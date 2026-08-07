// Locations are rendered with break opportunities so they wrap in the summary
// table, and users copy them straight out of that output into a filter rule.
// Depending on where they copy from, the rule can pick up artefacts of that
// rendering: a `<wbr>` when copied from the markdown source, or an invisible
// zero-width space when copied from the console of an older release. Normalize
// both sides before comparing, otherwise such a rule silently never matches and
// the user cannot see why (#20).
const RENDER_ARTEFACTS = /<wbr\s*\/?>|[​-‍﻿]/gi;

function normalizeLocation(text) {
  return text.replace(RENDER_ARTEFACTS, '');
}

function wildcardMatch(text, pattern) {
  // escape regex metachars, then replace * → [\s\S]* so wildcards match across line breaks
  const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp('^' + escaped.replace(/\*/g, '[\\s\\S]*') + '$', 'i');
  return regex.test(text);
}

/**
 * Decide whether an issue should be skipped (“known issue”) based on filters.
 * @param {Object} ctx           - Context: { fileName, location, messageId, details }
 * @param {Array<{fileName:string,msgId:string,detPattern:string,locationPattern:string}>} filtersArr
 * @returns {boolean}            - true = skip this issue
 */
function shouldSkipIssue(ctx, filtersArr) {
  if (!filtersArr.length) return false;

  return filtersArr.some(f => {
    const fileMatches    = !f.fileName       || ctx.fileName === f.fileName;
    const idMatches      = !f.msgId          || ctx.messageId.toLowerCase() === f.msgId.toLowerCase();
    const detailsMatches = !f.detPattern      || wildcardMatch(ctx.details, f.detPattern);
    const locMatches     = !f.locationPattern || wildcardMatch(normalizeLocation(ctx.location), normalizeLocation(f.locationPattern));
    const matches = fileMatches && idMatches && detailsMatches && locMatches;
    if (matches) {
      f.matched = true;
    }
    return matches;
  });
}

module.exports = { wildcardMatch, shouldSkipIssue, normalizeLocation };
