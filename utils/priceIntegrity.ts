import { PriceInfo, DetectedProduct, ProductCatalogEntry } from '../types';

export type PriceIntegrityFlagCode = 
  | 'SWAPPED_PROMO_REGULAR'
  | 'DECIMAL_RECOVERED'
  | 'OUT_OF_BOUNDS_CORRECTED'
  | 'NORMALIZED_FORMAT'
  | 'DEDUPLICATED_IDENTICAL'
  | 'EXTREME_DISCOUNT_ANOMALY'
  | 'CATALOG_BENCHMARK_MISMATCH';

export interface PriceIntegrityResult {
  prices: PriceInfo[];
  flags: PriceIntegrityFlagCode[];
  status: 'valid' | 'corrected' | 'warning' | 'missing';
  regularPrice: number | null;
  promoPrice: number | null;
  discountPercent: number | null;
}

export interface PriceIntegritySummary {
  totalChecked: number;
  validCount: number;
  correctedCount: number;
  warningCount: number;
  missingCount: number;
  swappedPromoCount: number;
  decimalRecoveredCount: number;
  deduplicatedCount: number;
  integrityRate: number; // 0 - 100%
}

/**
 * Standard numeric price parser. Converts strings like "1.49", "1,49", " 2.99 € " to float numbers.
 */
export function parsePrice(priceValue: string | number | undefined | null): number | null {
  if (priceValue === undefined || priceValue === null) return null;
  if (typeof priceValue === 'number') {
    return isNaN(priceValue) ? null : priceValue;
  }
  
  const str = String(priceValue).trim();
  if (!str) return null;

  // Replace comma with dot, remove everything except digits and dot
  const cleaned = str.replace(',', '.').replace(/[^\d.]/g, '');
  if (!cleaned) return null;

  // Handle multiple dots (e.g. "1.4.9" -> "1.49")
  const parts = cleaned.split('.');
  let normalizedStr = cleaned;
  if (parts.length > 2) {
    normalizedStr = `${parts[0]}.${parts.slice(1).join('')}`;
  }

  const num = parseFloat(normalizedStr);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

/**
 * Formats a numeric or string price into standard European display format "1.49 €" or "1.49".
 */
export function formatPrice(priceValue: number | string | null | undefined, suffix: string = ''): string {
  const num = parsePrice(priceValue);
  if (num === null) return '-';
  const formatted = num.toFixed(2);
  return suffix ? `${formatted} ${suffix}`.trim() : formatted;
}

/**
 * Normalizes and recovers individual raw price strings.
 * Handles missing decimals (e.g. OCR returning 149 instead of 1.49),
 * removes artifacts, standardizes decimal notation.
 */
export function sanitizeSinglePrice(rawValue: string): { normalizedValue: string; flags: PriceIntegrityFlagCode[] } {
  const flags: PriceIntegrityFlagCode[] = [];
  if (!rawValue) return { normalizedValue: '', flags };

  let clean = rawValue.trim();
  // Remove currency signs, words, quotes
  clean = clean.replace(/€|Eur|EUR|Sk|Kč|CZK/gi, '').replace(/['"`]/g, '').trim();

  // If contains comma, turn to dot
  clean = clean.replace(',', '.');

  // Remove multiple dots
  const dotParts = clean.split('.');
  if (dotParts.length > 2) {
    clean = `${dotParts[0]}.${dotParts.slice(1).join('')}`;
    flags.push('NORMALIZED_FORMAT');
  }

  // Pure digits check - missing decimal recovery
  // e.g. "149" -> 1.49, "229" -> 2.29, "1290" -> 12.90, "99" -> 0.99
  if (/^\d+$/.test(clean)) {
    const intVal = parseInt(clean, 10);
    // Typical FMCG item price heuristics without decimal point
    if (intVal >= 50 && intVal <= 9999) {
      if (intVal < 100) {
        // e.g. 89 or 99 -> 0.89 or 0.99 €
        clean = `0.${clean}`;
      } else if (intVal >= 100 && intVal <= 999) {
        // e.g. 149 -> 1.49, 299 -> 2.99
        clean = `${clean.slice(0, 1)}.${clean.slice(1)}`;
      } else if (intVal >= 1000 && intVal <= 9999) {
        // e.g. 1290 -> 12.90, 2499 -> 24.99
        clean = `${clean.slice(0, 2)}.${clean.slice(2)}`;
      }
      flags.push('DECIMAL_RECOVERED');
    }
  }

  // Handle leading dot like ".49" -> "0.49"
  if (clean.startsWith('.')) {
    clean = `0${clean}`;
    flags.push('NORMALIZED_FORMAT');
  }

  // Convert to standard 2-decimal format
  const num = parseFloat(clean);
  if (!isNaN(num)) {
    // Check extreme bounds
    if (num <= 0 || num > 500) {
      flags.push('OUT_OF_BOUNDS_CORRECTED');
    }
    const finalVal = num.toFixed(2);
    return { normalizedValue: finalVal, flags };
  }

  return { normalizedValue: clean, flags };
}

/**
 * Enforces price data integrity across the array of prices for a product.
 * Guarantees:
 * 1. PROMO <= REGULAR (swaps if inverted by OCR)
 * 2. Formats all numbers with 2 decimal places
 * 3. Removes identical duplicate prices
 * 4. Filters out zero / NaN / negative values
 * 5. Cross-checks against catalog benchmarks if provided
 */
export function enforcePriceIntegrity(
  rawPrices: PriceInfo[] | undefined,
  catalogEntry?: ProductCatalogEntry | null
): PriceIntegrityResult {
  if (!rawPrices || !Array.isArray(rawPrices) || rawPrices.length === 0) {
    return {
      prices: [],
      flags: [],
      status: 'missing',
      regularPrice: null,
      promoPrice: null,
      discountPercent: null
    };
  }

  const allFlags: PriceIntegrityFlagCode[] = [];
  const processedPrices: PriceInfo[] = [];

  // Step 1: Clean each price entry
  for (const item of rawPrices) {
    if (!item || !item.value) continue;
    const { normalizedValue, flags } = sanitizeSinglePrice(item.value);
    flags.forEach(f => {
      if (!allFlags.includes(f)) allFlags.push(f);
    });

    const parsedNum = parsePrice(normalizedValue);
    if (parsedNum !== null && parsedNum > 0 && parsedNum <= 500) {
      const type = (item.type || '').toUpperCase().includes('PROMO') || (item.type || '').toUpperCase().includes('AKCIA') 
        ? 'PROMO' 
        : 'REGULAR';

      processedPrices.push({
        value: normalizedValue,
        type,
        raw: item.value,
        integrityFlags: flags.length > 0 ? flags : undefined
      });
    }
  }

  if (processedPrices.length === 0) {
    return {
      prices: [],
      flags: allFlags,
      status: 'missing',
      regularPrice: null,
      promoPrice: null,
      discountPercent: null
    };
  }

  // Step 2: Extract Regular and Promo
  const regularEntry = processedPrices.find(p => p.type === 'REGULAR');
  const promoEntry = processedPrices.find(p => p.type === 'PROMO');

  let rNum = regularEntry ? parsePrice(regularEntry.value) : null;
  let pNum = promoEntry ? parsePrice(promoEntry.value) : null;

  // Step 3: Integrity Rule - Swapped Regular and Promo (Promo cannot be higher than Regular)
  if (regularEntry && promoEntry && rNum !== null && pNum !== null) {
    if (pNum > rNum) {
      // OCR swapped them (e.g. read regular as promo or vice versa)
      const tempVal = regularEntry.value;
      regularEntry.value = promoEntry.value;
      promoEntry.value = tempVal;

      // Swap parsed numbers
      const tempNum = rNum;
      rNum = pNum;
      pNum = tempNum;

      if (!allFlags.includes('SWAPPED_PROMO_REGULAR')) {
        allFlags.push('SWAPPED_PROMO_REGULAR');
      }
    } else if (pNum === rNum) {
      // Identical regular & promo -> deduplicate to single regular entry
      allFlags.push('DEDUPLICATED_IDENTICAL');
      processedPrices.splice(processedPrices.indexOf(promoEntry), 1);
      pNum = null;
    }
  }

  // Step 4: Check discount percentage sanity (if both exist)
  let discountPercent: number | null = null;
  if (rNum !== null && pNum !== null && rNum > 0) {
    discountPercent = Math.round(((rNum - pNum) / rNum) * 100);
    if (discountPercent > 85 || discountPercent < 1) {
      allFlags.push('EXTREME_DISCOUNT_ANOMALY');
    }
  }

  // Step 5: Benchmark validation against product catalog (if available)
  if (catalogEntry && catalogEntry.recommendedPrice && catalogEntry.recommendedPrice > 0) {
    const bench = catalogEntry.recommendedPrice;
    const activePrice = pNum || rNum;
    if (activePrice) {
      const variance = Math.abs((activePrice - bench) / bench) * 100;
      if (variance > 150) {
        allFlags.push('CATALOG_BENCHMARK_MISMATCH');
      }

      processedPrices.forEach(p => {
        p.benchmarkPrice = bench;
        p.variancePercent = Math.round(variance);
      });
    }
  }

  // Step 6: Deduplicate identical value/type pairs
  const uniqueMap = new Map<string, PriceInfo>();
  processedPrices.forEach(p => {
    const key = `${p.value}|${p.type}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, p);
    }
  });
  const finalPrices = Array.from(uniqueMap.values());

  // Step 7: Determine overall integrity status
  let status: 'valid' | 'corrected' | 'warning' | 'missing' = 'valid';
  if (allFlags.includes('SWAPPED_PROMO_REGULAR') || allFlags.includes('DECIMAL_RECOVERED') || allFlags.includes('DEDUPLICATED_IDENTICAL')) {
    status = 'corrected';
  } else if (allFlags.includes('OUT_OF_BOUNDS_CORRECTED') || allFlags.includes('EXTREME_DISCOUNT_ANOMALY') || allFlags.includes('CATALOG_BENCHMARK_MISMATCH')) {
    status = 'warning';
  }

  return {
    prices: finalPrices,
    flags: allFlags,
    status,
    regularPrice: rNum,
    promoPrice: pNum,
    discountPercent
  };
}

/**
 * Validates and updates a DetectedProduct with price integrity verification.
 */
export function validateProductPriceIntegrity(
  product: DetectedProduct,
  catalogEntry?: ProductCatalogEntry | null
): DetectedProduct {
  const result = enforcePriceIntegrity(product.prices, catalogEntry);
  return {
    ...product,
    prices: result.prices,
    priceIntegrityStatus: result.status
  };
}

/**
 * Generates an aggregated Price Integrity report across a list of recognized products.
 */
export function auditPriceIntegrityStats(products: DetectedProduct[]): PriceIntegritySummary {
  let validCount = 0;
  let correctedCount = 0;
  let warningCount = 0;
  let missingCount = 0;
  let swappedPromoCount = 0;
  let decimalRecoveredCount = 0;
  let deduplicatedCount = 0;

  const physicalProducts = (products || []).filter(p => p.type === 'product' && !p.isGhost);
  const totalChecked = physicalProducts.length;

  physicalProducts.forEach(p => {
    const res = enforcePriceIntegrity(p.prices);
    if (res.status === 'valid') validCount++;
    else if (res.status === 'corrected') correctedCount++;
    else if (res.status === 'warning') warningCount++;
    else if (res.status === 'missing') missingCount++;

    if (res.flags.includes('SWAPPED_PROMO_REGULAR')) swappedPromoCount++;
    if (res.flags.includes('DECIMAL_RECOVERED')) decimalRecoveredCount++;
    if (res.flags.includes('DEDUPLICATED_IDENTICAL')) deduplicatedCount++;
  });

  const integrityRate = totalChecked > 0 
    ? Math.round(((validCount + correctedCount) / totalChecked) * 100)
    : 100;

  return {
    totalChecked,
    validCount,
    correctedCount,
    warningCount,
    missingCount,
    swappedPromoCount,
    decimalRecoveredCount,
    deduplicatedCount,
    integrityRate
  };
}
