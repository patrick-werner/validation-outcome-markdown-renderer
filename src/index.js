const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const { shouldSkipIssue } = require('./filter');

async function run() {
  try {
    // 1) Read inputs
    const bundlePath = core.getInput('bundle-file', { required: true });
    const include = core.getInput('include') || 'errors';
    const rawFilters = core.getInput('filters')     || '';

    // 2) Parse filters: line-separated "fileName|messageId|detailsWildcard|location"
    //    Remove full-line and inline comments starting with "#"
    const filtersArr = rawFilters
      .split(/\r?\n/)
      .map(line => line.replace(/#.*/, '').trim())
      .filter(Boolean)
      .map(entry => {
        const [ fileName, msgId, detPattern, locationPattern ] = entry.split('|').map(p => p?.trim() || '');
        return { fileName, msgId, detPattern, locationPattern };
      });

    // 3) Load and parse the OperationOutcome bundle
    const text = fs.readFileSync(bundlePath, 'utf8');
    const bundle = JSON.parse(text);

    // 4) Determine minimum severity based on 'include'
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

    // 5) Collect issues, apply filters, and annotate
    const issues = [];
    let hasError = false;

    // Keep counts of all issues before filtering
    let origErrors = 0, origWarnings = 0, origHints = 0;

    for (const entry of bundle.entry) {
      const res = entry.resource;
      const rawPath = (res.extension || [])
      .find(ext => ext.url === 'http://hl7.org/fhir/StructureDefinition/operationoutcome-file')
          ?.valueString || '(unknown file)';
      const fileName = path.basename(rawPath);

      const relevant = (res.issue || [])
        .filter(i => sevOrder.indexOf(i.severity) <= minIndex);

      for (const issue of relevant) {
        // Count total issues before filtering
        if (issue.severity === 'error') origErrors++;
        else if (issue.severity === 'warning') origWarnings++;
        else origHints++;

        // Compute location string
        const expr = issue.expression;
        const locExt = issue.extension || [];
        const lineExt = locExt.find(e => e.url.endsWith('-line'));
        const colExt  = locExt.find(e => e.url.endsWith('-col'));
          let location = expr
            ? expr.join(', ')
            : (lineExt && colExt)
                ? `Line ${lineExt.valueInteger}, Column ${colExt.valueInteger}`
                : '(unknown location)';
        // Insert zero-width spaces after dots for line-wrapping
          location = location.replace(/\./g, '.\u200B');

        // Extract messageId and details
          const msgIdExt = locExt.find(e =>
            e.url === 'http://hl7.org/fhir/StructureDefinition/operationoutcome-message-id'
          );
          const messageId = msgIdExt?.valueCode || '';
        const details   = issue.details.text;
        const severity = issue.severity.toUpperCase();
        const code     = issue.code;

        // Build context object for filtering
        const ctx = { fileName, messageId, details, location };

        // Skip if this is a known issue per filters
        if (shouldSkipIssue(ctx, filtersArr)) {
          continue;
        }

        // Annotate in logs
          const annot = `${fileName} | ${severity} | ${code} | ${location} | ${messageId} | ${details}`;
          if      (issue.severity === 'error')   core.error(annot);
          else if (issue.severity === 'warning') core.warning(annot);
          else                                   core.info(annot);

        if (issue.severity === 'error') hasError = true;

        // Collect for summary
        issues.push({ fileName, severity, details, location, code, messageId });
      }
    }

    // 6) Fail the action if any errors remain after filtering
    const errorsLeft   = issues.filter(i => i.severity === 'ERROR').length;
    const warningsLeft = issues.filter(i => i.severity === 'WARNING').length;
    const hintsLeft    = issues.filter(i => i.severity === 'INFORMATION').length;

    if (errorsLeft > 0) {
      core.setFailed(`❌ FHIR Validation: ${errorsLeft} error(s) found after filtering.`);
    } else {
      core.info('✅ FHIR Validation: no errors found after filtering.');
    }

    // 7) Generate GitHub Checks Summary
    const icons = { ERROR:'❌', WARNING:'⚠️', INFORMATION:'ℹ️' };
    const summary = core.summary;

    // Choose label for filter level (use 'none' when include='all')
    const filterLabel = include === 'all' ? 'none' : include;

    // Compute how many were filtered out
    const filteredErrors   = origErrors   - errorsLeft;
    const filteredWarnings = origWarnings - warningsLeft;
    const filteredHints    = origHints    - hintsLeft;

    // Write summary heading
    summary.addHeading('FHIR Validation Results', 2);

    // Write compact summary line
    const generatedISO = new Date().toISOString();
    summary.addRaw(
      `FHIR Validation Results (filter: ${filterLabel}):\n` +
      `  ${icons.ERROR} ${errorsLeft} errors (${filteredErrors} filtered), ` +
      `${icons.WARNING} ${warningsLeft} warnings filtered out, ` +
      `${icons.INFORMATION} ${hintsLeft} hints filtered out — ${generatedISO}`
    );

    // Build and write detailed table
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
