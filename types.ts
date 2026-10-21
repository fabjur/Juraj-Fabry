export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PriceInfo {
  value: string;
  type: string;
  raw?: string;
  integrityFlags?: string[];
  isAnomalous?: boolean;
  benchmarkPrice?: number;
  variancePercent?: number;
}

export type ObjectType = 'product' | 'pos_material';
export type PosType = 'wobbler' | 'stopper' | 'stand' | 'pallet' | 'secondary_display';

export interface ObservationAuditTrailEntry {
  id: string;
  timestamp: string; // ISO
  user: string;
  action: 'verify' | 'change_sku' | 'correct_price' | 'assign_tag' | 'discard' | 'request_retake' | 'reset';
  fieldName?: string;
  previousValue?: any;
  newValue?: any;
  notes?: string;
}

export type VerificationStatus = 'pending_review' | 'auto_accepted' | 'human_verified' | 'unresolvable';
export type SkuVerificationStatus = 'unverified' | 'confirmed' | 'changed' | 'unresolvable';
export type PriceReadabilityStatus = 'readable' | 'partially_readable' | 'illegible' | 'missing';
export type TagAssociationStatus = 'correct' | 'wrong_tag' | 'unassigned';

export interface DetectedProduct {
  id: string;
  imageId?: string;
  name: string;
  brand?: string;
  prices?: PriceInfo[];
  boundingBox: BoundingBox;
  confidence: number;
  isCorrected?: boolean;
  catalogProductId?: number;
  type?: ObjectType;
  posType?: PosType;
  isGhost?: boolean;
  priceIntegrityStatus?: 'valid' | 'corrected' | 'warning' | 'missing';
  // Standardized metrics & SKU properties
  canonicalSku?: string;
  category?: string;
  facings?: number; // default 1
  visiblePacks?: number; // default 1
  estimatedStock?: number | null; // never guess hidden units
  regularPrice?: number | null; // parsed numeric, null if missing
  promoPrice?: number | null; // parsed numeric, null if missing
  clubPrice?: number | null; // loyalty/club price, null if missing
  currency?: string; // default 'EUR'
  // Verification dimensions
  verificationStatus?: VerificationStatus;
  skuVerificationStatus?: SkuVerificationStatus;
  priceReadabilityStatus?: PriceReadabilityStatus;
  tagAssociationStatus?: TagAssociationStatus;
  isDiscarded?: boolean; // false positive exclusion
  needsRetake?: boolean; // blurred/obscured photo flag
  assignedPriceTagId?: string | null;
  auditTrail?: ObservationAuditTrailEntry[];
  originalAiSnapshot?: {
    name: string;
    prices?: PriceInfo[];
    confidence: number;
    boundingBox?: BoundingBox;
  };
}

export interface ProductObservation extends DetectedProduct {
  observationId: string;
  analysisId: string;
  storeId?: number;
  storeName: string;
  storeChain?: string;
  imageName?: string;
  imageUrl?: string;
}

export interface AuditFilterOptions {
  category?: string; // 'ALL' or specific category
  brand?: string; // 'ALL' or specific brand
  brandType?: 'ALL' | 'OUR' | 'COMPETITOR';
  imageId?: string; // 'ALL' or specific imageId
  searchQuery?: string;
  verificationStatus?: 'ALL' | VerificationStatus;
  priceStatus?: 'ALL' | 'with_price' | 'missing_price' | 'promo_only';
  includePos?: boolean;
  includeGhosts?: boolean;
  includeDiscarded?: boolean;
}

export interface SingleShareMetric {
  key: string;
  label: string;
  brand?: string;
  category?: string;
  facings: number;
  facingSharePercent: number;
  facingDenominator: number;
  areaFraction: number | null;
  areaSharePercent: number | null;
  areaDenominator: number | null;
  isAreaEvaluatable: boolean;
  calculationMethod: string;
  uniqueSkus: number;
  unrecognizedIncludedInDenominator: boolean;
  unrecognizedCount: number;
}

export interface SharedAuditMetrics {
  auditId: string;
  storeName: string;
  storeChain?: string;
  auditDate: string;
  totalImages: number;
  // Clear facing vs visible packs vs stock distinction
  totalFacings: number; // Front row facings (excluding POS, ghosts, discarded)
  totalVisiblePacks: number; // Visible units
  totalEstimatedStock: number | null; // Known shelf capacity/depth, never guessed
  // Excluded entities clearly tracked
  ghostsCount: number;
  posCount: number;
  discardedCount: number;
  // Unique SKUs (strictly canonical without fuzzy auto-merge)
  uniqueSkusCount: number;
  // Prices
  withPriceCount: number;
  missingPriceCount: number;
  priceCoveragePercent: number;
  promoCount: number;
  promoSharePercent: number;
  avgRegularPrice: number | null;
  avgPromoPrice: number | null;
  avgDiscountPercent: number | null;
  currency: string;
  // Verification progress
  pendingReviewCount: number;
  verifiedCount: number;
  autoAcceptedCount: number;
  unresolvableCount: number;
  verificationProgressPercent: number;
  // Shelf share metrics
  categoryShares: SingleShareMetric[];
  brandShares: SingleShareMetric[];
  isAreaEvaluatable: boolean;
  areaEvaluationNote: string;
  appliedFilters: AuditFilterOptions;
}

export interface StoreInfo {
  chain?: string;
  address?: string;
}

// FIX: Added modelName property to AnalysisResult interface
export interface AnalysisResult {
  products: DetectedProduct[];
  storeInfo?: StoreInfo;
  modelName?: string;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  complianceScore?: number;
  reason?: string;
}

export interface CostInfo {
  inputTokens: number;
  outputTokens: number;
  cost: number;
  modelName?: string;
}

export interface SerializableFile {
  name: string;
  type: string;
  lastModified: number;
  data: string; // base64 encoded
}

export interface SerializableImageState {
  id: string;
  file: SerializableFile;
  imageUrl: string; 
  analysisResult: AnalysisResult | null;
  status: 'pending' | 'analyzing' | 'success' | 'error';
  error: string | null;
  uploadDate: string; // ISO string
  analysisType?: 'price' | 'shelfShare' | 'both' | 'osa' | 'qualityCheck';
  model?: string;
  retryCount?: number;
  isWideShelf?: boolean;
  isVideoMode?: boolean;
  assignedStore?: Store | null; 
  assignedStoreId?: number;
  productCategory?: string;
}

export interface BrandClassifications {
    ourBrands: string[];
    competitorBrands: string[];
}

export interface Store {
  id?: number;
  code?: string;
  name: string;
  chain?: string;
  address?: string;
  city?: string;
  storeTier?: string;
  targetShelfShare?: number;
  gpsCoordinates?: string;
  contactPerson?: string;
  description?: string;
}

export interface Analysis {
  id: string;
  name: string;
  createdAt: string; // ISO string
  images: SerializableImageState[];
  brandClassifications?: BrandClassifications;
  store: Store | null;
  storeId?: number; 
  costInfo?: CostInfo;
  productCategory?: string;
  manualPrice?: number;
}

export interface ProductCatalogEntry {
  id?: number;
  canonicalName: string;
  manufacturer?: string;
  sku?: string;
  category?: string;
  aliases: string[];
  visualFeatures?: string;
  referenceImages?: string[];
  recommendedPrice?: number; // MOC / Target RSP
  unitSize?: string; // napr. "500g", "1.5L"
}

export interface PriceGapItem {
  productName: string;
  brand: string;
  category: string;
  isOurBrand: boolean;
  actualPrice: number;
  recommendedPrice?: number;
  mocDiffPercent?: number;
  mocStatus?: 'COMPLIANT' | 'OVERPRICED' | 'UNDERPRICED' | 'NO_MOC';
  unitPrice?: number;
  unitLabel?: string;
  detectedVolume?: string;
  storeName: string;
  chain?: string;
  priceType: 'REGULAR' | 'PROMO';
  benchmarkGapPercent?: number;
  priceIndex?: number;
}

export interface CompetitorPriceEntry {
  id?: number;
  productName: string;
  competitorProduct: string;
  competitorBrand: string;
  category: string;
  competitorPrice: number;
  competitorPriceType?: 'REGULAR' | 'PROMO';
  chain?: string;
  notes?: string;
  updatedAt?: string;
}

export interface CompetitorComparisonRow {
  id: string;
  productName: string;
  brand: string;
  category: string;
  storeName: string;
  storeChain: string;
  actualPrice: number;
  actualPriceType: 'REGULAR' | 'PROMO';
  competitorPriceEntry?: CompetitorPriceEntry | null;
  competitorProductName: string;
  competitorBrand: string;
  competitorPrice: number;
  competitorChain?: string;
  priceDiffEur: number;
  priceDiffPercent: number;
  priceIndex: number;
  status: 'cheaper' | 'competitive' | 'more_expensive' | 'unpaired';
  confidence?: number;
  imageId?: string;
}

export interface BrandMemoryEntry {
  brand: string;
  classification: 'our' | 'competitor';
}

export interface PromptTemplate {
  id?: number;
  category: 'price' | 'shelfShare' | 'both' | 'system' | 'osa';
  productCategory?: string;
  clientName?: string;
  description?: string;
  version: number;
  text: string;
  isActive: boolean;
  createdAt: string;
  totalCount?: number;
  successCount?: number;
  avgConfidenceSum?: number;
  totalTokensUsed?: number;
  label?: string;
}

export interface MergeCandidate {
    target: DetectedProduct;
    source: DetectedProduct;
}

export interface ProductHistoryPoint {
  date: string;
  price: number;
  type: 'REGULAR' | 'PROMO';
  storeName: string;
  analysisId: string;
  imageId: string;
}

export interface SearchMatch {
  type: 'analysis_name' | 'product_name' | 'product_brand' | 'store_name' | 'store_chain' | 'product_alias' | 'manufacturer';
  context: string;
}

export interface SearchResult {
  analysis: Analysis;
  matches: SearchMatch[];
}

export interface SearchIndexEntry {
  id?: number;
  analysisId: string;
  type: SearchMatch['type'];
  contentTokens: string[];
  context: string;
}

export interface DistributionReport {
  id?: number;
  name: string;
  createdAt: string;
  selectedProducts: string[];
}

// FIX: Added count property to DistributionCell interface
export interface DistributionCell {
    isPresent: boolean;
    count: number;
    maxConfidence: number;
}

// FIX: Added totalFacings property to DistributionRow interface
export interface DistributionRow {
    storeName: string;
    storeId?: number;
    storeCode?: string;
    presence: Record<string, DistributionCell>;
    totalFacings: number;
    fulfillment: number;
}

// FIX: Updated DistributionMatrix interface to include selectedEntities and mode
export interface DistributionMatrix {
    rows: DistributionRow[];
    columnSummaries: Record<string, number>;
    selectedEntities: string[];
    mode: 'sku' | 'category';
}

// FIX: Added PromoAlertItem interface to resolve import errors
export interface PromoAlertItem {
    type: 'competitor_promo' | 'our_promo' | 'missing_promo';
    product: DetectedProduct;
    store: string;
}

export interface QualityCheckSubmission {
  id: string;
  storeId?: number;
  storeName: string;
  imageUrl: string; // base64
  fileName: string;
  status: 'pending' | 'analyzing' | 'success' | 'error';
  complianceScore?: number; // 0 - 100
  reason?: string; // vysvetlenie zhodnosti
  error?: string;
  createdAt: string;
}

export interface QualityCheck {
  id: string;
  name: string;
  description: string; // textový popis / návod
  referenceImages: string[]; // base64 referencie
  submissions: QualityCheckSubmission[];
  createdAt: string;
}

export interface ProductInStore {
    name: string;
    isCorrected?: boolean;
    category: string;
    count: number;
    priceHistory: { price: PriceInfo; date: Date; imageUrl: string }[];
    avgConfidence: number;
    imageUrl?: string;
    catalogProductId?: number;
    type: ObjectType;
    posType?: PosType;
    isGhost?: boolean;
    imageId?: string;
}

export interface StoreCentricSummary {
    storeName: string;
    storeId?: number;
    storeCode?: string;
    products: ProductInStore[];
}

export type ActiveView = 'home' | 'gallery' | 'priceMonitoring' | 'shelfShare' | 'promoAlert' | 'distribution' | 'listing' | 'productCatalog' | 'analyses' | 'stores' | 'costs' | 'prompts' | 'qualityCheck' | 'dashboard' | 'exportReports' | 'competitorComparison' | 'chat' | 'verificationQueue' | 'systemTests';

export type RecommendationSeverity = 'critical' | 'warning' | 'info' | 'optimization';
export type RecommendationCategory = 
  | 'normalization' 
  | 'price_ocr' 
  | 'confidence' 
  | 'ghost_filtering' 
  | 'pos_materials' 
  | 'category_rules' 
  | 'structure';

export interface PromptRecommendation {
  id: string;
  category: RecommendationCategory;
  severity: RecommendationSeverity;
  title: string;
  description: string;
  impact: string;
  evidence: {
    metric: string;
    value: string | number;
    detail: string;
  };
  suggestedRule: string;
  targetPromptCategory: 'system' | 'price' | 'shelfShare' | 'both' | 'osa';
  targetCategories?: PromptTemplate['category'][];
  productCategory?: string;
  examples?: { original: string; canonical: string; count?: number }[];
  applied?: boolean;
}

export interface PromptAuditSummary {
  totalAnalyses: number;
  totalImages: number;
  totalDetectedItems: number;
  avgConfidence: number;
  priceDetectionRate: number;
  regularVsPromoRatio: { regular: number; promo: number };
  ghostProductRate: number;
  posMaterialCount: number;
  skuDriftCount: number;
  unmatchedSkuCount: number;
  categoryBreakdown: { category: string; count: number; avgConfidence: number }[];
  topProblematicSkus: { name: string; occurrences: number; avgConfidence: number; issue: string }[];
  recommendationsCount: { critical: number; warning: number; optimization: number; info: number };
  healthScore: number; // 0 - 100
}

export interface PromptOptimizationResult {
  originalPrompt: string;
  optimizedPrompt: string;
  changesSummary: string[];
  expectedImprovements: string[];
  estimatedAccuracyGain: string;
}
