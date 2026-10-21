import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.ts';
import { useTranslation } from '../i18n/index.tsx';
import type { 
  DetectedProduct, 
  SerializableImageState, 
  Analysis, 
  BrandClassifications,
  ProductCatalogEntry,
  BoundingBox
} from '../types.ts';
import { 
  calculateAuditMetrics, 
  applyObservationUpdate, 
  normalizeProductObservation,
  extractNumericPrice 
} from '../utils/auditMetrics.ts';
import { normalizeBoundingBox } from '../utils/boundingBoxUtils.ts';
import { ShelfHeatmapOverlay } from './ShelfHeatmapOverlay.tsx';
import {
  CheckCircle2,
  AlertTriangle,
  Flame,
  Eye,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Check,
  X,
  Trash2,
  Camera,
  History,
  Info,
  Sparkles,
  Edit2
} from 'lucide-react';

export interface PhotoAuditVerificationScreenProps {
  images: SerializableImageState[];
  activeAnalysis: Analysis | null;
  catalogProducts?: ProductCatalogEntry[];
  initialImageId?: string | null;
  initialProductId?: string | null;
  onUpdateAnalysis?: (analysis: Analysis) => Promise<void>;
  onClose?: () => void;
  brandClassifications?: BrandClassifications;
  onLoadAnalysis?: (analysisId: string) => Promise<void>;
  onStartAnalysis?: (files?: File[]) => void;
}

export const PhotoAuditVerificationScreen: React.FC<PhotoAuditVerificationScreenProps> = ({
  images = [],
  activeAnalysis,
  catalogProducts = [],
  initialImageId,
  initialProductId,
  onUpdateAnalysis,
  onClose,
  brandClassifications,
  onLoadAnalysis,
  onStartAnalysis,
}) => {
  const { t } = useTranslation();
  const rawDbAnalyses = useLiveQuery(() => db.analyses.orderBy('createdAt').reverse().toArray());
  const dbAnalyses = useMemo(() => rawDbAnalyses || [], [rawDbAnalyses]);

  // Local analysis state to ensure instant UI responsiveness and prevent stale overwrite
  const [localAnalysis, setLocalAnalysis] = useState<Analysis | null>(activeAnalysis);
  const [selectedDbAnalysisId, setSelectedDbAnalysisId] = useState<string | null>(null);

  useEffect(() => {
    if (activeAnalysis) {
      setLocalAnalysis(activeAnalysis);
    }
  }, [activeAnalysis]);

  const fallbackDbAnalysis = useMemo(() => {
    if (localAnalysis || activeAnalysis || dbAnalyses.length === 0) return null;
    return (selectedDbAnalysisId ? dbAnalyses.find(a => a.id === selectedDbAnalysisId) : null) || dbAnalyses[0] || null;
  }, [localAnalysis, activeAnalysis, dbAnalyses, selectedDbAnalysisId]);

  const effectiveAnalysis = localAnalysis || activeAnalysis || fallbackDbAnalysis;

  // Safe price value string formatter to prevent any runtime .toFixed() crashes
  const formatPriceValue = useCallback((val: any): string => {
    if (val === null || val === undefined || val === '') return '';
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.').replace(/[^\d.]/g, ''));
    if (isNaN(num)) return typeof val === 'string' ? val : '';
    return num.toFixed(2);
  }, []);

  // Helper to safely get working image URL from any image state
  const getSafeImageUrl = useCallback((img: SerializableImageState | any): string => {
    if (!img) return '';
    // 1. If matching runtime image has blob URL, prefer it
    const safeImages = images || [];
    const runtimeImg = safeImages.find(i => i.id === img.id);
    if (runtimeImg?.imageUrl && runtimeImg.imageUrl.trim() !== '') {
      return runtimeImg.imageUrl;
    }
    // 2. Direct imageUrl
    if (img.imageUrl && typeof img.imageUrl === 'string' && img.imageUrl.trim() !== '') {
      return img.imageUrl;
    }
    // 3. Blob file instance
    if (img.file instanceof Blob) {
      try {
        return URL.createObjectURL(img.file);
      } catch {
        return '';
      }
    }
    // 4. File data (base64 or data URL)
    const b64 = img.file?.data || img.compressedBase64 || img.base64;
    if (b64 && typeof b64 === 'string') {
      if (b64.startsWith('data:') || b64.startsWith('blob:') || b64.startsWith('http')) {
        return b64;
      }
      const mime = img.file?.type || 'image/jpeg';
      return `data:${mime};base64,${b64}`;
    }
    return '';
  }, [images]);

  // All available images with guaranteed safe URLs
  const availableImages = useMemo(() => {
    const list = (effectiveAnalysis?.images && effectiveAnalysis.images.length > 0)
      ? effectiveAnalysis.images
      : (images || []);
    
    return list.map(img => {
      const safeUrl = getSafeImageUrl(img);
      return {
        ...img,
        imageUrl: safeUrl
      };
    });
  }, [effectiveAnalysis, images, getSafeImageUrl]);

  // Active image selection
  const [selectedImageId, setSelectedImageId] = useState<string>(
    initialImageId || availableImages[0]?.id || images[0]?.id || ''
  );

  // Sync selected image when availableImages changes or current is missing
  useEffect(() => {
    if (availableImages.length > 0) {
      if (!selectedImageId || !availableImages.some(img => img.id === selectedImageId)) {
        setSelectedImageId(availableImages[0].id);
      }
    }
  }, [availableImages, selectedImageId]);

  const currentImage = useMemo(() => {
    return availableImages.find(img => img.id === selectedImageId) || availableImages[0] || null;
  }, [availableImages, selectedImageId]);

  // Active product selection
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    initialProductId || null
  );

  // Heatmap overlay state
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);

  // Tab filter: 'uncertainties' (neistoty dát) vs 'businessIssues' (obchodné problémy) vs 'all'
  const [activeQueueTab, setActiveQueueTab] = useState<'uncertainties' | 'businessIssues' | 'all'>(
    'uncertainties'
  );

  // Search in queue
  const [queueSearch, setQueueSearch] = useState('');

  // Zoom & Pan state for image viewer
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imgElementRef = useRef<HTMLImageElement>(null);

  // Local editing state for the inspected product
  const [isEditingSku, setIsEditingSku] = useState(false);
  const [editedSkuName, setEditedSkuName] = useState('');
  const [editedRegPrice, setEditedRegPrice] = useState('');
  const [editedPromoPrice, setEditedPromoPrice] = useState('');
  const [editedClubPrice, setEditedClubPrice] = useState('');
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Crops
  const [productCropUrl, setProductCropUrl] = useState<string | null>(null);
  const [tagCropUrl, setTagCropUrl] = useState<string | null>(null);

  // Products on current image normalized
  const currentImageProducts = useMemo(() => {
    if (!currentImage?.analysisResult?.products || !Array.isArray(currentImage.analysisResult.products)) {
      return [];
    }
    const isSos = effectiveAnalysis?.analysisType === 'shelfShare' || currentImage.analysisType === 'shelfShare';
    const requirePricesInShelfShare = typeof window !== 'undefined' ? localStorage.getItem('salesapp_sos_require_prices') === 'true' : false;

    return currentImage.analysisResult.products.map(p => 
      normalizeProductObservation(p, {
        imageId: currentImage.id,
        imageName: currentImage.file?.name,
        storeName: effectiveAnalysis?.store?.name,
        analysisId: effectiveAnalysis?.id,
        analysisType: currentImage.analysisType || effectiveAnalysis?.analysisType,
        isShelfShare: isSos,
        requirePricesInShelfShare,
      })
    );
  }, [currentImage, effectiveAnalysis]);

  // Default selection
  useEffect(() => {
    if (!selectedProductId && currentImageProducts.length > 0) {
      setSelectedProductId(currentImageProducts[0].id);
    }
  }, [currentImageProducts, selectedProductId]);

  const selectedProduct = useMemo(() => {
    return currentImageProducts.find(p => p.id === selectedProductId) || currentImageProducts[0] || null;
  }, [currentImageProducts, selectedProductId]);

  // Generate real crops from image
  const generateCrops = useCallback((prod: DetectedProduct) => {
    if (!imgElementRef.current || !prod.boundingBox) {
      setProductCropUrl(null);
      setTagCropUrl(null);
      return;
    }

    const img = imgElementRef.current;
    if (!img.complete || img.naturalWidth === 0) return;

    try {
      // 1. Crop Product
      const pBox = normalizeBoundingBox(prod.boundingBox);
      if (pBox.width <= 0 || pBox.height <= 0) {
        setProductCropUrl(null);
        setTagCropUrl(null);
        return;
      }

      const pCanvas = document.createElement('canvas');
      const sx = Math.max(0, pBox.x * img.naturalWidth);
      const sy = Math.max(0, pBox.y * img.naturalHeight);
      const sw = Math.min(img.naturalWidth - sx, pBox.width * img.naturalWidth);
      const sh = Math.min(img.naturalHeight - sy, pBox.height * img.naturalHeight);

      if (sw > 5 && sh > 5) {
        pCanvas.width = sw;
        pCanvas.height = sh;
        const ctx = pCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
          try {
            setProductCropUrl(pCanvas.toDataURL('image/jpeg', 0.85));
          } catch {
            // Tainted canvas fallback - handled by CSS crop
            setProductCropUrl(null);
          }
        }
      }

      // 2. Crop Price Tag (estimated near bottom of product box or lower shelf rail)
      const tCanvas = document.createElement('canvas');
      const tagSy = Math.min(img.naturalHeight - 40, (pBox.y + pBox.height * 0.7) * img.naturalHeight);
      const tagSh = Math.min(img.naturalHeight - tagSy, pBox.height * 0.55 * img.naturalHeight);
      const tagSx = sx;
      const tagSw = sw;

      if (tagSw > 5 && tagSh > 5) {
        tCanvas.width = tagSw;
        tCanvas.height = tagSh;
        const tCtx = tCanvas.getContext('2d');
        if (tCtx) {
          tCtx.drawImage(img, tagSx, tagSy, tagSw, tagSh, 0, 0, tagSw, tagSh);
          try {
            setTagCropUrl(tCanvas.toDataURL('image/jpeg', 0.85));
          } catch {
            setTagCropUrl(null);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to crop product box:', e);
      setProductCropUrl(null);
      setTagCropUrl(null);
    }
  }, []);

  // Synchronize inputs when selected product changes
  useEffect(() => {
    if (selectedProduct) {
      setEditedSkuName(selectedProduct.canonicalSku || selectedProduct.name || '');
      setEditedRegPrice(formatPriceValue(selectedProduct.regularPrice));
      setEditedPromoPrice(formatPriceValue(selectedProduct.promoPrice));
      setEditedClubPrice(formatPriceValue(selectedProduct.clubPrice));
      setIsEditingSku(false);
      generateCrops(selectedProduct);
    }
  }, [selectedProduct, generateCrops, formatPriceValue]);

  // Two dedicated lists:
  // 1. Data uncertainties: low confidence, missing price, unverified SKU, unassigned tag
  const uncertaintiesList = useMemo(() => {
    return currentImageProducts.filter(p => {
      if (p.isDiscarded) return false;
      const hasMissingPrice = p.regularPrice === null && p.promoPrice === null && p.clubPrice === null;
      const hasLowConfidence = (p.confidence ?? 0.85) < 0.80;
      const isUnverified = p.verificationStatus === 'pending_review';
      const isMissingTag = p.tagAssociationStatus === 'unassigned' || p.tagAssociationStatus === 'wrong_tag';
      return hasMissingPrice || hasLowConfidence || isUnverified || isMissingTag;
    });
  }, [currentImageProducts]);

  // 2. Business issues: price gaps, inverted promo, excessive discount, OOS
  const businessIssuesList = useMemo(() => {
    return currentImageProducts.filter(p => {
      if (p.isDiscarded || p.type === 'pos_material') return false;
      const reg = p.regularPrice;
      const promo = p.promoPrice;

      // Inverted promo (promo > regular)
      if (reg !== null && promo !== null && promo > reg) return true;
      // High discount (> 60%)
      if (reg !== null && promo !== null && reg > 0 && ((reg - promo) / reg) > 0.6) return true;
      // Ghost product flag
      if (p.isGhost) return true;
      // Compare with catalog recommended price if present
      if (p.catalogProductId && reg !== null) {
        const cat = catalogProducts.find(c => c.id === p.catalogProductId);
        if (cat?.recommendedPrice && Math.abs(reg - cat.recommendedPrice) / cat.recommendedPrice > 0.25) {
          return true;
        }
      }
      return false;
    });
  }, [currentImageProducts, catalogProducts]);

  // Filtered queue based on active tab and search
  const filteredQueue = useMemo(() => {
    let list = activeQueueTab === 'uncertainties'
      ? uncertaintiesList
      : activeQueueTab === 'businessIssues'
      ? businessIssuesList
      : currentImageProducts;

    if (queueSearch.trim()) {
      const q = queueSearch.toLowerCase().trim();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeQueueTab, uncertaintiesList, businessIssuesList, currentImageProducts, queueSearch]);

  // Overall audit metrics
  const auditMetrics = useMemo(() => {
    const list = effectiveAnalysis?.images || images;
    return calculateAuditMetrics(list, effectiveAnalysis, {}, brandClassifications);
  }, [effectiveAnalysis, images, brandClassifications]);

  // Perform observation update and persist
  const handleUpdate = useCallback(async (updates: Partial<DetectedProduct>, actionLabel: string) => {
    let currentAnalysisObj = localAnalysis || activeAnalysis;
    if (!currentAnalysisObj && currentImage) {
      const allDb = await db.analyses.toArray();
      currentAnalysisObj = allDb.find(a => a.images?.some(img => img.id === currentImage.id)) || allDb[0] || null;
    }
    if (!currentAnalysisObj || !currentImage || !selectedProduct) return;

    const { updatedAnalysis, updatedProduct } = applyObservationUpdate(
      currentAnalysisObj,
      currentImage.id,
      selectedProduct.id,
      updates,
      'Kontrolór auditu'
    );

    // 1. Immediately update local state so currentImage & products reflect changes with 0ms latency
    setLocalAnalysis(updatedAnalysis);

    // 2. Persist directly to Dexie database so changes are never lost
    try {
      await db.analyses.put(updatedAnalysis);
    } catch (e) {
      console.error('Failed to save updated analysis to IndexedDB:', e);
    }

    // 3. Notify parent component to update global state and React tree
    if (onUpdateAnalysis) {
      try {
        await onUpdateAnalysis(updatedAnalysis);
      } catch (err) {
        console.warn('onUpdateAnalysis callback error:', err);
      }
    }

    setSaveToast(actionLabel);
    setTimeout(() => setSaveToast(null), 2500);

    // 4. Update the input field values to match the newly updated product
    if (updatedProduct) {
      setEditedSkuName(updatedProduct.canonicalSku || updatedProduct.name || '');
      setEditedRegPrice(formatPriceValue(updatedProduct.regularPrice));
      setEditedPromoPrice(formatPriceValue(updatedProduct.promoPrice));
      setEditedClubPrice(formatPriceValue(updatedProduct.clubPrice));
    }

    // 5. If verified, advance to next item in uncertainties queue
    if (updates.verificationStatus === 'human_verified') {
      const remainingUncertain = uncertaintiesList.filter(p => p.id !== selectedProduct.id);
      if (remainingUncertain.length > 0) {
        setSelectedProductId(remainingUncertain[0].id);
      }
    }
  }, [localAnalysis, activeAnalysis, currentImage, selectedProduct, uncertaintiesList, onUpdateAnalysis, formatPriceValue]);

  // Save SKU and price corrections without advancing immediately
  const handleSaveCorrections = async () => {
    const regNum = extractNumericPrice(editedRegPrice);
    const promoNum = extractNumericPrice(editedPromoPrice);
    const clubNum = extractNumericPrice(editedClubPrice);

    await handleUpdate({
      canonicalSku: editedSkuName.trim() || selectedProduct?.name,
      name: editedSkuName.trim() || selectedProduct?.name,
      regularPrice: regNum,
      promoPrice: promoNum,
      clubPrice: clubNum,
      isCorrected: true,
      priceReadabilityStatus: (regNum !== null || promoNum !== null || clubNum !== null) ? 'readable' : 'missing'
    }, t('pricesAndSkuSavedToast') || 'Prices and SKU successfully saved ✓');
    setIsEditingSku(false);
  };

  // 1-Click Verification Action: Confirm as human verified AND save any entered prices in a single atomic update
  const handleConfirmAndSave = async () => {
    const regNum = extractNumericPrice(editedRegPrice);
    const promoNum = extractNumericPrice(editedPromoPrice);
    const clubNum = extractNumericPrice(editedClubPrice);

    await handleUpdate({
      canonicalSku: editedSkuName.trim() || selectedProduct?.name,
      name: editedSkuName.trim() || selectedProduct?.name,
      regularPrice: regNum,
      promoPrice: promoNum,
      clubPrice: clubNum,
      verificationStatus: 'human_verified',
      skuVerificationStatus: 'confirmed',
      isCorrected: true,
      priceReadabilityStatus: (regNum !== null || promoNum !== null || clubNum !== null) ? 'readable' : 'missing'
    }, t('itemAndPricesVerifiedToast') || 'Item and prices verified and saved ✓');
    setIsEditingSku(false);
  };

  // 1-Click Discard action: Mark as false positive detection
  const handleDiscard = () => {
    handleUpdate({
      isDiscarded: true,
      verificationStatus: 'unresolvable',
    }, t('falsePositiveDiscardedToast') || 'False detection discarded from audit');
  };

  // 1-Click Retake action: Request new photo
  const handleRequestRetake = () => {
    handleUpdate({
      needsRetake: true,
      verificationStatus: 'unresolvable',
    }, t('retakePhotoRecordedToast') || 'Retake photo request recorded');
  };

  // Pan & Zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoomLevel(prev => Math.min(Math.max(prev * zoomFactor, 0.75), 4.5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // left mouse
      setIsPanning(true);
      setStartPan({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
    }
  };

  const handleMouseUp = () => setIsPanning(false);

  const resetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Center on selected product
  const centerOnProduct = (box: BoundingBox) => {
    const norm = normalizeBoundingBox(box);
    const img = imgElementRef.current;
    if (!img) return;
    const w = img.clientWidth || img.offsetWidth;
    const h = img.clientHeight || img.offsetHeight;
    if (!w || !h) return;

    const zoom = 2.2;
    const boxCenterX = (norm.x + norm.width / 2) * w;
    const boxCenterY = (norm.y + norm.height / 2) * h;

    const offsetX = -(boxCenterX - w / 2) * zoom;
    const offsetY = -(boxCenterY - h / 2) * zoom;

    setZoomLevel(zoom);
    setPanOffset({ x: offsetX, y: offsetY });
  };

  // Graceful empty state when no active images in memory
  if (!currentImage || availableImages.length === 0) {
    return (
      <div className="w-full bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-xs animate-fade-in text-center max-w-4xl mx-auto space-y-6">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto border border-amber-200 shadow-2xs">
          <Eye className="w-8 h-8" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            {t('verificationCenterTitle') || 'Photo Verification Center'}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            {t('verificationCenterEmptyDesc') || 'To verify prices, facings, and bounding boxes on photo, select a saved audit from the archive or create a new analysis.'}
          </p>
        </div>

        {dbAnalyses.length > 0 ? (
          <div className="space-y-3 text-left pt-2">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
              {t('selectAuditForReview') || 'Vyberte audit na kontrolu'} ({dbAnalyses.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto custom-scrollbar p-1">
              {dbAnalyses.map(a => (
                <div
                  key={a.id}
                  onClick={() => onLoadAnalysis && onLoadAnalysis(a.id)}
                  className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:border-zinc-300 transition-all cursor-pointer flex items-center justify-between group shadow-3xs hover:shadow-xs"
                >
                  <div className="min-w-0 pr-3">
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-blue-600 transition-colors">
                      {a.name}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                      {a.store?.name || t('store') || 'Store'} • {a.images?.length || 0} {t('imagesCountShort') || 'photos'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1.5 bg-zinc-900 group-hover:bg-blue-600 text-white text-[11px] font-bold rounded-lg transition-colors shrink-0"
                  >
                    {t('openAuditReview') || 'Open Review'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="pt-4">
            <button
              onClick={() => onStartAnalysis && onStartAnalysis()}
              className="px-6 py-3 bg-zinc-900 text-white font-bold text-xs rounded-xl shadow-xs hover:bg-zinc-800 transition-all cursor-pointer"
            >
              {t('createNewAudit') || 'Create New Audit'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col bg-zinc-950 text-zinc-100 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl animate-fade-in select-none">
      {/* 1. Header Toolbar */}
      <div className="px-5 py-3.5 bg-zinc-900 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl">
            <Eye className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-white uppercase tracking-wider">
                {t('verificationCenterHeader') || 'Verification Center & Photo Review'}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                {t('onePhotoOneShelf') || '1 photo = 1 shelf'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-medium">
              {t('store') || 'Store'}: <strong>{effectiveAnalysis?.store?.name || activeAnalysis?.store?.name || 'Maloobchod'}</strong> • {availableImages.length} {t('imagesCountShort') || 'photos'}
            </p>
          </div>
        </div>

        {/* Audit switcher & Image selector & Progress */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Audit Switcher if multiple analyses available in DB */}
          {dbAnalyses.length > 1 && (
            <div className="flex items-center gap-1.5 bg-zinc-800/80 px-2.5 py-1.5 rounded-xl border border-zinc-700 text-xs">
              <History className="w-3.5 h-3.5 text-zinc-400" />
              <select
                value={effectiveAnalysis?.id || ''}
                onChange={(e) => {
                  const targetId = e.target.value;
                  setSelectedDbAnalysisId(targetId);
                  const matched = dbAnalyses.find(a => a.id === targetId);
                  if (matched) {
                    setLocalAnalysis(matched);
                  }
                  if (onLoadAnalysis) {
                    onLoadAnalysis(targetId);
                  }
                }}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer max-w-[170px] truncate"
                title={t('switchAudit') || 'Switch audit'}
              >
                {dbAnalyses.map(a => (
                  <option key={a.id} value={a.id} className="bg-zinc-900 text-white">
                    {a.name} ({a.images?.length || 0} {t('photosShort') || 'fotiek'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Image carousel / switcher */}
          <div className="flex items-center gap-1.5 bg-zinc-800/80 px-2.5 py-1.5 rounded-xl border border-zinc-700 text-xs">
            <Camera className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={selectedImageId}
              onChange={(e) => setSelectedImageId(e.target.value)}
              className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
            >
              {availableImages.map((img, i) => (
                <option key={img.id} value={img.id} className="bg-zinc-900 text-white">
                  {t('imagesCountShort') || 'Fotografia'} #{i + 1} ({img.analysisResult?.products?.length || 0} {t('facingsShort') || 'facingov'})
                </option>
              ))}
            </select>
          </div>

          {/* Quick verification progress */}
          <div className="flex items-center gap-2 bg-zinc-800/80 px-3 py-1.5 rounded-xl border border-zinc-700 text-xs font-mono">
            <span className="text-zinc-400">{t('stepVerification') || 'Verified'}:</span>
            <span className="text-emerald-400 font-black">{auditMetrics.verifiedCount + auditMetrics.autoAcceptedCount}</span>
            <span className="text-zinc-500 dark:text-zinc-400">/</span>
            <span className="text-white font-black">{auditMetrics.totalFacings}</span>
            <span className="text-[10px] text-zinc-400 font-bold ml-1">({auditMetrics.verificationProgressPercent}%)</span>
          </div>

          {/* Close / Return button */}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
              title={t('closeVerificationReturn') || 'Close verification and return'}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Main Work Area: Split View (Left: Photo Canvas, Right: Queue & Inspector) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 h-[calc(88vh-80px)] min-h-[580px] overflow-hidden">
        {/* LEFT COLUMN: Photo Viewer with Bounding Box Annotations (7 cols) */}
        <div 
          ref={imageContainerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="lg:col-span-7 bg-zinc-950 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing border-b lg:border-b-0 lg:border-r border-zinc-800"
        >
          {/* Zoom controls float */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-zinc-900/90 backdrop-blur-md p-1.5 rounded-xl border border-zinc-800 shadow-xl no-print">
            <button
              onClick={() => setZoomLevel(prev => Math.min(prev * 1.25, 4.5))}
              className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-white transition-colors"
              title={t('zoomIn') || 'Zoom in (Mouse wheel)'}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.max(prev * 0.8, 0.75))}
              className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-white transition-colors"
              title={t('zoomOut') || 'Zoom out'}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={resetZoom}
              className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-white transition-colors"
              title={t('zoomReset') || 'Original size (Reset)'}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <div className="w-[1px] h-4 bg-zinc-700/60 mx-0.5" />
            <button
              onClick={() => setShowHeatmap(prev => !prev)}
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                showHeatmap 
                  ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400/60' 
                  : 'hover:bg-zinc-800 text-zinc-300 hover:text-white'
              }`}
              title={t('heatmapDensity') || 'Heatmap'}
            >
              <Flame className="w-4 h-4 text-amber-400" />
            </button>
            <span className="text-[10px] font-mono px-2 py-0.5 text-zinc-400 font-bold">
              {Math.round(zoomLevel * 100)}%
            </span>
          </div>

          {/* Toast feedback */}
          {saveToast && (
            <div className="absolute top-4 right-4 z-30 bg-emerald-500 text-zinc-950 dark:text-zinc-100 px-3.5 py-1.5 rounded-xl font-black text-xs shadow-xl animate-fade-in flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{saveToast}</span>
            </div>
          )}

          {/* Photo and SVG Bounding Boxes Layer */}
          <div
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: isPanning ? 'none' : 'transform 0.15s ease-out',
            }}
            className="relative select-none inline-block max-w-full max-h-full"
          >
            {currentImage?.imageUrl ? (
              <>
                <img
                  ref={imgElementRef}
                  src={currentImage.imageUrl}
                  alt={t('shelf') || 'Shelf'}
                  crossOrigin={currentImage.imageUrl.startsWith('data:') || currentImage.imageUrl.startsWith('blob:') ? undefined : 'anonymous'}
                  onLoad={() => selectedProduct && generateCrops(selectedProduct)}
                  className="max-h-[78vh] max-w-full w-auto h-auto object-contain block pointer-events-none rounded-lg"
                />

                {/* 🌟 HEATMAP OVERLAY LAYER */}
                {showHeatmap && (
                  <ShelfHeatmapOverlay
                    products={currentImageProducts}
                    onSelectProduct={(p) => setSelectedProductId(p.id)}
                    selectedProductId={selectedProductId}
                    onClose={() => setShowHeatmap(false)}
                  />
                )}

                {/* Overlay Bounding Boxes */}
                {currentImageProducts.map((p) => {
                  if (!p.boundingBox) return null;
                  const b = normalizeBoundingBox(p.boundingBox);
                  if (b.width <= 0 || b.height <= 0) return null;

                  const isSelected = p.id === selectedProductId;
                  const isGhost = p.isGhost;
                  const isDiscarded = p.isDiscarded;

                  // Color code: emerald for verified, amber for pending, red for discarded
                  let borderColor = 'border-amber-400/80 bg-amber-500/10 z-10';
                  if (isDiscarded) {
                    borderColor = 'border-red-500/50 bg-red-500/10 line-through opacity-50 z-5';
                  } else if (p.verificationStatus === 'human_verified') {
                    borderColor = 'border-emerald-400 bg-emerald-500/15 z-10';
                  } else if (p.verificationStatus === 'auto_accepted') {
                    borderColor = 'border-sky-400 bg-sky-500/10 z-10';
                  } else if (isGhost) {
                    borderColor = 'border-zinc-500 border-dashed bg-zinc-500/10 z-5';
                  }

                  if (isSelected) {
                    borderColor = 'border-2 border-lime-300 ring-4 ring-lime-400/40 bg-lime-400/20 z-30 shadow-lg';
                  }

                  return (
                    <div
                      key={p.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProductId(p.id);
                        centerOnProduct(b);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${b.x * 100}%`,
                        top: `${b.y * 100}%`,
                        width: `${b.width * 100}%`,
                        height: `${b.height * 100}%`,
                      }}
                      className={`cursor-pointer transition-all rounded ${borderColor} flex flex-col justify-between p-1 hover:brightness-125`}
                      title={`${p.name} - ${t('clickForVerificationDetail') || 'Click for detailed verification'}`}
                    >
                      <div className="flex items-center justify-between gap-1 overflow-hidden pointer-events-none">
                        <span className="text-[9px] font-bold bg-black/85 text-white px-1 rounded truncate leading-none">
                          {p.name}
                        </span>
                        {formatPriceValue(p.regularPrice) ? (
                          <span className="text-[9px] font-mono font-black bg-rose-600 text-white px-1 rounded leading-none shrink-0 shadow-2xs">
                            {formatPriceValue(p.regularPrice)} €
                          </span>
                        ) : formatPriceValue(p.promoPrice) ? (
                          <span className="text-[9px] font-mono font-black bg-amber-500 text-zinc-950 dark:text-zinc-100 px-1 rounded leading-none shrink-0 shadow-2xs">
                            {formatPriceValue(p.promoPrice)} €
                          </span>
                        ) : formatPriceValue(p.clubPrice) ? (
                          <span className="text-[9px] font-mono font-black bg-sky-500 text-white px-1 rounded leading-none shrink-0 shadow-2xs">
                            {formatPriceValue(p.clubPrice)} €
                          </span>
                        ) : (
                          <span className="text-[8px] font-bold bg-amber-950/90 text-amber-300 border border-amber-600/40 px-1 rounded leading-none shrink-0">
                            {t('missingPriceBadge') || 'Missing price'}
                          </span>
                        )}
                      </div>

                      {/* Tag association indicator icon */}
                      {isSelected && (
                        <div className="self-end bg-lime-400 text-zinc-950 dark:text-zinc-100 p-0.5 rounded text-[8px] font-black uppercase shadow-xs">
                          {t('selected') || 'Selected'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="p-12 text-center text-zinc-500 dark:text-zinc-400 text-xs">
                {t('noPhotoToDisplay') || 'Žiadna fotografia na zobrazenie'}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Queue Lists & Item Inspector (5 cols) */}
        <div className="lg:col-span-5 bg-zinc-900 flex flex-col h-full overflow-hidden">
          {/* Queue Tab Navigation */}
          <div className="p-3 border-b border-zinc-800 bg-zinc-900/90 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-zinc-800 p-1 rounded-xl w-full text-xs">
                <button
                  onClick={() => setActiveQueueTab('uncertainties')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    activeQueueTab === 'uncertainties'
                      ? 'bg-amber-500 text-zinc-950 shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{t('uncertainties') || 'Data Uncertainties'}</span>
                  <span className="bg-black/30 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black">
                    {uncertaintiesList.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveQueueTab('businessIssues')}
                  className={`flex-1 py-1.5 px-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    activeQueueTab === 'businessIssues'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('businessIssues') || 'Commercial Issues'}</span>
                  <span className="bg-black/30 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black">
                    {businessIssuesList.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveQueueTab('all')}
                  className={`py-1.5 px-2.5 rounded-lg font-bold transition-colors cursor-pointer ${
                    activeQueueTab === 'all'
                      ? 'bg-zinc-700 text-white shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {t('allQueueItems') || 'All'} ({currentImageProducts.length})
                </button>
              </div>
            </div>

            {/* Quick search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={queueSearch}
                onChange={e => setQueueSearch(e.target.value)}
                placeholder={t('quickSkuSearch') || 'Quick SKU search...'}
                className="w-full bg-zinc-800 text-white text-xs pl-8 pr-3 py-1.5 rounded-lg border border-zinc-700 focus:outline-none focus:border-zinc-500"
              />
            </div>
          </div>

          {/* Queue List (Scrollable Cards) */}
          <div className="h-44 overflow-y-auto custom-scrollbar p-2.5 space-y-1.5 border-b border-zinc-800 shrink-0 bg-zinc-950/40">
            {filteredQueue.length > 0 ? (
              filteredQueue.map((item, idx) => {
                const isSelected = item.id === selectedProductId;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedProductId(item.id);
                      if (item.boundingBox) centerOnProduct(item.boundingBox);
                    }}
                    className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-zinc-800 border-lime-400 shadow-md shadow-lime-950/30 ring-1 ring-lime-400'
                        : 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 w-4 text-center">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate max-w-[200px]" title={item.name}>
                          {item.name}
                        </div>
                        <div className="text-[10px] text-zinc-400 flex items-center gap-1.5">
                          <span>{item.brand || t('brandCol') || 'Brand'}</span>
                          <span>•</span>
                          <span>{item.category || t('category') || 'Kategória'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {formatPriceValue(item.regularPrice) ? (
                        <span className="text-xs font-mono font-bold text-white">
                          {formatPriceValue(item.regularPrice)} €
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                          {t('missingPriceBadge') || 'Missing price'}
                        </span>
                      )}

                      {/* Verification status pill */}
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        item.verificationStatus === 'human_verified'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : item.verificationStatus === 'auto_accepted'
                          ? 'bg-sky-500/20 text-sky-300'
                          : item.isDiscarded
                          ? 'bg-red-500/20 text-red-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {item.verificationStatus === 'human_verified' ? (t('verified') || 'Verified') : item.verificationStatus === 'auto_accepted' ? (t('accepted') || 'Accepted') : item.isDiscarded ? (t('discarded') || 'Discarded') : (t('forReview') || 'Na kontrolu')}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-zinc-500 dark:text-zinc-400 text-xs italic">
                {t('noItemsInFilter') || 'No items in this filter'}
              </div>
            )}
          </div>

          {/* ITEM INSPECTOR & VERIFICATION CONTROLS (Bottom half, scrollable) */}
          {selectedProduct ? (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
              {/* Evidence Crops Header (Product Crop & Tag Crop side-by-side) */}
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-rose-400" />
                  <span>{t('photoEvidenceTitle') || 'Photo Evidence (Crops from Original)'}</span>
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {/* Product Box Crop */}
                  <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800 flex flex-col items-center">
                    <span className="text-[9px] font-bold uppercase text-zinc-400 mb-1">{t('productCrop') || 'Product crop'}</span>
                    <div className="w-full h-24 bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center border border-zinc-800 relative">
                      {productCropUrl ? (
                        <img src={productCropUrl} alt={t('productCrop') || 'Product crop'} className="max-h-full max-w-full object-contain" />
                      ) : selectedProduct?.boundingBox && currentImage?.imageUrl ? (
                        (() => {
                          const nb = normalizeBoundingBox(selectedProduct.boundingBox);
                          if (nb.width <= 0 || nb.height <= 0) {
                            return <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{t('noPosition') || 'No position'}</span>;
                          }
                          return (
                            <div className="relative w-full h-full overflow-hidden rounded bg-black">
                              <img
                                src={currentImage.imageUrl}
                                alt={t('productCrop') || 'Product crop'}
                                crossOrigin={currentImage.imageUrl.startsWith('data:') || currentImage.imageUrl.startsWith('blob:') ? undefined : 'anonymous'}
                                style={{
                                  position: 'absolute',
                                  width: `${(1 / Math.max(0.01, nb.width)) * 100}%`,
                                  height: `${(1 / Math.max(0.01, nb.height)) * 100}%`,
                                  left: `${-(nb.x / Math.max(0.01, nb.width)) * 100}%`,
                                  top: `${-(nb.y / Math.max(0.01, nb.height)) * 100}%`,
                                  maxWidth: 'none',
                                  maxHeight: 'none',
                                }}
                              />
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-[10px] text-zinc-600 dark:text-zinc-400">{t('preparingCrop') || 'Preparing crop...'}</span>
                      )}
                    </div>
                  </div>

                  {/* Price Tag Crop */}
                  <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800 flex flex-col items-center">
                    <span className="text-[9px] font-bold uppercase text-zinc-400 mb-1">{t('priceTagCrop') || 'Shelf price tag crop'}</span>
                    <div className="w-full h-24 bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center border border-zinc-800 relative">
                      {tagCropUrl ? (
                        <img src={tagCropUrl} alt={t('priceTagCrop') || 'Price tag crop'} className="max-h-full max-w-full object-contain" />
                      ) : selectedProduct?.boundingBox && currentImage?.imageUrl ? (
                        (() => {
                          const nb = normalizeBoundingBox(selectedProduct.boundingBox);
                          if (nb.width <= 0 || nb.height <= 0) {
                            return <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{t('notFound') || 'Not found'}</span>;
                          }
                          const tagX = nb.x;
                          const tagY = Math.min(0.92, nb.y + nb.height * 0.72);
                          const tagW = nb.width;
                          const tagH = Math.min(0.22, nb.height * 0.55);
                          return (
                            <div className="relative w-full h-full overflow-hidden rounded bg-black">
                              <img
                                src={currentImage.imageUrl}
                                alt={t('priceTagCrop') || 'Price tag crop'}
                                crossOrigin={currentImage.imageUrl.startsWith('data:') || currentImage.imageUrl.startsWith('blob:') ? undefined : 'anonymous'}
                                style={{
                                  position: 'absolute',
                                  width: `${(1 / Math.max(0.01, tagW)) * 100}%`,
                                  height: `${(1 / Math.max(0.01, tagH)) * 100}%`,
                                  left: `${-(tagX / Math.max(0.01, tagW)) * 100}%`,
                                  top: `${-(tagY / Math.max(0.01, tagH)) * 100}%`,
                                  maxWidth: 'none',
                                  maxHeight: 'none',
                                }}
                              />
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-[10px] text-zinc-600 dark:text-zinc-400">{t('notFound') || 'Not found'}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dimension 1: SKU Identity */}
              <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-zinc-400">1. {t('productIdentitySku') || 'Identita produktu (SKU)'}</span>
                  <button
                    onClick={() => setIsEditingSku(!isEditingSku)}
                    className="text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{isEditingSku ? (t('cancelEdit') || 'Cancel edit') : (t('changeSku') || 'Change SKU')}</span>
                  </button>
                </div>

                {isEditingSku ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editedSkuName}
                      onChange={e => setEditedSkuName(e.target.value)}
                      placeholder={t('enterSkuPlaceholder') || 'Enter SKU name...'}
                      className="w-full bg-zinc-850 text-white text-xs p-2 rounded-lg border border-zinc-700 focus:outline-none focus:border-rose-500 font-bold"
                    />

                    {/* Catalog SKU Quick Picker */}
                    {catalogProducts.length > 0 && (
                      <select
                        onChange={e => {
                          if (e.target.value) setEditedSkuName(e.target.value);
                        }}
                        className="w-full bg-zinc-900 text-zinc-300 text-xs p-1.5 rounded-lg border border-zinc-700"
                      >
                        <option value="">{t('selectFromCatalogOption') || '-- Select from catalog --'}</option>
                        {catalogProducts.map(c => (
                          <option key={c.id} value={c.canonicalName}>
                            {c.canonicalName} ({c.sku || t('noSku') || 'bez SKU'})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="text-sm font-black text-white">{selectedProduct.canonicalSku || selectedProduct.name}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {t('brand') || 'Brand'}: <strong className="text-zinc-200">{selectedProduct.brand}</strong> • {t('category') || 'Kategória'}: <strong className="text-zinc-200">{selectedProduct.category}</strong>
                    </div>
                  </div>
                )}

                {/* Orientačná AI detekcia (nekalibrovaná hodnota bez predstierania pravdepodobnosti) */}
                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1 pt-1 border-t border-zinc-900">
                  <Info className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                  <span>{t('aiScoreNotice') || 'AI model confidence score'}: <strong>{Math.round((selectedProduct.confidence ?? 0.85) * 100)}%</strong> ({t('rankingSignalNotice') || 'used as a ranking signal'})</span>
                </div>
              </div>

              {/* Dimension 2: Price Readability & Value */}
              <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800 space-y-2">
                <span className="text-[10px] font-black uppercase text-zinc-400">2. {t('pricesAndReadability') || 'Prices & Tag Readability'}</span>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-400 block font-semibold mb-0.5">{t('regularPriceCol') || 'Regular price'} (€)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editedRegPrice}
                      onChange={e => setEditedRegPrice(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleConfirmAndSave(); }}
                      placeholder="napr. 1.89"
                      className="w-full bg-zinc-850 text-white font-mono font-bold text-xs p-2 rounded-lg border border-zinc-700 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-rose-400 block font-semibold mb-0.5">{t('promoPriceCol') || 'Sale price'} (€)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editedPromoPrice}
                      onChange={e => setEditedPromoPrice(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleConfirmAndSave(); }}
                      placeholder="napr. 1.39"
                      className="w-full bg-zinc-850 text-rose-300 font-mono font-bold text-xs p-2 rounded-lg border border-zinc-700 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-sky-400 block font-semibold mb-0.5">{t('clubPrice') || 'Club price'} (€)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editedClubPrice}
                      onChange={e => setEditedClubPrice(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleConfirmAndSave(); }}
                      placeholder="napr. 1.29"
                      className="w-full bg-zinc-850 text-sky-300 font-mono font-bold text-xs p-2 rounded-lg border border-zinc-700 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* Quick Save Price Button */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleSaveCorrections}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 text-[11px] font-bold rounded-lg border border-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    title={t('savePricesNotice') || 'Saves entered price without advancing'}
                  >
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('savePrices') || 'Save Prices'}</span>
                  </button>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                    {t('enterSaveVerify') || 'Enter: save & verify'}
                  </span>
                </div>

                {/* Readability assessment options */}
                <div className="flex items-center gap-1.5 pt-1 text-[10px]">
                  <span className="text-zinc-500 dark:text-zinc-400">{t('priceReadability') || 'Tag readability'}:</span>
                  <button
                    onClick={() => handleUpdate({ priceReadabilityStatus: 'readable' }, `${t('priceReadability') || 'Readability'}: ${t('readable') || 'readable'}`)}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      selectedProduct.priceReadabilityStatus === 'readable'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {t('readable') || 'Readable'}
                  </button>
                  <button
                    onClick={() => handleUpdate({ priceReadabilityStatus: 'illegible' }, `${t('priceReadability') || 'Readability'}: ${t('illegible') || 'illegible'}`)}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      selectedProduct.priceReadabilityStatus === 'illegible'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {t('illegible') || 'Illegible'}
                  </button>
                  <button
                    onClick={() => handleUpdate({ priceReadabilityStatus: 'missing' }, `${t('priceReadability') || 'Readability'}: ${t('missing') || 'missing'}`)}
                    className={`px-2 py-0.5 rounded cursor-pointer ${
                      selectedProduct.priceReadabilityStatus === 'missing'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {t('missing') || 'Missing'}
                  </button>
                </div>
              </div>

              {/* Action Buttons Cluster */}
              <div className="space-y-2 pt-1">
                {/* Primary confirmation */}
                <button
                  type="button"
                  onClick={handleConfirmAndSave}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 dark:text-zinc-100 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('confirmVerification') || 'Confirm & Verify'}</span>
                </button>

                {/* Secondary actions row */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleDiscard}
                    className="py-2 px-3 bg-zinc-800 hover:bg-red-950/60 text-zinc-300 hover:text-red-300 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 border border-zinc-700 cursor-pointer"
                    title={t('discardDetectionTitle') || 'Discard false detection from facings'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('discardProduct') || 'Discard Detection'}</span>
                  </button>

                  <button
                    onClick={handleRequestRetake}
                    className="py-2 px-3 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 border border-zinc-700 cursor-pointer"
                    title={t('requestRetakeTitle') || 'Request photo retake from store'}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{t('requestRetake') || 'Request Retake'}</span>
                  </button>
                </div>
              </div>

              {/* Dimension 3: Audit Trail / History */}
              {selectedProduct.auditTrail && selectedProduct.auditTrail.length > 0 && (
                <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800">
                  <span className="text-[10px] font-black uppercase text-zinc-400 flex items-center gap-1 mb-2">
                    <History className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                    <span>{t('auditTrailTitle') || 'Correction History (Audit Trail)'}</span>
                  </span>
                  <div className="space-y-1 text-[10px] font-mono text-zinc-400">
                    {selectedProduct.auditTrail.map(log => (
                      <div key={log.id} className="p-1.5 bg-zinc-900 rounded border border-zinc-850">
                        <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                          <span>{log.user}</span>
                          <span>{new Date(log.timestamp).toLocaleTimeString('sk-SK')}</span>
                        </div>
                        <div className="text-zinc-200 mt-0.5">
                          {log.action}: <strong>{log.fieldName}</strong> ({String(log.previousValue ?? 'null')} → {String(log.newValue)})
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500 dark:text-zinc-400 text-xs">
              {t('itemsForReview') || 'Select an item to review'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhotoAuditVerificationScreen;
