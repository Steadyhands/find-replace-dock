'use strict';
/**
 * Shared matching rules for the editor and multi-file search engines.
 *
 * JavaScript's `m` flag is essential: ^ and $ must address every line, not
 * merely the beginning/end of the whole document (regression fixed in 0.3.2).
 * The `u` flag enables Unicode property escapes for whole-word boundaries.
 * Patterns are user supplied, never evaluated as JavaScript source code.
 */
const MAX_EXPRESSION_LENGTH = 20000;
const MAX_REPLACEMENT_LENGTH = 20000;
function escapeRegex(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function validateState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw Error('Invalid search request.');
  if (typeof state.find !== 'string' || state.find.length > MAX_EXPRESSION_LENGTH) throw Error('Find expression exceeds the 20,000-character limit.');
  if (typeof state.replace !== 'string' || state.replace.length > MAX_REPLACEMENT_LENGTH) throw Error('Replacement exceeds the 20,000-character limit.');
  for (const field of ['regex', 'whole', 'case', 'highlight']) if (typeof state[field] !== 'boolean') throw Error('Invalid '+field+' option.');
}
function patternSource(state) {
  const pattern = state.regex ? state.find : escapeRegex(state.find);
  return state.whole ? `(?<![\\p{L}\\p{N}_])(?:${pattern})(?![\\p{L}\\p{N}_])` : pattern;
}
function makeRegex(state) {
  validateState(state);
  if (!state.find) return null;
  return new RegExp(patternSource(state), 'gmu' + (state.case ? '' : 'i'));
}
/** Expand JavaScript replacement tokens using the same whole-word boundaries. */
function replacement(state, matchedText) {
  const anchored = new RegExp('^(?:' + patternSource(state) + ')$', 'u' + (state.case ? '' : 'i'));
  return matchedText.replace(anchored, state.replace);
}
/** Advance past an empty match without splitting a UTF-16 surrogate pair. */
function advanceEmpty(regex, text) {
  if (regex.lastIndex >= text.length) return false;
  const cp = text.codePointAt(regex.lastIndex);
  regex.lastIndex += cp > 0xffff ? 2 : 1;
  return true;
}
module.exports = { escapeRegex, validateState, patternSource, makeRegex, replacement, advanceEmpty, MAX_EXPRESSION_LENGTH, MAX_REPLACEMENT_LENGTH };
