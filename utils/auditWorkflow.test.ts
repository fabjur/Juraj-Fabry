import type { DetectedProduct, Analysis, SerializableImageState } from '../types.ts';
import { 
  normalizeProductObservation, 
  applyObservationUpdate, 
  calculateAuditMetrics 
} from './auditMetrics.ts';

export interface TestResult {
  passed: boolean;
  results: string[];
  assertions: number;
}

/**
 * Functional test suite for Audit Workflow, Stepper Logic, and Human-in-the-loop Verification.
 */
export function runAuditWorkflowTestSuite(): TestResult {
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

  // 1. Initial State: Unprocessed / New Image
  const p1: DetectedProduct = {
    id: 'p_raw',
    name: 'Kofola Bez Cukru 2L',
    boundingBox: { x: 0.1, y: 0.2, width: 0.1, height: 0.3 },
    confidence: 0.72, // Below 80% confidence threshold -> should flag for review
    prices: [] // Missing price
  };

  const normP1 = normalizeProductObservation(p1);
  assert(normP1.verificationStatus === 'pending_review', 'Low confidence/missing price flags observation as pending_review');
  assert(normP1.regularPrice === null, 'Regular price is explicitly null');
  assert(normP1.facings === 1, 'Default facings set to 1');

  // 2. High confidence observation auto-acceptance
  const pHighConf: DetectedProduct = {
    id: 'p_high',
    name: 'Pilsner Urquell 0.5L',
    boundingBox: { x: 0.3, y: 0.2, width: 0.1, height: 0.3 },
    confidence: 0.96,
    prices: [{ value: '1.49 €', type: 'REGULAR' }]
  };
  const normHigh = normalizeProductObservation(pHighConf);
  assert(normHigh.verificationStatus === 'auto_accepted', 'High confidence (>90%) with valid price marked auto_accepted');

  // 3. Human Verification / Correction with Audit Trail
  const mockImage: SerializableImageState = {
    id: 'img_test_1',
    file: { name: 'regal_test.jpg', type: 'image/jpeg', lastModified: Date.now(), data: '' },
    imageUrl: 'blob:test',
    uploadDate: new Date().toISOString(),
    status: 'success',
    error: null,
    analysisResult: {
      products: [normP1, normHigh]
    }
  };

  const mockAnalysis: Analysis = {
    id: 'analysis_workflow_1',
    name: 'Audit Predajne Tesco',
    createdAt: new Date().toISOString(),
    images: [mockImage],
    store: { name: 'Tesco Lamač', chain: 'Tesco' }
  };

  // User in UI supplies missing regular price 1.79 EUR and confirms SKU
  const updateResult = applyObservationUpdate(
    mockAnalysis,
    'img_test_1',
    'p_raw',
    {
      regularPrice: 1.79,
      verificationStatus: 'human_verified',
      skuVerificationStatus: 'confirmed'
    },
    'Inšpektor Martin'
  );

  assert(updateResult.updatedProduct !== null, 'Product update returned updated entity');
  assert(updateResult.updatedProduct?.regularPrice === 1.79, 'Regular price updated to 1.79');
  assert(updateResult.updatedProduct?.verificationStatus === 'human_verified', 'Status transitioned to human_verified');
  assert(updateResult.updatedProduct?.isCorrected === true, 'isCorrected set to true');

  const trail = updateResult.updatedProduct?.auditTrail || [];
  assert(trail.length > 0, 'Audit trail entry created');
  assert(trail[0].user === 'Inšpektor Martin', 'Audit trail records user name');

  // 4. Metrics re-calculation reflects updated data
  const updatedImages = updateResult.updatedAnalysis.images;
  const metricsAfter = calculateAuditMetrics(updatedImages, updateResult.updatedAnalysis);

  assert(metricsAfter.totalFacings === 2, 'Total facings remains consistent (2)');
  assert(metricsAfter.withPriceCount === 2, 'With price count is now 2 (100% price coverage)');
  assert(metricsAfter.priceCoveragePercent === 100, 'Price coverage recalculated to 100%');
  assert(metricsAfter.pendingReviewCount === 0, 'Pending review count dropped to 0');
  assert(metricsAfter.verificationProgressPercent === 100, 'Verification progress is 100%');

  // 5. Excluded/Discarded items do not pollute facings
  const pDiscarded: DetectedProduct = {
    id: 'p_disc',
    name: 'Cudzí objekt / Ruka zákazníka',
    boundingBox: { x: 0.8, y: 0.1, width: 0.1, height: 0.1 },
    confidence: 0.4,
    isDiscarded: true
  };

  const imageWithDiscarded: SerializableImageState = {
    ...mockImage,
    id: 'img_test_2',
    analysisResult: {
      products: [normHigh, pDiscarded]
    }
  };

  const metricsDiscarded = calculateAuditMetrics([imageWithDiscarded]);
  assert(metricsDiscarded.totalFacings === 1, 'Discarded false positive excluded from facings count');
  assert(metricsDiscarded.discardedCount === 1, 'Discarded item tracked separately in discardedCount');

  // 6. Shelf Share (SOS) Mode: No mandatory prices required
  const pSosProduct: DetectedProduct = {
    id: 'p_sos_1',
    name: 'Kofola Original 2L',
    confidence: 0.94, // High confidence (> 0.88)
    prices: [] // No prices on shelf
  };
  const normSos = normalizeProductObservation(pSosProduct, { isShelfShare: true });
  assert(normSos.verificationStatus === 'auto_accepted', 'High confidence SOS product without prices is auto_accepted');

  const sosImage: SerializableImageState = {
    ...mockImage,
    id: 'img_sos',
    analysisType: 'shelfShare',
    analysisResult: {
      products: [normSos]
    }
  };
  const sosAnalysis: Analysis = {
    ...mockAnalysis,
    id: 'analysis_sos',
    analysisType: 'shelfShare',
    images: [sosImage]
  };
  const sosMetrics = calculateAuditMetrics([sosImage], sosAnalysis);
  assert(sosMetrics.pendingReviewCount === 0, 'SOS pending review count is 0 when prices not required');
  assert(sosMetrics.missingPriceCount === 0, 'SOS missing price count is 0');

  return { passed: allPassed, results, assertions };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('auditWorkflow.test')) {
  const { passed, results, assertions } = runAuditWorkflowTestSuite();
  console.log(`\n--- AUDIT WORKFLOW & TRIAGE TEST SUITE RESULTS (${assertions} assertions) ---`);
  results.forEach(r => console.log(r));
  console.log(`TOTAL RESULT: ${passed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}\n`);
  if (!passed) process.exit(1);
}
