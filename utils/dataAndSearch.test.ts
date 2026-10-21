import { 
  getBrandFromName, 
  getCategoryFromName, 
  parseDateFromFileName, 
  normalizeProductName, 
  calculateStringSimilarity, 
  findBestMatch 
} from './helpers.ts';

export interface TestResult {
  passed: boolean;
  results: string[];
  assertions: number;
}

/**
 * Functional test suite for Catalog Data, Normalization, and Matching.
 */
export function runDataAndSearchTestSuite(): TestResult {
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

  // TEST 1: Brand extraction from name
  assert(getBrandFromName('Kofola Original 2L') === 'Kofola', 'Brand extracted: Kofola');
  assert(getBrandFromName('Coca-Cola Zero 0.5L') === 'Coca-Cola', 'Brand extracted: Coca-Cola');
  assert(getBrandFromName('Pilsner Urquell 0.5L Plech') === 'Pilsner', 'Brand extracted: Pilsner');
  assert(getBrandFromName('') === '', 'Empty string returns empty brand');

  // TEST 2: Category extraction from name
  assert(getCategoryFromName('Kofola Original 2L', 'Nezaradené') === 'Kofola', 'Category extracted: Kofola');
  assert(getCategoryFromName('Bon pari Lesná zmes', 'Nezaradené') === 'Bon pari', 'Multi-word category: Bon pari');
  assert(getCategoryFromName('', 'Nezaradené') === 'Nezaradené', 'Fallback category returned when name is empty');

  // TEST 3: parseDateFromFileName
  const dateDDMMYYYY = parseDateFromFileName('regal_26.03.2026_tesco.jpg');
  assert(dateDDMMYYYY !== null, 'Date DD.MM.YYYY parsed');
  assert(dateDDMMYYYY?.getUTCFullYear() === 2026, 'Year is 2026');
  assert(dateDDMMYYYY?.getUTCMonth() === 2, 'Month is 2 (March, 0-indexed)');
  assert(dateDDMMYYYY?.getUTCDate() === 26, 'Day is 26');

  const dateDash = parseDateFromFileName('audit-2026-05-15.jpg');
  assert(dateDash !== null, 'Date YYYY-MM-DD parsed');
  assert(dateDash?.getUTCMonth() === 4, 'Month is 4 (May)');

  const dateNone = parseDateFromFileName('random_photo.png');
  assert(dateNone === null, 'No date in filename returns null');

  // TEST 4: normalizeProductName
  const norm1 = normalizeProductName('  Kofola   Originál   2L  ');
  const norm2 = normalizeProductName('Kofola Original 2L');
  assert(norm1 === norm2, 'normalizeProductName handles spaces and diacritics');

  // TEST 5: calculateStringSimilarity (Levenshtein based, 0-100)
  const simExact = calculateStringSimilarity('Heineken 0.5L', 'Heineken 0.5L');
  assert(simExact === 100, 'Identical strings have 100% similarity');

  const simTypo = calculateStringSimilarity('Heineken 0.5L', 'Heiniken 0.5L');
  assert(simTypo > 85, 'Minor typo has >85% similarity');

  const simDiff = calculateStringSimilarity('Heineken 0.5L', 'Coca Cola 2L');
  assert(simDiff < 40, 'Completely different strings have <40% similarity');

  // TEST 6: findBestMatch with volume number consistency check
  const candidates = [
    'Kofola Original 0.5L',
    'Kofola Original 1.5L',
    'Kofola Original 2.0L',
    'Vinea Biela 1.5L'
  ];

  // Diacritics tolerance
  const matchDiacritics = findBestMatch('Kofola Originál 0.5L', candidates);
  assert(matchDiacritics === 'Kofola Original 0.5L', 'Handles diacritics in match (Originál -> Original)');

  // Missing volume unit 'L'
  const match05 = findBestMatch('Kofola Original 0.5', candidates);
  assert(match05 === 'Kofola Original 0.5L', 'Matches correct volume 0.5L candidate');

  const match20 = findBestMatch('Kofola Original 2.0L', candidates);
  assert(match20 === 'Kofola Original 2.0L', 'Matches correct volume 2.0L candidate');

  const matchUnrelated = findBestMatch('Plzeň 12 0.5L', candidates);
  assert(matchUnrelated === null, 'Unrelated product yields no match (>60 threshold)');

  return { passed: allPassed, results, assertions };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('dataAndSearch.test')) {
  const { passed, results, assertions } = runDataAndSearchTestSuite();
  console.log(`\n--- DATA & SEARCH MATCHING TEST SUITE RESULTS (${assertions} assertions) ---`);
  results.forEach(r => console.log(r));
  console.log(`TOTAL RESULT: ${passed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}\n`);
  if (!passed) process.exit(1);
}
