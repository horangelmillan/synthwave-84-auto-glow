# Fork: SynthWave '84 Auto-Glow

Fork de [robb0wen/synthwave-vscode](https://github.com/robb0wen/synthwave-vscode) (MIT, (c) 2019 Robb Owen).
Se mantiene `LICENSE` original intacto como exige la licencia.

## Qué cambia vs original 0.1.20

Problema original: cada update de VS Code sobrescribe
`app/out/vs/code/electron-*/workbench/workbench*.html` y borra la
inyección `<script src="neondreams.js">`. La extensión original solo
activaba con `onCommand`, así que nunca lo detectaba y tocaba hacer
`Ctrl+Shift+P > Enable Neon Dreams` a mano.

Este fork:
1. `activationEvents` añade `onStartupFinished`.
2. Guarda en `globalState` si el usuario tenía neon activado + versión de VS Code.
3. Al iniciar (2s delay), si estaba activado pero el HTML ya no tiene la inyección
   o cambió la versión, lo re-aplica solo y pide `Reload` una vez.
4. Nuevo setting `synthwave84.autoEnableOnStartup` (default `true`).
   Si `false`, solo muestra aviso con botón para re-activar.
5. Lógica de `enable` extraída a `applyNeon()` reutilizable + `patchHtml()` idempotente (verificado).

No se puede evitar que VS Code borre el parche — es por integridad —,
pero ya no tienes que acordarte: se auto-repara.

## Probar local

```powershell
npm install -g @vscode/vsce
vsce package
code --install-extension synthwave-84-auto-glow-0.2.0.vsix
```

Luego: `Enable Neon Dreams` una vez. A partir de ahí, cada update se auto-restaura.

## Publicar como tuyo

1. Crea repo nuevo en GitHub (ej. `tu-usuario/synthwave-84-auto-glow`).
2. En esta carpeta:
   ```powershell
   git remote remove origin
   git remote add origin https://github.com/tu-usuario/synthwave-84-auto-glow.git
   # cambia publisher en package.json a tu publisher de Marketplace
   ```
3. Mantén atribución a Robb Owen en README + LICENSE (obligatorio MIT).
