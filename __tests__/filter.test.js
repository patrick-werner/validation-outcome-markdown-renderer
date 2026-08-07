// __tests__/filter.test.js
const { wildcardMatch, shouldSkipIssue } = require('../src/filter');

describe('wildcardMatch()', () => {
  test('matches exact text when no wildcard', () => {
    expect(wildcardMatch('hello', 'hello')).toBe(true);
    expect(wildcardMatch('hello', 'hell')).toBe(false);
  });

  test('handles single * wildcard', () => {
    expect(wildcardMatch('foobar', 'foo*bar')).toBe(true);
    expect(wildcardMatch('fooxbar', 'foo*bar')).toBe(true);
    expect(wildcardMatch('fobar', 'foo*bar')).toBe(false);
  });

  test('is case insensitive', () => {
    expect(wildcardMatch('HELLO', 'hello')).toBe(true);
    expect(wildcardMatch('HelloWorld', '*world')).toBe(true);
  });

  test('matches across line breaks', () => {
    const details = 'Error from tx: Invalid request: foo\r\nInformation: X-Request-Id: 123';
    expect(wildcardMatch(details, '*Error from tx: Invalid request:*')).toBe(true);
  });

  test('escapes regex metachars', () => {
    expect(wildcardMatch('a.b*c', 'a.b\\*c')).toBe(false);
    expect(wildcardMatch('a.b*c', 'a\\.b\\*c')).toBe(false);
  });
});

describe('shouldSkipIssue()', () => {
  // Hilfsfunktion, um einen Context zu bauen
  function makeCtx({
    fileName = 'default.json',
    messageId = '',
    details   = '',
    location  = ''
  } = {}) {
    return { fileName, messageId, details, location };
  }

  test('no filters => never skip', () => {
    const ctx = makeCtx({ fileName: 'foo.json', messageId: 'X', details: 'y', location: 'L1' });
    expect(shouldSkipIssue(ctx, [])).toBe(false);
  });

  test('only fileName filter matches => skip', () => {
    const ctx = makeCtx({ fileName: 'foo.json' });
    const filters = [
      { fileName: 'foo.json', msgId: '', detPattern: '', locationPattern: '' }
    ];
    expect(shouldSkipIssue(ctx, filters)).toBe(true);
  });

  test('only fileName filter non-match => do not skip', () => {
    const ctx = makeCtx({ fileName: 'bar.json' });
    const filters = [
      { fileName: 'foo.json', msgId: '', detPattern: '', locationPattern: '' }
    ];
    expect(shouldSkipIssue(ctx, filters)).toBe(false);
  });

  test('only messageId filter matches => skip', () => {
    const ctx = makeCtx({ messageId: 'FOO' });
    const filters = [
      { fileName: '', msgId: 'FOO', detPattern: '', locationPattern: '' }
    ];
    expect(shouldSkipIssue(ctx, filters)).toBe(true);
  });

  test('only messageId filter non-match => do not skip', () => {
    const ctx = makeCtx({ messageId: 'BAR' });
    const filters = [
      { fileName: '', msgId: 'FOO', detPattern: '', locationPattern: '' }
    ];
    expect(shouldSkipIssue(ctx, filters)).toBe(false);
  });

  test('only details filter matches => skip', () => {
    const ctx = makeCtx({ details: 'this contains magic snippet' });
    const filters = [
      { fileName: '', msgId: '', detPattern: '*magic*', locationPattern: '' }
    ];
    expect(shouldSkipIssue(ctx, filters)).toBe(true);
  });

  test('only details filter non-match => do not skip', () => {
    const ctx = makeCtx({ details: 'nothing here' });
    const filters = [
      { fileName: '', msgId: '', detPattern: '*magic*', locationPattern: '' }
    ];
    expect(shouldSkipIssue(ctx, filters)).toBe(false);
  });

  test('only location filter matches => skip', () => {
    const ctx = makeCtx({ location: 'Line 1, Column 2' });
    const filters = [
      { fileName: '', msgId: '', detPattern: '', locationPattern: 'Line 1, Column 2' }
    ];
    expect(shouldSkipIssue(ctx, filters)).toBe(true);
  });

  test('only location filter non-match => do not skip', () => {
    const ctx = makeCtx({ location: 'Other location' });
    const filters = [
      { fileName: '', msgId: '', detPattern: '', locationPattern: 'Line 1, Column 2' }
    ];
    expect(shouldSkipIssue(ctx, filters)).toBe(false);
  });

  test('location wildcard pattern matches => skip', () => {
    const ctx = makeCtx({ location: 'Observation.component[0].code' });
    const filters = [
      { fileName: '', msgId: '', detPattern: '', locationPattern: 'Observation.*' }
    ];
    expect(shouldSkipIssue(ctx, filters)).toBe(true);
  });

  test('location wildcard pattern non-match => do not skip', () => {
    const ctx = makeCtx({ location: 'Patient.name' });
    const filters = [
      { fileName: '', msgId: '', detPattern: '', locationPattern: 'Observation.*' }
    ];
    expect(shouldSkipIssue(ctx, filters)).toBe(false);
  });

  test('all four must match => skip only when all match', () => {
    const ctx = makeCtx({
      fileName: 'foo.json',
      messageId: 'ID1',
      details: 'foo bar baz',
      location: 'locA'
    });
    const filters = [
      {
        fileName:       'foo.json',
        msgId:          'ID1',
        detPattern:     '*bar*',
        locationPattern:'locA'
      }
    ];
    expect(shouldSkipIssue(ctx, filters)).toBe(true);

    // Any single mismatch → do not skip
    expect(shouldSkipIssue(
        makeCtx({ fileName: 'foo.json', messageId: 'ID1', details: 'foo bar baz', location: 'X' }),
        filters
    )).toBe(false);
    expect(shouldSkipIssue(
        makeCtx({ fileName: 'foo.json', messageId: 'WRONG', details: 'foo bar baz', location: 'locA' }),
        filters
    )).toBe(false);
    expect(shouldSkipIssue(
        makeCtx({ fileName: 'foo.json', messageId: 'ID1', details: 'no match', location: 'locA' }),
        filters
    )).toBe(false);
    expect(shouldSkipIssue(
        makeCtx({ fileName: 'other.json', messageId: 'ID1', details: 'foo bar baz', location: 'locA' }),
        filters
    )).toBe(false);
  });

  test('multiple filters => skip if any filter block matches completely', () => {
    const ctx = makeCtx({
      fileName: 'f.json',
      messageId: 'A',
      details: 'some details',
      location: 'loc1'
    });
    const filters = [
      { fileName:'x.json', msgId:'', detPattern:'', locationPattern:'' },
      { fileName:'',      msgId:'A',detPattern:'*details*', locationPattern:'' },
      { fileName:'',      msgId:'', detPattern:'', locationPattern:'other' }
    ];
    // zweite Regel passt (msgId + details), also skip
    expect(shouldSkipIssue(ctx, filters)).toBe(true);

    // wenn keine Regel komplett passt → do not skip
    const ctx2 = makeCtx({
      fileName: 'f.json',
      messageId: 'Z',
      details: 'different',
      location: 'loc1'
    });
    expect(shouldSkipIssue(ctx2, filters)).toBe(false);
  });
});

describe('zero-width characters in locations (#20)', () => {
  const { normalizeLocation } = require('../src/filter');
  const { formatLocationForTable } = require('../src/index');

  function locationFilter(pattern) {
    return [{ fileName: '', msgId: '', detPattern: '', locationPattern: pattern }];
  }

  function ctxWith(location) {
    return { fileName: 'f.json', messageId: '', details: '', location };
  }

  test('the rendered table no longer emits zero-width spaces', () => {
    const rendered = formatLocationForTable('Observation.code');
    expect(rendered).toBe('Observation.<wbr>code');
    expect(rendered).not.toMatch(/[​-‍﻿]/);
  });

  test('a location copied out of the summary table matches', () => {
    // exactly what a user sees in the Checks table / PR comment and copies
    const location = 'Observation.component[0].code.coding[1]';
    const copied = formatLocationForTable(location);

    expect(shouldSkipIssue(ctxWith(location), locationFilter(copied))).toBe(true);
  });

  test('a filter written by hand still matches', () => {
    const location = 'Observation.code';
    expect(shouldSkipIssue(ctxWith(location), locationFilter('Observation.code'))).toBe(true);
  });

  test('a filter carrying zero-width spaces from an older release still matches', () => {
    // people copied these out of the console before the table-only change
    const legacy = 'Observation.​code';
    expect(shouldSkipIssue(ctxWith('Observation.code'), locationFilter(legacy))).toBe(true);
  });

  test('a location carrying zero-width spaces matches a clean filter', () => {
    expect(shouldSkipIssue(ctxWith('Observation.​code'), locationFilter('Observation.code'))).toBe(true);
  });

  test('wildcards still work across a copied location', () => {
    const copied = formatLocationForTable('Specimen.extension[1].extension[0].value');
    expect(shouldSkipIssue(ctxWith('Specimen.extension[1].extension[0].value'), locationFilter(copied))).toBe(true);
    expect(shouldSkipIssue(ctxWith('Specimen.extension[1].extension[0].value'), locationFilter('Specimen.*.value'))).toBe(true);
  });

  test('normalization does not make unrelated locations match', () => {
    expect(shouldSkipIssue(ctxWith('Observation.code'), locationFilter('Observation.value'))).toBe(false);
  });

  test('normalizeLocation removes rendering artefacts only', () => {
    expect(normalizeLocation('a​b‌c‍d﻿e')).toBe('abcde');
    expect(normalizeLocation('a.<wbr>b.<wbr/>c.<WBR>d')).toBe('a.b.c.d');
    expect(normalizeLocation('Observation.code')).toBe('Observation.code');
  });

  test('what the browser shows for a rendered location is the plain location', () => {
    // <wbr> is markup, so it never reaches the clipboard when copied from the
    // rendered table — this is the path fix 2 addresses
    const location = 'Observation.component[0].code';
    expect(formatLocationForTable(location).replace(/<wbr>/g, '')).toBe(location);
  });
});
