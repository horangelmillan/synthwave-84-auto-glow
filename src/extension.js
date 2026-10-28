const path = require('path');
const fs = require('fs');
const vscode = require('vscode');

// Centralise errors & info messages to keep activation code clean
const messages = {
	ACTIVATED: "Neon Dreams enabled. VS code must reload for this change to take effect. Code may display a warning that it is corrupted, this is normal. You can dismiss this message by choosing 'Don't show this again' on the notification.",
	DEACTIVATED: `Neon Dreams disabled. VS code must reload for this change to take effect`,
	REACTIVATED: "Neon dreams is already enabled. Reload to refresh JS settings.",
	AUTO_RESTORED: "VS Code update detected: Neon Dreams glow was wiped. It has been re-applied. Reload to restore the glow.",
	AUTO_FAILED: "VS Code update wiped Neon Dreams glow and auto-restore failed. Run 'Synthwave '84: Enable Neon Dreams' manually (may need admin rights).",
	NOT_RUNNING: `Neon dreams isn't running.`,
	ERROR_ACCESS_DENIED: "Neon Dreams was unable to modify the core VS code files needed to launch the extension. You may need to run VS code with admin privileges in order to enable Neon Dreams.",
	ERROR_WORKBENCH_NOT_FOUND: "Neon Dreams could not find the workbench HTML file. This is likely due to a change in VS Code's internal structure. Please open an issue on the Synthwave '84 GitHub repository to report this.",
	ERROR_GENERIC: "Something went wrong when starting neon dreams"
};

const STATE_ENABLED = 'synthwave84.neonEnabled';
const STATE_VSCODE_VERSION = 'synthwave84.lastVscodeVersion';

function getNeonConfig() {
	const config = vscode.workspace.getConfiguration("synthwave84");
	const disableGlow = config && config.disableGlow ? !!config.disableGlow : false;
	const autoEnable = config && typeof config.autoEnableOnStartup === 'boolean' ? config.autoEnableOnStartup : true;
	let brightness = config ? parseFloat(config.brightness) : 0.45;
	if (!(brightness <= 1)) brightness = 1;
	if (!(brightness >= 0)) brightness = 0;
	if (isNaN(brightness)) brightness = 0.45;
	const neonBrightness = Math.floor(brightness * 255).toString(16).toUpperCase().padStart(2, '0');
	return { disableGlow, autoEnable, neonBrightness };
}

function buildThemeFile(disableGlow, neonBrightness) {
	const chromeStyles = fs.readFileSync(path.join(__dirname, 'css', 'editor_chrome.css'), 'utf-8');
	const jsTemplate = fs.readFileSync(path.join(__dirname, 'js', 'theme_template.js'), 'utf-8');
	return jsTemplate
		.replace(/\[DISABLE_GLOW\]/g, disableGlow)
		.replace(/\[CHROME_STYLES\]/g, chromeStyles)
		.replace(/\[NEON_BRIGHTNESS\]/g, neonBrightness);
}

function patchHtml(html) {
	const cleaned = html.replace(/^.*(<!-- SYNTHWAVE 84 --><script src="neondreams.js"><\/script><!-- NEON DREAMS -->).*\n?/mg, '');
	const withTag = cleaned.replace(/\<\/html\>/g, `\t<!-- SYNTHWAVE 84 --><script src="neondreams.js"></script><!-- NEON DREAMS -->\n`);
	return withTag + '</html>';
}

// Returns { htmlFile, templateFile } or null if workbench not found.
function resolveTargetFiles() {
	const appDir = path.dirname(vscode.env.appRoot);
	const base = path.join(appDir, 'app', 'out', 'vs', 'code');
	const workbenchPaths = resolveWorkbenchPaths(base);
	if (!workbenchPaths) return null;
	const [electronBase, workBenchFilename] = workbenchPaths;
	return {
		htmlFile: path.join(base, electronBase, "workbench", workBenchFilename),
		templateFile: path.join(base, electronBase, "workbench", "neondreams.js")
	};
}

function isNeonInjected(htmlFile) {
	try {
		const html = fs.readFileSync(htmlFile, "utf-8");
		return html.includes("neondreams.js");
	} catch {
		return false;
	}
}

// Core enable logic shared by manual command + auto-restore.
// Returns 'enabled' | 'already' and throws on error.
function applyNeon({ disableGlow, neonBrightness }) {
	const targets = resolveTargetFiles();
	if (!targets) {
		throw Object.assign(new Error(messages.ERROR_WORKBENCH_NOT_FOUND), { code: 'WORKBENCH_NOT_FOUND' });
	}
	const finalTheme = buildThemeFile(disableGlow, neonBrightness);
	fs.writeFileSync(targets.templateFile, finalTheme, "utf-8");

	const html = fs.readFileSync(targets.htmlFile, "utf-8");
	const isEnabled = html.includes("neondreams.js");
	if (!isEnabled) {
		fs.writeFileSync(targets.htmlFile, patchHtml(html), "utf-8");
		return 'enabled';
	}
	// Refresh theme file even if tag exists (brightness / chrome may have changed)
	return 'already';
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	const enableCmd = vscode.commands.registerCommand('synthwave84.enableNeon', function () {
		const cfg = getNeonConfig();
		try {
			const result = applyNeon(cfg);
			context.globalState.update(STATE_ENABLED, true);
			context.globalState.update(STATE_VSCODE_VERSION, vscode.version);
			const msg = result === 'enabled' ? messages.ACTIVATED : messages.REACTIVATED;
			vscode.window
				.showInformationMessage(msg, { title: "Restart editor to complete" })
				.then(() => vscode.commands.executeCommand("workbench.action.reloadWindow"));
		} catch (e) {
			handleApplyError(e);
		}
	});

	const disableCmd = vscode.commands.registerCommand('synthwave84.disableNeon', () => {
		uninstall(context);
	});

	context.subscriptions.push(enableCmd, disableCmd);

	// Auto-restore after VS Code updates (which wipe workbench.html).
	// Runs on startup; only acts if user previously enabled neon.
	setTimeout(() => checkAndRestore(context).catch(() => {}), 2000);
}

async function checkAndRestore(context) {
	const wasEnabled = context.globalState.get(STATE_ENABLED, false);
	if (!wasEnabled) return;

	const lastVersion = context.globalState.get(STATE_VSCODE_VERSION, null);
	const cfg = getNeonConfig();
	const targets = resolveTargetFiles();
	if (!targets) return; // can't determine; manual command will surface error

	const injected = isNeonInjected(targets.htmlFile);
	const versionChanged = lastVersion !== null && lastVersion !== vscode.version;

	// If still injected and version unchanged, nothing to do.
	if (injected && !versionChanged) {
		// Keep version fresh
		if (lastVersion !== vscode.version) {
			await context.globalState.update(STATE_VSCODE_VERSION, vscode.version);
		}
		return;
	}
	// If injected but version changed, template may be wiped -> refresh silently
	// If not injected -> update wiped our patch -> restore.

	if (!cfg.autoEnable) {
		const choice = await vscode.window.showWarningMessage(
			"SynthWave '84: VS Code update disabled the Neon glow.",
			"Re-enable Neon Dreams"
		);
		if (choice) vscode.commands.executeCommand('synthwave84.enableNeon');
		return;
	}

	try {
		applyNeon(cfg);
		await context.globalState.update(STATE_VSCODE_VERSION, vscode.version);
		const choice = await vscode.window.showInformationMessage(
			messages.AUTO_RESTORED,
			{ title: "Reload now" },
			{ title: "Later" }
		);
		if (choice && choice.title === "Reload now") {
			vscode.commands.executeCommand("workbench.action.reloadWindow");
		}
	} catch (e) {
		if (e && e.code === 'WORKBENCH_NOT_FOUND') {
			vscode.window.showErrorMessage(messages.ERROR_WORKBENCH_NOT_FOUND);
		} else if (e && /ENOENT|EACCES|EPERM/.test(e.code || '')) {
			vscode.window.showWarningMessage(messages.AUTO_FAILED);
		} else {
			vscode.window.showWarningMessage(messages.AUTO_FAILED);
		}
	}
}

function handleApplyError(e) {
	if (e && e.code === 'WORKBENCH_NOT_FOUND') {
		vscode.window.showErrorMessage(messages.ERROR_WORKBENCH_NOT_FOUND);
		return;
	}
	if (e && /ENOENT|EACCES|EPERM/.test(e.code || '')) {
		vscode.window.showInformationMessage(messages.ERROR_ACCESS_DENIED);
		return;
	}
	vscode.window.showErrorMessage(messages.ERROR_GENERIC);
}

// this method is called when your extension is deactivated
function deactivate() {
	// ...
}

function uninstall(context) {
	const targets = resolveTargetFiles();
	if (!targets) {
		vscode.window.showErrorMessage(messages.ERROR_WORKBENCH_NOT_FOUND);
		return;
	}
	try {
		const html = fs.readFileSync(targets.htmlFile, "utf-8");
		const isEnabled = html.includes("neondreams.js");
		if (isEnabled) {
			const output = html.replace(/^.*(<!-- SYNTHWAVE 84 --><script src="neondreams.js"><\/script><!-- NEON DREAMS -->).*\n?/mg, '');
			fs.writeFileSync(targets.htmlFile, output, "utf-8");
			if (context) {
				context.globalState.update(STATE_ENABLED, false);
			}
			vscode.window
				.showInformationMessage(messages.DEACTIVATED, { title: "Restart editor to complete" })
				.then(() => vscode.commands.executeCommand("workbench.action.reloadWindow"));
		} else {
			if (context) context.globalState.update(STATE_ENABLED, false);
			vscode.window.showInformationMessage(messages.NOT_RUNNING);
		}
	} catch (e) {
		if (/ENOENT|EACCES|EPERM/.test(e.code)) {
			vscode.window.showInformationMessage(messages.ERROR_ACCESS_DENIED);
			return;
		} else {
			vscode.window.showErrorMessage(messages.ERROR_GENERIC);
			return;
		}
	}
}

// Find the workbench HTML file and electron base directory.
// Returns an array with the electron base directory and the workbench HTML filename.
// If not found, returns null.
function resolveWorkbenchPaths(base) {
	const electronBaseCandidates = [
		// v1.70-, v1.102+
		"electron-browser",
		// v1.70 ~ v1.102
		"electron-sandbox",
	];

	const htmlCandidates = [
		// v1.94.0
		"workbench.esm.html",
		// other
		"workbench.html",
	];

	for (const electronBase of electronBaseCandidates) {
		for (const htmlFile of htmlCandidates) {
			if (fs.existsSync(path.join(base, electronBase, "workbench", htmlFile))) {
				return [electronBase, htmlFile];
			}
		}
	}

	return null;
}

module.exports = {
	activate,
	deactivate,
	// exported for tests
	_resolveWorkbenchPaths: resolveWorkbenchPaths,
	_patchHtml: patchHtml,
	_buildThemeFile: buildThemeFile
};
