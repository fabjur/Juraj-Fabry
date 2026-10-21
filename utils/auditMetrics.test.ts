import { 
  normalizeProductObservation, 
  calculateAuditMetrics, 
  extractNumericPrice,
  applyObservationUpdate 
} from './auditMetrics.ts';
import type { SerializableImageState, Analysis, DetectedProduct, AuditFilterOptions } from '../types.ts';

/**
 * Self-test suite for the shared metrics and calculation engine.
 * Covers: duplicates, unknown values, multiple pricing tiers, data ranges, and denominator integrity.
 */
export function runAuditMetricsTestSuite(): { passed: boolean; results: string[] } {
  const results: string[] = [];
  let allPassed = true;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      results.push(`PASS: ${testName}`);
    } else {
      results.push(`FAIL: ${testName} - ${detail || 'Condition not met'}`);
      allPassed = false;
    }
  }

  // TEST 1: Missing price is null, never 0
  const nullPrice1 = extractNumericPrice(null);
  const nullPrice2 = extractNumericPrice(undefined);
  const nullPrice3 = extractNumericPrice('');
  const zeroPrice = extractNumericPrice(0);
  const validPrice = extractNumericPrice('1,89 €');

  assert(nullPrice1 === null, 'extractNumericPrice(null) returns null');
  assert(nullPrice2 === null, 'extractNumericPrice(undefined) returns null');
  assert(nullPrice3 === null, 'extractNumericPrice("") returns null');
  assert(zeroPrice === null, 'extractNumericPrice(0) returns null (never treat 0 as free price)');
  assert(validPrice === 1.89, 'extractNumericPrice("1,89 €") returns 1.89');

  // TEST 2: Product normalization without fuzzy auto-merge
  const p1: DetectedProduct = {
    id: 'p1',
    name: 'Kofola Original 0.5L',
    boundingBox: { x: 0.1, y: 0.2, width: 0.1, height: 0.3 },
    confidence: 0.95,
    prices: [{ value: '1.19 €', type: 'REGULAR' }],
  };
  const p2: DetectedProduct = {
    id: 'p2',
    name: 'Kofola Original 2.0L',
    boundingBox: { x: 0.2, y: 0.2, width: 0.15, height: 0.35 },
    confidence: 0.92,
    prices: [{ value: '1.99 €', type: 'REGULAR' }],
  };

  const norm1 = normalizeProductObservation(p1);
  const norm2 = normalizeProductObservation(p2);

  assert(norm1.canonicalSku === 'Kofola Original 0.5L', 'Canonical SKU preserved for 0.5L');
  assert(norm2.canonicalSku === 'Kofola Original 2.0L', 'Canonical SKU preserved for 2.0L');
  assert(norm1.regularPrice === 1.19, 'Regular price parsed correctly for p1');
  assert(norm2.regularPrice === 1.99, 'Regular price parsed correctly for p2');
  assert(norm1.facings === 1, 'Default facings is 1');

  // TEST 3: Facing counts and distinction from POS and Ghosts
  const ghostProd: DetectedProduct = {
    id: 'g1',
    name: 'Mockup Reklama Kofola',
    boundingBox: { x: 0.5, y: 0.1, width: 0.2, height: 0.2 },
    confidence: 0.88,
    isGhost: true,
  };
  const posProd: DetectedProduct = {
    id: 'pos1',
    name: 'Wobbler Zľava',
    type: 'pos_material',
    boundingBox: { x: 0.7, y: 0.3, width: 0.05, height: 0.05 },
    confidence: 0.9,
  };

  const mockImage: SerializableImageState = {
    id: 'img1',
    file: { name: 'regal1.jpg', type: 'image/jpeg', lastModified: Date.now(), data: '' },
    imageUrl: 'blob:mock',
    uploadDate: new Date().toISOString(),
    status: 'success',
    error: null,
    analysisResult: {
      products: [p1, p2, ghostProd, posProd],
    },
  };

  const mockAnalysis: Analysis = {
    id: 'a1',
    name: 'Audit Billa Central',
    createdAt: new Date().toISOString(),
    images: [mockImage],
    store: { name: 'Billa Central', chain: 'Billa' },
  };

  const metrics = calculateAuditMetrics([mockImage], mockAnalysis);

  assert(metrics.totalFacings === 2, 'Total facings strictly counts real products (2)', `Got ${metrics.totalFacings}`);
  assert(metrics.ghostsCount === 1, 'Ghost products tracked separately (1)', `Got ${metrics.ghostsCount}`);
  assert(metrics.posCount === 1, 'POS materials tracked separately (1)', `Got ${metrics.posCount}`);
  assert(metrics.uniqueSkusCount === 2, 'Unique SKUs count is 2 (no fuzzy collapsing)', `Got ${metrics.uniqueSkusCount}`);
  assert(metrics.priceCoveragePercent === 100, 'Price coverage is 100%', `Got ${metrics.priceCoveragePercent}`);

  // TEST 4: Missing geometry -> "Nedá sa vyhodnotiť" instead of "0k px²"
  const pNoGeo: DetectedProduct = {
    id: 'p3',
    name: 'Minerálka',
    boundingBox: { x: 0, y: 0, width: 0, height: 0 },
    confidence: 0.8,
  };
  const mockImageNoGeo: SerializableImageState = {
    id: 'img2',
    file: { name: 'regal2.jpg', type: 'image/jpeg', lastModified: Date.now(), data: '' },
    imageUrl: 'blob:mock2',
    uploadDate: new Date().toISOString(),
    status: 'success',
    error: null,
    analysisResult: {
      products: [pNoGeo],
    },
  };

  const metricsNoGeo = calculateAuditMetrics([mockImageNoGeo], null);
  assert(
    metricsNoGeo.isAreaEvaluatable === false,
    'Missing geometry results in isAreaEvaluatable === false (Nedá sa vyhodnotiť)',
    `isAreaEvaluatable was ${metricsNoGeo.isAreaEvaluatable}`
  );
  assert(
    metricsNoGeo.categoryShares[0]?.areaSharePercent === null,
    'Area share percent is null when geometry is not evaluatable'
  );

  // TEST 5: Observation update and audit trail
  const { updatedAnalysis, updatedProduct } = applyObservationUpdate(
    mockAnalysis,
    'img1',
    'p1',
    { regularPrice: 1.29 },
    'Inšpektor Juraj'
  );

  assert(updatedProduct?.regularPrice === 1.29, 'Observation price updated to 1.29');
  assert(updatedProduct?.isCorrected === true, 'Observation marked as corrected');
  assert(
    (updatedProduct?.auditTrail?.length || 0) > 0,
    'Audit trail entry added to observation'
  );
  assert(
    updatedAnalysis.images[0].analysisResult?.products[0].prices?.[0].value === '1.29 €',
    'Price array synchronized with corrected regularPrice'
  );

  // TEST 6: Duplicates & Facing Accumulation
  // Three separate bottles of the same SKU on the shelf must equal 3 facings, 1 unique SKU
  const pDup1: DetectedProduct = {
    id: 'dup1',
    name: 'Pilsner Urquell 0.5L Plech',
    boundingBox: { x: 0.1, y: 0.5, width: 0.08, height: 0.25 },
    prices: [{ value: '1.49 €', type: 'REGULAR' }],
  };
  const pDup2: DetectedProduct = {
    id: 'dup2',
    name: 'Pilsner Urquell 0.5L Plech',
    boundingBox: { x: 0.2, y: 0.5, width: 0.08, height: 0.25 },
    prices: [{ value: '1.49 €', type: 'REGULAR' }],
  };
  const pDup3: DetectedProduct = {
    id: 'dup3',
    name: 'Pilsner Urquell 0.5L Plech',
    boundingBox: { x: 0.3, y: 0.5, width: 0.08, height: 0.25 },
    prices: [{ value: '1.49 €', type: 'REGULAR' }],
  };

  const imageWithDuplicates: SerializableImageState = {
    id: 'img_dup',
    file: { name: 'beer_shelf.jpg', type: 'image/jpeg', lastModified: Date.now(), data: '' },
    imageUrl: 'blob:dup',
    uploadDate: new Date().toISOString(),
    status: 'success',
    error: null,
    analysisResult: {
      products: [pDup1, pDup2, pDup3],
    },
  };

  const dupMetrics = calculateAuditMetrics([imageWithDuplicates]);
  assert(dupMetrics.totalFacings === 3, 'Multiple shelf detections accumulate to 3 facings', `Got ${dupMetrics.totalFacings}`);
  assert(dupMetrics.uniqueSkusCount === 1, 'Same SKU has uniqueSkusCount === 1', `Got ${dupMetrics.uniqueSkusCount}`);
  assert(dupMetrics.totalVisiblePacks === 3, 'Visible packs accurately counts 3 units', `Got ${dupMetrics.totalVisiblePacks}`);

  // TEST 7: Multi-tier pricing (Regular, Promo, and Club price distinction)
  const pMultiPrice: DetectedProduct = {
    id: 'p_prices',
    name: 'Čokoláda Milka 100g',
    boundingBox: { x: 0.4, y: 0.4, width: 0.1, height: 0.1 },
    prices: [
      { value: '1.79 €', type: 'REGULAR' },
      { value: '1.19 €', type: 'PROMO' },
      { value: '0.99 €', type: 'CLUB' }
    ],
  };
  const normMultiPrice = normalizeProductObservation(pMultiPrice);
  assert(normMultiPrice.regularPrice === 1.79, 'Regular price parsed as 1.79');
  assert(normMultiPrice.promoPrice === 1.19, 'Promo price parsed as 1.19');
  assert(normMultiPrice.clubPrice === 0.99, 'Club loyalty price parsed as 0.99');
  assert(normMultiPrice.currency === 'EUR', 'Currency defaults to EUR');

  // TEST 8: Unknown / Missing Values Robustness
  const pMissingInfo: DetectedProduct = {
    id: 'p_unknown',
    name: 'Neznámy produkt na regáli',
    // Missing brand, missing prices, missing bounding box coordinates
  };
  const normMissing = normalizeProductObservation(pMissingInfo);
  assert(normMissing.regularPrice === null, 'Missing regular price is null, never 0 or NaN');
  assert(normMissing.promoPrice === null, 'Missing promo price is null');
  assert(normMissing.clubPrice === null, 'Missing club price is null');
  assert(normMissing.estimatedStock === null, 'Unmeasured stock is null, never fabricated');
  assert(normMissing.verificationStatus === 'pending_review', 'Missing data observation marked pending_review');

  // TEST 9: Different data ranges & Filter Scopes
  const imgScopeA: SerializableImageState = {
    id: 'img_a',
    file: { name: 'nealko.jpg', type: 'image/jpeg', lastModified: Date.now(), data: '' },
    imageUrl: 'blob:a',
    uploadDate: '2026-03-01T10:00:00Z',
    status: 'success',
    error: null,
    analysisResult: {
      products: [
        { id: 'a1', name: 'Kofola 2L', category: 'Nealko', prices: [{ value: '1.89 €', type: 'REGULAR' }] },
        { id: 'a2', name: 'Rajec 1.5L', category: 'Voda', prices: [{ value: '0.89 €', type: 'REGULAR' }] },
      ],
    },
  };
  const imgScopeB: SerializableImageState = {
    id: 'img_b',
    file: { name: 'sladkosti.jpg', type: 'image/jpeg', lastModified: Date.now(), data: '' },
    imageUrl: 'blob:b',
    uploadDate: '2026-03-02T10:00:00Z',
    status: 'success',
    error: null,
    analysisResult: {
      products: [
        { id: 'b1', name: 'Horalka 50g', category: 'Sladkosti', prices: [{ value: '0.65 €', type: 'REGULAR' }] },
      ],
    },
  };

  const allImages = [imgScopeA, imgScopeB];

  // Scope 1: Filter by category 'Nealko'
  const filterNealko: AuditFilterOptions = { category: 'Nealko' };
  const metricsNealko = calculateAuditMetrics(allImages, null, filterNealko);
  assert(metricsNealko.totalFacings === 1, 'Category filter isolates Nealko (1 facing)', `Got ${metricsNealko.totalFacings}`);
  assert(metricsNealko.appliedFilters?.category === 'Nealko', 'Applied filters contains category Nealko');

  // Scope 2: Filter by single image scope 'img_b'
  const filterImageB: AuditFilterOptions = { imageId: 'img_b' };
  const metricsImgB = calculateAuditMetrics(allImages, null, filterImageB);
  assert(metricsImgB.totalFacings === 1, 'Image scope isolates img_b (1 facing)', `Got ${metricsImgB.totalFacings}`);

  // TEST 10: Denominator preservation with unrecognized items
  // Unrecognized items must not silently fall out of the denominator in shelf shares
  const pUnrec: DetectedProduct = {
    id: 'unrec1',
    name: 'Neznáma plechovka bez etikety',
    category: 'Nezaradené',
    facings: 2,
    boundingBox: { x: 0.6, y: 0.1, width: 0.1, height: 0.2 },
  };
  const imgWithUnrec: SerializableImageState = {
    id: 'img_unrec',
    file: { name: 'mixed_shelf.jpg', type: 'image/jpeg', lastModified: Date.now(), data: '' },
    imageUrl: 'blob:unrec',
    uploadDate: new Date().toISOString(),
    status: 'success',
    error: null,
    analysisResult: {
      products: [p1, pUnrec], // p1 has 1 facing, pUnrec has 2 facings => total denominator = 3
    },
  };

  const metricsUnrec = calculateAuditMetrics([imgWithUnrec]);
  assert(metricsUnrec.totalFacings === 3, 'Total denominator includes unrecognized items (3 facings)', `Got ${metricsUnrec.totalFacings}`);
  const catShareP1 = metricsUnrec.categoryShares.find(c => c.category !== 'Nezaradené');
  assert(catShareP1?.facingDenominator === 3, 'Share denominator for known category preserves total (3)', `Got ${catShareP1?.facingDenominator}`);
  assert(catShareP1?.unrecognizedIncludedInDenominator === true, 'Flag unrecognizedIncludedInDenominator is true');

  return { passed: allPassed, results };
}

// Direct execution entry point when run with tsx or node
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('auditMetrics.test')) {
  const { passed, results } = runAuditMetricsTestSuite();
  console.log(`\n--- AUDIT METRICS TEST SUITE RESULTS ---`);
  results.forEach(r => console.log(r));
  console.log(`----------------------------------------`);
  console.log(`TOTAL RESULT: ${passed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}\n`);
  if (!passed) {
    process.exit(1);
  }
}
