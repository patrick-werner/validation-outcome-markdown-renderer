// __tests__/index.test.js
const fs = require('fs');
const path = require('path');

// Mock @actions/core
const mockCore = {
  getInput: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  info: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn()
};
jest.mock('@actions/core', () => mockCore);

describe('index.js - OperationOutcome handling', () => {
  let tempDir;
  
  beforeEach(() => {
    jest.clearAllMocks();
    tempDir = fs.mkdtempSync(path.join(__dirname, 'temp-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('handles single OperationOutcome resource', async () => {
    // Create test file with single OperationOutcome
    const testFile = path.join(tempDir, 'test-outcome.json');
    const singleOutcome = {
      resourceType: 'OperationOutcome',
      extension: [{
        url: 'http://hl7.org/fhir/StructureDefinition/operationoutcome-file',
        valueString: 'input/patient.json'
      }],
      issue: [{
        severity: 'error',
        code: 'invalid',
        details: { text: 'Test error message' },
        expression: ['Patient.name']
      }]
    };
    fs.writeFileSync(testFile, JSON.stringify(singleOutcome));

    // Mock inputs
    mockCore.getInput.mockImplementation((name) => {
      if (name === 'bundle-file') return testFile;
      if (name === 'include') return 'errors';
      if (name === 'filters') return '';
      return '';
    });

    // Run the action
    const run = require('../src/index');
    await run();

    // Verify error was logged
    expect(mockCore.error).toHaveBeenCalled();
    const errorCall = mockCore.error.mock.calls[0][0];
    expect(errorCall).toContain('patient.json');
    expect(errorCall).toContain('ERROR');
    expect(errorCall).toContain('Test error message');
  });

  test('handles Bundle with multiple OperationOutcome entries', async () => {
    // Create test file with Bundle
    const testFile = path.join(tempDir, 'test-bundle.json');
    const bundle = {
      resourceType: 'Bundle',
      entry: [
        {
          resource: {
            resourceType: 'OperationOutcome',
            extension: [{
              url: 'http://hl7.org/fhir/StructureDefinition/operationoutcome-file',
              valueString: 'input/patient.json'
            }],
            issue: [{
              severity: 'error',
              code: 'invalid',
              details: { text: 'Error 1' },
              expression: ['Patient.name']
            }]
          }
        },
        {
          resource: {
            resourceType: 'OperationOutcome',
            extension: [{
              url: 'http://hl7.org/fhir/StructureDefinition/operationoutcome-file',
              valueString: 'input/observation.json'
            }],
            issue: [{
              severity: 'warning',
              code: 'informational',
              details: { text: 'Warning 1' },
              expression: ['Observation.value']
            }]
          }
        }
      ]
    };
    fs.writeFileSync(testFile, JSON.stringify(bundle));

    // Mock inputs
    mockCore.getInput.mockImplementation((name) => {
      if (name === 'bundle-file') return testFile;
      if (name === 'include') return 'warnings';
      if (name === 'filters') return '';
      return '';
    });

    // Run the action
    const run = require('../src/index');
    await run();

    // Verify both error and warning were logged
    expect(mockCore.error).toHaveBeenCalledTimes(1);
    expect(mockCore.warning).toHaveBeenCalledTimes(1);
  });

  test('throws error for unsupported resource type', async () => {
    // Create test file with unsupported resource
    const testFile = path.join(tempDir, 'test-invalid.json');
    const invalid = {
      resourceType: 'Patient',
      name: [{ family: 'Test' }]
    };
    fs.writeFileSync(testFile, JSON.stringify(invalid));

    // Mock inputs
    mockCore.getInput.mockImplementation((name) => {
      if (name === 'bundle-file') return testFile;
      if (name === 'include') return 'errors';
      if (name === 'filters') return '';
      return '';
    });

    // Run the action
    const run = require('../src/index');
    await run();

    // Verify setFailed was called with appropriate message
    expect(mockCore.setFailed).toHaveBeenCalled();
    const failMessage = mockCore.setFailed.mock.calls[0][0];
    expect(failMessage).toContain('Unsupported resource type');
  });
});
