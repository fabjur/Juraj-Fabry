import { escapeCsvValue, convertToCSV } from './export.ts';

export interface TestResult {
  passed: boolean;
  results: string[];
  assertions: number;
}

/**
 * Functional test suite for Data Export & Serialization.
 */
export function runExportTestSuite(): TestResult {
  const results: string[] = [];
  let allPassed = true;
  let assertions = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    assertions++;
    if (condition) {
      results.push(`PASS: ${testName}`);
    } else {
      results.push(`FAIL: ${testName} - ${detail || 'Condition not met'}`);
      allPassed = false;
    }
  }

  // TEST 1: escapeCsvValue handles simple values
  assert(escapeCsvValue('SimpleText') === 'SimpleText', 'Simple text is unquoted');
  assert(escapeCsvValue(123) === '123', 'Number is converted to string');
  assert(escapeCsvValue(null) === '', 'null returns empty string');
  assert(escapeCsvValue(undefined) === '', 'undefined returns empty string');

  // TEST 2: escapeCsvValue with semicolons (European delimiter)
  assert(escapeCsvValue('Billa; Bratislava') === '"Billa; Bratislava"', 'Values with semicolons wrapped in quotes');

  // TEST 3: escapeCsvValue with double quotes
  assert(escapeCsvValue('Coca Cola "Zero"') === '"Coca Cola ""Zero"""', 'Internal quotes are doubled and wrapped');

  // TEST 4: escapeCsvValue with newlines
  assert(escapeCsvValue('Line 1\nLine 2') === '"Line 1\nLine 2"', 'Values with newlines wrapped in quotes');

  // TEST 5: convertToCSV full table generation
  const headers = ['Predajňa', 'Produkt', 'Cena (EUR)'];
  const rows = [
    ['Tesco Extra', 'Kofola 2L', 1.89],
    ['Billa; Avion', 'Pilsner 0.5L', 1.49]
  ];

  const csvOutput = convertToCSV(headers, rows);
  const lines = csvOutput.split('\n');

  assert(lines.length === 3, 'CSV output has exactly 3 lines (1 header + 2 rows)');
  assert(lines[0] === 'Predajňa;Produkt;Cena (EUR)', 'Header row joined with semicolons');
  assert(lines[1] === 'Tesco Extra;Kofola 2L;1.89', 'First data row correctly formatted');
  assert(lines[2] === '"Billa; Avion";Pilsner 0.5L;1.49', 'Semicolon in store name safely quoted in CSV');

  return { passed: allPassed, results, assertions };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('export.test')) {
  const { passed, results, assertions } = runExportTestSuite();
  console.log(`\n--- EXPORT & CSV TEST SUITE RESULTS (${assertions} assertions) ---`);
  results.forEach(r => console.log(r));
  console.log(`TOTAL RESULT: ${passed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}\n`);
  if (!passed) process.exit(1);
}
