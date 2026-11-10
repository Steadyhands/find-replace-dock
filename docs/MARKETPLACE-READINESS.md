# Find & Replace Dock — Marketplace Readiness Review

Reviewed candidate: v0.3.7. Status: **NOT YET APPROVED FOR PUBLICATION**.

## Completed

- Preserved v0.3.7 runtime JavaScript unchanged.
- Updated Marketplace description, keywords and licence metadata.
- Corrected README Find tab controls (List Lines instead of removed Highlight All button).
- Included source, existing regex tests, and manual acceptance checklist.
- Verified packaged source syntax and regex regression assertions.

## Publication Blockers

1. Replace `local-tools` publisher with an actual Marketplace publisher ID. This changes extension identity; plan saved-pattern migration.
2. Confirm legal copyright attribution in LICENSE. Do not publish with an unverified owner.
3. Establish a real support URL or issue-reporting contact and add it to the manifest and README.
4. Test Find Results view registration and clickable navigation in a clean VS Code profile on Windows, plus at least one other platform if claiming cross-platform support.
5. Test multi-file preview, modified-file rejection, selected replacements, undo and repeated Apply.
6. Perform security review of expensive regex patterns and document the risk; synchronous JS regex has no execution timeout.
7. Run the official `@vscode/vsce` packager and inspect its package list and warnings before upload.
8. Add genuine application screenshots with captions; avoid private filenames and document content.
9. Verify compatibility with the declared minimum VS Code version (`^1.85.0`) or raise it to the oldest actually tested release.
10. Decide how saved patterns and history should migrate when changing publisher identity.

## Review Notes

- Main and results webviews have CSP and localResourceRoots restrictions; review all webview message types for strict input validation.
- File replacement can alter user data. Test previews against changed buffers and ensure errors are surfaced.
- No claim of full accessibility compliance is made; test keyboard-only use, high contrast, screen readers and 200% scaling.
- The current package uses a hand-built VSIX; prefer the official `vsce package` for the Marketplace candidate.
- Do not claim complete absence of security vulnerabilities based only on static inspection.

## References

- https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- https://code.visualstudio.com/api/references/extension-manifest
- https://code.visualstudio.com/api/working-with-extensions/testing-extension
