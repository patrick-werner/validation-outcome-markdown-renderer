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

    // 4) Compute original counts of all issues by severity
    const origCounts = { ERROR: 0, WARNING: 0, INFORMATION: 0 };
    for (const e of bundle.entry) {
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

    for (const entry of bundle.entry) {
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
          let location = expr
            ? expr.join(', ')
          : (line && col)
            ? `Line ${line.valueInteger}, Column ${col.valueInteger}`
                : '(unknown location)';
        // Insert zero-width spaces after dots for line-wrapping
          location = location.replace(/\./g, '.\u200B');

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
