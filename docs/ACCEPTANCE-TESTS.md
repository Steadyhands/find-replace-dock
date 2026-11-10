# Manual Acceptance Tests

Use a disposable workspace and sample Markdown files. Record PASS/FAIL and VS Code version for each item.

- [ ] Install cleanly using VSIX; no activation errors in Extension Host log
- [ ] Find, Replace, Find in Files and Replace in Files tabs all switch
- [ ] Ctrl+F and Ctrl+H remain native editor shortcuts
- [ ] Keyboard-only tab navigation, Enter/Shift+Enter and Escape behave as documented
- [ ] Font spinner works 10–40 px, one-pixel increments, and persists
- [ ] Search `^([a-z])` finds lowercase initial on later lines
- [ ] Test `text$`, capture groups, lookarounds, Unicode fractions, invalid regex
- [ ] Replace Once stays at replaced text; Replace & Next advances
- [ ] Count All agrees with native Find on known sample
- [ ] List Lines opens docked results, displays full lines and correct count
- [ ] Single-file results show filename once; multi-file results grouped
- [ ] Clicking results navigates to original correct match
- [ ] Refresh replaces snapshot; Clear empties it; stale results handled safely
- [ ] Saved Patterns add, rename, duplicate, delete, import/export and persist
- [ ] Import rejects invalid and oversized JSON; does not execute imported patterns
- [ ] Find in Files scopes: open files, workspace, chosen folder; filters work
- [ ] Replace in Files preview only selected edits, detects stale documents, cannot reapply
- [ ] Undo changes after multi-file replacement; check unsaved buffer behaviour
- [ ] Light, dark and high-contrast themes; 200% display scaling
- [ ] Test large files and pathological regex without risking important documents
- [ ] Reopen VS Code and verify persisted settings and panel location
