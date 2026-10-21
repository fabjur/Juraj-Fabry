import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import type { DetectedProduct } from '../types.ts';
import { useTranslation } from '../i18n/index.tsx';
import { normalizeBoundingBox } from '../utils/boundingBoxUtils.ts';
import { parsePrice } from '../utils/priceIntegrity.ts';
import {
  Flame,
  Tag,
  ShieldAlert,
  Grid,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Eye,
  EyeOff,
  X
} from 'lucide-react';

export type HeatmapMode = 'density' | 'missing_labels' | 'audit_issues' | 'shelf_voids';
export type DiffusionRadius = 'tight' | 'balanced' | 'broad';

export interface ShelfHeatmapOverlayProps {
  products: DetectedProduct[];
  imageWidth?: number;
  imageHeight?: number;
  highlightedProductName?: string | null;
  onSelectProduct?: (product: DetectedProduct) => void;
  selectedProductId?: string | null;
  className?: string;
  onClose?: () => void;
}

export function isMissingPriceLabel(p: DetectedProduct): boolean {
  if (!p || p.type === 'pos_material' || p.isGhost) return false;
  if (p.priceReadabilityStatus === 'missing' || p.priceReadabilityStatus === 'illegible') return true;
  if (p.priceIntegrityStatus === 'missing') return true;
  
  const hasValidRegularPrice = typeof p.regularPrice === 'number' && p.regularPrice > 0;
  const hasValidPromoPrice = typeof p.promoPrice === 'number' && p.promoPrice > 0;
  
  const hasValidPriceInList = Boolean(
    p.prices && p.prices.length > 0 && p.prices.some(pr => {
      const val = parsePrice(pr.value);
      return val !== null && val > 0;
    })
  );

  return !hasValidRegularPrice && !hasValidPromoPrice && !hasValidPriceInList;
}

export function getProductAuditIssue(p: DetectedProduct): { type: string; label: string; severity: 'high' | 'medium' } | null {
  if (!p || p.type === 'pos_material') return null;
  if (isMissingPriceLabel(p)) {
    return { type: 'missing_label', label: 'Missing Price Tag', severity: 'high' };
  }
  const reg = p.regularPrice;
  const promo = p.promoPrice;
  if (typeof reg === 'number' && typeof promo === 'number' && promo > reg) {
    return { type: 'inverted_promo', label: 'Promo > Regular', severity: 'high' };
  }
  if (typeof reg === 'number' && typeof promo === 'number' && reg > 0 && ((reg - promo) / reg) > 0.75) {
    return { type: 'extreme_discount', label: 'Extreme Discount', severity: 'medium' };
  }
  const conf = Math.round((p.confidence ?? 0.9) * 100);
  if (conf < 70) {
    return { type: 'low_confidence', label: `Low Confidence (${conf}%)`, severity: 'medium' };
  }
  return null;
}

export const ShelfHeatmapOverlay: React.FC<ShelfHeatmapOverlayProps> = ({
  products = [],
  highlightedProductName = null,
  onSelectProduct,
  selectedProductId,
  className = '',
  onClose
}) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Configuration States
  const [mode, setMode] = useState<HeatmapMode>('density');
  const [opacity, setOpacity] = useState<number>(0.75);
  const [radius, setRadius] = useState<DiffusionRadius>('balanced');
  const [showMarkers, setShowMarkers] = useState<boolean>(true);
  const [isHudCollapsed, setIsHudCollapsed] = useState<boolean>(false);
  const [currentIssueIndex, setCurrentIssueIndex] = useState<number>(0);

  // Filter shelf products (exclude non-shelf POS materials for density)
  const shelfProducts = useMemo(() => {
    return products.filter(p => p.type !== 'pos_material' && !p.isGhost);
  }, [products]);

  // Identify missing label items and general audit issues
  const missingLabelProducts = useMemo(() => {
    return shelfProducts.filter(p => isMissingPriceLabel(p));
  }, [shelfProducts]);

  const problemProducts = useMemo(() => {
    return shelfProducts.filter(p => Boolean(getProductAuditIssue(p)));
  }, [shelfProducts]);

  // Active list of issues depending on current mode
  const activeIssueList = useMemo(() => {
    if (mode === 'missing_labels') return missingLabelProducts;
    if (mode === 'audit_issues') return problemProducts;
    return [];
  }, [mode, missingLabelProducts, problemProducts]);

  // Estimate shelf fill index (percentage of bounded shelf area covered by products)
  const shelfFillRate = useMemo(() => {
    if (shelfProducts.length === 0) return 0;
    let totalCoveredArea = 0;
    shelfProducts.forEach(p => {
      const b = normalizeBoundingBox(p.boundingBox);
      totalCoveredArea += (b.width * b.height);
    });
    // Cap reasonably to 100%
    return Math.min(100, Math.round(totalCoveredArea * 120));
  }, [shelfProducts]);

  // Quick cycle through problematic items
  const handleJumpToIssue = useCallback((direction: 'next' | 'prev') => {
    if (activeIssueList.length === 0) return;
    let nextIdx = direction === 'next' ? currentIssueIndex + 1 : currentIssueIndex - 1;
    if (nextIdx >= activeIssueList.length) nextIdx = 0;
    if (nextIdx < 0) nextIdx = activeIssueList.length - 1;
    setCurrentIssueIndex(nextIdx);
    const targetProduct = activeIssueList[nextIdx];
    if (targetProduct && onSelectProduct) {
      onSelectProduct(targetProduct);
    }
  }, [activeIssueList, currentIssueIndex, onSelectProduct]);

  // Color lookup palette builder (256 RGBA steps)
  const createColorPalette = useCallback((currentMode: HeatmapMode): Uint8ClampedArray => {
    const palette = new Uint8ClampedArray(256 * 4);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 256;
    tempCanvas.height = 1;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return palette;

    const grad = ctx.createLinearGradient(0, 0, 256, 0);

    if (currentMode === 'density') {
      // Cold (Blue/Cyan) -> Warm (Green/Yellow) -> Hot (Orange/Red)
      grad.addColorStop(0.00, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.12, 'rgba(37, 99, 235, 0.45)');   // Royal Blue
      grad.addColorStop(0.30, 'rgba(6, 182, 212, 0.70)');   // Cyan
      grad.addColorStop(0.50, 'rgba(34, 197, 94, 0.85)');   // Lime/Green
      grad.addColorStop(0.72, 'rgba(234, 179, 8, 0.92)');   // Amber/Yellow
      grad.addColorStop(0.88, 'rgba(249, 115, 22, 0.98)');  // Deep Orange
      grad.addColorStop(1.00, 'rgba(225, 29, 72, 1.00)');   // Crimson Red
    } else if (currentMode === 'missing_labels') {
      // Focused warning ramp for missing price tags
      grad.addColorStop(0.00, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.15, 'rgba(245, 158, 11, 0.35)');  // Amber glow
      grad.addColorStop(0.35, 'rgba(239, 68, 68, 0.65)');   // Crimson warning
      grad.addColorStop(0.65, 'rgba(225, 29, 72, 0.90)');   // Hot Rose
      grad.addColorStop(0.85, 'rgba(190, 18, 60, 0.98)');   // Deep Alert
      grad.addColorStop(1.00, 'rgba(147, 51, 234, 1.00)');  // Neon Purple hotspot
    } else if (currentMode === 'shelf_voids') {
      // Inverted density highlighting empty gaps and voids
      grad.addColorStop(0.00, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.20, 'rgba(71, 85, 105, 0.30)');   // Slate
      grad.addColorStop(0.45, 'rgba(14, 165, 233, 0.65)');  // Sky Blue
      grad.addColorStop(0.70, 'rgba(6, 182, 212, 0.85)');   // Cyan void
      grad.addColorStop(0.90, 'rgba(56, 189, 248, 0.95)');  // Bright Ice Blue
      grad.addColorStop(1.00, 'rgba(255, 255, 255, 1.00)');  // Pure Highlighting Core
    } else {
      // General Audit Problem Hotspots
      grad.addColorStop(0.00, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.20, 'rgba(245, 158, 11, 0.40)');  // Amber
      grad.addColorStop(0.50, 'rgba(249, 115, 22, 0.75)');  // Orange
      grad.addColorStop(0.75, 'rgba(239, 68, 68, 0.90)');   // Red
      grad.addColorStop(1.00, 'rgba(168, 85, 247, 1.00)');  // Violet alert
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 1);
    const imgData = ctx.getImageData(0, 0, 256, 1);
    palette.set(imgData.data);
    return palette;
  }, []);

  // Main Canvas Heatmap Render Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use a fixed virtual high-definition buffer for consistency
    const bufferWidth = 600;
    const bufferHeight = 450;
    canvas.width = bufferWidth;
    canvas.height = bufferHeight;

    // Clear display canvas
    ctx.clearRect(0, 0, bufferWidth, bufferHeight);

    // Create offscreen buffer canvas for Gaussian intensity blending
    const offCanvas = document.createElement('canvas');
    offCanvas.width = bufferWidth;
    offCanvas.height = bufferHeight;
    const offCtx = offCanvas.getContext('2d');
    if (!offCtx) return;

    offCtx.clearRect(0, 0, bufferWidth, bufferHeight);

    // Radius multiplier based on user preference
    const radiusMultiplier = radius === 'tight' ? 0.7 : radius === 'broad' ? 1.5 : 1.0;

    if (mode === 'density') {
      // 🌡️ Product Density Mode
      shelfProducts.forEach(product => {
        const norm = normalizeBoundingBox(product.boundingBox);
        const cx = (norm.x + norm.width / 2) * bufferWidth;
        const cy = (norm.y + norm.height / 2) * bufferHeight;
        const boxSpan = Math.max(norm.width, norm.height) * bufferWidth;
        const r = Math.max(24, boxSpan * 0.9) * radiusMultiplier;

        const radial = offCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
        radial.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
        radial.addColorStop(0.5, 'rgba(0, 0, 0, 0.20)');
        radial.addColorStop(1, 'rgba(0, 0, 0, 0)');

        offCtx.fillStyle = radial;
        offCtx.beginPath();
        offCtx.arc(cx, cy, r, 0, Math.PI * 2);
        offCtx.fill();
      });
    } else if (mode === 'missing_labels') {
      // 🏷️ Missing Price Tags Mode
      missingLabelProducts.forEach(product => {
        const norm = normalizeBoundingBox(product.boundingBox);
        const cx = (norm.x + norm.width / 2) * bufferWidth;
        const cy = (norm.y + norm.height / 2) * bufferHeight;
        const boxSpan = Math.max(norm.width, norm.height) * bufferWidth;
        const r = Math.max(32, boxSpan * 1.3) * radiusMultiplier;

        const radial = offCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
        radial.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
        radial.addColorStop(0.4, 'rgba(0, 0, 0, 0.45)');
        radial.addColorStop(0.8, 'rgba(0, 0, 0, 0.15)');
        radial.addColorStop(1, 'rgba(0, 0, 0, 0)');

        offCtx.fillStyle = radial;
        offCtx.beginPath();
        offCtx.arc(cx, cy, r, 0, Math.PI * 2);
        offCtx.fill();
      });
    } else if (mode === 'audit_issues') {
      // ⚠️ Audit Attention / Problem Areas
      problemProducts.forEach(product => {
        const issue = getProductAuditIssue(product);
        const norm = normalizeBoundingBox(product.boundingBox);
        const cx = (norm.x + norm.width / 2) * bufferWidth;
        const cy = (norm.y + norm.height / 2) * bufferHeight;
        const boxSpan = Math.max(norm.width, norm.height) * bufferWidth;
        const r = Math.max(30, boxSpan * 1.1) * radiusMultiplier;
        const weight = issue?.severity === 'high' ? 0.75 : 0.50;

        const radial = offCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
        radial.addColorStop(0, `rgba(0, 0, 0, ${weight})`);
        radial.addColorStop(0.5, `rgba(0, 0, 0, ${weight * 0.4})`);
        radial.addColorStop(1, 'rgba(0, 0, 0, 0)');

        offCtx.fillStyle = radial;
        offCtx.beginPath();
        offCtx.arc(cx, cy, r, 0, Math.PI * 2);
        offCtx.fill();
      });
    } else if (mode === 'shelf_voids') {
      // 🕳️ Shelf Voids / Empty Gap Highlights
      // Create a grid of points and identify areas far from products
      const step = 20;
      for (let x = step / 2; x < bufferWidth; x += step) {
        for (let y = step / 2; y < bufferHeight; y += step) {
          const normX = x / bufferWidth;
          const normY = y / bufferHeight;

          // Compute distance to nearest product
          let minDist = 1.0;
          for (const p of shelfProducts) {
            const b = normalizeBoundingBox(p.boundingBox);
            const dx = Math.max(0, b.x - normX, normX - (b.x + b.width));
            const dy = Math.max(0, b.y - normY, normY - (b.y + b.height));
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) minDist = dist;
          }

          // If distance is significant and within the main shelf boundary
          if (minDist > 0.05 && minDist < 0.35 && normY > 0.1 && normY < 0.9 && normX > 0.05 && normX < 0.95) {
            const intensity = Math.min(0.65, (minDist - 0.05) * 2.8);
            const r = 35 * radiusMultiplier;
            const radial = offCtx.createRadialGradient(x, y, 0, x, y, r);
            radial.addColorStop(0, `rgba(0, 0, 0, ${intensity})`);
            radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
            offCtx.fillStyle = radial;
            offCtx.beginPath();
            offCtx.arc(x, y, r, 0, Math.PI * 2);
            offCtx.fill();
          }
        }
      }
    }

    // Colorize the offscreen alpha channel via color lookup table
    const palette = createColorPalette(mode);
    const offImgData = offCtx.getImageData(0, 0, bufferWidth, bufferHeight);
    const pixels = offImgData.data;
    const len = pixels.length;

    for (let i = 0; i < len; i += 4) {
      const alpha = pixels[i + 3]; // 0 to 255
      if (alpha > 0) {
        const paletteIdx = alpha * 4;
        pixels[i] = palette[paletteIdx];         // R
        pixels[i + 1] = palette[paletteIdx + 1]; // G
        pixels[i + 2] = palette[paletteIdx + 2]; // B
        // Apply overall opacity slider
        pixels[i + 3] = Math.round(palette[paletteIdx + 3] * opacity);
      }
    }

    // Draw processed image data to on-screen canvas
    ctx.putImageData(offImgData, 0, 0);
  }, [mode, opacity, radius, shelfProducts, missingLabelProducts, problemProducts, createColorPalette]);

  return (
    <div className={`absolute inset-0 pointer-events-none z-15 overflow-hidden rounded-lg ${className}`}>
      {/* 🎨 Canvas Heatmap Layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none rounded-lg"
        style={{ mixBlendMode: 'normal' }}
      />

      {/* 📍 Problem Section Badges / Pins Overlay (Interactive) */}
      {showMarkers && (mode === 'missing_labels' || mode === 'audit_issues') && (
        <div className="absolute inset-0 pointer-events-auto">
          {(mode === 'missing_labels' ? missingLabelProducts : problemProducts).map((product, idx) => {
            const norm = normalizeBoundingBox(product.boundingBox);
            if (norm.width <= 0 || norm.height <= 0) return null;
            const isHighlighted = Boolean(highlightedProductName && product.name.toLowerCase().includes(highlightedProductName.toLowerCase()));
            const isSelected = selectedProductId === product.id || isHighlighted;
            const issue = getProductAuditIssue(product);
            const isMissingLabel = isMissingPriceLabel(product);

            return (
              <div
                key={`pin-${product.id || idx}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectProduct?.(product);
                }}
                className={`absolute cursor-pointer transition-all duration-200 transform -translate-x-1/2 -translate-y-1/2 group ${
                  isSelected ? 'scale-125 z-40' : 'hover:scale-110 z-30'
                }`}
                style={{
                  left: `${(norm.x + norm.width / 2) * 100}%`,
                  top: `${(norm.y + norm.height * 0.3) * 100}%`,
                }}
                title={`${product.name}: ${issue?.label || t('missingPriceTagLabel') || 'No Price Tag'}`}
              >
                <div
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full shadow-lg border backdrop-blur-md font-black text-[10px] tracking-tight transition-all ${
                    isMissingLabel
                      ? 'bg-rose-600/90 text-white border-rose-300 ring-2 ring-rose-500/50 animate-pulse'
                      : 'bg-amber-600/90 text-white border-amber-300 ring-2 ring-amber-500/50'
                  }`}
                >
                  <Tag className="w-3 h-3 shrink-0" />
                  <span className="truncate max-w-[110px]">
                    {isMissingLabel ? (t('missingPriceTagLabel') || 'No Price') : issue?.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 🎛️ Auditor Floating HUD & Control Bar (Top Right) */}
      <div className="absolute top-3 right-3 z-50 pointer-events-auto flex flex-col items-end gap-2 max-w-[92vw] sm:max-w-[420px]">
        {/* HUD Card */}
        <div className="w-full bg-slate-900/95 dark:bg-zinc-900/95 backdrop-blur-md text-slate-100 rounded-xl shadow-2xl border border-slate-700/80 p-3 transition-all duration-200">
          {/* Header Strip */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-black tracking-wide text-amber-400">
              <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>{t('heatmapAuditorHud') || 'Shelf Heatmap Auditor'}</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsHudCollapsed(prev => !prev)}
                className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                title={isHudCollapsed ? (t('expandHud') || 'Expand') : (t('minimizeHud') || 'Minimize')}
              >
                {isHudCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </button>

              {onClose && (
                <button
                  onClick={onClose}
                  className="p-1 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800 transition-colors cursor-pointer ml-0.5"
                  title={t('closeHeatmap') || 'Exit Heatmap'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Metrics Bar (Always Visible) */}
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300 px-0.5 py-1">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">{t('total') || 'Total'}:</span>
              <span className="font-bold text-white">{shelfProducts.length}</span>
            </div>
            <div className="text-slate-600">·</div>
            <div className="flex items-center gap-1.5">
              <span className="text-rose-400 font-semibold">{t('missingLabels') || 'Missing Tags'}:</span>
              <span className={`font-black px-1.5 py-0.2 rounded ${missingLabelProducts.length > 0 ? 'bg-rose-500/20 text-rose-300' : 'text-emerald-400'}`}>
                {missingLabelProducts.length}
              </span>
            </div>
            <div className="text-slate-600">·</div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">{t('shelfFillRate') || 'Fill'}:</span>
              <span className="font-bold text-sky-300">{shelfFillRate}%</span>
            </div>
          </div>

          {/* Collapsible Detailed Controls */}
          {!isHudCollapsed && (
            <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-3">
              {/* Mode Selector Buttons */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  {t('heatmapMode') || 'Analysis Mode'}
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setMode('density')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      mode === 'density'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span className="truncate">{t('productDensity') || 'Product Density'}</span>
                  </button>

                  <button
                    onClick={() => setMode('missing_labels')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      mode === 'missing_labels'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Tag className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                    <span className="truncate">{t('missingLabels') || 'Missing Labels'}</span>
                  </button>

                  <button
                    onClick={() => setMode('audit_issues')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      mode === 'audit_issues'
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-orange-300 shrink-0" />
                    <span className="truncate">{t('auditIssues') || 'Problem Areas'}</span>
                  </button>

                  <button
                    onClick={() => setMode('shelf_voids')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      mode === 'shelf_voids'
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                    <span className="truncate">{t('shelfVoids') || 'Shelf Voids'}</span>
                  </button>
                </div>
              </div>

              {/* Problem Cycle Action (when issues exist in current mode) */}
              {activeIssueList.length > 0 && (
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-rose-950/40 border border-rose-800/50 rounded-lg text-xs">
                  <div className="flex items-center gap-1.5 text-rose-200 font-medium truncate">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span className="truncate">
                      {activeIssueList.length} {t('problematicShelfSections') || 'Issues on Shelf'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleJumpToIssue('prev')}
                      className="p-1 hover:bg-rose-900/60 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title={t('prevIssue') || 'Previous'}
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-mono font-bold text-rose-300 px-1">
                      {currentIssueIndex + 1}/{activeIssueList.length}
                    </span>
                    <button
                      onClick={() => handleJumpToIssue('next')}
                      className="p-1 hover:bg-rose-900/60 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                      title={t('nextIssue') || 'Next'}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Heatmap Legend Bar */}
              <div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                  <span>
                    {mode === 'density'
                      ? (t('legendLow') || 'Low (Gap)')
                      : mode === 'missing_labels'
                      ? (t('legendCompliant') || 'Tags Present')
                      : mode === 'shelf_voids'
                      ? (t('legendFullShelf') || 'Full Shelf')
                      : (t('legendNormal') || 'Normal SKU')}
                  </span>
                  <span>
                    {mode === 'density'
                      ? (t('legendHigh') || 'High Density')
                      : mode === 'missing_labels'
                      ? (t('legendMissing') || 'Missing Tag Hotspot')
                      : mode === 'shelf_voids'
                      ? (t('legendEmptyGap') || 'Empty Void')
                      : (t('legendAuditAlert') || 'Issue Cluster')}
                  </span>
                </div>
                <div
                  className="h-2 rounded-full w-full"
                  style={{
                    background:
                      mode === 'density'
                        ? 'linear-gradient(to right, #2563eb, #06b6d4, #22c55e, #eab308, #f97316, #e11d48)'
                        : mode === 'missing_labels'
                        ? 'linear-gradient(to right, rgba(255,255,255,0.1), #f59e0b, #ef4444, #be123c, #9333ea)'
                        : mode === 'shelf_voids'
                        ? 'linear-gradient(to right, rgba(255,255,255,0.1), #334155, #0ea5e9, #06b6d4, #ffffff)'
                        : 'linear-gradient(to right, rgba(255,255,255,0.1), #f59e0b, #f97316, #ef4444, #a855f7)',
                  }}
                />
              </div>

              {/* Adjustments: Opacity & Diffusion */}
              <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>{t('heatmapOpacity') || 'Opacity'}</span>
                    <span className="font-mono text-slate-200">{Math.round(opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="1.0"
                    step="0.05"
                    value={opacity}
                    onChange={(e) => setOpacity(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span>{t('kernelRadius') || 'Diffusion'}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg">
                    {(['tight', 'balanced', 'broad'] as DiffusionRadius[]).map((rKey) => (
                      <button
                        key={rKey}
                        onClick={() => setRadius(rKey)}
                        className={`flex-1 py-0.5 text-[10px] font-bold rounded transition-colors cursor-pointer ${
                          radius === rKey
                            ? 'bg-slate-700 text-white shadow-2xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {rKey === 'tight' ? (t('radiusTight') || 'Tight') : rKey === 'broad' ? (t('radiusBroad') || 'Broad') : (t('radiusBalanced') || 'Med')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Toggle Problem Pins */}
              {(mode === 'missing_labels' || mode === 'audit_issues') && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-300 font-medium">
                    {t('showProblemPins') || 'Pin Markers'}
                  </span>
                  <button
                    onClick={() => setShowMarkers(prev => !prev)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                      showMarkers
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {showMarkers ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{showMarkers ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
