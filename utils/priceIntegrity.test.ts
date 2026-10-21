import { 
  parsePrice, 
  formatPrice, 
  sanitizeSinglePrice, 
  enforcePriceIntegrity, 
  auditPriceIntegrityStats 
} from './priceIntegrity.ts';
import type { PriceInfo, DetectedProduct, ProductCatalogEntry } from '../types.ts';

export interface TestResult {
  passed: boolean;
  results: string[];
  assertions: number;
}

/**
 * Functional test suite for Price Integrity & Normalization Engine.
 */
export function runPriceIntegrityTestSuite(): TestResult {
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

  // TEST 1: parsePrice conversions
  assert(parsePrice(null) === null, 'parsePrice(null) is null');
  assert(parsePrice(undefined) === null, 'parsePrice(undefined) is null');
  assert(parsePrice('') === null, 'parsePrice("") is null');
  assert(parsePrice('   ') === null, 'parsePrice whitespace is null');
  assert(parsePrice(1.49) === 1.49, 'parsePrice numeric 1.49');
  assert(parsePrice('1.49') === 1.49, 'parsePrice dot decimal string');
  assert(parsePrice('1,49') === 1.49, 'parsePrice comma decimal string');
  assert(parsePrice(' 2.99 € ') === 2.99, 'parsePrice with euro symbol and spaces');
  assert(parsePrice('1.4.9') === 1.49, 'parsePrice with accidental double dots');

  // TEST 2: formatPrice European formatting
  assert(formatPrice(1.49) === '1.49', 'formatPrice(1.49) is "1.49"');
  assert(formatPrice('1,49', '€') === '1.49 €', 'formatPrice with suffix is "1.49 €"');
  assert(formatPrice(null) === '-', 'formatPrice(null) returns "-"');

  // TEST 3: sanitizeSinglePrice - Decimal point recovery from OCR
  const rec1 = sanitizeSinglePrice('149');
  assert(rec1.normalizedValue === '1.49', 'Recovers "149" -> "1.49"');
  assert(rec1.flags.includes('DECIMAL_RECOVERED'), 'Flag DECIMAL_RECOVERED set for 149');

  const rec2 = sanitizeSinglePrice('229');
  assert(rec2.normalizedValue === '2.29', 'Recovers "229" -> "2.29"');

  const rec3 = sanitizeSinglePrice('1290');
  assert(rec3.normalizedValue === '12.90', 'Recovers "1290" -> "12.90"');

  const rec4 = sanitizeSinglePrice('89');
  assert(rec4.normalizedValue === '0.89', 'Recovers "89" -> "0.89"');

  const recDot = sanitizeSinglePrice('.79');
  assert(recDot.normalizedValue === '0.79', 'Recovers leading dot ".79" -> "0.79"');

  // TEST 4: enforcePriceIntegrity - Swapped Regular and Promo (promo > regular)
  const swappedPrices: PriceInfo[] = [
    { value: '1.20', type: 'REGULAR' },
    { value: '2.50', type: 'PROMO' } // Inverted by OCR
  ];
  const swappedRes = enforcePriceIntegrity(swappedPrices);
  assert(swappedRes.status === 'corrected', 'Status marked as "corrected" when prices swapped');
  assert(swappedRes.regularPrice === 2.50, 'Regular price swapped to 2.50');
  assert(swappedRes.promoPrice === 1.20, 'Promo price swapped to 1.20');
  assert(swappedRes.flags.includes('SWAPPED_PROMO_REGULAR'), 'Flag SWAPPED_PROMO_REGULAR set');

  // TEST 5: enforcePriceIntegrity - Identical regular & promo deduplication
  const identicalPrices: PriceInfo[] = [
    { value: '1.99', type: 'REGULAR' },
    { value: '1.99', type: 'PROMO' }
  ];
  const identicalRes = enforcePriceIntegrity(identicalPrices);
  assert(identicalRes.status === 'corrected', 'Status corrected for identical prices');
  assert(identicalRes.regularPrice === 1.99, 'Regular price preserved at 1.99');
  assert(identicalRes.promoPrice === null, 'Duplicate promo price eliminated');
  assert(identicalRes.flags.includes('DEDUPLICATED_IDENTICAL'), 'Flag DEDUPLICATED_IDENTICAL present');

  // TEST 6: Extreme discount anomaly flag (>85% discount)
  const extremePrices: PriceInfo[] = [
    { value: '10.00', type: 'REGULAR' },
    { value: '0.50', type: 'PROMO' } // 95% discount anomaly
  ];
  const extremeRes = enforcePriceIntegrity(extremePrices);
  assert(extremeRes.flags.includes('EXTREME_DISCOUNT_ANOMALY'), 'Extreme discount flagged');
  assert(extremeRes.status === 'warning', 'Status set to warning for extreme discount');

  // TEST 7: Catalog benchmark comparison
  const catalogEntry: ProductCatalogEntry = {
    canonicalName: 'Coca Cola 1.5L',
    aliases: [],
    recommendedPrice: 1.50
  };
  const deviatePrices: PriceInfo[] = [
    { value: '4.99', type: 'REGULAR' } // ~232% variance from benchmark
  ];
  const benchmarkRes = enforcePriceIntegrity(deviatePrices, catalogEntry);
  assert(benchmarkRes.flags.includes('CATALOG_BENCHMARK_MISMATCH'), 'Benchmark mismatch flagged');
  assert(benchmarkRes.status === 'warning', 'Status is warning when benchmark deviates > 150%');

  // TEST 8: Missing prices handling
  const missingRes = enforcePriceIntegrity([]);
  assert(missingRes.status === 'missing', 'Empty array returns status missing');
  assert(missingRes.regularPrice === null, 'Regular price is null for missing');

  // TEST 9: Aggregate price integrity statistics
  const sampleProducts: DetectedProduct[] = [
    {
      id: 'prod1',
      name: 'Item Valid',
      type: 'product',
      boundingBox: { x: 0, y: 0, width: 0.1, height: 0.1 },
      confidence: 0.95,
      prices: [{ value: '1.49', type: 'REGULAR' }]
    },
    {
      id: 'prod2',
      name: 'Item Swapped',
      type: 'product',
      boundingBox: { x: 0.1, y: 0, width: 0.1, height: 0.1 },
      confidence: 0.9,
      prices: [{ value: '1.00', type: 'REGULAR' }, { value: '2.00', type: 'PROMO' }]
    },
    {
      id: 'prod3',
      name: 'Item Missing',
      type: 'product',
      boundingBox: { x: 0.2, y: 0, width: 0.1, height: 0.1 },
      confidence: 0.85,
      prices: []
    }
  ];

  const stats = auditPriceIntegrityStats(sampleProducts);
  assert(stats.totalChecked === 3, 'auditPriceIntegrityStats checked 3 products');
  assert(stats.validCount === 1, '1 product is valid');
  assert(stats.correctedCount === 1, '1 product is corrected (swapped)');
  assert(stats.missingCount === 1, '1 product is missing price');
  assert(stats.swappedPromoCount === 1, 'Swapped promo count is 1');
  assert(stats.integrityRate === 67, 'Integrity rate is 67% (2 out of 3 valid or corrected)');

  return { passed: allPassed, results, assertions };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('priceIntegrity.test')) {
  const { passed, results, assertions } = runPriceIntegrityTestSuite();
  console.log(`\n--- PRICE INTEGRITY TEST SUITE RESULTS (${assertions} assertions) ---`);
  results.forEach(r => console.log(r));
  console.log(`TOTAL RESULT: ${passed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}\n`);
  if (!passed) process.exit(1);
}
