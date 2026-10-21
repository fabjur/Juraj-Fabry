import React, { useState, useRef, useMemo, useCallback } from 'react';
import type { DetectedProduct, BrandClassifications, PriceInfo } from '../types';
import { useTranslation } from '../i18n/index.tsx';
import { 
  normalizeBoundingBox, 
  getBoxColorInfo, 
  isPromoProduct, 
  type BoundingBoxColorScheme 
} from '../utils/boundingBoxUtils';
import { parsePrice } from '../utils/priceIntegrity';
import { generateShelfPreviewSvg } from '../utils/shelfPreview.ts';
import { ShelfHeatmapOverlay } from './ShelfHeatmapOverlay.tsx';
import { 
  Box, 
  Flame, 
  Tag, 
  ShieldAlert, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  SlidersHorizontal, 
  Sparkles,
  Search,
  DollarSign,
  Pencil,
  Check,
  X,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';

export interface ProductAnomalyInfo {
  hasAnomaly: boolean;
  type: 'missing_price' | 'inverted_promo' | 'extreme_discount' | 'low_confidence';
  severity: 'high' | 'medium' | 'low';
  label: string;
  description: string;
  regularPrice: number | null;
  promoPrice: number | null;
}

export function detectProductAnomaly(p: DetectedProduct, t?: (key: string, params?: any) => string): ProductAnomalyInfo | null {
  if (!p || p.type === 'pos_material') return null;

  let reg: number | null = null;
  let promo: number | null = null;

  (p.prices || []).forEach(price => {
    const parsed = parsePrice(price.value);
    if (price.type === 'PROMO') {
      promo = parsed;
    } else {
      reg = parsed;
    }
  });

  if (!p.prices || p.prices.length === 0 || (reg === null && promo === null)) {
    return {
      hasAnomaly: true,
      type: 'missing_price',
      severity: 'high',
      label: t ? (t('missingPrice') || 'Chýba cena') : 'Chýba cena',
      description: t ? (t('missingPriceTagDesc') || 'AI nezachytila regálovú cenovku.') : 'AI nezachytila regálovú cenovku.',
      regularPrice: null,
      promoPrice: null,
    };
  }

  if (reg !== null && promo !== null && promo > reg) {
    return {
      hasAnomaly: true,
      type: 'inverted_promo',
      severity: 'high',
      label: t ? (t('invertedPromoTitle') || 'Akcia > Bežná') : 'Akcia > Bežná',
      description: t ? (t('invertedPromoDesc', { promo: promo.toFixed(2), reg: reg.toFixed(2) }) || `Akcia (${promo.toFixed(2)} €) je vyššia ako bežná cena (${reg.toFixed(2)} €).`) : `Akcia (${promo.toFixed(2)} €) je vyššia ako bežná cena (${reg.toFixed(2)} €).`,
      regularPrice: reg,
      promoPrice: promo,
    };
  }

  if (reg !== null && promo !== null && reg > 0 && ((reg - promo) / reg) > 0.75) {
    const disc = Math.round(((reg - promo) / reg) * 100);
    return {
      hasAnomaly: true,
      type: 'extreme_discount',
      severity: 'medium',
      label: t ? (t('extremeDiscountTitle', { discount: disc }) || `Zľava -${disc}%`) : `Zľava -${disc}%`,
      description: t ? (t('extremeDiscountDesc') || `Extrémne vysoká zľava (-${disc}%). Overte desatinné miesta.`) : `Extrémne vysoká zľava (-${disc}%). Overte desatinné miesta.`,
      regularPrice: reg,
      promoPrice: promo,
    };
  }

  const conf = Math.round((p.confidence ?? 0.9) * 100);
  if (conf < 70 || (p.name && p.name.toLowerCase().startsWith('neznám'))) {
    return {
      hasAnomaly: true,
      type: 'low_confidence',
      severity: 'medium',
      label: t ? (t('lowConfidenceSkuTitle', { confidence: conf }) || `Istota ${conf}%`) : `Istota ${conf}%`,
      description: t ? (t('lowConfidenceSkuDesc') || `Nízka istota detekcie SKU (${conf}%).`) : `Nízka istota detekcie SKU (${conf}%).`,
      regularPrice: reg,
      promoPrice: promo,
    };
  }

  return null;
}

export interface BoundingBoxOverlayProps {
  imageUrl: string;
  imageAlt?: string;
  products: DetectedProduct[];
  isLoading?: boolean;
  highlightedProductName?: string | null;
  brandClassifications?: BrandClassifications;
  onSelectProduct?: (product: DetectedProduct) => void;
  onProductNameUpdate?: (productId: string, originalName: string, newName: string) => void | Promise<void>;
  onUpdateProductPrices?: (updates: { productId: string; prices: PriceInfo[] }[]) => void;
  onOpenTriage?: () => void;
  className?: string;
  showControls?: boolean;
  initialColorScheme?: BoundingBoxColorScheme;
  allowZoomPan?: boolean;
  allowFullScreen?: boolean;
  isVideo?: boolean;
  isSOSMode?: boolean;
}

export const BoundingBoxOverlay: React.FC<BoundingBoxOverlayProps> = ({
  imageUrl,
  imageAlt,
  products,
  isLoading = false,
  highlightedProductName = null,
  brandClassifications,
  onSelectProduct,
  onProductNameUpdate,
  onUpdateProductPrices,
  onOpenTriage,
  className = '',
  showControls = true,
  initialColorScheme = 'brand',
  allowZoomPan = true,
  allowFullScreen = true,
  isVideo = false,
  isSOSMode = false
}) => {
  const { t } = useTranslation();
  const effectiveImageAlt = imageAlt || t('shelfPhoto') || 'Snímka regálu';

  // Layer & Display States
  const [showBoxes, setShowBoxes] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<'always' | 'hover' | 'off'>('always');
  const [showPrices, setShowPrices] = useState<boolean>(true);
  const [showPos, setShowPos] = useState<boolean>(true);
  const [showGhosts, setShowGhosts] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [showOnlyPromo, setShowOnlyPromo] = useState<boolean>(false);
  const [showOnlyAnomalies, setShowOnlyAnomalies] = useState<boolean>(false);
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [colorScheme, setColorScheme] = useState<BoundingBoxColorScheme>(initialColorScheme);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState<boolean>(false);
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Zoom & Pan state
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  // Hovered product for HUD
  const [hoveredProduct, setHoveredProduct] = useState<DetectedProduct | null>(null);

  // In-place inline product name editing state
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [editFeedback, setEditFeedback] = useState<{ id: string; text: string } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const startEditing = useCallback((product: DetectedProduct, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingProductId(product.id);
    setEditingName(product.name);
    setTimeout(() => {
      if (editInputRef.current) {
        editInputRef.current.focus();
        editInputRef.current.select();
      }
    }, 50);
  }, []);

  const handleSaveEdit = useCallback((product: DetectedProduct) => {
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== product.name) {
      onProductNameUpdate?.(product.id, product.name, trimmed);
      setEditFeedback({ id: product.id, text: trimmed });
      setTimeout(() => {
        setEditFeedback(null);
      }, 3000);
    }
    setEditingProductId(null);
    setEditingName('');
  }, [editingName, onProductNameUpdate]);

  const handleCancelEdit = useCallback(() => {
    setEditingProductId(null);
    setEditingName('');
  }, []);

  // Inline Price Editing State & Handlers
  const [editingPriceProductId, setEditingPriceProductId] = useState<string | null>(null);
  const [editingRegularPrice, setEditingRegularPrice] = useState('');
  const [editingPromoPrice, setEditingPromoPrice] = useState('');

  const startEditingPrice = useCallback((product: DetectedProduct, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingPriceProductId(product.id);
    let regStr = '';
    let promoStr = '';
    (product.prices || []).forEach(pr => {
      const num = parsePrice(pr.value);
      if (num !== null) {
        const t = (pr.type || '').toUpperCase();
        if (t.includes('PROMO') || t.includes('AKCIA')) promoStr = num.toFixed(2);
        else regStr = num.toFixed(2);
      }
    });
    if (!regStr && typeof product.regularPrice === 'number') regStr = product.regularPrice.toFixed(2);
    if (!promoStr && typeof product.promoPrice === 'number') promoStr = product.promoPrice.toFixed(2);
    setEditingRegularPrice(regStr);
    setEditingPromoPrice(promoStr);
  }, []);

  const handleSavePrice = useCallback((product: DetectedProduct) => {
    if (!onUpdateProductPrices) return;
    const newPrices: PriceInfo[] = [];
    const regNum = parsePrice(editingRegularPrice);
    if (regNum !== null && regNum > 0) {
      newPrices.push({ value: `${regNum.toFixed(2)} €`, type: 'REGULAR' });
    }
    const promoNum = parsePrice(editingPromoPrice);
    if (promoNum !== null && promoNum > 0) {
      newPrices.push({ value: `${promoNum.toFixed(2)} €`, type: 'PROMO' });
    }
    if (newPrices.length > 0) {
      onUpdateProductPrices([{ productId: product.id, prices: newPrices }]);
      setEditFeedback({ id: product.id, text: 'Cena uložená' });
      setTimeout(() => setEditFeedback(null), 3000);
    }
    setEditingPriceProductId(null);
    setEditingRegularPrice('');
    setEditingPromoPrice('');
  }, [editingRegularPrice, editingPromoPrice, onUpdateProductPrices]);

  const handleCancelPriceEdit = useCallback(() => {
    setEditingPriceProductId(null);
    setEditingRegularPrice('');
    setEditingPromoPrice('');
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.5, 4));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  }, [zoomLevel, panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || zoomLevel <= 1) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  }, [isDragging, zoomLevel, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    if (!Array.isArray(products)) return [];
    
    return products.filter(p => {
      if (!p || !p.boundingBox) return false;
      
      // POS filter
      if (p.type === 'pos_material' && !showPos) return false;

      // Ghost filter
      if (p.isGhost && !showGhosts) return false;

      // Promo filter (show only promo products)
      if (showOnlyPromo && !isPromoProduct(p)) return false;

      // Anomaly filter
      if (showOnlyAnomalies && !detectProductAnomaly(p)) return false;

      // Confidence threshold
      const conf = p.confidence ?? 0.9;
      if (conf * 100 < minConfidence) return false;

      // Search keyword filter
      if (searchFilter.trim()) {
        const query = searchFilter.toLowerCase().trim();
        const nameMatch = (p.name || '').toLowerCase().includes(query);
        const brandMatch = (p.brand || '').toLowerCase().includes(query);
        const priceMatch = (p.prices || []).some(price => price.value.toLowerCase().includes(query));
        if (!nameMatch && !brandMatch && !priceMatch) return false;
      }

      return true;
    });
  }, [products, showPos, showGhosts, showOnlyPromo, showOnlyAnomalies, minConfidence, searchFilter]);

  // Count of anomalies in this image
  const anomalyCount = useMemo(() => {
    if (!Array.isArray(products)) return 0;
    return products.filter(p => Boolean(detectProductAnomaly(p))).length;
  }, [products]);

  // Statistics for the current image
  const stats = useMemo(() => {
    let totalFacings = 0;
    let totalPos = 0;
    let totalGhosts = 0;
    let promoCount = 0;
    let sumConfidence = 0;

    (products || []).forEach(p => {
      if (!p) return;
      if (p.type === 'pos_material') totalPos++;
      else totalFacings++;

      if (p.isGhost) totalGhosts++;
      if (isPromoProduct(p)) promoCount++;
      sumConfidence += (p.confidence ?? 0.9);
    });

    const avgConfidence = products?.length > 0 ? Math.round((sumConfidence / products.length) * 100) : 0;

    return { totalFacings, totalPos, totalGhosts, promoCount, avgConfidence };
  }, [products]);

  // Count of occurrences (facings) of each product in the current photo
  const productOccurrencesMap = useMemo(() => {
    const map = new Map<string, number>();
    (products || []).forEach(p => {
      if (!p || !p.name) return;
      const key = p.name.trim().toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [products]);

  const getFacingCountText = useCallback((count: number) => {
    if (count === 1) return '1 facing';
    if (count >= 2 && count <= 4) return `${count} facingy`;
    return `${count} facingov`;
  }, []);

  return (
    <div 
      className={`relative flex flex-col bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-xl select-none ${
        isFullScreen ? 'fixed inset-0 z-50 rounded-none border-none' : ''
      } ${className}`}
      ref={containerRef}
    >
      {/* 🛠️ TOP CONTROL TOOLBAR */}
      {showControls && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 z-30 text-xs">
          
          {/* Left: Layer Toggles & Mode Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setShowBoxes(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${
                showBoxes 
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30' 
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title={t('toggleBoundingBoxes') || 'Prepnúť ohraničenia (Bounding Boxes)'}
            >
              <Box className="w-3.5 h-3.5" />
              <span>{t('boundingBoxes') || 'Ohraničenia'}</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-black/30 rounded-md font-mono">
                {filteredProducts.length}
              </span>
            </button>

            <button
              onClick={() => setShowHeatmap(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${
                showHeatmap 
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/30 ring-2 ring-amber-400/60' 
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title={t('heatmapDensity') || 'Zobraziť hustotu vystavenia (Heatmap)'}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('heatmap') || 'Heatmap'}</span>
            </button>

            <button
              onClick={() => setShowPrices(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${
                showPrices 
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30' 
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title={t('showPriceTags') || 'Zobraziť cenové štítky nad produktmi'}
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-300" />
              <span>{t('priceTags') || 'Cenovky'}</span>
            </button>

            <button
              onClick={() => setShowLabels(prev => prev === 'always' ? 'hover' : prev === 'hover' ? 'off' : 'always')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${
                showLabels === 'always' 
                  ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-500/30' 
                  : showLabels === 'hover'
                  ? 'bg-slate-800 text-cyan-300 hover:text-white hover:bg-slate-700 border border-cyan-800/40'
                  : 'bg-slate-800 text-slate-500 hover:text-slate-300'
              }`}
              title={t('toggleProductNames') || 'Prepínať zobrazenie názvov produktov: Vždy viditeľné / Pri prejdení myšou / Vypnuté'}
            >
              <Pencil className="w-3.5 h-3.5 text-cyan-300" />
              <span>{t('names') || 'Názvy'} ({showLabels === 'always' ? (t('labelsAlways') || 'Vždy') : showLabels === 'hover' ? (t('labelsHover') || 'Hover') : (t('labelsOff') || 'Vyp')})</span>
            </button>

            <button
              onClick={() => {
                setShowOnlyPromo(prev => !prev);
                if (!showOnlyPromo) setColorScheme('promo');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${
                showOnlyPromo 
                  ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/30 ring-1 ring-rose-400' 
                  : 'bg-slate-800 text-rose-300 hover:text-white hover:bg-slate-700'
              }`}
              title={t('promoOnlyFilter') || 'Filtrovať iba akciové produkty a ceny (červené/žlté rámčeky)'}
            >
              <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span>{t('onlyPromos') || 'Iba Akcie'} ({stats.promoCount})</span>
            </button>

            <button
              onClick={() => setShowPos(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${
                showPos 
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/30' 
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title={t('showPosMaterials') || 'Zobraziť POS materiály (stoppery, woblery, palety)'}
            >
              <Tag className="w-3.5 h-3.5 text-purple-300" />
              <span>POSM ({stats.totalPos})</span>
            </button>

            {stats.totalGhosts > 0 && (
              <button
                onClick={() => setShowGhosts(prev => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${
                  showGhosts 
                    ? 'bg-slate-700 text-slate-200' 
                    : 'bg-slate-800/60 text-slate-500 hover:text-slate-300'
                }`}
                title={t('showGhosts') || 'Zobraziť tlačené / ghost obrazy regálu'}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                <span>Ghosts ({stats.totalGhosts})</span>
              </button>
            )}

            {anomalyCount > 0 && (
              <button
                onClick={() => setShowOnlyAnomalies(prev => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${
                  showOnlyAnomalies 
                    ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30 ring-2 ring-amber-300 animate-pulse' 
                    : 'bg-amber-950/60 text-amber-300 hover:bg-amber-900 border border-amber-800'
                }`}
                title={t('filterExceptions') || 'Filtrovať iba produkty s chýbajúcimi cenami alebo anomáliami'}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('exceptionsCount', { count: anomalyCount }) || `Výnimky (${anomalyCount})`}</span>
              </button>
            )}

            {onOpenTriage && (
              <button
                onClick={onOpenTriage}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-xs bg-slate-800 text-amber-300 hover:text-white hover:bg-slate-700 border border-amber-600/40 transition-all cursor-pointer"
                title={t('goToTriage') || 'Prejsť do zoznamu výnimiek Triage'}
              >
                <span>Triage</span>
                <ArrowRight className="w-3 h-3 text-amber-400" />
              </button>
            )}

            {/* Quick Color Scheme Dropdown */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700/80">
              <button
                onClick={() => setColorScheme('brand')}
                className={`px-2 py-0.8 rounded text-[11px] font-bold transition-all ${
                  colorScheme === 'brand' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t('colorByBrand') || 'Zafarbenie podľa značky (Naša vs Konkurencia)'}
              >
                {t('brand') || 'Značka'}
              </button>
              <button
                onClick={() => setColorScheme('confidence')}
                className={`px-2 py-0.8 rounded text-[11px] font-bold transition-all ${
                  colorScheme === 'confidence' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t('colorByConfidence') || 'Zafarbenie podľa istoty AI (Vysoká / Stredná / Nízka)'}
              >
                {t('confidence') || 'Istota'}
              </button>
              <button
                onClick={() => setColorScheme('promo')}
                className={`px-2 py-0.8 rounded text-[11px] font-bold transition-all ${
                  colorScheme === 'promo' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t('colorByPromo') || 'Zafarbenie podľa Promo akcií'}
              >
                {t('promos') || 'Akcie'}
              </button>
            </div>
          </div>

          {/* Right: Quick Search, Zoom & Fullscreen Controls */}
          <div className="flex items-center gap-2">
            {/* Search within Image */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={t('searchInImage') || 'Hľadať v snímke...'}
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-7 pr-2 py-1 bg-slate-800/90 text-white placeholder-slate-500 rounded-lg border border-slate-700/80 text-[11px] focus:outline-hidden focus:border-cyan-500 w-32 focus:w-44 transition-all"
              />
              {searchFilter && (
                <button 
                  onClick={() => setSearchFilter('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 hover:text-white text-xs px-1"
                >
                  ×
                </button>
              )}
            </div>

            {/* Filter Drawer Toggle */}
            <button
              onClick={() => setIsFilterPanelOpen(prev => !prev)}
              className={`p-1.5 rounded-lg border transition-all ${
                isFilterPanelOpen || minConfidence > 0
                  ? 'bg-cyan-600 text-white border-cyan-500' 
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title={t('advancedViewFilters') || 'Pokročilé filtre zobrazenia'}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            {/* Zoom Controls */}
            {allowZoomPan && (
              <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700/80 p-0.5">
                <button
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 1}
                  className="p-1 text-slate-400 dark:text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                  title={t('zoomOut') || 'Zmenšiť'}
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 text-[10px] font-mono text-cyan-300 font-bold min-w-[32px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 4}
                  className="p-1 text-slate-400 dark:text-zinc-500 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                  title={t('zoomIn') || 'Zväčšiť'}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                {zoomLevel > 1 && (
                  <button
                    onClick={handleResetZoom}
                    className="p-1 text-slate-400 dark:text-zinc-500 hover:text-white border-l border-slate-700"
                    title={t('resetZoom') || 'Obnoviť priblíženie'}
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Fullscreen Toggle */}
            {allowFullScreen && (
              <button
                onClick={() => setIsFullScreen(prev => !prev)}
                className="p-1.5 bg-slate-800 text-slate-400 dark:text-zinc-500 hover:text-white border border-slate-700 rounded-lg transition-colors"
                title={isFullScreen ? (t('exitFullScreen') || 'Ukončiť režim celej obrazovky') : (t('fullScreen') || 'Celá obrazovka')}
              >
                {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 🎛️ EXPANDABLE ADVANCED SETTINGS PANEL */}
      {isFilterPanelOpen && (
        <div className="bg-slate-900 border-b border-slate-800 p-3 text-xs text-slate-300 grid grid-cols-1 sm:grid-cols-3 gap-4 z-20 animate-fade-in">
          {/* Label Visibility */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-1.5 block">
              {t('skuLabelDisplay') || 'Zobrazenie názvov SKU'}
            </label>
            <div className="flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
              <button
                onClick={() => setShowLabels('always')}
                className={`flex-1 py-1 rounded text-[11px] font-bold ${
                  showLabels === 'always' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('labelsAlways') || 'Vždy'}
              </button>
              <button
                onClick={() => setShowLabels('hover')}
                className={`flex-1 py-1 rounded text-[11px] font-bold ${
                  showLabels === 'hover' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('labelsHover') || 'Pri nábehu'}
              </button>
              <button
                onClick={() => setShowLabels('off')}
                className={`flex-1 py-1 rounded text-[11px] font-bold ${
                  showLabels === 'off' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {t('labelsOff') || 'Vypnuté'}
              </button>
            </div>
          </div>

          {/* Min Confidence Threshold Slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                {t('minAiConfidence') || 'Minimálna istota AI'}
              </label>
              <span className="font-mono text-cyan-400 font-bold">{minConfidence}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="95"
              step="5"
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          {/* Quick Statistics Summary */}
          <div className="flex flex-col justify-center bg-slate-800/60 rounded-xl p-2.5 border border-slate-700/60">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">{t('detectionsOverviewInPhoto') || 'Prehľad detekcií v snímke'}</span>
            <div className="flex items-center gap-3 mt-1 text-[11px] font-bold">
              <span className="text-emerald-400">{stats.totalFacings} Facings</span>
              <span className="text-purple-400">{stats.totalPos} POSM</span>
              <span className="text-amber-400">{stats.promoCount} {t('promos') || 'Akcií'}</span>
              {isSOSMode ? (
                <span className="text-lime-400 font-black flex items-center gap-1">
                  <Box className="w-3 h-3" />
                  {t('sosModeFacings', { count: stats.totalFacings }) || `SOS Režim (${stats.totalFacings} facingov)`}
                </span>
              ) : (
                <span className="text-cyan-400">Ø {stats.avgConfidence}% {t('confidence') || 'Istota'}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🖼️ IMAGE VIEWPORT & OVERLAY CANVAS */}
      <div 
        className={`relative w-full flex-1 overflow-hidden flex items-center justify-center bg-slate-950 ${
          zoomLevel > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center z-40">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
              <Sparkles className="w-5 h-5 text-cyan-400 absolute inset-0 m-auto animate-pulse" />
            </div>
            <p className="mt-3 text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              {t('aiModelProcessing') || 'Processing AI model...'}
            </p>
          </div>
        )}

        {/* Scalable Container */}
        <div 
          className="relative inline-block max-w-full max-h-full transition-transform duration-75"
          style={{
            transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
            transformOrigin: 'center center'
          }}
        >
          {/* Main Shelf Image or Video */}
          {isVideo ? (
            <video 
              src={imageUrl} 
              className="w-auto h-auto max-h-[75vh] max-w-full object-contain mx-auto block rounded-lg select-none"
              controls
              autoPlay
              loop
              muted
            />
          ) : (
            <img 
              src={imageUrl} 
              alt={effectiveImageAlt} 
              className="w-auto h-auto max-h-[75vh] max-w-full object-contain mx-auto block rounded-lg select-none"
              draggable={false}
              onError={(e) => {
                const target = e.currentTarget;
                const fallback = generateShelfPreviewSvg({
                  file: { name: imageAlt || 'Regál' },
                  analysisResult: { products },
                });
                if (target.src !== fallback) {
                  target.src = fallback;
                }
              }}
            />
          )}

          {/* 🌟 HEATMAP OVERLAY LAYER */}
          {showHeatmap && (
            <ShelfHeatmapOverlay
              products={filteredProducts}
              highlightedProductName={highlightedProductName}
              onSelectProduct={onSelectProduct}
              selectedProductId={hoveredProduct?.id}
              onClose={() => setShowHeatmap(false)}
            />
          )}

          {/* 🔲 BOUNDING BOXES INTERACTIVE LAYER */}
          {showBoxes && filteredProducts.map((product, idx) => {
            const norm = normalizeBoundingBox(product.boundingBox);
            if (norm.width <= 0 || norm.height <= 0) return null;

            const isHighlighted = Boolean(highlightedProductName && product.name.toLowerCase().includes(highlightedProductName.toLowerCase()));
            const isHovered = hoveredProduct?.id === product.id;
            const isPOS = product.type === 'pos_material';
            const isGhost = product.isGhost === true;
            const isPromo = isPromoProduct(product);
            
            const colorInfo = getBoxColorInfo(product, brandClassifications, colorScheme);
            const priceText = (product.prices && product.prices.length > 0)
              ? product.prices.map(p => `${p.value}`).join(' | ')
              : null;
            const anomaly = detectProductAnomaly(product);

            return (
              <div
                key={`box-${product.id || idx}`}
                className={`absolute group cursor-pointer transition-all duration-150 ${
                  isHighlighted 
                    ? 'z-30 ring-4 ring-cyan-400 shadow-[0_0_20px_#22d3ee]' 
                    : isHovered 
                    ? 'z-20 ring-2 ring-white shadow-lg' 
                    : anomaly
                    ? 'z-15 ring-2 ring-rose-500/70 shadow-sm'
                    : 'z-10'
                }`}
                style={{
                  left: `${norm.x * 100}%`,
                  top: `${norm.y * 100}%`,
                  width: `${norm.width * 100}%`,
                  height: `${norm.height * 100}%`,
                  borderColor: anomaly ? (anomaly.severity === 'high' ? '#f43f5e' : '#f59e0b') : colorInfo.border,
                  backgroundColor: isHovered || isHighlighted ? colorInfo.bg : 'transparent',
                  borderWidth: isHovered || isHighlighted ? '3px' : '2px',
                  borderStyle: isGhost ? 'dashed' : 'solid',
                  borderRadius: '4px',
                  opacity: highlightedProductName && !isHighlighted ? 0.35 : 1
                }}
                onMouseEnter={() => setHoveredProduct(product)}
                onMouseLeave={() => setHoveredProduct(null)}
                onClick={() => onSelectProduct && onSelectProduct(product)}
              >
                {/* Modern Corner Accents */}
                <div 
                  className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2"
                  style={{ borderColor: colorInfo.border }}
                />
                <div 
                  className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2"
                  style={{ borderColor: colorInfo.border }}
                />
                <div 
                  className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2"
                  style={{ borderColor: colorInfo.border }}
                />
                <div 
                  className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2"
                  style={{ borderColor: colorInfo.border }}
                />

                {/* ⚠️ TOP-RIGHT ANOMALY BADGE */}
                {anomaly && (
                  <div 
                    className={`absolute -top-3.5 right-0 px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase tracking-wider shadow-md flex items-center gap-0.5 z-35 animate-pulse ${
                      anomaly.severity === 'high' 
                        ? 'bg-rose-600 text-white border border-rose-300 ring-1 ring-rose-400' 
                        : 'bg-amber-500 text-zinc-950 border border-amber-200'
                    }`}
                    title={`${anomaly.label}: ${anomaly.description}`}
                  >
                    <AlertTriangle className="w-2.5 h-2.5" />
                    <span>{anomaly.label}</span>
                  </div>
                )}

                {/* 🏷️ FLOATING PRICE TAG / PROMO BADGE (if enabled) */}
                {showPrices && priceText && (
                  <div 
                    className={`absolute -bottom-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-black shadow-md flex items-center gap-1 pointer-events-none whitespace-nowrap z-25 ${
                      isPromo 
                        ? 'bg-gradient-to-r from-red-600 to-amber-500 text-white border border-amber-300 ring-1 ring-red-500/50' 
                        : 'bg-slate-900/90 text-white border border-slate-700'
                    }`}
                  >
                    {isPromo && (
                      <span className="px-1 py-0.2 bg-black/40 rounded text-[7px] text-amber-300 font-extrabold uppercase tracking-wider flex items-center gap-0.5">
                        <Flame className="w-2.5 h-2.5 text-amber-300 animate-pulse" />
                        AKCIA
                      </span>
                    )}
                    <span>{priceText}</span>
                  </div>
                )}

                {/* 🔖 PERMANENT OR HOVER BADGE */}
                {(showLabels === 'always' || (showLabels === 'hover' && isHovered) || isHighlighted || editingProductId === product.id) && (
                  <div 
                    className={`absolute ${norm.y < 0.07 ? 'top-1 left-1' : '-top-7 left-0'} px-2 py-0.5 rounded-md text-[10px] font-black text-white shadow-xl flex items-center gap-1.5 whitespace-nowrap z-30 animate-fade-in ${
                      isPromo ? 'ring-1 ring-amber-300' : ''
                    } ${editingProductId === product.id ? 'ring-2 ring-cyan-400 bg-slate-900 z-40 pointer-events-auto' : 'pointer-events-auto'}`}
                    style={{ backgroundColor: editingProductId === product.id ? '#0f172a' : colorInfo.badgeBg }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {editingProductId === product.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => {
                            const trimmed = editingName.trim();
                            if (trimmed && trimmed !== product.name) {
                              handleSaveEdit(product);
                            } else {
                              handleCancelEdit();
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSaveEdit(product);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCancelEdit();
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="px-2 py-0.5 bg-slate-800 text-white font-bold text-[10px] rounded border border-cyan-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-400 min-w-[160px] max-w-[260px] shadow-inner select-text cursor-text"
                          placeholder={t('editProductNamePlaceholder') || 'Upraviť názov produktu...'}
                          title={t('editProductNameHint') || 'Upravte názov produktu (Enter pre uloženie, Esc pre zrušenie)'}
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveEdit(product);
                          }}
                          className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer transition-colors shadow-xs"
                          title={t('saveChangeEnter') || 'Uložiť zmenu (Enter)'}
                        >
                          <Check className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelEdit();
                          }}
                          className="p-1 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded cursor-pointer transition-colors shadow-xs"
                          title={t('cancelEsc') || 'Zrušiť (Esc)'}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-1.5 cursor-pointer group/label select-none px-1 py-0.5 rounded hover:bg-white/10 transition-colors"
                        onClick={(e) => startEditing(product, e)}
                        title="Kliknutím na textové pole upravíte názov produktu (korekcia AI v reálnom čase)"
                      >
                        {isPromo && <Flame className="w-3 h-3 text-amber-300" />}
                        {isPOS && <Tag className="w-3 h-3 text-white" />}
                        {isGhost && <ShieldAlert className="w-3 h-3 text-white" />}
                        <span className="truncate max-w-[180px] underline decoration-dotted decoration-white/50 group-hover/label:decoration-white transition-all font-semibold">
                          {product.name}
                        </span>
                        <Pencil className="w-2.5 h-2.5 opacity-70 group-hover/label:opacity-100 transition-opacity text-cyan-300 ml-0.5" />
                        {isPromo && (
                          <span className="px-1 py-0.2 bg-amber-400 text-slate-950 dark:text-zinc-100 rounded text-[8px] font-black tracking-wider">
                            PROMO
                          </span>
                        )}
                        {anomaly?.type === 'missing_price' && onUpdateProductPrices && (
                          <button
                            type="button"
                            onClick={(e) => startEditingPrice(product, e)}
                            className="px-1.5 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 dark:text-zinc-100 font-black rounded text-[8px] uppercase tracking-wider flex items-center gap-0.5 shadow-sm active:scale-95 transition-all cursor-pointer ml-0.5"
                            title="Doplniť chýbajúcu cenovku"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            <span>+ Cena</span>
                          </button>
                        )}
                        {anomaly?.type === 'inverted_promo' && onUpdateProductPrices && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateProductPrices([
                                {
                                  productId: product.id,
                                  prices: [
                                    { value: `${anomaly.promoPrice!.toFixed(2)} €`, type: 'REGULAR' },
                                    { value: `${anomaly.regularPrice!.toFixed(2)} €`, type: 'PROMO' }
                                  ]
                                }
                              ]);
                            }}
                            className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-0.5 shadow-sm active:scale-95 transition-all cursor-pointer ml-0.5"
                            title="Prehodiť obrátené ceny (Akcia > Bežná)"
                          >
                            <span>⇄ Prehodiť</span>
                          </button>
                        )}
                        {isSOSMode ? (
                          <span 
                            className="px-1.5 py-0.2 bg-lime-400 text-slate-950 dark:text-zinc-100 font-black rounded text-[8px] flex items-center gap-0.5 tracking-tight shadow-xs"
                            title={`Výskyt tohto produktu na snímke: ${getFacingCountText(productOccurrencesMap.get(product.name?.trim().toLowerCase()) || 1)}`}
                          >
                            <Box className="w-2.5 h-2.5" />
                            {getFacingCountText(productOccurrencesMap.get(product.name?.trim().toLowerCase()) || 1)}
                          </span>
                        ) : (
                          <span className="opacity-80 text-[8px] font-mono">
                            {Math.round((product.confidence ?? 0.9) * 100)}%
                          </span>
                        )}
                        {editFeedback?.id === product.id && (
                          <span className="ml-1 px-1 py-0.2 bg-emerald-500 text-white text-[8px] font-bold rounded animate-bounce">
                            ✓ Upravené
                          </span>
                        )}
                      </div>
                    )}

                    {/* 🏷️ INLINE PRICE EDIT POPOVER */}
                    {editingPriceProductId === product.id && (
                      <div 
                        className="absolute z-50 top-full left-0 mt-1 p-3 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl flex flex-col gap-2.5 min-w-[210px] text-white"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="text-[10px] font-black text-cyan-400 flex items-center justify-between border-b border-slate-800 pb-1.5">
                          <span className="flex items-center gap-1">
                            <Tag className="w-3 h-3 text-amber-400" />
                            Doplniť / upraviť cenu
                          </span>
                          <button type="button" onClick={handleCancelPriceEdit} className="text-slate-400 dark:text-zinc-500 hover:text-white cursor-pointer">✕</button>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] text-slate-300 font-bold">Bežná cena (€):</label>
                          <input
                            type="text"
                            placeholder="napr. 1.89"
                            value={editingRegularPrice}
                            onChange={(e) => setEditingRegularPrice(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSavePrice(product); if (e.key === 'Escape') handleCancelPriceEdit(); }}
                            className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
                            autoFocus
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] text-amber-400 font-bold">Akciová cena (€) - voliteľné:</label>
                          <input
                            type="text"
                            placeholder="napr. 1.29"
                            value={editingPromoPrice}
                            onChange={(e) => setEditingPromoPrice(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSavePrice(product); if (e.key === 'Escape') handleCancelPriceEdit(); }}
                            className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
                          />
                        </div>
                        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-800">
                          <button
                            type="button"
                            onClick={handleCancelPriceEdit}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                          >
                            Zrušiť
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSavePrice(product)}
                            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-[10px] font-black transition-colors cursor-pointer shadow-sm"
                          >
                            Uložiť cenu
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 📊 BOTTOM HUD STATUS BAR */}
      <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 text-xs text-slate-400 dark:text-zinc-500 flex flex-wrap items-center justify-between gap-3 z-30">
        {hoveredProduct ? (
          <div className="flex items-center gap-3 text-white">
            <span className="font-black text-cyan-400 flex items-center gap-1">
              <Box className="w-3.5 h-3.5" />
              {hoveredProduct.name}
            </span>
            <button
              type="button"
              onClick={(e) => startEditing(hoveredProduct, e)}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-[10px] font-bold border border-slate-700 hover:border-cyan-500 flex items-center gap-1 transition-colors cursor-pointer"
              title={t('editProductNameOnPhoto') || 'Upraviť názov tohto produktu na fotografii'}
            >
              <Pencil className="w-2.5 h-2.5" />
              <span>{t('editName') || 'Upraviť názov'}</span>
            </button>
            {onUpdateProductPrices && (
              <button
                type="button"
                onClick={(e) => startEditingPrice(hoveredProduct, e)}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded text-[10px] font-bold border border-slate-700 hover:border-amber-500 flex items-center gap-1 transition-colors cursor-pointer"
                title={t('editProductPriceOnShelf') || 'Doplniť alebo upraviť ceny tohto produktu na regáli'}
              >
                <Tag className="w-2.5 h-2.5" />
                <span>{t('editPrice') || 'Upraviť cenu'}</span>
              </button>
            )}
            {hoveredProduct.brand && (
              <span className="px-2 py-0.5 bg-slate-800 rounded-md text-[10px] font-bold text-slate-300 border border-slate-700">
                {hoveredProduct.brand}
              </span>
            )}
            {hoveredProduct.prices && hoveredProduct.prices.length > 0 && (
              <span className={`font-bold flex items-center gap-1 ${isPromoProduct(hoveredProduct) ? 'text-amber-400' : 'text-emerald-400'}`}>
                {isPromoProduct(hoveredProduct) && <Flame className="w-3 h-3 text-rose-400 animate-pulse" />}
                {hoveredProduct.prices.map(p => `${p.value} (${p.type})`).join(', ')}
              </span>
            )}
            {isSOSMode ? (
              <span className="text-[10px] text-slate-300 flex items-center gap-1.5">
                Výskyt / počet facingov: <strong className="text-lime-300 font-extrabold bg-lime-950/70 border border-lime-500/40 px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                  <Box className="w-3 h-3 text-lime-400" />
                  {getFacingCountText(productOccurrencesMap.get(hoveredProduct.name?.trim().toLowerCase()) || 1)}
                </strong>
              </span>
            ) : (
              <span className="text-[10px] font-mono text-slate-400 dark:text-zinc-500">
                Istota: <strong className="text-white">{Math.round((hoveredProduct.confidence ?? 0.9) * 100)}%</strong>
              </span>
            )}
            {(() => {
              const anom = detectProductAnomaly(hoveredProduct);
              if (!anom) return null;
              return (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1.5 ${
                  anom.severity === 'high'
                    ? 'bg-rose-950 text-rose-300 border border-rose-600 animate-pulse'
                    : 'bg-amber-950 text-amber-300 border border-amber-600'
                }`}>
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span>{anom.label}: {anom.description}</span>
                </span>
              );
            })()}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400 dark:text-zinc-500 text-[11px]">
            <span>Nabehnutím kurzorom na ohraničenie zobrazíte detail produktu.</span>
            {highlightedProductName && (
              <span className="text-cyan-300 font-bold">
                Zvýraznené: &ldquo;{highlightedProductName}&rdquo;
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400 dark:text-zinc-500 ml-auto">
          <span>Zobrazených: <strong className="text-white">{filteredProducts.length}</strong> / {products?.length || 0}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          <span>Salesapp Vision Bounding Box Engine</span>
        </div>
      </div>
    </div>
  );
};
