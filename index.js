const core = require('@actions/core');
const fs = require('fs');

async function run() {
  try {
    // 1) Inputs holen
    const bundlePath = core.getInput('bundle-file', { required: true });
    const include = core.getInput('include') || 'errors';

    // 2) Bundle einlesen
    const text = fs.readFileSync(bundlePath, 'utf8');
    const bundle = JSON.parse(text);

    // 3) Severity-Level bestimmen
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

    // 4) Issues sammeln
    const issues = [];
    let hasError = false;

    bundle.entry.forEach(entry => {
      const res = entry.resource;
      const filePath = (res.extension || [])
      .find(ext => ext.url === 'http://hl7.org/fhir/StructureDefinition/operationoutcome-file')
          ?.valueString || '(unknown file)';

      (res.issue || [])
      .filter(issue => sevOrder.indexOf(issue.severity) <= minIndex)
      .forEach(issue => {
        // Location bestimmen
        const expr = issue.expression;
        const locExt = issue.extension || [];
        const lineExt = locExt.find(e => e.url.endsWith('-line'));
        const colExt  = locExt.find(e => e.url.endsWith('-col'));
        const location = expr
            ? expr.join(', ')
            : (lineExt && colExt)
                ? `Line ${lineExt.valueInteger}, Column ${colExt.valueInteger}`
                : '(unknown location)';

        const severity = issue.severity.toUpperCase();
        const code     = issue.code;
        const details  = issue.details.text;

        // GitHub-Annotierung
        const msg = `${filePath} | ${severity} | ${code} | ${location} | ${details}`;
        if (issue.severity === 'error')      core.error(msg);
        else if (issue.severity === 'warning') core.warning(msg);
        else                                   core.info(msg);

        if (issue.severity === 'error') hasError = true;

        // Für Summary-Tabelle speichern
        issues.push({ file: filePath, severity, location, code, details });
      });
    });

    // 5) CI-Logik: fail oder loggen je nach include
    if (hasError && include === 'errors') {
      core.setFailed('❌ FHIR Validation: at least one error found.');
    } else if (hasError && include === 'warnings') {
      core.info('⚠️ FHIR Validation: warnings (and possible errors) reported.');
    } else if (hasError && include === 'all') {
      core.info('ℹ️ FHIR Validation: all issues reported.');
    } else {
      core.info('✅ FHIR Validation: no issues of the selected severity found.');
    }

    // 6) Markdown-Summary für GitHub Checks UI
    const summary = core.summary;
    summary.addHeading('FHIR Validation Results', 2);

    // Tabelle bauen
    const table = [
      ['File', 'Severity', 'Location', 'Code', 'Details'],
      ...issues.map(i => [
        i.file,
        i.severity,
        i.location,
        i.code,
        i.details.replace(/\|/g, '\\|')  // Pipes escapen
      ])
    ];
    summary.addTable(table);

    // Zusammenfassungstext
    if (hasError) {
      summary.addRaw('\n❌ At least one error was found.');
    } else {
      summary.addRaw('\n✅ No errors were found.');
    }

    // Summary schreiben
    await summary.write();

  } catch (err) {
    core.setFailed(`Action failed: ${err.message}`);
  }
}

run();
