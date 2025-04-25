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

  test('escapes regex metachars', () => {
    expect(wildcardMatch('a.b*c', 'a.b\\*c')).toBe(false);
    expect(wildcardMatch('a.b*c', 'a.b\\*c')).toBe(false);
  });
});

describe('shouldSkipIssue()', () => {
  // Hilfsfunktion, um ein Issue-Objekt zu bauen
  function makeIssue({ messageId = '', details = '' }) {
    return {
      details: { text: details },
      extension: messageId
          ? [{ url: 'http://hl7.org/fhir/StructureDefinition/operationoutcome-message-id', valueCode: messageId }]
          : []
    };
  }

  test('no filters => never skip', () => {
    const issue = makeIssue({ messageId: 'ANY', details: 'something' });
    expect(shouldSkipIssue(issue, [])).toBe(false);
  });

  test('only messageId filter matches => skip', () => {
    const issue = makeIssue({ messageId: 'FOO', details: 'bar' });
    const filters = [{ msgId: 'FOO', detPattern: '' }];
    expect(shouldSkipIssue(issue, filters)).toBe(true);
  });

  test('only messageId filter non-match => do not skip', () => {
    const issue = makeIssue({ messageId: 'BAR', details: 'bar' });
    const filters = [{ msgId: 'FOO', detPattern: '' }];
    expect(shouldSkipIssue(issue, filters)).toBe(false);
  });

  test('only details filter matches => skip', () => {
    const issue = makeIssue({ messageId: 'X', details: 'contains magic code snippet' });
    const filters = [{ msgId: '', detPattern: '*magic code*' }];
    expect(shouldSkipIssue(issue, filters)).toBe(true);
  });

  test('only details filter non-match => do not skip', () => {
    const issue = makeIssue({ messageId: 'X', details: 'no match here' });
    const filters = [{ msgId: '', detPattern: '*magic code*' }];
    expect(shouldSkipIssue(issue, filters)).toBe(false);
  });

  test('both msgId and details must match => skip only when both match', () => {
    const issue = makeIssue({ messageId: 'ID1', details: 'foo bar baz' });
    const filters = [{ msgId: 'ID1', detPattern: '*bar*' }];
    expect(shouldSkipIssue(issue, filters)).toBe(true);

    const issue2 = makeIssue({ messageId: 'ID2', details: 'foo bar baz' });
    expect(shouldSkipIssue(issue2, filters)).toBe(false);

    const issue3 = makeIssue({ messageId: 'ID1', details: 'no match' });
    expect(shouldSkipIssue(issue3, filters)).toBe(false);
  });

  test('multiple filters => skip if any filter matches', () => {
    const issue = makeIssue({ messageId: 'A', details: 'yadayada' });
    const filters = [
      { msgId: 'X', detPattern: '' },
      { msgId: '',  detPattern: '*yadayada*' },
      { msgId: 'Z', detPattern: 'nomatch' }
    ];
    expect(shouldSkipIssue(issue, filters)).toBe(true);

    const issue2 = makeIssue({ messageId: 'Z', details: 'something else' });
    expect(shouldSkipIssue(issue2, filters)).toBe(false);

    const issue3 = makeIssue({ messageId: 'Q', details: 'nothing special' });
    expect(shouldSkipIssue(issue3, filters)).toBe(false);
  });
});
