const core = require('@actions/core');
const fs = require('fs');
const path = require('path');
const { shouldSkipIssue } = require('./filter');
const { parseValidationOutcome } = require('./parse');

/**
 * Give the summary table a chance to wrap long locations.
 *
 * `<wbr>` is a break opportunity that is not a character: unlike the zero-width
 * space this used to insert, it does not travel along when the location is copied
 * out of the rendered table into a filter rule (#20).
 */
function formatLocationForTable(location) {
  return location.replace(/\./g, '.<wbr>');
}

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
        return { fileName, msgId, detPattern, locationPattern, raw: entry };
      });
    let unusedFilters = [];

    // 3) Load and parse the OperationOutcome bundle or single OperationOutcome (JSON or XML)
    const text = fs.readFileSync(bundlePath, 'utf8');
    const data = parseValidationOutcome(text, bundlePath);

    // Handle both Bundle and single OperationOutcome formats
    let entries = [];
    if (data.resourceType === 'Bundle' && data.entry) {
      entries = data.entry;
    } else if (data.resourceType === 'OperationOutcome') {
      // Wrap single OperationOutcome in entry format
      entries = [{ resource: data }];
    } else {
      throw new Error(`Unsupported resource type: ${data.resourceType}`);
    }

    // 4) Compute original counts of all issues by severity
    const origCounts = { ERROR: 0, WARNING: 0, INFORMATION: 0 };
    for (const e of entries) {
      for (const issu of (e.resource.issue || [])) {
        const sev = issu.severity.toUpperCase();
        if (origCounts.hasOwnProperty(sev)) origCounts[sev]++;
      }
    }

    // 5) Determine minimum severity index for "include"
    const sevOrder = ['error', 'warning', 'information'];
    let minIndex;
    switch (include) {
      case 'errors':   minIndex = 0; break;
      case 'warnings': minIndex = 1; break;
      case 'all':      minIndex = 2; break;
      default:
        throw new Error(`Invalid include value: ${include}`);
    }

    // 6) Collect & filter issues
    const remaining = { ERROR: 0, WARNING: 0, INFORMATION: 0 };
    const issues = [];

    for (const entry of entries) {
      const res = entry.resource;
      const rawPath = (res.extension || [])
        .find(x => x.url==='http://hl7.org/fhir/StructureDefinition/operationoutcome-file')
          ?.valueString || '(unknown file)';
      const fileName = path.basename(rawPath);

      const relevant = (res.issue || [])
        .filter(i => sevOrder.indexOf(i.severity) <= minIndex);

      for (const issue of relevant) {
        // extract location
        const locExt = issue.extension || [];
        const expr = issue.expression;
        const line   = locExt.find(e=>e.url.endsWith('-line'));
        const col    = locExt.find(e=>e.url.endsWith('-col'));
          const location = expr
            ? expr.join(', ')
          : (line && col)
            ? `Line ${line.valueInteger}, Column ${col.valueInteger}`
                : '(unknown location)';

        // Extract messageId and details
          const msgIdExt = locExt.find(e =>
            e.url === 'http://hl7.org/fhir/StructureDefinition/operationoutcome-message-id'
          );
          const messageId = msgIdExt?.valueCode || '';
        const details   = issue.details.text;
        const sevKey    = issue.severity.toUpperCase();
        const code     = issue.code;

        // Build context object for filtering
        const ctx = { fileName, messageId, details, location };

        // Skip if this is a known issue per filters
        if (shouldSkipIssue(ctx, filtersArr)) {
          continue;
        }

        // log annotation
        const annot = `${fileName} | ${sevKey} | ${code} | ${location} | ${messageId} | ${details}`;
        if      (sevKey==='ERROR')       core.error(annot);
        else if (sevKey==='WARNING')     core.warning(annot);
          else                                   core.info(annot);

        remaining[sevKey]++;
        issues.push({ fileName, severity: sevKey, details, location, code, messageId });
      }
    }

    if (filtersArr.length) {
      unusedFilters = filtersArr.filter(f => !f.matched);
      if (unusedFilters.length) {
        core.info(`${unusedFilters.length} filter(s) defined but not triggered:`);
        for (const f of unusedFilters) {
          if (f.raw) {
            core.info(`  - ${f.raw}`);
          } else {
            const parts = [];
            if (f.fileName) parts.push(`file=${f.fileName}`);
            if (f.msgId) parts.push(`msgId=${f.msgId}`);
            if (f.detPattern) parts.push(`details=${f.detPattern}`);
            if (f.locationPattern) parts.push(`location=${f.locationPattern}`);
            core.info(`  - ${parts.join(', ') || '(empty filter)'}`);
          }
        }
      }
    }

    // 7) CI logic: fail if any ERROR remains
    if (remaining.ERROR > 0) {
      core.setFailed(`❌ FHIR Validation: ${remaining.ERROR} error(s) found after filtering.`);
    } else {
      core.info('✅ FHIR Validation: no errors found after filtering.');
    }

    // 7) Generate GitHub Checks Summary
    const icons = { ERROR:'❌', WARNING:'⚠️', INFORMATION:'ℹ️' };
    const summary = core.summary;
    const ts = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

    summary.addHeading(
      `FHIR Validation Results (filter: ${include})`, 2
    );

    if (unusedFilters.length) {
      summary.addHeading('Unused filters (not triggered)', 3);
      summary.addList(
        unusedFilters.map(f => (
          f.raw
            ? f.raw
            : [
                f.fileName && `file=${f.fileName}`,
                f.msgId && `msgId=${f.msgId}`,
                f.detPattern && `details=${f.detPattern}`,
                f.locationPattern && `location=${f.locationPattern}`
              ].filter(Boolean).join(', ') || '(empty filter)'
        ))
      );
      summary.addBreak();
    }

    // build one line per severity
    const parts = [];
    for (const [key, icon] of [['ERROR','❌'],['WARNING','⚠️'],['INFORMATION','ℹ️']]) {
      const orig   = origCounts[key];
      const rem    = remaining[key];
      const filt   = orig - rem;
      const label  = key.toLowerCase()==='information' ? 'hints' : key.toLowerCase()+'s';
      if (sevOrder.indexOf(key.toLowerCase()) <= minIndex) {
        // this severity is included
        parts.push(
          `${icon} ${rem} ${label} (${filt} filtered)`
        );
      } else {
        // severity suppressed by include
        parts.push(
          `${icon} ${filt} ${label} filtered out`
        );
      }
    }

    summary.addRaw(
      `  ${parts.join(', ')} — ${ts}`
    );

    // Build and write detailed table
    const table = [
      ['File', 'Severity', 'Details', 'Location', 'Code', 'MessageId'],
      ...issues.map(i => [
        i.fileName,
        `${icons[i.severity]} ${i.severity.toLowerCase()}`,
        i.details.replace(/\|/g, '\\|'),
        formatLocationForTable(i.location),
        i.code,
        i.messageId
      ])
    ];
    summary.addTable(table);

    // 8) Write summary as markdown file for PR comments (before write() clears the buffer)
    const prSummaryPath = core.getInput('pr-summary-path');
    const md = summary.stringify();
    const prContent = `<!-- fhir-validation-summary -->\n${md}\n<!-- fhir-validation-summary -->`;
    fs.writeFileSync(prSummaryPath, prContent, 'utf8');
    core.info(`✅ Wrote PR summary markdown to ${prSummaryPath}`);

    await summary.write();

  } catch (err) {
    core.setFailed(`Action failed: ${err.message}`);
  }
}

// Export for testing (property, so `require('./index')` stays callable)
module.exports = run;
module.exports.formatLocationForTable = formatLocationForTable;

// Run if this is the main module
if (require.main === module) {
  run();
}
