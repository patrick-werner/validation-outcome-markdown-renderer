// __tests__/parse.test.js
const { parseValidationOutcome, parseXml, outcomeEntries } = require('../src/parse');

const BUNDLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Bundle xmlns="http://hl7.org/fhir">
  <type value="collection"/>
  <entry>
    <resource>
      <OperationOutcome>
        <extension url="http://hl7.org/fhir/StructureDefinition/operationoutcome-file">
          <valueString value="fsh-generated/resources/CodeSystem-kdl.json"/>
        </extension>
        <issue>
          <extension url="http://hl7.org/fhir/StructureDefinition/operationoutcome-issue-line">
            <valueInteger value="1"/>
          </extension>
          <extension url="http://hl7.org/fhir/StructureDefinition/operationoutcome-issue-col">
            <valueInteger value="176277"/>
          </extension>
          <extension url="http://hl7.org/fhir/StructureDefinition/operationoutcome-message-id">
            <valueCode value="NO_VALID_DISPLAY_FOUND"/>
          </extension>
          <severity value="information"/>
          <code value="invalid"/>
          <details><text value="No valid display names found"/></details>
          <expression value="CodeSystem/kdl: CodeSystem.jurisdiction[0].coding[0].display"/>
        </issue>
      </OperationOutcome>
    </resource>
  </entry>
</Bundle>`;

describe('parseXml()', () => {
  test('produces the FHIR JSON representation of a Bundle', () => {
    const data = parseXml(BUNDLE_XML);

    expect(data.resourceType).toBe('Bundle');
    expect(data.type).toBe('collection');
    expect(data.entry).toHaveLength(1);

    const res = data.entry[0].resource;
    expect(res.resourceType).toBe('OperationOutcome');
    expect(res.extension[0].url)
      .toBe('http://hl7.org/fhir/StructureDefinition/operationoutcome-file');
    expect(res.extension[0].valueString).toBe('fsh-generated/resources/CodeSystem-kdl.json');

    const issue = res.issue[0];
    expect(issue.severity).toBe('information');
    expect(issue.code).toBe('invalid');
    expect(issue.details.text).toBe('No valid display names found');
    expect(issue.expression).toEqual(['CodeSystem/kdl: CodeSystem.jurisdiction[0].coding[0].display']);
    expect(issue.extension).toHaveLength(3);
  });

  test('single-occurrence repeating elements become arrays', () => {
    const data = parseXml(BUNDLE_XML);
    expect(Array.isArray(data.entry)).toBe(true);
    expect(Array.isArray(data.entry[0].resource.issue)).toBe(true);
    expect(Array.isArray(data.entry[0].resource.issue[0].expression)).toBe(true);
  });

  test('typed value attributes are converted', () => {
    const ext = parseXml(BUNDLE_XML).entry[0].resource.issue[0].extension;
    expect(ext[0].valueInteger).toBe(1);
    expect(ext[1].valueInteger).toBe(176277);
    expect(ext[2].valueCode).toBe('NO_VALID_DISPLAY_FOUND');
  });

  test('parses a standalone OperationOutcome', () => {
    const data = parseXml(`<OperationOutcome xmlns="http://hl7.org/fhir">
      <issue>
        <severity value="error"/>
        <code value="structure"/>
        <details><text value="boom"/></details>
      </issue>
    </OperationOutcome>`);

    expect(data.resourceType).toBe('OperationOutcome');
    expect(data.issue[0].severity).toBe('error');
    expect(data.issue[0].details.text).toBe('boom');
  });

  test('decodes entities and keeps special characters in details', () => {
    const data = parseXml(`<OperationOutcome>
      <issue>
        <severity value="error"/>
        <code value="invalid"/>
        <details><text value="value must be &gt; 5 &amp; &lt; 10 (&quot;range&quot;)"/></details>
      </issue>
    </OperationOutcome>`);

    expect(data.issue[0].details.text).toBe('value must be > 5 & < 10 ("range")');
  });

  test('namespace declarations are dropped', () => {
    const data = parseXml(BUNDLE_XML);
    expect(data.xmlns).toBeUndefined();
  });

  test('throws on an XML root that is not a FHIR resource', () => {
    expect(() => parseXml('<notAResource><foo value="1"/></notAResource>'))
      .toThrow(/Unsupported XML root element/);
  });
});

describe('parseValidationOutcome()', () => {
  test('parses JSON unchanged', () => {
    const json = JSON.stringify({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'invalid', details: { text: 'x' } }]
    });
    expect(parseValidationOutcome(json)).toEqual(JSON.parse(json));
  });

  test('detects XML by content, not by file extension', () => {
    expect(parseValidationOutcome(BUNDLE_XML, 'qa.txt').resourceType).toBe('Bundle');
  });

  test('tolerates a BOM in front of the XML declaration', () => {
    expect(parseValidationOutcome('﻿' + BUNDLE_XML).resourceType).toBe('Bundle');
  });

  test('tolerates leading whitespace when there is no XML declaration', () => {
    expect(parseValidationOutcome('\n  <OperationOutcome/>').resourceType)
      .toBe('OperationOutcome');
  });

  test('tolerates a BOM and whitespace in front of JSON', () => {
    expect(parseValidationOutcome('﻿  {"resourceType":"OperationOutcome"}').resourceType)
      .toBe('OperationOutcome');
  });

  test('reports the detected format and path on parse errors', () => {
    expect(() => parseValidationOutcome('{ not json', 'validation.json'))
      .toThrow(/Failed to parse JSON file validation\.json/);
    expect(() => parseValidationOutcome('<Bundle><unclosed></Bundle>', 'qa.xml'))
      .toThrow(/Failed to parse XML file qa\.xml/);
  });
});

describe('outcomeEntries', () => {
  const EMPTY_FIRST_ENTRY_XML = `<?xml version="1.0" encoding="UTF-8"?><Bundle xmlns="http://hl7.org/fhir"><type value="collection"/><entry/><entry><resource><OperationOutcome><extension url="http://hl7.org/fhir/StructureDefinition/operationoutcome-file"><valueString value="fsh-generated/resources/ActorDefinition-a.json"/></extension><issue><severity value="information"/><code value="business-rule"/><details><text value="could usefully have an OID assigned"/></details><expression value="Resource"/></issue></OperationOutcome></resource></entry></Bundle>`;

  test('skips the empty <entry/> the IG Publisher writes when there are no link-check messages', () => {
    const entries = outcomeEntries(parseValidationOutcome(EMPTY_FIRST_ENTRY_XML, 'qa.xml'));
    expect(entries).toHaveLength(1);
    expect(entries[0].resource.resourceType).toBe('OperationOutcome');
    expect(entries[0].resource.issue[0].severity).toBe('information');
  });

  test('skips JSON entries without a resource', () => {
    const data = { resourceType: 'Bundle', type: 'collection', entry: [{}, { resource: { resourceType: 'OperationOutcome', issue: [] } }] };
    expect(outcomeEntries(data)).toHaveLength(1);
  });

  test('treats a bundle without entries as having no issues', () => {
    expect(outcomeEntries({ resourceType: 'Bundle', type: 'collection' })).toEqual([]);
  });

  test('wraps a standalone OperationOutcome', () => {
    const oo = { resourceType: 'OperationOutcome', issue: [] };
    expect(outcomeEntries(oo)).toEqual([{ resource: oo }]);
  });

  test('rejects other resource types', () => {
    expect(() => outcomeEntries({ resourceType: 'Patient' })).toThrow(/Unsupported resource type: Patient/);
  });
});
