import type { PriceGapItem, ProductCatalogEntry, BrandClassifications, StoreCentricSummary } from '../types';
import { getBrandFromName } from './helpers';

/**
 * Extracts float number from price string (e.g. "1.99 €", "2,49", "0.89 EUR")
 */
export const parseNumericPrice = (pStr?: string): number | null => {
  if (!pStr) return null;
  const cleanStr = pStr.replace(/[^0-9,.]/g, '').replace(',', '.');
  const num = parseFloat(cleanStr);
  return isNaN(num) ? null : num;
};

export interface ExtractedVolume {
  amount: number;
  unit: 'g' | 'kg' | 'ml' | 'l' | 'ks';
  baseMultiplier: number; // e.g. 0.5 for 500g in kg, 1.5 for 1.5L in l
  normalizedUnit: 'kg' | 'l' | 'ks';
  rawString: string;
}

/**
 * Extracts weight/volume from product name (e.g. "Jacobs Krönung 250g", "Kofola 1.5L", "Pilsner Urquell 0.5 l", "4x100g")
 */
export const extractVolumeAndUnit = (name: string): ExtractedVolume | null => {
  if (!name) return null;
  const cleanName = name.replace(/\s+/g, ' ');

  // 1. Multi-pack patterns like 4x100g, 6x0.5l, 2 x 250 g
  const multiPackMatch = cleanName.match(/(\d+)\s*[xX*]\s*(\d+[.,]?\d*)\s*(kg|g|l|ml|cl)/i);
  if (multiPackMatch) {
    const count = parseInt(multiPackMatch[1], 10);
    const amountPerItem = parseFloat(multiPackMatch[2].replace(',', '.'));
    const unitRaw = multiPackMatch[3].toLowerCase();
    const totalAmount = count * amountPerItem;

    if (unitRaw === 'g') {
      return {
        amount: totalAmount,
        unit: 'g',
        baseMultiplier: totalAmount / 1000,
        normalizedUnit: 'kg',
        rawString: multiPackMatch[0]
      };
    } else if (unitRaw === 'kg') {
      return {
        amount: totalAmount,
        unit: 'kg',
        baseMultiplier: totalAmount,
        normalizedUnit: 'kg',
        rawString: multiPackMatch[0]
      };
    } else if (unitRaw === 'ml') {
      return {
        amount: totalAmount,
        unit: 'ml',
        baseMultiplier: totalAmount / 1000,
        normalizedUnit: 'l',
        rawString: multiPackMatch[0]
      };
    } else if (unitRaw === 'cl') {
      return {
        amount: totalAmount,
        unit: 'ml',
        baseMultiplier: totalAmount / 100,
        normalizedUnit: 'l',
        rawString: multiPackMatch[0]
      };
    } else if (unitRaw === 'l') {
      return {
        amount: totalAmount,
        unit: 'l',
        baseMultiplier: totalAmount,
        normalizedUnit: 'l',
        rawString: multiPackMatch[0]
      };
    }
  }

  // 2. Standard single unit patterns: 250g, 1.5 l, 500 ml, 0,75L, 1kg, 80 g
  const singleMatch = cleanName.match(/(\d+[.,]?\d*)\s*(kg|g|l|ml|cl|ks|pack)\b/i);
  if (singleMatch) {
    const val = parseFloat(singleMatch[1].replace(',', '.'));
    const unitRaw = singleMatch[2].toLowerCase();

    if (unitRaw === 'g') {
      return {
        amount: val,
        unit: 'g',
        baseMultiplier: val / 1000,
        normalizedUnit: 'kg',
        rawString: singleMatch[0]
      };
    } else if (unitRaw === 'kg') {
      return {
        amount: val,
        unit: 'kg',
        baseMultiplier: val,
        normalizedUnit: 'kg',
        rawString: singleMatch[0]
      };
    } else if (unitRaw === 'ml') {
      return {
        amount: val,
        unit: 'ml',
        baseMultiplier: val / 1000,
        normalizedUnit: 'l',
        rawString: singleMatch[0]
      };
    } else if (unitRaw === 'cl') {
      return {
        amount: val,
        unit: 'ml',
        baseMultiplier: val / 100,
        normalizedUnit: 'l',
        rawString: singleMatch[0]
      };
    } else if (unitRaw === 'l') {
      return {
        amount: val,
        unit: 'l',
        baseMultiplier: val,
        normalizedUnit: 'l',
        rawString: singleMatch[0]
      };
    } else if (unitRaw === 'ks') {
      return {
        amount: val,
        unit: 'ks',
        baseMultiplier: val,
        normalizedUnit: 'ks',
        rawString: singleMatch[0]
      };
    }
  }

  return null;
};

/**
 * Calculates standard unit price (€/kg, €/l, €/ks) given actual retail price and product name or unit spec
 */
export const calculateUnitPrice = (
  price: number,
  productName: string,
  catalogUnitSize?: string
): { unitPrice: number; unitLabel: string; detectedVolume: string } | null => {
  if (!price || price <= 0) return null;

  const extracted = catalogUnitSize ? extractVolumeAndUnit(catalogUnitSize) : extractVolumeAndUnit(productName);
  if (!extracted || extracted.baseMultiplier <= 0) return null;

  const unitPrice = parseFloat((price / extracted.baseMultiplier).toFixed(2));
  const unitLabel = `€/${extracted.normalizedUnit}`;

  return {
    unitPrice,
    unitLabel,
    detectedVolume: extracted.rawString
  };
};

/**
 * Evaluates MOC (Recommended Retail Price) Compliance
 */
export const evaluateMocCompliance = (
  actualPrice: number,
  recommendedPrice?: number,
  tolerancePercent = 3
): { status: 'COMPLIANT' | 'OVERPRICED' | 'UNDERPRICED' | 'NO_MOC'; diffPercent: number; diffAbsolute: number } => {
  if (!recommendedPrice || recommendedPrice <= 0) {
    return { status: 'NO_MOC', diffPercent: 0, diffAbsolute: 0 };
  }

  const diffAbsolute = parseFloat((actualPrice - recommendedPrice).toFixed(2));
  const diffPercent = parseFloat((((actualPrice - recommendedPrice) / recommendedPrice) * 100).toFixed(1));

  if (Math.abs(diffPercent) <= tolerancePercent) {
    return { status: 'COMPLIANT', diffPercent, diffAbsolute };
  } else if (diffPercent > tolerancePercent) {
    return { status: 'OVERPRICED', diffPercent, diffAbsolute };
  } else {
    return { status: 'UNDERPRICED', diffPercent, diffAbsolute };
  }
};

/**
 * Calculates Price Gap Index against a benchmark (e.g. 100 is equal to benchmark, >100 is more expensive, <100 is cheaper)
 */
export const calculatePriceGapIndex = (
  actualPrice: number,
  benchmarkPrice: number
): { index: number; diffPercent: number } => {
  if (!benchmarkPrice || benchmarkPrice <= 0 || !actualPrice || actualPrice <= 0) {
    return { index: 100, diffPercent: 0 };
  }
  const index = Math.round((actualPrice / benchmarkPrice) * 100);
  const diffPercent = parseFloat((((actualPrice - benchmarkPrice) / benchmarkPrice) * 100).toFixed(1));
  return { index, diffPercent };
};

/**
 * Extracts and compiles comprehensive Price Intelligence items from store summaries & catalog
 */
export const buildPriceGapAnalytics = (
  storeData: StoreCentricSummary[],
  catalog: ProductCatalogEntry[],
  brandClassifications: BrandClassifications
): {
  items: PriceGapItem[];
  categoryAverages: Record<string, number>;
  ourBrandAverages: Record<string, number>;
  chainAverages: Record<string, { avgPrice: number; count: number }>;
} => {
  const items: PriceGapItem[] = [];
  const catalogMap = new Map<string, ProductCatalogEntry>();
  catalog.forEach(c => {
    catalogMap.set(c.canonicalName.toLowerCase().trim(), c);
    (c.aliases || []).forEach(a => catalogMap.set(a.toLowerCase().trim(), c));
  });

  storeData.forEach(store => {
    const chainName = store.storeName.split(',')[0]?.trim() || 'Neznámy reťazec';

    store.products.forEach(product => {
      if (product.type === 'pos_material' || product.isGhost) return;

      const brand = getBrandFromName(product.name);
      const isOurBrand = (brandClassifications.ourBrands || []).some(
        b => b.toLowerCase().trim() === brand.toLowerCase().trim()
      );

      // Find regular or promo prices
      const regPriceObj = product.priceHistory.find(ph => ph.price.type?.toUpperCase() === 'REGULAR');
      const promoPriceObj = product.priceHistory.find(ph => ph.price.type?.toUpperCase() === 'PROMO');

      const regularPriceNum = regPriceObj ? parseNumericPrice(regPriceObj.price.value) : null;
      const promoPriceNum = promoPriceObj ? parseNumericPrice(promoPriceObj.price.value) : null;

      const effectivePrice = promoPriceNum || regularPriceNum || (product.priceHistory[0] ? parseNumericPrice(product.priceHistory[0].price.value) : null);
      if (!effectivePrice || effectivePrice <= 0) return;

      // Find matching catalog entry for MOC
      const catEntry = catalogMap.get(product.name.toLowerCase().trim());
      const recommendedPrice = catEntry?.recommendedPrice;
      const unitSize = catEntry?.unitSize;

      const mocComp = evaluateMocCompliance(effectivePrice, recommendedPrice);
      const unitCalc = calculateUnitPrice(effectivePrice, product.name, unitSize);

      items.push({
        productName: product.name,
        brand,
        category: product.category || 'Nezaradené',
        isOurBrand,
        actualPrice: effectivePrice,
        recommendedPrice,
        mocDiffPercent: mocComp.diffPercent,
        mocStatus: mocComp.status,
        unitPrice: unitCalc?.unitPrice,
        unitLabel: unitCalc?.unitLabel,
        detectedVolume: unitCalc?.detectedVolume,
        storeName: store.storeName,
        chain: chainName,
        priceType: promoPriceNum ? 'PROMO' : 'REGULAR'
      });
    });
  });

  // Calculate category averages
  const catSums: Record<string, { total: number; count: number }> = {};
  const ourBrandSums: Record<string, { total: number; count: number }> = {};
  const chainSums: Record<string, { total: number; count: number }> = {};

  items.forEach(item => {
    // Category average
    if (!catSums[item.category]) catSums[item.category] = { total: 0, count: 0 };
    catSums[item.category].total += item.actualPrice;
    catSums[item.category].count += 1;

    // Our brand average in category
    if (item.isOurBrand) {
      if (!ourBrandSums[item.category]) ourBrandSums[item.category] = { total: 0, count: 0 };
      ourBrandSums[item.category].total += item.actualPrice;
      ourBrandSums[item.category].count += 1;
    }

    // Chain average
    const ch = item.chain || 'Iné';
    if (!chainSums[ch]) chainSums[ch] = { total: 0, count: 0 };
    chainSums[ch].total += item.actualPrice;
    chainSums[ch].count += 1;
  });

  const categoryAverages: Record<string, number> = {};
  Object.keys(catSums).forEach(cat => {
    categoryAverages[cat] = parseFloat((catSums[cat].total / catSums[cat].count).toFixed(2));
  });

  const ourBrandAverages: Record<string, number> = {};
  Object.keys(ourBrandSums).forEach(cat => {
    ourBrandAverages[cat] = parseFloat((ourBrandSums[cat].total / ourBrandSums[cat].count).toFixed(2));
  });

  const chainAverages: Record<string, { avgPrice: number; count: number }> = {};
  Object.keys(chainSums).forEach(ch => {
    chainAverages[ch] = {
      avgPrice: parseFloat((chainSums[ch].total / chainSums[ch].count).toFixed(2)),
      count: chainSums[ch].count
    };
  });

  // Calculate Price Index for each item against category average
  items.forEach(item => {
    const catAvg = categoryAverages[item.category];
    if (catAvg && catAvg > 0) {
      const pIndex = calculatePriceGapIndex(item.actualPrice, catAvg);
      item.priceIndex = pIndex.index;
      item.benchmarkGapPercent = pIndex.diffPercent;
    }
  });

  return {
    items,
    categoryAverages,
    ourBrandAverages,
    chainAverages
  };
};
