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

export type ActiveView = 'home' | 'gallery' | 'priceMonitoring' | 'shelfShare' | 'promoAlert' | 'distribution' | 'listing' | 'productCatalog' | 'analyses' | 'stores' | 'costs' | 'prompts' | 'qualityCheck' | 'dashboard';

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
