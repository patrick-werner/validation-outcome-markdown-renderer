const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const { shouldSkipIssue } = require('./filter');

async function run() {
  try {
    // 1) Inputs
    const bundlePath = core.getInput('bundle-file', { required: true });
    const include = core.getInput('include') || 'errors';
    const rawFilters = core.getInput('filters')     || '';

    // 2) Parse filters: line-separated "fileName|messageId|detailsWildcard|location"
    //    Strip out full-line and inline comments beginning with "#"
    const filtersArr = rawFilters
      .split(/\r?\n/)
      .map(line => line.replace(/#.*/, '').trim()) // remove anything after "#" and trim
      .filter(Boolean)                             // drop empty/comment-only lines
      .map(entry => {
        const [ fileName, msgId, detPattern, locationPattern ] = entry.split('|').map(p => p?.trim() || '');
        return { fileName, msgId, detPattern, locationPattern };
      });

    // 3) Load and parse bundle
    const text = fs.readFileSync(bundlePath, 'utf8');
    const bundle = JSON.parse(text);

    // 4) Determine minimum severity index
    const sevOrder = ['error', 'warning', 'information'];
    let minIndex;
    switch (include) {
      case 'errors':
        minIndex = sevOrder.indexOf('error');
        break;
      case 'warnings':
        minIndex = sevOrder.indexOf('warning');
        break;
      case 'all':
        minIndex = sevOrder.indexOf('information');
        break;
      default:
        throw new Error(`Invalid include value: ${include}`);
    }

    // 5) Collect, filter & annotate issues
    const issues = [];
    let hasError = false;

    for (const entry of bundle.entry) {
      const res = entry.resource;
      const rawPath = (res.extension || [])
      .find(ext => ext.url === 'http://hl7.org/fhir/StructureDefinition/operationoutcome-file')
          ?.valueString || '(unknown file)';
      const fileName = path.basename(rawPath);

      const relevant = (res.issue || [])
        .filter(i => sevOrder.indexOf(i.severity) <= minIndex);

      for (const issue of relevant) {
        // extract location
        const expr = issue.expression;
        const locExt = issue.extension || [];
        const lineExt = locExt.find(e => e.url.endsWith('-line'));
        const colExt  = locExt.find(e => e.url.endsWith('-col'));
          let location = expr
            ? expr.join(', ')
            : (lineExt && colExt)
                ? `Line ${lineExt.valueInteger}, Column ${colExt.valueInteger}`
                : '(unknown location)';
        // inject zero-width spaces after dots for wrapping
          location = location.replace(/\./g, '.\u200B');

        // extract messageId & details
          const msgIdExt = locExt.find(e =>
            e.url === 'http://hl7.org/fhir/StructureDefinition/operationoutcome-message-id'
          );
          const messageId = msgIdExt?.valueCode || '';
        const details   = issue.details.text;
        const severity = issue.severity.toUpperCase();
        const code     = issue.code;

        // build context for filtering
        const ctx = { fileName, messageId, details, location };

        // skip if matches any "known issue" filter
        if (shouldSkipIssue(ctx, filtersArr)) {
          continue;
        }

          // annotate in logs
          const annot = `${fileName} | ${severity} | ${code} | ${location} | ${messageId} | ${details}`;
          if      (issue.severity === 'error')   core.error(annot);
          else if (issue.severity === 'warning') core.warning(annot);
          else                                   core.info(annot);

        if (issue.severity === 'error') hasError = true;

          // collect for summary
        issues.push({ fileName, severity, details, location, code, messageId });
      }
    }

    // 6) CI logic: fail if any ERROR remains after filtering
    const errorsLeft   = issues.filter(i => i.severity === 'ERROR').length;
    const warningsLeft = issues.filter(i => i.severity === 'WARNING').length;
    const hintsLeft    = issues.filter(i => i.severity === 'INFORMATION').length;

    if (errorsLeft > 0) {
      core.setFailed(`❌ FHIR Validation: ${errorsLeft} error(s) found after filtering.`);
    } else {
      core.info('✅ FHIR Validation: no errors found after filtering.');
    }

    // 7) GitHub Checks Summary
    const icons = { ERROR:'❌', WARNING:'⚠️', INFORMATION:'ℹ️' };
    const summary = core.summary;

    // Heading + counts paragraph
    summary.addHeading('FHIR Validation Results', 2);

    // counts paragraph
    const generatedISO = new Date().toISOString();
    summary.addRaw(
      `${errorsLeft} ${icons.ERROR} errors, ` +
      `${warningsLeft} ${icons.WARNING} warnings, ` +
      `${hintsLeft} ${icons.INFORMATION} hints. ` +
      `Generated ${generatedISO}`
    );

    // table: File | Severity | Details | Location | Code | MessageId
    const table = [
      ['File', 'Severity', 'Details', 'Location', 'Code', 'MessageId'],
      ...issues.map(i => [
        i.fileName,
        `${icons[i.severity] || ''} ${i.severity}`,
        i.details.replace(/\|/g, '\\|'),
        i.location,
        i.code,
        i.messageId
      ])
    ];
    summary.addTable(table);

    await summary.write();

  } catch (err) {
    core.setFailed(`Action failed: ${err.message}`);
  }
}

run();
