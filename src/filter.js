// filter.js
function wildcardMatch(text, pattern) {
  // escape regex metachars, then replace * → .*
  const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp('^' + escaped.replace(/\*/g, '.*') + '$', 'i');
  return regex.test(text);
}

/**
 * Decide whether an issue should be excluded (“known issue”) based on filters.
 * @param {Object} issue         - The OperationOutcome.issue object
 * @param {Array<{msgId:string,detPattern:string}>} filtersArr
 * @returns {boolean}            - true = skip this issue
 */
function shouldSkipIssue(issue, filtersArr) {
  if (!filtersArr.length) return false;

  // extract messageId from extensions
  const msgIdExt = (issue.extension || [])
  .find(e => e.url === 'http://hl7.org/fhir/StructureDefinition/operationoutcome-message-id');
  const messageId = msgIdExt?.valueCode || '';

  const details = issue.details?.text || '';

  return filtersArr.some(f => {
    const idMatches    = !f.msgId       || messageId === f.msgId;
    const detailsMatch = !f.detPattern  || wildcardMatch(details, f.detPattern);
    return idMatches && detailsMatch;
  });
}

module.exports = { wildcardMatch, shouldSkipIssue };
