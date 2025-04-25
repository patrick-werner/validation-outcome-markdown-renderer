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

    // parse filters: line-separated "messageId|detailsWildcard"
    const filtersArr = rawFilters
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(entry => {
        const [ msgId, detPattern ] = entry.split('|');
        return {
          msgId:       msgId?.trim() || '',
          detPattern:  detPattern?.trim() || ''
        };
      });

    // 2) Load and parse bundle
    const text = fs.readFileSync(bundlePath, 'utf8');
    const bundle = JSON.parse(text);

    // 3) Determine minimum severity index
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

    // 4) Collect and filter issues
    const issues = [];
    let hasError = false;

    for (const entry of bundle.entry) {
      const res = entry.resource;
      const rawPath = (res.extension || [])
      .find(ext => ext.url === 'http://hl7.org/fhir/StructureDefinition/operationoutcome-file')
          ?.valueString || '(unknown file)';
      const fileName = path.basename(rawPath);

      for (const issue of (res.issue || []).filter(i => sevOrder.indexOf(i.severity) <= minIndex)) {
        if (shouldSkipIssue(issue, filtersArr)) {
          continue;  // skip known issue
        }

        // compute location
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

          // messageId extension
          const msgIdExt = locExt.find(e =>
            e.url === 'http://hl7.org/fhir/StructureDefinition/operationoutcome-message-id'
          );
          const messageId = msgIdExt?.valueCode || '';

        const severity = issue.severity.toUpperCase();
        const code     = issue.code;
        const details  = issue.details.text;

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

    // 5) CI logic
    if      (hasError && include === 'errors')   core.setFailed('❌ FHIR Validation: at least one error found.');
    else if (hasError && include === 'warnings') core.info('⚠️ FHIR Validation: warnings (and possible errors) reported.');
    else if (hasError && include === 'all')      core.info('ℹ️ FHIR Validation: all issues reported.');
    else                                         core.info('✅ FHIR Validation: no issues of the selected severity found.');

    // 6) GitHub Checks Summary
    const severityIcon = { ERROR:'❌', WARNING:'⚠️', INFORMATION:'ℹ️' };

    const summary = core.summary;

    // Heading + counts paragraph
    summary.addHeading('FHIR Validation Results', 2);

    // Insert counts summary
    const errorCount   = issues.filter(i => i.severity === 'ERROR').length;
    const warningCount = issues.filter(i => i.severity === 'WARNING').length;
    const infoCount    = issues.filter(i => i.severity === 'INFORMATION').length;
    const generatedISO = new Date().toISOString();

    summary.addRaw(
        `<p>${errorCount} ❌ errors, ${warningCount} ⚠️ warnings, ${infoCount} ℹ️ hints. Generated ${generatedISO}</p>\n`
    );

    // table: File | Severity | Details | Location | Code | MessageId
    const table = [
      ['File', 'Severity', 'Details', 'Location', 'Code', 'MessageId'],
      ...issues.map(i => [
        i.fileName,
        `${severityIcon[i.severity] || ''} ${i.severity}`,
        i.details.replace(/\|/g, '\\|'),
        i.location,
        i.code,
        i.messageId
      ])
    ];
    summary.addTable(table);

    // final note
    summary.addRaw(hasError
      ? '\n❌ At least one error was found.'
      : '\n✅ No errors were found.'
    );

    await summary.write();

  } catch (err) {
    core.setFailed(`Action failed: ${err.message}`);
  }
}

run();
