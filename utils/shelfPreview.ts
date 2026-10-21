import type { DetectedProduct } from '../types.ts';
import { removeDateFromStoreName, getImageStoreName } from './helpers.ts';

// Helper to escape XML special characters
const escapeXml = (unsafe: string): string => {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

// Distinct colors for product categories/brands on the shelf
const PRODUCT_COLORS = [
  { fill: '#dc2626', stroke: '#991b1b', text: '#ffffff', tag: '#fee2e2' }, // Red (Coca Cola, Heinz, Ketchup)
  { fill: '#ea580c', stroke: '#c2410c', text: '#ffffff', tag: '#ffedd5' }, // Orange (Kofola, Fanta)
  { fill: '#d97706', stroke: '#b45309', text: '#ffffff', tag: '#fef3c7' }, // Amber (Beer, Birell)
  { fill: '#16a34a', stroke: '#15803d', text: '#ffffff', tag: '#dcfce7' }, // Green (Sprite, Pickles)
  { fill: '#0284c7', stroke: '#0369a1', text: '#ffffff', tag: '#e0f2fe' }, // Blue (Waters, Rajec)
  { fill: '#4f46e5', stroke: '#4338ca', text: '#ffffff', tag: '#e0e7ff' }, // Indigo (Dairy)
  { fill: '#7c3aed', stroke: '#6d28d9', text: '#ffffff', tag: '#ede9fe' }, // Purple (Sweets)
  { fill: '#db2777', stroke: '#be185d', text: '#ffffff', tag: '#fce7f3' }, // Pink
  { fill: '#0d9488', stroke: '#0f766e', text: '#ffffff', tag: '#ccfbf1' }, // Teal
  { fill: '#ca8a04', stroke: '#a16207', text: '#ffffff', tag: '#fef9c3' }, // Yellow/Mustard
];

const getProductColor = (name: string, index: number) => {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const colorIndex = Math.abs(hash + index) % PRODUCT_COLORS.length;
  return PRODUCT_COLORS[colorIndex];
};

// Retail Chain color theme for top store header
const getStoreTheme = (storeName: string) => {
  const lower = (storeName || '').toLowerCase();
  if (lower.includes('billa')) {
    return { banner: '#dc2626', text: '#ffffff', sub: '#fef08a', badge: '#eab308', name: 'BILLA' };
  }
  if (lower.includes('albert')) {
    return { banner: '#0284c7', text: '#ffffff', sub: '#fef08a', badge: '#eab308', name: 'ALBERT' };
  }
  if (lower.includes('kaufland')) {
    return { banner: '#dc2626', text: '#ffffff', sub: '#ffffff', badge: '#ffffff', name: 'KAUFLAND' };
  }
  if (lower.includes('tesco')) {
    return { banner: '#1d4ed8', text: '#ffffff', sub: '#fca5a5', badge: '#ef4444', name: 'TESCO' };
  }
  if (lower.includes('lidl')) {
    return { banner: '#2563eb', text: '#ffffff', sub: '#fef08a', badge: '#eab308', name: 'LIDL' };
  }
  if (lower.includes('terno') || lower.includes('kraj')) {
    return { banner: '#ea580c', text: '#ffffff', sub: '#bbf7d0', badge: '#16a34a', name: 'TERNO' };
  }
  return { banner: '#1e293b', text: '#ffffff', sub: '#94a3b8', badge: '#38bdf8', name: 'PREDAJŇA' };
};

/**
 * Generates an SVG data URL representing a realistic retail shelf preview
 * populated with detected products, facings, and prices based on AI detection.
 */
export const generateShelfPreviewSvg = (img: any): string => {
  if (!img) return '';

  const rawStore = getImageStoreName(img, 'Predajňa maloobchodu', img.assignedStore?.name || null);
  const storeName = (!rawStore || rawStore.trim().toLowerCase() === 'null')
    ? 'Predajňa maloobchodu'
    : removeDateFromStoreName(rawStore);

  const theme = getStoreTheme(storeName);
  const fileName = img.file?.name || 'Snímka regálu';
  const products: DetectedProduct[] = (img.analysisResult?.products || []).filter((p: any) => p && p.name && !p.isGhost);
  const productCount = products.length;

  const svgWidth = 1000;
  const svgHeight = 750;

  let productElements = '';

  if (products.length > 0) {
    // Render each detected product inside its bounding box
    products.forEach((p, idx) => {
      const b = p.boundingBox || { x: 0.1, y: 0.2, width: 0.1, height: 0.2 };
      const rawX = (b.x || 0) * svgWidth;
      const rawY = (b.y || 0) * svgHeight;
      const rawW = (b.width || 0.1) * svgWidth;
      const rawH = (b.height || 0.2) * svgHeight;

      // Bound within the shelf area (below top header 80px)
      const x = Math.max(25, Math.min(svgWidth - 40, rawX));
      const y = Math.max(90, Math.min(svgHeight - 40, rawY));
      const w = Math.max(24, Math.min(svgWidth - x - 20, rawW));
      const h = Math.max(28, Math.min(svgHeight - y - 20, rawH));

      const color = getProductColor(p.name, idx);
      const prodName = escapeXml(p.name);
      const isPromo = (p.prices || []).some(pr => {
        const t = (pr.type || '').toUpperCase();
        return t.includes('PROMO') || t.includes('AKCIA');
      });

      const priceVal = (p.prices && p.prices.length > 0) ? escapeXml(p.prices[0].value) : '';

      productElements += `
        <g id="prod_${idx}">
          <!-- Package Box -->
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${color.fill}" stroke="${color.stroke}" stroke-width="2" opacity="0.92"/>
          <rect x="${x + 2}" y="${y + 2}" width="${Math.max(0, w - 4)}" height="${Math.min(14, h * 0.25)}" rx="3" fill="#ffffff" opacity="0.2"/>
          
          <!-- Label Text if width > 35 -->
          ${w >= 36 && h >= 32 ? `
            <text x="${x + w / 2}" y="${y + Math.min(h * 0.45, 24)}" font-family="system-ui, sans-serif" font-weight="800" font-size="${Math.max(9, Math.min(13, w * 0.14))}" fill="${color.text}" text-anchor="middle">
              ${prodName.substring(0, Math.max(4, Math.floor(w / 7)))}
            </text>
          ` : ''}

          <!-- Price Tag Pill if available -->
          ${priceVal && w >= 32 ? `
            <rect x="${x + 3}" y="${y + h - 17}" width="${Math.max(0, w - 6)}" height="14" rx="3" fill="${isPromo ? '#dc2626' : '#ffffff'}" stroke="${isPromo ? '#ef4444' : '#cbd5e1'}"/>
            <text x="${x + w / 2}" y="${y + h - 6}" font-family="monospace" font-weight="900" font-size="${Math.max(8, Math.min(10, w * 0.16))}" fill="${isPromo ? '#ffffff' : '#0f172a'}" text-anchor="middle">
              ${priceVal}
            </text>
          ` : ''}
        </g>
      `;
    });
  } else {
    // Generic fallback shelf items
    for (let shelfIdx = 0; shelfIdx < 3; shelfIdx++) {
      const shelfY = 220 + shelfIdx * 200;
      const itemCount = 7;
      const itemW = 110;
      const itemH = 150;
      const gap = 20;
      for (let i = 0; i < itemCount; i++) {
        const itemX = 50 + i * (itemW + gap);
        const col = PRODUCT_COLORS[(i + shelfIdx * 3) % PRODUCT_COLORS.length];
        productElements += `
          <g opacity="0.65">
            <rect x="${itemX}" y="${shelfY - itemH}" width="${itemW}" height="${itemH}" rx="8" fill="${col.fill}" stroke="${col.stroke}" stroke-width="2"/>
            <rect x="${itemX + 10}" y="${shelfY - itemH + 20}" width="${itemW - 20}" height="${itemH - 40}" rx="4" fill="#ffffff" opacity="0.15"/>
          </g>
        `;
      }
    }
  }

  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">
      <defs>
        <!-- Background Gradient -->
        <linearGradient id="wallBg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="60%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0b1120"/>
        </linearGradient>

        <!-- Shelf Metal Gradient -->
        <linearGradient id="shelfMetal" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#f8fafc"/>
          <stop offset="25%" stop-color="#e2e8f0"/>
          <stop offset="60%" stop-color="#94a3b8"/>
          <stop offset="100%" stop-color="#475569"/>
        </linearGradient>

        <!-- Drop Shadow -->
        <filter id="shelfShadow" x="-5%" y="-5%" width="110%" height="120%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000000" flood-opacity="0.6"/>
        </filter>
      </defs>

      <!-- Background Supermarket Wall -->
      <rect width="${svgWidth}" height="${svgHeight}" fill="url(#wallBg)"/>

      <!-- Vertical Rack Posts -->
      <rect x="25" y="80" width="14" height="650" fill="#334155" opacity="0.6"/>
      <rect x="330" y="80" width="10" height="650" fill="#334155" opacity="0.4"/>
      <rect x="660" y="80" width="10" height="650" fill="#334155" opacity="0.4"/>
      <rect x="960" y="80" width="14" height="650" fill="#334155" opacity="0.6"/>

      <!-- 3 Retail Horizontal Shelf Bars -->
      <g filter="url(#shelfShadow)">
        <rect x="20" y="270" width="960" height="18" fill="url(#shelfMetal)" rx="2"/>
        <rect x="20" y="288" width="960" height="12" fill="#334155"/>
        <rect x="20" y="490" width="960" height="18" fill="url(#shelfMetal)" rx="2"/>
        <rect x="20" y="508" width="960" height="12" fill="#334155"/>
        <rect x="20" y="700" width="960" height="20" fill="url(#shelfMetal)" rx="2"/>
        <rect x="20" y="720" width="960" height="14" fill="#334155"/>
      </g>

      <!-- Products Layer -->
      <g id="products_layer">
        ${productElements}
      </g>

      <!-- Top Header Store Banner -->
      <rect x="0" y="0" width="${svgWidth}" height="76" fill="${theme.banner}" filter="url(#shelfShadow)"/>
      <rect x="0" y="72" width="${svgWidth}" height="4" fill="${theme.badge}"/>

      <!-- Store Chain Badge -->
      <rect x="24" y="16" width="120" height="42" rx="10" fill="#ffffff" opacity="0.95"/>
      <text x="84" y="44" font-family="system-ui, sans-serif" font-weight="900" font-size="18" fill="${theme.banner}" text-anchor="middle">
        ${theme.name}
      </text>

      <!-- Store Name & Filename -->
      <text x="160" y="36" font-family="system-ui, sans-serif" font-weight="900" font-size="16" fill="${theme.text}">
        ${escapeXml(storeName).substring(0, 55)}
      </text>
      <text x="160" y="56" font-family="system-ui, sans-serif" font-weight="600" font-size="12" fill="${theme.sub}">
        ${escapeXml(fileName).substring(0, 65)} • ${productCount} facingov na regáli
      </text>

      <!-- Right Facing Count Pill -->
      <rect x="${svgWidth - 170}" y="20" width="146" height="36" rx="18" fill="#000000" opacity="0.45"/>
      <circle cx="${svgWidth - 148}" cy="38" r="7" fill="#84cc16"/>
      <text x="${svgWidth - 132}" y="43" font-family="system-ui, sans-serif" font-weight="900" font-size="12" fill="#ffffff">
        ${productCount} FACINGOV
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent.trim())}`;
};
