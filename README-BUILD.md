# Build And Publication Preparation

This repository contains the v0.3.9 extension source and release-preparation documents.

## Checks

From the repository root, with Node.js installed:

```powershell
npm test
npm run check
```

## Package A VSIX

Install the official VS Code extension packager, then package from the repository root:

```powershell
npm install -g @vscode/vsce
vsce ls
vsce package
```

Review the files listed by `vsce ls` and complete `docs/ACCEPTANCE-TESTS.md` before publication. The `local-tools` publisher ID remains a placeholder and must be changed only after registering the intended Marketplace publisher. Changing publisher identity may affect access to existing stored settings.
