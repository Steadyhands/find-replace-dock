# Find & Replace Dock

A persistent, dockable Find and Replace interface for Visual Studio Code. Designed for deliberate editing: **Replace Once** changes a match and stays at the replacement until you choose to move on.

## Features

- **Find**: Next, Previous, Count All and List Lines.
- **Replace**: Replace Once (stay), Replace & Next and Replace All.
- **Find in Files**: search open files (default), a workspace or a selected folder.
- **Replace in Files**: review a selectable list of proposed changes before applying them.
- **Saved Patterns**: save Find-only patterns or Find/Replace pairs; rename, duplicate, update, delete, import and export them.
- **History**: recall previous search and replacement text independently.
- **Accessibility**: change Find/Replace text size from 10 to 40 px in 1 px steps without changing the editor font.
- Case-sensitive, whole-word and JavaScript regular-expression matching.

## Install And Open

In VS Code, open **Extensions** (`Ctrl+Shift+X`), choose **Install from VSIX…**, select the release package and reload if prompted. Open **Find & Replace Dock** from the Activity Bar or the Command Palette. Move the view to the Secondary Side Bar using its view title's context menu.

The extension leaves VS Code's normal `Ctrl+F` and `Ctrl+H` shortcuts unchanged.

## Everyday Editing

1. Open a text document and choose **Find** or **Replace**.
2. Enter a Find expression. In Replace, enter optional replacement text.
3. Choose Current file, Selected text or All open files (visible editors).
4. Use **Next** or **Previous** to inspect matches. **Count All** reports the number found.
5. **Replace Once** replaces one match and leaves the cursor at that location. **Replace & Next** also advances. **Replace All** applies every match in the chosen scope.

**Selected text:** first select a range in the editor. Switch to Current file and back to reset the stored selection.

**Note:** the single-file *All open files* option currently means **visible editors**. The separate Find in Files tab can search background open tabs.

## Regular Expressions

Enable **Regular expressions (JavaScript)** to use JavaScript regex syntax, including capture groups, lookarounds and Unicode property escapes. This is **not** the Perl engine. `^` and `$` work at each line boundary (multiline mode); case-insensitive searches add the `i` flag.

| Find | Replace | Result |
| --- | --- | --- |
| `^([a-z])` | (none) | Find lowercase letters at the start of lines |
| `(foo)(bar)` | `$2$1` | Change `foobar` to `barfoo` |
| `\b([0-9]+) miles\b` | `$1 mi` | Change `12 miles` to `12 mi` |

Check replacements carefully when using lookarounds, zero-length matches or complex patterns. Some JavaScript regexes can take a long time to evaluate. Match-count limits are not time limits.

## Searching And Replacing In Files

Select **Find in Files** or **Replace in Files**. The default scope is **All open files**; choose **Current workspace** or **Selected folder** if needed. Enter a file filter such as `**/*.md` and start the search.

The results open in a separate editor tab. In Replace in Files, inspect the original and proposed text, uncheck unwanted results, then select **Apply Selected Replacements**. A changed document version blocks stale preview application; successful previews cannot be applied twice. You should still review changes and retain backups for important files.

Workspace search excludes `.git` and `node_modules`. Searches are capped at 10,000 files and 20,000 results; single-document searches are capped at 50,000 matches.

## Saved Patterns And History

**Save Current** stores the current Find expression, optional Replace text and matching options. Selecting a saved pattern only fills the controls: **it never runs a search or replacement automatically**. Use **Manage…** to edit, duplicate, rename or delete entries. **Import…** and **Export…** exchange a versioned JSON library.

Imported libraries must contain version 1 and no more than 1,000 entries; imports are limited to 1 MB. The library and history persist in VS Code extension storage. The extension does not transmit document contents or patterns to a remote service and has no telemetry feature.

## Keyboard And Accessibility

- `Tab` / `Shift+Tab`: navigate controls.
- Arrow keys while focused on the tab strip: switch tabs.
- `Enter` / `Shift+Enter` in Find/Replace fields: Next / Previous.
- `Escape` in a search field: return focus to the editor.
- Use the compact **− / +** control or type a number to set font size (10–40 px).

The fields accept multiline content, but pressing Enter triggers Find Next; use pasted line breaks when entering multiline patterns.

## Troubleshooting

- **No matches for `^` or `$`:** confirm regex is enabled; this was fixed in v0.3.2.
- **No results in Selected text:** select text in the editor, then reset the scope if needed.
- **Unexpected regex error:** verify JavaScript syntax, not Perl-only features.
- **No matching files:** check the scope, file filter and open workspace.
- **Stale replacement preview:** rerun the search after editing a source file.
- **Interface appears stuck:** reload the VS Code window and check the installed version.

## Privacy And Security

The extension works locally through VS Code's document and filesystem APIs. It does not execute imported patterns as JavaScript, download remote scripts or send telemetry. The webviews have restrictive Content Security Policies. Multi-file replacement requires an explicit preview and Apply action.

**Limitations:** JavaScript regex evaluation can block the extension host for expensive expressions; it has no guaranteed execution timeout. Be cautious with untrusted patterns. Previewing does not replace a file backup, and a VS Code undo operation may be needed to revert changes.

## Source, Maintenance And Licence

The VSIX includes the extension's JavaScript source (`extension.js`, `multi.js`, `regex.js`) and documentation. The separate source archive contains tests and rebuilding instructions. You do not need Git to maintain local versioned releases.

MIT licence. See `LICENSE` and `CHANGELOG.md`. The publisher identity is currently a local development placeholder and must be confirmed before publication.

## List Lines (Find Results)

On the **Find** tab, select **List Lines** to capture one result for each matching line. Results appear in a separate **Find Results** panel, initially in the bottom panel area. Each result displays its original file, line number and complete line text; the panel supports horizontal scrolling for long lines. Select a result to navigate to its source. **Refresh** repeats the captured search; **Clear** empties the list. New List Lines searches replace the previous snapshot. Results are not live; when a document has changed since capture, navigation is blocked until you refresh, preventing inaccurate jumps. The existing **Highlight all matches** checkbox controls highlighting independently.

## Support And Feedback

Before public release, the publisher must provide a support channel for reproducible bug reports. Include the VS Code version, extension version, search scope, anonymised sample text, expected result and actual result. Do not submit confidential document contents.
