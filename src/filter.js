function wildcardMatch(text, pattern) {
  // escape regex metachars, then replace * → .*
  const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$', 'i');
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
    const idMatches      = !f.msgId          || ctx.messageId === f.msgId;
    const detailsMatches = !f.detPattern     || wildcardMatch(ctx.details, f.detPattern);
    const locMatches     = !f.locationPattern|| ctx.location === f.locationPattern;
    return fileMatches && idMatches && detailsMatches && locMatches;
  });
}

module.exports = { wildcardMatch, shouldSkipIssue };
