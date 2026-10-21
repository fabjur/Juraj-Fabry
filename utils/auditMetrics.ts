import type { 
  DetectedProduct, 
  SerializableImageState, 
  Analysis, 
  BrandClassifications,
  AuditFilterOptions,
  SharedAuditMetrics,
  SingleShareMetric,
  ProductObservation,
  ObservationAuditTrailEntry,
  PriceInfo
} from '../types.ts';
import { getBrandFromName, getCategoryFromName } from './helpers.ts';
import { parsePrice } from './priceIntegrity.ts';

/**
 * Safely parses any price string or object to a numeric value or null.
 * CRITICAL RULE: A missing or invalid price is ALWAYS null, NEVER 0.
 */
export function extractNumericPrice(priceValue?: string | number | null): number | null {
  if (priceValue === null || priceValue === undefined || priceValue === '') return null;
  if (typeof priceValue === 'number') {
    return isNaN(priceValue) || priceValue <= 0 ? null : priceValue;
  }
  const parsed = parsePrice(String(priceValue));
  return parsed !== null && parsed > 0 ? parsed : null;
}

/**
 * Normalizes a detected product into a stable observation format with explicit prices,
 * metrics (facings, visible packs, stock), and verification state.
 */
export function normalizeProductObservation(
  product: DetectedProduct,
  context?: {
    imageId?: string;
    imageName?: string;
    uploadDate?: string;
    storeName?: string;
    storeChain?: string;
    analysisId?: string;
    defaultCategory?: string;
    analysisType?: string;
    isShelfShare?: boolean;
    requirePricesInShelfShare?: boolean;
  }
): DetectedProduct {
  const prices = Array.isArray(product.prices) ? product.prices : [];
  
  // Extract regular, promo, club prices
  let regPrice: number | null = null;
  let promoPrice: number | null = null;
  let clubPrice: number | null = null;

  prices.forEach(p => {
    const val = extractNumericPrice(p.value);
    if (val !== null) {
      const typeUpper = (p.type || '').toUpperCase();
      if (typeUpper.includes('PROMO') || typeUpper.includes('AKCIA') || typeUpper.includes('DISCOUNT')) {
        promoPrice = val;
      } else if (typeUpper.includes('CLUB') || typeUpper.includes('LOYALTY') || typeUpper.includes('KARTA')) {
        clubPrice = val;
      } else {
        regPrice = val;
      }
    }
  });

  // Check direct properties: if explicitly a number or if prices was empty
  if (typeof product.regularPrice === 'number') {
    regPrice = product.regularPrice;
  }
  if (typeof product.promoPrice === 'number') {
    promoPrice = product.promoPrice;
  }
  if (typeof product.clubPrice === 'number') {
    clubPrice = product.clubPrice;
  }

  // Ensure prices array is ALWAYS synchronized with direct prices (regularPrice, promoPrice, clubPrice)
  const synchronizedPrices: PriceInfo[] = [];
  if (regPrice !== null && regPrice > 0) synchronizedPrices.push({ value: `${regPrice.toFixed(2)} €`, type: 'REGULAR' });
  if (promoPrice !== null && promoPrice > 0) synchronizedPrices.push({ value: `${promoPrice.toFixed(2)} €`, type: 'PROMO' });
  if (clubPrice !== null && clubPrice > 0) synchronizedPrices.push({ value: `${clubPrice.toFixed(2)} €`, type: 'CLUB' });
  prices.forEach(p => {
    const t = (p.type || '').toUpperCase();
    if (!t.includes('REGULAR') && !t.includes('PROMO') && !t.includes('AKCIA') && !t.includes('CLUB') && !t.includes('KLUB')) {
      synchronizedPrices.push(p);
    }
  });

  // Canonical SKU without fuzzy auto-merge
  const canonicalSku = product.canonicalSku || product.name.trim();
  const category = product.category || getCategoryFromName(canonicalSku, context?.defaultCategory || 'Všeobecné');
  const brand = product.brand || getBrandFromName(canonicalSku);

  // Facings vs visible packs vs stock
  const facings = typeof product.facings === 'number' && product.facings >= 0 ? product.facings : 1;
  const visiblePacks = typeof product.visiblePacks === 'number' && product.visiblePacks >= 0 ? product.visiblePacks : facings;
  const estimatedStock = product.estimatedStock !== undefined ? product.estimatedStock : null;

  // Verification status determination
  const isSos = Boolean(context?.isShelfShare || context?.analysisType === 'shelfShare');
  const requirePrices = isSos ? Boolean(context?.requirePricesInShelfShare) : true;

  let verificationStatus = product.verificationStatus;
  if (!verificationStatus) {
    if (product.isDiscarded) {
      verificationStatus = 'unresolvable';
    } else if (product.isCorrected) {
      verificationStatus = 'human_verified';
    } else if (
      (product.confidence ?? 0.85) >= 0.88 && 
      (!requirePrices || regPrice !== null || promoPrice !== null) &&
      !product.isGhost && 
      product.type !== 'pos_material'
    ) {
      verificationStatus = 'auto_accepted';
    } else {
      verificationStatus = 'pending_review';
    }
  }

  // Store original AI snapshot for auditing if not already present
  const originalAiSnapshot = product.originalAiSnapshot || {
    name: product.name,
    prices: [...prices],
    confidence: product.confidence ?? 0.85,
    boundingBox: product.boundingBox ? { ...product.boundingBox } : undefined,
  };

  return {
    ...product,
    imageId: product.imageId || context?.imageId,
    name: canonicalSku,
    canonicalSku,
    brand,
    category,
    facings,
    visiblePacks,
    estimatedStock,
    regularPrice: regPrice,
    promoPrice,
    clubPrice,
    prices: synchronizedPrices.length > 0 ? synchronizedPrices : prices,
    currency: product.currency || 'EUR',
    verificationStatus,
    skuVerificationStatus: product.skuVerificationStatus || (product.isCorrected ? 'confirmed' : 'unverified'),
    priceReadabilityStatus: product.priceReadabilityStatus || (prices.length > 0 ? 'readable' : 'missing'),
    tagAssociationStatus: product.tagAssociationStatus || 'correct',
    isDiscarded: Boolean(product.isDiscarded),
    needsRetake: Boolean(product.needsRetake),
    originalAiSnapshot,
    auditTrail: Array.isArray(product.auditTrail) ? product.auditTrail : [],
  };
}

/**
 * Extracts flat list of observations linked to audit, store, image, and geometry.
 */
export function extractObservations(
  analysis: Analysis | null,
  images?: SerializableImageState[]
): ProductObservation[] {
  const sourceImages = images || analysis?.images || [];
  const observations: ProductObservation[] = [];
  const isSosAnalysis = analysis?.analysisType === 'shelfShare';
  const requirePricesInShelfShare = typeof window !== 'undefined' ? localStorage.getItem('salesapp_sos_require_prices') === 'true' : false;

  sourceImages.forEach(img => {
    if (!img.analysisResult?.products || !Array.isArray(img.analysisResult.products)) return;

    const storeName = img.assignedStore?.name || analysis?.store?.name || img.analysisResult.storeInfo?.chain || 'Predajňa';
    const storeChain = img.assignedStore?.chain || analysis?.store?.chain || img.analysisResult.storeInfo?.chain;
    const storeId = img.assignedStoreId || analysis?.storeId;
    const isSos = isSosAnalysis || img.analysisType === 'shelfShare';

    img.analysisResult.products.forEach((prod, pIdx) => {
      const normalized = normalizeProductObservation(prod, {
        imageId: img.id,
        imageName: img.file?.name,
        uploadDate: img.uploadDate,
        storeName,
        storeChain,
        analysisId: analysis?.id,
        analysisType: img.analysisType || analysis?.analysisType,
        isShelfShare: isSos,
        requirePricesInShelfShare,
      });

      observations.push({
        ...normalized,
        observationId: `${img.id}_${prod.id || pIdx}`,
        analysisId: analysis?.id || 'current_audit',
        storeId,
        storeName,
        storeChain,
        imageName: img.file?.name || `Fotografia #${img.id.slice(0, 6)}`,
        imageUrl: img.imageUrl,
      });
    });
  });

  return observations;
}

/**
 * Unified calculation layer for counts, prices, and shelf shares.
 * Guarantees identical metrics across dashboard, audit summary, triage and exports.
 */
export function calculateAuditMetrics(
  images: SerializableImageState[],
  activeAnalysis?: Analysis | null,
  filters: AuditFilterOptions = {},
  brandClassifications?: BrandClassifications
): SharedAuditMetrics {
  const observations = extractObservations(activeAnalysis || null, images);
  
  const ourBrandsSet = new Set((brandClassifications?.ourBrands || []).map(b => b.toLowerCase().trim()));
  const compBrandsSet = new Set((brandClassifications?.competitorBrands || []).map(b => b.toLowerCase().trim()));

  // Base scope filter (e.g. image scope)
  const scopedObservations = observations.filter(obs => {
    if (filters.imageId && filters.imageId !== 'ALL' && obs.imageId !== filters.imageId) {
      return false;
    }
    return true;
  });

  // Track excluded entities in scope so they are never silently lost
  const ghostsList = scopedObservations.filter(o => o.isGhost);
  const posList = scopedObservations.filter(o => o.type === 'pos_material');
  const discardedList = scopedObservations.filter(o => o.isDiscarded);

  // 1. Filter observations according to exact active filters
  const filtered = scopedObservations.filter(obs => {
    // Exclude discarded detections unless explicitly requested
    if (!filters.includeDiscarded && obs.isDiscarded) return false;
    // Exclude ghost products unless explicitly requested
    if (!filters.includeGhosts && obs.isGhost) return false;
    // Exclude POS materials unless explicitly requested
    if (!filters.includePos && obs.type === 'pos_material') return false;

    // Category filter
    if (filters.category && filters.category !== 'ALL') {
      if ((obs.category || '').toLowerCase() !== filters.category.toLowerCase()) {
        return false;
      }
    }

    // Brand filter
    if (filters.brand && filters.brand !== 'ALL') {
      if ((obs.brand || '').toLowerCase() !== filters.brand.toLowerCase()) {
        return false;
      }
    }

    // Brand classification filter
    if (filters.brandType && filters.brandType !== 'ALL') {
      const bLower = (obs.brand || '').toLowerCase().trim();
      const isOur = ourBrandsSet.has(bLower);
      const isComp = compBrandsSet.has(bLower);
      if (filters.brandType === 'OUR' && !isOur) return false;
      if (filters.brandType === 'COMPETITOR' && !isComp) return false;
    }

    // Verification status filter
    if (filters.verificationStatus && filters.verificationStatus !== 'ALL') {
      if (obs.verificationStatus !== filters.verificationStatus) {
        return false;
      }
    }

    // Price status filter
    if (filters.priceStatus && filters.priceStatus !== 'ALL') {
      const hasAnyPrice = obs.regularPrice !== null || obs.promoPrice !== null || obs.clubPrice !== null;
      if (filters.priceStatus === 'with_price' && !hasAnyPrice) return false;
      if (filters.priceStatus === 'missing_price' && hasAnyPrice) return false;
      if (filters.priceStatus === 'promo_only' && obs.promoPrice === null) return false;
    }

    // Text search query
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      const match = 
        obs.name.toLowerCase().includes(q) ||
        (obs.brand || '').toLowerCase().includes(q) ||
        (obs.category || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  // 2. Separate real products from POS materials & ghosts for facing calculation
  const productFacingsList = filtered.filter(o => o.type !== 'pos_material' && !o.isGhost && !o.isDiscarded);

  // Facings & pack counts
  const totalFacings = productFacingsList.reduce((sum, p) => sum + (p.facings || 1), 0);
  const totalVisiblePacks = productFacingsList.reduce((sum, p) => sum + (p.visiblePacks || 1), 0);
  
  // Estimated stock (only sum when explicitly defined, never invent)
  const stockItems = productFacingsList.filter(p => typeof p.estimatedStock === 'number');
  const totalEstimatedStock = stockItems.length > 0 
    ? stockItems.reduce((sum, p) => sum + (p.estimatedStock || 0), 0)
    : null;

  // Unique SKUs count without fuzzy collapsing
  const uniqueSkusSet = new Set(productFacingsList.map(p => p.canonicalSku || p.name.trim()));
  const uniqueSkusCount = uniqueSkusSet.size;

  // Price aggregation
  let withPriceCount = 0;
  let missingPriceCount = 0;
  let promoCount = 0;
  const regularPrices: number[] = [];
  const promoPrices: number[] = [];
  const discounts: number[] = [];

  productFacingsList.forEach(p => {
    const hasPrice = p.regularPrice !== null || p.promoPrice !== null || p.clubPrice !== null;
    if (hasPrice) {
      withPriceCount += (p.facings || 1);
    } else {
      missingPriceCount += (p.facings || 1);
    }

    if (p.promoPrice !== null) {
      promoCount += (p.facings || 1);
      promoPrices.push(p.promoPrice);
      if (p.regularPrice !== null && p.regularPrice > p.promoPrice) {
        const disc = Math.round(((p.regularPrice - p.promoPrice) / p.regularPrice) * 100);
        discounts.push(disc);
      }
    }

    if (p.regularPrice !== null) {
      regularPrices.push(p.regularPrice);
    }
  });

  const isShelfShareAudit = activeAnalysis?.analysisType === 'shelfShare';
  const requirePricesInSos = typeof window !== 'undefined' ? localStorage.getItem('salesapp_sos_require_prices') === 'true' : false;
  if (isShelfShareAudit && !requirePricesInSos) {
    missingPriceCount = 0;
  }

  const priceCoveragePercent = totalFacings > 0 ? Math.round((withPriceCount / totalFacings) * 100) : 0;
  const promoSharePercent = totalFacings > 0 ? Math.round((promoCount / totalFacings) * 100) : 0;
  
  const avgRegularPrice = regularPrices.length > 0 
    ? regularPrices.reduce((a, b) => a + b, 0) / regularPrices.length 
    : null;

  const avgPromoPrice = promoPrices.length > 0 
    ? promoPrices.reduce((a, b) => a + b, 0) / promoPrices.length 
    : null;

  const avgDiscountPercent = discounts.length > 0 
    ? Math.round(discounts.reduce((a, b) => a + b, 0) / discounts.length) 
    : null;

  // Verification progress breakdown
  let pendingReviewCount = 0;
  let verifiedCount = 0;
  let autoAcceptedCount = 0;
  let unresolvableCount = 0;

  productFacingsList.forEach(p => {
    const f = p.facings || 1;
    switch (p.verificationStatus) {
      case 'human_verified':
        verifiedCount += f;
        break;
      case 'auto_accepted':
        autoAcceptedCount += f;
        break;
      case 'unresolvable':
        unresolvableCount += f;
        break;
      case 'pending_review':
      default:
        pendingReviewCount += f;
        break;
    }
  });

  const verifiedTotal = verifiedCount + autoAcceptedCount;
  const verificationProgressPercent = totalFacings > 0 
    ? Math.round((verifiedTotal / totalFacings) * 100) 
    : 100;

  // Shelf Share Computations (Category & Brand)
  // Check if bounding box geometry exists for area evaluation
  let evaluatableAreaCount = 0;
  let totalEvaluatableArea = 0;

  productFacingsList.forEach(p => {
    if (p.boundingBox) {
      const w = p.boundingBox.width || 0;
      const h = p.boundingBox.height || 0;
      const area = w * h;
      if (area > 0) {
        evaluatableAreaCount++;
        totalEvaluatableArea += area;
      }
    }
  });

  // Area is evaluatable if at least 50% of facings have valid bounding boxes and total area > 0
  const isAreaEvaluatable = productFacingsList.length > 0 && 
    evaluatableAreaCount > 0 && 
    (evaluatableAreaCount / productFacingsList.length) >= 0.5 && 
    totalEvaluatableArea > 0;

  const areaEvaluationNote = isAreaEvaluatable
    ? `Plošný podiel vyhodnotený z ${evaluatableAreaCount} z ${productFacingsList.length} položiek s platnou geometriou.`
    : 'Nedá sa vyhodnotiť (chýbajú geometrické súradnice bounding boxov).';

  // Group by Category
  const categoryGroups = new Map<string, { facings: number; area: number; skus: Set<string> }>();
  productFacingsList.forEach(p => {
    const cat = p.category || 'Nezaradené';
    const entry = categoryGroups.get(cat) || { facings: 0, area: 0, skus: new Set<string>() };
    entry.facings += (p.facings || 1);
    if (p.boundingBox) {
      entry.area += (p.boundingBox.width || 0) * (p.boundingBox.height || 0);
    }
    entry.skus.add(p.canonicalSku || p.name);
    categoryGroups.set(cat, entry);
  });

  const categoryShares: SingleShareMetric[] = Array.from(categoryGroups.entries())
    .map(([cat, data]) => {
      const facingSharePercent = totalFacings > 0 ? parseFloat(((data.facings / totalFacings) * 100).toFixed(1)) : 0;
      const areaSharePercent = (isAreaEvaluatable && totalEvaluatableArea > 0)
        ? parseFloat(((data.area / totalEvaluatableArea) * 100).toFixed(1))
        : null;

      return {
        key: cat,
        label: cat,
        category: cat,
        facings: data.facings,
        facingSharePercent,
        facingDenominator: totalFacings,
        areaFraction: isAreaEvaluatable ? data.area : null,
        areaSharePercent,
        areaDenominator: isAreaEvaluatable ? totalEvaluatableArea : null,
        isAreaEvaluatable,
        calculationMethod: 'Počet facingov na regáli (Facing Share)',
        uniqueSkus: data.skus.size,
        unrecognizedIncludedInDenominator: true,
        unrecognizedCount: categoryGroups.get('Nezaradené')?.facings || 0,
      };
    })
    .sort((a, b) => b.facings - a.facings);

  // Group by Brand
  const brandGroups = new Map<string, { facings: number; area: number; category?: string; skus: Set<string> }>();
  productFacingsList.forEach(p => {
    const bName = p.brand || 'Neznáma značka';
    const entry = brandGroups.get(bName) || { facings: 0, area: 0, category: p.category, skus: new Set<string>() };
    entry.facings += (p.facings || 1);
    if (p.boundingBox) {
      entry.area += (p.boundingBox.width || 0) * (p.boundingBox.height || 0);
    }
    entry.skus.add(p.canonicalSku || p.name);
    brandGroups.set(bName, entry);
  });

  const brandShares: SingleShareMetric[] = Array.from(brandGroups.entries())
    .map(([bName, data]) => {
      const facingSharePercent = totalFacings > 0 ? parseFloat(((data.facings / totalFacings) * 100).toFixed(1)) : 0;
      const areaSharePercent = (isAreaEvaluatable && totalEvaluatableArea > 0)
        ? parseFloat(((data.area / totalEvaluatableArea) * 100).toFixed(1))
        : null;

      return {
        key: bName,
        label: bName,
        brand: bName,
        category: data.category,
        facings: data.facings,
        facingSharePercent,
        facingDenominator: totalFacings,
        areaFraction: isAreaEvaluatable ? data.area : null,
        areaSharePercent,
        areaDenominator: isAreaEvaluatable ? totalEvaluatableArea : null,
        isAreaEvaluatable,
        calculationMethod: 'Počet facingov na regáli (Facing Share)',
        uniqueSkus: data.skus.size,
        unrecognizedIncludedInDenominator: true,
        unrecognizedCount: brandGroups.get('Neznáma značka')?.facings || 0,
      };
    })
    .sort((a, b) => b.facings - a.facings);

  return {
    auditId: activeAnalysis?.id || 'current_audit',
    storeName: activeAnalysis?.store?.name || 'Maloobchodná predajňa',
    storeChain: activeAnalysis?.store?.chain,
    auditDate: activeAnalysis?.createdAt || new Date().toISOString(),
    totalImages: images.length,
    totalFacings,
    totalVisiblePacks,
    totalEstimatedStock,
    ghostsCount: ghostsList.length,
    posCount: posList.length,
    discardedCount: discardedList.length,
    uniqueSkusCount,
    withPriceCount,
    missingPriceCount,
    priceCoveragePercent,
    promoCount,
    promoSharePercent,
    avgRegularPrice,
    avgPromoPrice,
    avgDiscountPercent,
    currency: '€',
    pendingReviewCount,
    verifiedCount,
    autoAcceptedCount,
    unresolvableCount,
    verificationProgressPercent,
    categoryShares,
    brandShares,
    isAreaEvaluatable,
    areaEvaluationNote,
    appliedFilters: filters,
  };
}

/**
 * Updates a product observation with audit trail history and safe metric recomputation.
 */
export function applyObservationUpdate(
  analysis: Analysis,
  imageId: string,
  productId: string,
  updates: Partial<DetectedProduct>,
  user: string = 'Inšpektor auditu'
): { updatedAnalysis: Analysis; updatedProduct: DetectedProduct | null } {
  const images = Array.isArray(analysis.images) ? [...analysis.images] : [];
  const imgIdx = images.findIndex(i => i.id === imageId);
  if (imgIdx < 0) return { updatedAnalysis: analysis, updatedProduct: null };

  const targetImage = { ...images[imgIdx] };
  const products = Array.isArray(targetImage.analysisResult?.products)
    ? [...targetImage.analysisResult.products]
    : [];

  const prodIdx = products.findIndex(p => p.id === productId);
  if (prodIdx < 0) return { updatedAnalysis: analysis, updatedProduct: null };

  const originalProduct = products[prodIdx];

  // Create audit trail entry
  const trailEntries: ObservationAuditTrailEntry[] = [...(originalProduct.auditTrail || [])];
  
  Object.keys(updates).forEach(key => {
    const prev = (originalProduct as any)[key];
    const next = (updates as any)[key];
    if (prev !== next && key !== 'auditTrail') {
      trailEntries.push({
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        user,
        action: updates.isDiscarded ? 'discard' : updates.regularPrice !== undefined || updates.promoPrice !== undefined ? 'correct_price' : 'verify',
        fieldName: key,
        previousValue: prev,
        newValue: next,
      });
    }
  });

  // Re-synchronize price array if regularPrice, promoPrice, or clubPrice was edited
  let newPrices = originalProduct.prices ? [...originalProduct.prices] : [];
  if (updates.regularPrice !== undefined || updates.promoPrice !== undefined || updates.clubPrice !== undefined) {
    const updatedPrices: PriceInfo[] = [];
    const reg = updates.regularPrice !== undefined ? updates.regularPrice : originalProduct.regularPrice;
    const promo = updates.promoPrice !== undefined ? updates.promoPrice : originalProduct.promoPrice;
    const club = updates.clubPrice !== undefined ? updates.clubPrice : originalProduct.clubPrice;

    if (reg !== null && reg !== undefined) {
      updatedPrices.push({
        value: `${reg.toFixed(2)} €`,
        type: 'REGULAR',
      });
    }
    if (promo !== null && promo !== undefined) {
      updatedPrices.push({
        value: `${promo.toFixed(2)} €`,
        type: 'PROMO',
      });
    }
    if (club !== null && club !== undefined) {
      updatedPrices.push({
        value: `${club.toFixed(2)} €`,
        type: 'CLUB',
      });
    }
    newPrices = updatedPrices;
  }

  const updatedProduct: DetectedProduct = normalizeProductObservation(
    {
      ...originalProduct,
      ...updates,
      prices: newPrices,
      isCorrected: true,
      auditTrail: trailEntries,
    },
    {
      imageId,
      storeName: analysis.store?.name,
      analysisId: analysis.id,
    }
  );

  products[prodIdx] = updatedProduct;

  targetImage.analysisResult = {
    ...targetImage.analysisResult!,
    products,
  };

  images[imgIdx] = targetImage;

  const updatedAnalysis: Analysis = {
    ...analysis,
    images,
  };

  return { updatedAnalysis, updatedProduct };
}
