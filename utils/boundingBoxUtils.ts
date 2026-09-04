import type { BoundingBox, DetectedProduct, BrandClassifications } from '../types';
import { getBrandFromName } from './helpers';

export type BoundingBoxColorScheme = 'brand' | 'confidence' | 'type' | 'promo';

export interface BoundingBoxColorInfo {
  border: string;
  bg: string;
  badgeBg: string;
  text: string;
  label: string;
}

/**
 * Clamps a number between min and max bounds.
 */
export const clamp = (val: number, min: number, max: number): number => {
  if (isNaN(val)) return min;
  return Math.min(Math.max(val, min), max);
};

/**
 * Normalizes a bounding box ensuring all coordinates are within [0, 1] range
 * and width/height are positive.
 */
export const normalizeBoundingBox = (box: BoundingBox | null | undefined): BoundingBox => {
  if (!box) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let x = typeof box.x === 'number' && !isNaN(box.x) ? box.x : 0;
  let y = typeof box.y === 'number' && !isNaN(box.y) ? box.y : 0;
  let width = typeof box.width === 'number' && !isNaN(box.width) ? box.width : 0;
  let height = typeof box.height === 'number' && !isNaN(box.height) ? box.height : 0;

  // Handle negative width / height
  if (width < 0) {
    x += width;
    width = Math.abs(width);
  }
  if (height < 0) {
    y += height;
    height = Math.abs(height);
  }

  // Clamp within 0..1 viewport
  x = clamp(x, 0, 1);
  y = clamp(y, 0, 1);
  width = clamp(width, 0, 1 - x);
  height = clamp(height, 0, 1 - y);

  return { x, y, width, height };
};

/**
 * Calculates center coordinates (cx, cy) in normalized space [0..1].
 */
export const getBoxCenter = (box: BoundingBox): { cx: number; cy: number } => {
  const norm = normalizeBoundingBox(box);
  return {
    cx: norm.x + norm.width / 2,
    cy: norm.y + norm.height / 2,
  };
};

/**
 * Calculates the Intersection over Union (IoU) between two bounding boxes.
 */
export const calculateIoU = (boxA: BoundingBox, boxB: BoundingBox): number => {
  const a = normalizeBoundingBox(boxA);
  const b = normalizeBoundingBox(boxB);

  const xA = Math.max(a.x, b.x);
  const yA = Math.max(a.y, b.y);
  const xB = Math.min(a.x + a.width, b.x + b.width);
  const yB = Math.min(a.y + a.height, b.y + b.height);

  const interWidth = Math.max(0, xB - xA);
  const interHeight = Math.max(0, yB - yA);
  const interArea = interWidth * interHeight;

  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  const unionArea = areaA + areaB - interArea;

  if (unionArea <= 0) return 0;
  return interArea / unionArea;
};

/**
 * Checks whether a detected product has a promotional price tag, discount or promo frame.
 */
export const isPromoProduct = (product: DetectedProduct): boolean => {
  if (!product.prices || !Array.isArray(product.prices) || product.prices.length === 0) {
    return false;
  }
  return product.prices.some(p => {
    const type = (p.type || '').toUpperCase();
    const val = (p.value || '').toUpperCase();
    return type === 'PROMO' || type.includes('AKCIA') || type.includes('KLUB') || type.includes('CARD') ||
           type.includes('DISCOUNT') || type.includes('SALE') ||
           val.endsWith('P') || val.includes(' P') || val.includes('PROMO') || val.includes('AKCIA') || 
           val.includes('CLUBCARD') || val.includes('SUPER CENA') || val.includes('%');
  });
};

/**
 * Determines color styling for bounding box according to selected color scheme.
 */
export const getBoxColorInfo = (
  product: DetectedProduct,
  brandClassifications?: BrandClassifications,
  colorScheme: BoundingBoxColorScheme = 'brand'
): BoundingBoxColorInfo => {
  const isPOS = product.type === 'pos_material';
  const isGhost = product.isGhost === true;
  const isPromo = isPromoProduct(product);

  // POS materials always get distinct purple styling
  if (isPOS) {
    return {
      border: '#a855f7', // purple-500
      bg: 'rgba(168, 85, 247, 0.15)',
      badgeBg: '#9333ea', // purple-600
      text: '#ffffff',
      label: `POS: ${product.posType || 'Materiál'}`
    };
  }

  // Ghost products (printed image on shelf backing)
  if (isGhost) {
    return {
      border: '#64748b', // slate-500
      bg: 'rgba(100, 116, 139, 0.15)',
      badgeBg: '#475569', // slate-600
      text: '#f8fafc',
      label: 'Ghost (Tlačený obraz)'
    };
  }

  // Promo color scheme: Highlights promo products with high-visibility red/amber accents
  if (colorScheme === 'promo') {
    if (isPromo) {
      return {
        border: '#ef4444', // red-500 (Akcia / Promo)
        bg: 'rgba(239, 68, 68, 0.25)',
        badgeBg: '#dc2626', // red-600
        text: '#ffffff',
        label: '★ AKCIA / PROMO'
      };
    } else {
      return {
        border: '#475569', // slate-600
        bg: 'rgba(71, 85, 105, 0.08)',
        badgeBg: '#334155', // slate-700
        text: '#cbd5e1',
        label: 'Bežná cena'
      };
    }
  }

  if (colorScheme === 'confidence') {
    const conf = product.confidence ?? 0.9;
    if (conf >= 0.9) {
      return {
        border: '#10b981', // emerald-500
        bg: 'rgba(16, 185, 129, 0.15)',
        badgeBg: '#059669', // emerald-600
        text: '#ffffff',
        label: `Vysoká istota (${Math.round(conf * 100)}%)`
      };
    } else if (conf >= 0.75) {
      return {
        border: '#f59e0b', // amber-500
        bg: 'rgba(245, 158, 11, 0.15)',
        badgeBg: '#d97706', // amber-600
        text: '#ffffff',
        label: `Stredná istota (${Math.round(conf * 100)}%)`
      };
    } else {
      return {
        border: '#ef4444', // red-500
        bg: 'rgba(239, 68, 68, 0.2)',
        badgeBg: '#dc2626', // red-600
        text: '#ffffff',
        label: `Nízka istota (${Math.round(conf * 100)}%)`
      };
    }
  }

  if (colorScheme === 'type') {
    return {
      border: '#3b82f6', // blue-500
      bg: 'rgba(59, 130, 246, 0.15)',
      badgeBg: '#2563eb', // blue-600
      text: '#ffffff',
      label: 'Produkt SKU'
    };
  }

  // Default 'brand' color scheme (Naša značka vs Konkurencia vs Ostatné)
  const brand = (product.brand || getBrandFromName(product.name) || '').trim().toLowerCase();
  const ourBrands = (brandClassifications?.ourBrands || []).map(b => b.trim().toLowerCase());
  const competitorBrands = (brandClassifications?.competitorBrands || []).map(b => b.trim().toLowerCase());

  const isOurBrand = ourBrands.some(b => b && (brand.includes(b) || b.includes(brand)));
  const isCompetitor = competitorBrands.some(b => b && (brand.includes(b) || b.includes(brand)));

  if (isOurBrand) {
    return {
      border: '#22c55e', // green-500
      bg: 'rgba(34, 197, 94, 0.18)',
      badgeBg: '#16a34a', // green-600
      text: '#ffffff',
      label: 'Naša značka'
    };
  } else if (isCompetitor) {
    return {
      border: '#f43f5e', // rose-500
      bg: 'rgba(244, 63, 94, 0.18)',
      badgeBg: '#e11d48', // rose-600
      text: '#ffffff',
      label: 'Konkurencia'
    };
  }

  // Neutral / Unassigned Brand
  return {
    border: '#0ea5e9', // sky-500
    bg: 'rgba(14, 165, 233, 0.15)',
    badgeBg: '#0284c7', // sky-600
    text: '#ffffff',
    label: product.brand || 'Tovar'
  };
};
