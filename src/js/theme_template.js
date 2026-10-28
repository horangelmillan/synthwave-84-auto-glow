(function () {
  //====================================
  // Theme replacement CSS (Glow styles)
  //====================================
  const tokenReplacements = {
    /* Red */
    'fe4450': "color: #fff5f6; text-shadow: 0 0 2px #000, 0 0 10px #fc1f2c[NEON_BRIGHTNESS], 0 0 5px #fc1f2c[NEON_BRIGHTNESS], 0 0 25px #fc1f2c[NEON_BRIGHTNESS]; backface-visibility: hidden;",
    /* Neon pink */
    'ff7edb': "color: #f92aad; text-shadow: 0 0 2px #100c0f, 0 0 5px #dc078e33, 0 0 10px #fff3; backface-visibility: hidden;",
    /* Yellow */
    'fede5d': "color: #f4eee4; text-shadow: 0 0 2px #393a33, 0 0 8px #f39f05[NEON_BRIGHTNESS], 0 0 2px #f39f05[NEON_BRIGHTNESS]; backface-visibility: hidden;",
    /* Green */
    '72f1b8': "color: #72f1b8; text-shadow: 0 0 2px #100c0f, 0 0 10px #257c55[NEON_BRIGHTNESS], 0 0 35px #212724[NEON_BRIGHTNESS]; backface-visibility: hidden;",
    /* Blue */
    '36f9f6': "color: #fdfdfd; text-shadow: 0 0 2px #001716, 0 0 3px #03edf9[NEON_BRIGHTNESS], 0 0 5px #03edf9[NEON_BRIGHTNESS], 0 0 8px #03edf9[NEON_BRIGHTNESS]; backface-visibility: hidden;"
  };

  console.log("Synthwave '84: neondreams.js loaded (fork auto-glow)");

  //=============================
  // Helper functions
  //=============================

  /**
   * @summary Check if the style element exists and that it has synthwave '84 color content
   */
  const themeStylesExist = (tokensEl, replacements) => {
    return tokensEl && tokensEl.innerText !== '' &&
      Object.keys(replacements).every(color => {
        return tokensEl.innerText.toLowerCase().includes(`#${color}`);
      });
  };

  const replaceTokens = (styles, replacements) => Object.keys(replacements).reduce((acc, color) => {
    const re = new RegExp(`color: #${color};`, 'gi');
    return acc.replace(re, replacements[color]);
  }, styles);

  /**
   * @summary Checks if the theme is synthwave (fork-compat: any synthwave class)
   */
  const usingSynthwave = () => {
    const synthWaveTheme = document.querySelector('[class*="synthwave"]');
    if (!synthWaveTheme) return false;
    const appliedTheme = document.querySelector('[class*="theme-json"]')
      || document.querySelector('.vscode-tokens-styles');
    return !!appliedTheme;
  }

  const readyForReplacement = (tokensEl, tokenReplacements) => tokensEl
    ? (usingSynthwave() && themeStylesExist(tokensEl, tokenReplacements))
    : false;

  const appendStyleTag = (cssText, tagId) => {
    if (document.querySelector('#' + tagId)) return false;
    const tag = document.createElement('style');
    tag.setAttribute('id', tagId);
    tag.innerText = cssText.replace(/(\r\n|\n|\r)/gm, '');
    document.body.appendChild(tag);
    return true;
  };

  /**
   * @summary Fallback: inject static .mtk glow rules without token detection.
   * Used when VS Code changes .vscode-tokens-styles format (e.g. 1.143+).
   */
  const injectFallbackGlow = (disableGlow, reason) => {
    if (document.querySelector('#synthwave-84-theme-styles')) return;
    const fallback = `[GLOW_FALLBACK_STYLES]`;
    const chrome = `[CHROME_STYLES]`;
    const css = disableGlow ? chrome : (fallback + chrome);
    if (appendStyleTag(css, 'synthwave-84-theme-styles')) {
      console.log("Synthwave '84: NEON DREAMS initialised via FALLBACK (" + reason + ")");
    }
  };

  const initNeonDreams = (disableGlow, obs) => {
    const tokensEl = document.querySelector('.vscode-tokens-styles');

    if (!tokensEl || !readyForReplacement(tokensEl, tokenReplacements)) {
      return;
    }

    if (!document.querySelector('#synthwave-84-theme-styles')) {
      const initialThemeStyles = tokensEl.innerText;
      let updatedThemeStyles = !disableGlow
        ? replaceTokens(initialThemeStyles, tokenReplacements)
        : initialThemeStyles;
      updatedThemeStyles = `${updatedThemeStyles}[CHROME_STYLES]`;
      appendStyleTag(updatedThemeStyles, 'synthwave-84-theme-styles');
      console.log('Synthwave \'84: NEON DREAMS initialised!');
    }

    if (obs) {
      obs.disconnect();
      obs = null;
    }
    clearTimeout(fallbackTimer);
  };

  const watchForBootstrap = function(mutationsList, observer) {
    for(let mutation of mutationsList) {
      if (mutation.type === 'attributes' || mutation.type === 'childList') {
        const tokensEl = document.querySelector('.vscode-tokens-styles');
        if (readyForReplacement(tokensEl, tokenReplacements)) {
          initNeonDreams([DISABLE_GLOW], observer);
        } else {
          if (tokensEl) {
            observer.disconnect();
            observer.observe(tokensEl, { childList: true, characterData: true, subtree: true });
          }
        }
      }
    }
  };

  //=============================
  // Start bootstrapping!
  //=============================
  const bodyNode = document.querySelector('body');
  const observer = new MutationObserver(watchForBootstrap);
  observer.observe(bodyNode, { attributes: true, childList: true, subtree: true });

  // Try once immediately in case DOM is already ready
  try { initNeonDreams([DISABLE_GLOW], null); } catch (e) {
    console.log("Synthwave '84: immediate init failed, waiting for mutations");
  }

  // Fallback timer: if token detection never succeeds (new VS Code internals),
  // still inject static glow so the user sees neon instead of nothing.
  const fallbackTimer = setTimeout(() => {
    if (document.querySelector('#synthwave-84-theme-styles')) return;
    const hasTokensEl = !!document.querySelector('.vscode-tokens-styles');
    const hasSynthClass = !!document.querySelector('[class*="synthwave"]');
    const tokensTxt = hasTokensEl
      ? (document.querySelector('.vscode-tokens-styles').innerText || '').slice(0, 120)
      : '(no tokens el)';
    console.log("Synthwave '84: token path failed"
      + " tokensEl=" + hasTokensEl
      + " synthClass=" + hasSynthClass
      + " sample=" + JSON.stringify(tokensTxt));
    injectFallbackGlow([DISABLE_GLOW], 'token-detection-timeout');
  }, 5000);
})();
