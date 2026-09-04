import React, { useState, useRef, useMemo, useCallback } from 'react';
import type { DetectedProduct, BrandClassifications } from '../types';
import { 
  normalizeBoundingBox, 
  getBoxColorInfo, 
  isPromoProduct, 
  type BoundingBoxColorScheme 
} from '../utils/boundingBoxUtils';
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
  DollarSign
} from 'lucide-react';

export interface BoundingBoxOverlayProps {
  imageUrl: string;
  imageAlt?: string;
  products: DetectedProduct[];
  isLoading?: boolean;
  highlightedProductName?: string | null;
  brandClassifications?: BrandClassifications;
  onSelectProduct?: (product: DetectedProduct) => void;
  className?: string;
  showControls?: boolean;
  initialColorScheme?: BoundingBoxColorScheme;
  allowZoomPan?: boolean;
  allowFullScreen?: boolean;
}

export const BoundingBoxOverlay: React.FC<BoundingBoxOverlayProps> = ({
  imageUrl,
  imageAlt = 'Snímka regálu',
  products,
  isLoading = false,
  highlightedProductName = null,
  brandClassifications,
  onSelectProduct,
  className = '',
  showControls = true,
  initialColorScheme = 'brand',
  allowZoomPan = true,
  allowFullScreen = true
}) => {
  // Layer & Display States
  const [showBoxes, setShowBoxes] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<'always' | 'hover' | 'off'>('hover');
  const [showPrices, setShowPrices] = useState<boolean>(true);
  const [showPos, setShowPos] = useState<boolean>(true);
  const [showGhosts, setShowGhosts] = useState<boolean>(true);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [showOnlyPromo, setShowOnlyPromo] = useState<boolean>(false);
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
  }, [products, showPos, showGhosts, showOnlyPromo, minConfidence, searchFilter]);

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
              title="Prepnúť ohraničenia (Bounding Boxes)"
            >
              <Box className="w-3.5 h-3.5" />
              <span>Ohraničenia</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 bg-black/30 rounded-md font-mono">
                {filteredProducts.length}
              </span>
            </button>

            <button
              onClick={() => setShowHeatmap(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${
                showHeatmap 
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/30' 
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title="Zobraziť hustotu vystavenia (Heatmap)"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Hustota</span>
            </button>

            <button
              onClick={() => setShowPrices(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${
                showPrices 
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30' 
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title="Zobraziť cenové štítky nad produktmi"
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-300" />
              <span>Cenovky</span>
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
              title="Filtrovať iba akciové produkty a ceny (červené/žlté rámčeky)"
            >
              <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span>Iba Akcie ({stats.promoCount})</span>
            </button>

            <button
              onClick={() => setShowPos(prev => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all ${
                showPos 
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/30' 
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title="Zobraziť POS materiály (stoppery, woblery, palety)"
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
                title="Zobraziť tlačené / ghost obrazy regálu"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                <span>Ghosts ({stats.totalGhosts})</span>
              </button>
            )}

            {/* Quick Color Scheme Dropdown */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700/80">
              <button
                onClick={() => setColorScheme('brand')}
                className={`px-2 py-0.8 rounded text-[11px] font-bold transition-all ${
                  colorScheme === 'brand' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Zafarbenie podľa značky (Naša vs Konkurencia)"
              >
                Značka
              </button>
              <button
                onClick={() => setColorScheme('confidence')}
                className={`px-2 py-0.8 rounded text-[11px] font-bold transition-all ${
                  colorScheme === 'confidence' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Zafarbenie podľa istoty AI (Vysoká / Stredná / Nízka)"
              >
                Istota
              </button>
              <button
                onClick={() => setColorScheme('promo')}
                className={`px-2 py-0.8 rounded text-[11px] font-bold transition-all ${
                  colorScheme === 'promo' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Zafarbenie podľa Promo akcií"
              >
                Akcie
              </button>
            </div>
          </div>

          {/* Right: Quick Search, Zoom & Fullscreen Controls */}
          <div className="flex items-center gap-2">
            {/* Search within Image */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Hľadať v snímke..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-7 pr-2 py-1 bg-slate-800/90 text-white placeholder-slate-500 rounded-lg border border-slate-700/80 text-[11px] focus:outline-hidden focus:border-cyan-500 w-32 focus:w-44 transition-all"
              />
              {searchFilter && (
                <button 
                  onClick={() => setSearchFilter('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs px-1"
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
              title="Pokročilé filtre zobrazenia"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            {/* Zoom Controls */}
            {allowZoomPan && (
              <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700/80 p-0.5">
                <button
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 1}
                  className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                  title="Zmenšiť"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-1.5 text-[10px] font-mono text-cyan-300 font-bold min-w-[32px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 4}
                  className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                  title="Zväčšiť"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                {zoomLevel > 1 && (
                  <button
                    onClick={handleResetZoom}
                    className="p-1 text-slate-400 hover:text-white border-l border-slate-700"
                    title="Obnoviť priblíženie"
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
                className="p-1.5 bg-slate-800 text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors"
                title={isFullScreen ? 'Ukončiť režim celej obrazovky' : 'Celá obrazovka'}
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
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 block">
              Zobrazenie názvov SKU
            </label>
            <div className="flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
              <button
                onClick={() => setShowLabels('always')}
                className={`flex-1 py-1 rounded text-[11px] font-bold ${
                  showLabels === 'always' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Vždy
              </button>
              <button
                onClick={() => setShowLabels('hover')}
                className={`flex-1 py-1 rounded text-[11px] font-bold ${
                  showLabels === 'hover' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Pri nábehu
              </button>
              <button
                onClick={() => setShowLabels('off')}
                className={`flex-1 py-1 rounded text-[11px] font-bold ${
                  showLabels === 'off' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Vypnuté
              </button>
            </div>
          </div>

          {/* Min Confidence Threshold Slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Minimálna istota AI
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
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Prehľad detekcií v snímke</span>
            <div className="flex items-center gap-3 mt-1 text-[11px] font-bold">
              <span className="text-emerald-400">{stats.totalFacings} Facings</span>
              <span className="text-purple-400">{stats.totalPos} POSM</span>
              <span className="text-amber-400">{stats.promoCount} Akcií</span>
              <span className="text-cyan-400">Ø {stats.avgConfidence}% Istota</span>
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
              Spracovanie AI modelu...
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
          {/* Main Shelf Image */}
          <img 
            src={imageUrl} 
            alt={imageAlt} 
            className="w-auto h-auto max-h-[75vh] max-w-full object-contain mx-auto block rounded-lg select-none"
            draggable={false}
          />

          {/* 🌟 HEATMAP OVERLAY LAYER */}
          {showHeatmap && (
            <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-lg">
              {filteredProducts
                .filter(p => p.type !== 'pos_material')
                .map((product, idx) => {
                  const norm = normalizeBoundingBox(product.boundingBox);
                  const isHighlighted = highlightedProductName && product.name === highlightedProductName;
                  return (
                    <div
                      key={`heat-${product.id || idx}`}
                      className="absolute rounded-full"
                      style={{
                        left: `${(norm.x + norm.width / 2) * 100}%`,
                        top: `${(norm.y + norm.height / 2) * 100}%`,
                        width: `${Math.max(norm.width, norm.height) * 220}%`,
                        height: `${Math.max(norm.width, norm.height) * 220}%`,
                        transform: 'translate(-50%, -50%)',
                        background: isHighlighted
                          ? 'radial-gradient(circle, rgba(34, 211, 238, 0.6) 0%, rgba(34, 211, 238, 0) 70%)'
                          : 'radial-gradient(circle, rgba(245, 158, 11, 0.45) 0%, rgba(239, 68, 68, 0.2) 40%, rgba(0, 0, 0, 0) 70%)',
                      }}
                    />
                  );
                })}
            </div>
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

            return (
              <div
                key={`box-${product.id || idx}`}
                className={`absolute group cursor-pointer transition-all duration-150 ${
                  isHighlighted 
                    ? 'z-30 ring-4 ring-cyan-400 shadow-[0_0_20px_#22d3ee]' 
                    : isHovered 
                    ? 'z-20 ring-2 ring-white shadow-lg' 
                    : 'z-10'
                }`}
                style={{
                  left: `${norm.x * 100}%`,
                  top: `${norm.y * 100}%`,
                  width: `${norm.width * 100}%`,
                  height: `${norm.height * 100}%`,
                  borderColor: colorInfo.border,
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
                {(showLabels === 'always' || (showLabels === 'hover' && isHovered) || isHighlighted) && (
                  <div 
                    className={`absolute -top-7 left-0 px-2 py-0.5 rounded-md text-[10px] font-black text-white shadow-xl flex items-center gap-1.5 whitespace-nowrap pointer-events-none z-30 animate-fade-in ${
                      isPromo ? 'ring-1 ring-amber-300' : ''
                    }`}
                    style={{ backgroundColor: colorInfo.badgeBg }}
                  >
                    {isPromo && <Flame className="w-3 h-3 text-amber-300" />}
                    {isPOS && <Tag className="w-3 h-3 text-white" />}
                    {isGhost && <ShieldAlert className="w-3 h-3 text-white" />}
                    <span className="truncate max-w-[180px]">{product.name}</span>
                    {isPromo && (
                      <span className="px-1 py-0.2 bg-amber-400 text-slate-950 rounded text-[8px] font-black tracking-wider">
                        PROMO
                      </span>
                    )}
                    <span className="opacity-80 text-[8px] font-mono">
                      {Math.round((product.confidence ?? 0.9) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 📊 BOTTOM HUD STATUS BAR */}
      <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3 z-30">
        {hoveredProduct ? (
          <div className="flex items-center gap-3 text-white">
            <span className="font-black text-cyan-400 flex items-center gap-1">
              <Box className="w-3.5 h-3.5" />
              {hoveredProduct.name}
            </span>
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
            <span className="text-[10px] font-mono text-slate-400">
              Istota: <strong className="text-white">{Math.round((hoveredProduct.confidence ?? 0.9) * 100)}%</strong>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <span>Nabehnutím kurzorom na ohraničenie zobrazíte detail produktu.</span>
            {highlightedProductName && (
              <span className="text-cyan-300 font-bold">
                Zvýraznené: &ldquo;{highlightedProductName}&rdquo;
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-400 ml-auto">
          <span>Zobrazených: <strong className="text-white">{filteredProducts.length}</strong> / {products?.length || 0}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          <span>Salesapp Vision Bounding Box Engine</span>
        </div>
      </div>
    </div>
  );
};
