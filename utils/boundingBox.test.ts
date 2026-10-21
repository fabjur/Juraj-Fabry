import { 
  clamp, 
  normalizeBoundingBox, 
  getBoxCenter, 
  calculateIoU, 
  isPromoProduct 
} from './boundingBoxUtils.ts';
import type { BoundingBox, DetectedProduct } from '../types.ts';

export interface TestResult {
  passed: boolean;
  results: string[];
  assertions: number;
}

/**
 * Functional test suite for Geometric & Bounding Box Utilities.
 */
export function runBoundingBoxTestSuite(): TestResult {
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

  // TEST 1: clamp utility
  assert(clamp(0.5, 0, 1) === 0.5, 'clamp within range remains unchanged');
  assert(clamp(-0.2, 0, 1) === 0, 'clamp negative value bounded to min');
  assert(clamp(1.5, 0, 1) === 1, 'clamp excessive value bounded to max');
  assert(clamp(NaN, 0, 1) === 0, 'clamp NaN returns min value safely');

  // TEST 2: normalizeBoundingBox
  const nullBox = normalizeBoundingBox(null as any);
  assert(nullBox.x === 0 && nullBox.width === 0, 'null box returns safe zero box');

  // Negative width and height correction
  const invertedBox: BoundingBox = { x: 0.5, y: 0.5, width: -0.2, height: -0.3 };
  const normInverted = normalizeBoundingBox(invertedBox);
  assert(Math.abs(normInverted.x - 0.3) < 0.001, 'Inverted width moves x origin to 0.3');
  assert(Math.abs(normInverted.y - 0.2) < 0.001, 'Inverted height moves y origin to 0.2');
  assert(Math.abs(normInverted.width - 0.2) < 0.001, 'Width is made positive');
  assert(Math.abs(normInverted.height - 0.3) < 0.001, 'Height is made positive');

  // Coordinates outside [0, 1] clamped
  const overflowBox: BoundingBox = { x: 0.9, y: 0.8, width: 0.5, height: 0.5 };
  const normOverflow = normalizeBoundingBox(overflowBox);
  assert(normOverflow.x === 0.9, 'x clamped within limits');
  assert(Math.abs(normOverflow.width - 0.1) < 0.001, 'width clamped to 1 - x (0.1)');
  assert(Math.abs(normOverflow.height - 0.2) < 0.001, 'height clamped to 1 - y (0.2)');

  // TEST 3: getBoxCenter
  const boxForCenter: BoundingBox = { x: 0.2, y: 0.4, width: 0.2, height: 0.2 };
  const center = getBoxCenter(boxForCenter);
  assert(Math.abs(center.cx - 0.3) < 0.001, 'Center X is cx = 0.3');
  assert(Math.abs(center.cy - 0.5) < 0.001, 'Center Y is cy = 0.5');

  // TEST 4: calculateIoU (Intersection over Union)
  // Subtest 4a: Identical boxes => IoU = 1.0
  const boxA: BoundingBox = { x: 0.1, y: 0.1, width: 0.2, height: 0.2 };
  const boxSameA: BoundingBox = { x: 0.1, y: 0.1, width: 0.2, height: 0.2 };
  const iouIdentical = calculateIoU(boxA, boxSameA);
  assert(Math.abs(iouIdentical - 1.0) < 0.001, 'IoU of identical boxes is 1.0');

  // Subtest 4b: Completely disjoint boxes => IoU = 0.0
  const boxDisjoint: BoundingBox = { x: 0.6, y: 0.6, width: 0.2, height: 0.2 };
  const iouDisjoint = calculateIoU(boxA, boxDisjoint);
  assert(iouDisjoint === 0, 'IoU of non-overlapping boxes is 0.0');

  // Subtest 4c: 50% overlap calculation
  // Box 1: [0, 0] to [0.2, 0.2] (area = 0.04)
  // Box 2: [0.1, 0] to [0.3, 0.2] (area = 0.04)
  // Intersection: [0.1, 0] to [0.2, 0.2] (area = 0.1 * 0.2 = 0.02)
  // Union = 0.04 + 0.04 - 0.02 = 0.06
  // IoU = 0.02 / 0.06 = 1/3 ~ 0.3333
  const b1: BoundingBox = { x: 0, y: 0, width: 0.2, height: 0.2 };
  const b2: BoundingBox = { x: 0.1, y: 0, width: 0.2, height: 0.2 };
  const iouOverlap = calculateIoU(b1, b2);
  assert(Math.abs(iouOverlap - (1 / 3)) < 0.01, 'IoU of partially overlapping boxes calculated accurately (~0.33)');

  // TEST 5: isPromoProduct
  const normalProduct: DetectedProduct = {
    id: 'p1',
    name: 'Standard Milk',
    boundingBox: { x: 0, y: 0, width: 0.1, height: 0.1 },
    confidence: 0.9,
    prices: [{ value: '0.99', type: 'REGULAR' }]
  };
  const promoProduct: DetectedProduct = {
    id: 'p2',
    name: 'Discount Juice',
    boundingBox: { x: 0, y: 0, width: 0.1, height: 0.1 },
    confidence: 0.9,
    prices: [{ value: '1.49', type: 'PROMO' }]
  };
  const slovakAkciaProduct: DetectedProduct = {
    id: 'p3',
    name: 'Akciové Pivo',
    boundingBox: { x: 0, y: 0, width: 0.1, height: 0.1 },
    confidence: 0.9,
    prices: [{ value: '0.79 AKCIA', type: 'AKCIA' }]
  };

  assert(isPromoProduct(normalProduct) === false, 'Standard product is not promo');
  assert(isPromoProduct(promoProduct) === true, 'PROMO type recognized as promo product');
  assert(isPromoProduct(slovakAkciaProduct) === true, 'AKCIA recognized as promo product');

  return { passed: allPassed, results, assertions };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('boundingBox.test')) {
  const { passed, results, assertions } = runBoundingBoxTestSuite();
  console.log(`\n--- BOUNDING BOX & GEOMETRY TEST SUITE RESULTS (${assertions} assertions) ---`);
  results.forEach(r => console.log(r));
  console.log(`TOTAL RESULT: ${passed ? 'ALL TESTS PASSED ✓' : 'SOME TESTS FAILED ✗'}\n`);
  if (!passed) process.exit(1);
}
