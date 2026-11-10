## 0.3.9

- Display zero-match search messages in #700000 in Find & Replace Dock and the Find Results summary.
- Preserve other status colours and existing search behaviour.

## 0.3.8

- Preserve search options when the dock webview is recreated; avoid saving default checkbox values during initialisation.
- Use consistent neutral styling for Next and Replace Once.
- Shorten the checkbox label to Regular expressions; document JavaScript syntax in its tooltip.
- Clarify that loading a saved pattern restores its search options.

## 0.3.7
- Display the filename once in the Find Results status line for a single file.
- Group multi-file results by filename, with aligned line numbers and full-line scrolling.
- No changes to search, snapshot or navigation logic.

## 0.3.6

- Open the Find Results view container using its registered workbench command, rather than a nonexistent view focus command.
- Reveal and republish the snapshot when the results view is available.

## 0.3.3 — Maintenance, Documentation And Security

- Shared regex rules for single-file and multi-file searches.
- Added source documentation and regex regression tests.
- Strengthened webview CSP nonces and message validation.
- Limited imported pattern libraries to 1 MB and 1,000 entries.
- Prevented applying a successful multi-file replacement preview twice.
- Rewrote README with usage, accessibility, privacy and limitations.
- No intentional user-interface or keyboard shortcut changes.

## 0.3.2

- Fixed line-start (`^`) and line-end (`$`) regex matching across document lines in Find, Replace and multi-file searches.
- Added regression checks for multiline anchors, case sensitivity and literal searches.

## 0.3.1

- Fixed tab switching so the selected tab displays its corresponding controls.
- Retained the fully renamed extension ID and existing functionality.

## 0.3.0

- Renamed to Find & Replace Dock; retained extension identifier and saved data.
- Improved theme colours, compact layout, keyboard focus and accessible tab semantics.
- Added 10–40 px font-size spinner in 1 px increments.
- Preserved VS Code Ctrl+F and Ctrl+H shortcuts.

## 0.2.1

- Added 26, 28 and 30 px Find/Replace font sizes.
- Added Saved Patterns with optional replacement pairs, management and JSON import/export.
- Kept search and replacement execution unchanged.

# Changelog

## 0.2.0 — Multi-File Search and Replacement

- Add Find in Files and Replace in Files tabs.
- Default multi-file scope to all open files; offer workspace and folder scopes.
- Add file filters, clickable results and selective replacement previews.
- Remove third-party editor references from documentation.

## 0.1.4 — Documentation and Packaging

- Include README and MIT licence inside the installed VSIX.
- Add release history and a custom extension icon.
- Preserve the working v0.1.3 Find/Replace implementation without code changes.

## 0.1.3 — Font Size

- Add a persistent font-size selector for the Find and Replace text boxes.

## 0.1.2 — Webview Fix

- Fix a webview JavaScript syntax error introduced in 0.1.1.

## 0.1.1 — History

- Add in-panel history dropdowns and persistent search and replacement history.

## 0.1.0 — Initial Release

- Find and Replace tabs, individual and bulk replacements, scopes, regex options and highlighting.

## 0.3.4
- Added Find Results panel with full-line snapshot listings, clickable navigation, Refresh and Clear.
- Replaced redundant Highlight All button with List Lines; retained Highlight All Matches checkbox.
- Detects stale document versions before navigation.

## 0.3.5
- Fixed List Lines failing with an unknown VS Code panel focus command.
