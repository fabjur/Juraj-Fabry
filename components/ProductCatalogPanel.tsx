import React, { useState, useEffect, useMemo, useCallback } from 'react';

const EMPTY_ARRAY: any[] = [];
import { useLiveQuery } from 'dexie-react-hooks';
import { LayoutGrid, List } from 'lucide-react';
import { useTranslation } from '../i18n/index.tsx';
import type { ProductCatalogEntry } from '../types.ts';
import { db, updateCatalogEntry, getCatalogEntries, bulkDeleteCatalogEntries, bulkUpdateCatalogEntries } from '../db.ts';
import { 
    BookOpenIcon, 
    EditIcon, 
    SaveIcon, 
    TagIcon, 
    SpinnerIcon, 
    LightBulbIcon, 
    CloseIcon, 
    TrashIcon, 
    AdjustmentsHorizontalIcon, 
    MagicWandIcon, 
    ArrowLeftIcon,
    BuildingStorefrontIcon,
    HistoryIcon,
    CheckCircleIcon
} from './Icons.tsx';
import { createVisualFingerprint } from '../services/geminiService.ts';
import { normalizeProductName } from '../utils/helpers.ts';

interface ProductCatalogPanelProps {
    onProductSelect: (product: ProductCatalogEntry) => void;
}

interface ProductCardPanelProps {
    product: ProductCatalogEntry;
    onBack: () => void;
}

export const ProductCardPanel: React.FC<ProductCardPanelProps> = ({ product, onBack }) => {
    const { t, language } = useTranslation();

    // Dynamically calculate and enrich the selected product with insights from all audits
    const productStats = useLiveQuery(async () => {
        const analyses = await db.analyses.toArray();
        const normProductCanonical = normalizeProductName(product.canonicalName);
        
        const aliasesSet = new Set([
            normProductCanonical,
            ...(product.aliases ?? EMPTY_ARRAY).map(a => normalizeProductName(a))
        ]);

        const stats = {
            totalFindingsCount: 0,
            storesCount: 0,
            avgRegularPrice: null as number | null,
            avgPromoPrice: null as number | null,
            minRegularPrice: null as number | null,
            maxRegularPrice: null as number | null,
            minPromoPrice: null as number | null,
            maxPromoPrice: null as number | null,
            lastSeenDate: null as string | null,
            lastSeenStore: null as string | null,
            priceHistory: [] as { date: string; price: number; type: 'REGULAR' | 'PROMO'; storeName: string; chain: string }[],
            storePresence: [] as { storeName: string; chain: string; count: number; avgPrice: number | null; lastSeen: string }[],
            promoCount: 0,
            regularCount: 0
        };

        const regularPrices: number[] = [];
        const promoPrices: number[] = [];
        const storesSet = new Set<string>();
        const storeDets: Record<string, { chain: string; count: number; prices: number[]; lastSeen: string }> = {};

        // Sort descending by date to track last seen easily
        const sortedAnalyses = [...analyses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        sortedAnalyses.forEach(analysis => {
            const storeName = analysis.store?.name || t('otherStore') || 'Iná predajňa';
            const chainName = analysis.store?.chain || t('unknownChain') || 'Neznámy reťazec';
            const dateStr = analysis.createdAt;

            analysis.images.forEach(img => {
                const products = img.analysisResult?.products ?? EMPTY_ARRAY;
                products.forEach(p => {
                    if (!p || !p.name || p.isDiscarded) return;
                    const normName = normalizeProductName(p.name);
                    
                    if (aliasesSet.has(normName)) {
                        stats.totalFindingsCount++;
                        storesSet.add(storeName);

                        if (!stats.lastSeenDate) {
                            stats.lastSeenDate = dateStr;
                            stats.lastSeenStore = storeName;
                        }

                        let regVal: number | null = typeof p.regularPrice === 'number' && p.regularPrice > 0 ? p.regularPrice : null;
                        let promoVal: number | null = typeof p.promoPrice === 'number' && p.promoPrice > 0 ? p.promoPrice : null;

                        if (p.prices && p.prices.length > 0) {
                            p.prices.forEach(priceObj => {
                                const numericPrice = parseFloat(priceObj.value.replace(',', '.'));
                                if (!isNaN(numericPrice) && numericPrice > 0) {
                                    if (priceObj.type === 'REGULAR') {
                                        if (regVal === null) regVal = numericPrice;
                                    } else if (priceObj.type === 'PROMO' || priceObj.type === 'ACTION') {
                                        if (promoVal === null) promoVal = numericPrice;
                                    }
                                }
                            });
                        }

                        if (regVal !== null) {
                            regularPrices.push(regVal);
                            stats.regularCount++;
                            if (stats.minRegularPrice === null || regVal < stats.minRegularPrice) stats.minRegularPrice = regVal;
                            if (stats.maxRegularPrice === null || regVal > stats.maxRegularPrice) stats.maxRegularPrice = regVal;

                            stats.priceHistory.push({
                                date: dateStr,
                                price: regVal,
                                type: 'REGULAR',
                                storeName,
                                chain: chainName
                            });
                        }

                        if (promoVal !== null) {
                            promoPrices.push(promoVal);
                            stats.promoCount++;
                            if (stats.minPromoPrice === null || promoVal < stats.minPromoPrice) stats.minPromoPrice = promoVal;
                            if (stats.maxPromoPrice === null || promoVal > stats.maxPromoPrice) stats.maxPromoPrice = promoVal;

                            stats.priceHistory.push({
                                date: dateStr,
                                price: promoVal,
                                type: 'PROMO',
                                storeName,
                                chain: chainName
                            });
                        }

                        if (!storeDets[storeName]) {
                            storeDets[storeName] = {
                                chain: chainName,
                                count: 0,
                                prices: [],
                                lastSeen: dateStr
                            };
                        }
                        storeDets[storeName].count++;
                        const activeP = promoVal !== null ? promoVal : regVal;
                        if (activeP !== null) {
                            storeDets[storeName].prices.push(activeP);
                        }
                    }
                });
            });
        });

        stats.storesCount = storesSet.size;

        if (regularPrices.length > 0) {
            stats.avgRegularPrice = regularPrices.reduce((a, b) => a + b, 0) / regularPrices.length;
        }
        if (promoPrices.length > 0) {
            stats.avgPromoPrice = promoPrices.reduce((a, b) => a + b, 0) / promoPrices.length;
        }

        stats.storePresence = Object.entries(storeDets).map(([stName, details]) => {
            const avgPrice = details.prices.length > 0
                ? details.prices.reduce((a, b1) => a + b1, 0) / details.prices.length
                : null;
            return {
                storeName: stName,
                chain: details.chain,
                count: details.count,
                avgPrice,
                lastSeen: details.lastSeen
            };
        }).sort((a, b1) => b1.count - a.count);

        // Sort price history ascending chronologically for visualization line drawing
        stats.priceHistory.sort((a, b1) => new Date(a.date).getTime() - new Date(b1.date).getTime());

        return stats;
    }, [product.canonicalName, product.aliases, t]);

    // Format humanized relative seen dates
    const getHumanizedDate = useCallback((dateStr: string | null) => {
        if (!dateStr) return '-';
        const dateObj = new Date(dateStr);
        if (isNaN(dateObj.getTime())) return dateStr;
        const localeMap: Record<string, string> = {
            sk: 'sk-SK',
            cs: 'cs-CZ',
            de: 'de-DE',
            hu: 'hu-HU',
            hr: 'hr-HR',
            en: 'en-US'
        };
        return dateObj.toLocaleDateString(localeMap[language] || 'en-US', { day: 'numeric', month: 'numeric', year: 'numeric' });
    }, [language]);

    return (
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 h-full flex flex-col animate-fade-in">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-3 hover:bg-gray-50 dark:hover:bg-zinc-800/60 rounded-2xl text-gray-500 dark:text-zinc-400 hover:text-gray-900 transition-all active:scale-95 border border-transparent hover:border-gray-200 shadow-sm cursor-pointer" title={t('backToCatalog')}>
                        <ArrowLeftIcon className="w-6 h-6" />
                    </button>
                    <div>
                        <span className="text-[10px] font-black text-lime-600 uppercase tracking-widest block mb-0.5">{t('productCard')}</span>
                        <h2 className="text-3xl font-black text-gray-900 dark:text-zinc-100 tracking-tight leading-none">{product.canonicalName}</h2>
                    </div>
                </div>
                {product.sku && (
                    <span className="md:self-center px-4 py-2 bg-gray-50 dark:bg-zinc-800/60 text-gray-700 dark:text-zinc-300 border border-gray-150 dark:border-zinc-800 rounded-xl text-xs font-mono font-black shadow-inner">
                        SKU: #{product.sku}
                    </span>
                )}
            </div>
            
            <div className="space-y-8 overflow-y-auto custom-scrollbar pr-4 flex-grow pb-12">
                 
                 {/* Basic Info & Master specifications */}
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50/50 dark:bg-zinc-950/60 p-8 rounded-[2rem] border border-gray-100 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 shadow-sm">
                    <div>
                        <h3 className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">{t('manufacturer')}</h3>
                        <p className="text-lg font-black text-gray-900 dark:text-zinc-100">{product.manufacturer || '—'}</p>
                    </div>
                     <div>
                        <h3 className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">{t('category')}</h3>
                        <p className="text-lg font-black text-gray-900 dark:text-zinc-100">{product.category || t('unassignedCategory') || '—'}</p>
                    </div>
                     <div>
                        <h3 className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">{t('lastOccurrence')}</h3>
                        <p className="text-base font-bold text-gray-900 dark:text-zinc-100 truncate" title={productStats?.lastSeenStore || '-'}>
                            {productStats?.lastSeenStore ? (
                                <>
                                    <span>{productStats.lastSeenStore}</span>
                                    <span className="block text-[10px] font-normal text-gray-400 dark:text-zinc-500 font-mono mt-0.5">
                                        {getHumanizedDate(productStats.lastSeenDate)}
                                    </span>
                                </>
                            ) : '-'}
                        </p>
                    </div>
                 </div>

                 {/* Advanced Extracted Analytics & Pricing statistics */}
                 <div className="space-y-4">
                     <h3 className="text-xs font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                         <CheckCircleIcon className="w-4 h-4 text-lime-600" />
                         {t('marketInsightsAndPricing')}
                     </h3>
                     
                     <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                         
                          {/* Facings detected metric */}
                          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
                              <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block mb-2">{t('totalFindingsCountLabel')}</span>
                              <div>
                                  <span className="text-3xl font-black text-gray-900 dark:text-zinc-100">{productStats?.totalFindingsCount || 0}</span>
                                  <span className="text-xs font-bold text-gray-400 dark:text-zinc-500 ml-1">{t('unitPieces')}</span>
                              </div>
                              <span className="text-[10px] text-gray-500 dark:text-zinc-400 font-bold mt-2 font-mono block">{t('facingsAcrossAudits')}</span>
                          </div>

                          {/* Active stores penetration */}
                          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
                              <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block mb-2">{t('storeDistribution')}</span>
                              <div>
                                  <span className="text-3xl font-black text-lime-650">{productStats?.storesCount || 0}</span>
                                  <span className="text-xs font-bold text-gray-400 dark:text-zinc-500 ml-1">{t('storesWord')}</span>
                              </div>
                              <span className="text-[10px] text-gray-500 dark:text-zinc-400 font-bold mt-2 font-mono block">{t('activeFieldPresence')}</span>
                          </div>

                          {/* Normal regular price */}
                          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
                              <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block mb-2">{t('avgRegularPrice')}</span>
                              <div>
                                  <span className="text-3xl font-black text-gray-950 dark:text-zinc-100">
                                      {productStats?.avgRegularPrice ? `${productStats.avgRegularPrice.toFixed(2)} ` : t('notAvailable')}
                                  </span>
                              </div>
                              <span className="text-[10px] text-gray-500 dark:text-zinc-400 font-bold mt-2 font-mono block">
                                  {productStats?.minRegularPrice && productStats?.maxRegularPrice ? (
                                      `${t('priceRangeLabel')}: ${productStats.minRegularPrice.toFixed(2)} - ${productStats.maxRegularPrice.toFixed(2)}`
                                  ) : t('notRecordedYet')}
                              </span>
                          </div>

                          {/* Promo action price */}
                          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-xs flex flex-col justify-between bg-amber-50/20 border-amber-100">
                              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-2">{t('avgPromoPrice')}</span>
                              <div>
                                  <span className="text-3xl font-black text-amber-600">
                                      {productStats?.avgPromoPrice ? `${productStats.avgPromoPrice.toFixed(2)} ` : t('notAvailable')}
                                  </span>
                              </div>
                              <span className="text-[10px] text-amber-700/80 font-bold mt-2 font-mono block">
                                  {productStats?.avgRegularPrice && productStats?.avgPromoPrice ? (
                                      `${t('discount')}: -${(((productStats.avgRegularPrice - productStats.avgPromoPrice) / productStats.avgRegularPrice) * 100).toFixed(0)}%`
                                  ) : t('notRegisteredInPromos')}
                              </span>
                          </div>

                      </div>
                  </div>

                  {/* Price History timeline / Interactive customized SVG Chart */}
                  <div className="space-y-4">
                      <h3 className="text-xs font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                          <HistoryIcon className="w-4 h-4 text-lime-600" />
                          {t('priceHistoryChart')}
                      </h3>
                      
                      {productStats && productStats.priceHistory && productStats.priceHistory.length > 0 ? (
                          <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 dark:border-zinc-800 shadow-sm">
                              <div className="relative h-64 w-full">
                                  {(() => {
                                      const history = productStats.priceHistory;
                                      const pricesArr = history.map(h => h.price);
                                      const maxPrice = Math.max(...pricesArr) * 1.15; // padding top
                                      const minPrice = Math.max(0, Math.min(...pricesArr) * 0.85); // padding bottom
                                      const priceRange = maxPrice - minPrice;

                                      const width = 600;
                                      const height = 180;
                                      const paddingLeft = 45;
                                      const paddingRight = 20;
                                      const paddingTop = 20;
                                      const paddingBottom = 30;

                                      const chartWidth = width - paddingLeft - paddingRight;
                                      const chartHeight = height - paddingTop - paddingBottom;

                                      // Points generator coordinates
                                      const points = history.map((item, index) => {
                                          const x = paddingLeft + (chartWidth * (history.length > 1 ? index / (history.length - 1) : 0.5));
                                          const y = paddingTop + chartHeight - (chartHeight * ((item.price - minPrice) / (priceRange || 1)));
                                          return { ...item, x, y };
                                      });

                                      // Separate regular vs action list
                                      const regPoints = points.filter(p => p.type === 'REGULAR');
                                      const promoPoints = points.filter(p => p.type === 'PROMO');

                                      const localeMap: Record<string, string> = {
                                          sk: 'sk-SK',
                                          cs: 'cs-CZ',
                                          de: 'de-DE',
                                          hu: 'hu-HU',
                                          hr: 'hr-HR',
                                          en: 'en-US'
                                      };
                                      const activeLocale = localeMap[language] || 'en-US';

                                      return (
                                          <div className="w-full h-full flex flex-col justify-between">
                                              <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
                                                  {/* Horizontal Guideline Grids */}
                                                  <line x1={paddingLeft} y1={paddingTop} x2={width - paddingRight} y2={paddingTop} stroke="#f3f4f6" strokeWidth="1" strokeDasharray="4 4" />
                                                  <line x1={paddingLeft} y1={paddingTop + chartHeight / 2} x2={width - paddingRight} y2={paddingTop + chartHeight / 2} stroke="#f3f4f6" strokeWidth="1" strokeDasharray="4 4" />
                                                  <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={width - paddingRight} y2={paddingTop + chartHeight} stroke="#e5e7eb" strokeWidth="1.5" />

                                                  {/* Connect overall values chronologically */}
                                                  {points.length > 1 && (
                                                      <path 
                                                          d={points.reduce((acc, p, i) => acc + `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '')} 
                                                          fill="none" 
                                                          stroke="#cbd5e1" 
                                                          strokeWidth="1.5" 
                                                          strokeDasharray="3 3"
                                                          className="opacity-70"
                                                      />
                                                  )}

                                                  {/* Regular blue path */}
                                                  {regPoints.length > 1 ? (
                                                      <path 
                                                          d={regPoints.reduce((acc, p, i) => acc + `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '')} 
                                                          fill="none" 
                                                          stroke="#3b82f6" 
                                                          strokeWidth="3" 
                                                          strokeLinecap="round"
                                                      />
                                                  ) : regPoints.length === 1 ? (
                                                      <circle cx={regPoints[0].x} cy={regPoints[0].y} r="5" fill="#3b82f6" />
                                                  ) : null}

                                                  {/* Promo amber path */}
                                                  {promoPoints.length > 1 ? (
                                                      <path 
                                                          d={promoPoints.reduce((acc, p, i) => acc + `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`, '')} 
                                                          fill="none" 
                                                          stroke="#f59e0b" 
                                                          strokeWidth="3" 
                                                          strokeLinecap="round"
                                                      />
                                                  ) : promoPoints.length === 1 ? (
                                                      <circle cx={promoPoints[0].x} cy={promoPoints[0].y} r="5" fill="#f59e0b" />
                                                  ) : null}

                                                  {/* Interactive dots with titles */}
                                                  {points.map((p, i) => (
                                                      <g key={i} className="group/dot cursor-pointer">
                                                          <circle 
                                                              cx={p.x} 
                                                              cy={p.y} 
                                                              r="5" 
                                                              fill={p.type === 'REGULAR' ? '#3b82f6' : '#f59e0b'} 
                                                              stroke="#ffffff" 
                                                              strokeWidth="2" 
                                                              className="transition-all duration-200 hover:r-7"
                                                          />
                                                          <title>
                                                              {`${t('store')}: ${p.storeName} (${p.chain})\n${t('colAvgPrice')}: ${p.price.toFixed(2)} (${p.type === 'REGULAR' ? t('regularPriceChartLegend') : t('promoPriceChartLegend')})\n${t('date')}: ${new Date(p.date).toLocaleDateString(activeLocale)}`}
                                                          </title>
                                                      </g>
                                                  ))}

                                                  {/* Grid Price Markers */}
                                                  <text x={paddingLeft - 8} y={paddingTop + 4} textAnchor="end" className="text-[9px] font-bold fill-gray-400 font-mono">
                                                      {maxPrice.toFixed(2)}
                                                  </text>
                                                  <text x={paddingLeft - 8} y={paddingTop + chartHeight / 2 + 4} textAnchor="end" className="text-[9px] font-bold fill-gray-400 font-mono">
                                                      {((maxPrice + minPrice) / 2).toFixed(2)}
                                                  </text>
                                                  <text x={paddingLeft - 8} y={paddingTop + chartHeight + 4} textAnchor="end" className="text-[9px] font-bold fill-gray-400 font-mono">
                                                      {minPrice.toFixed(2)}
                                                  </text>

                                                  {/* Date limits */}
                                                  {points.map((p, i) => {
                                                      if (points.length > 6 && i % 2 !== 0 && i !== points.length - 1) return null;
                                                      const stringDate = new Date(p.date).toLocaleDateString(activeLocale, { day: 'numeric', month: 'numeric' });
                                                      return (
                                                          <text key={i} x={p.x} y={height - 8} textAnchor="middle" className="text-[9px] font-black fill-gray-500 uppercase tracking-widest">
                                                              {stringDate}
                                                          </text>
                                                      );
                                                  })}
                                              </svg>

                                              {/* Chart Legend */}
                                              <div className="flex gap-6 justify-center text-xs mt-3 select-none">
                                                  <div className="flex items-center gap-1.5">
                                                      <span className="w-3.5 h-1.5 rounded-full bg-blue-500 inline-block"></span>
                                                      <span className="text-gray-600 dark:text-zinc-400 font-bold">{t('regularPriceChartLegend')}</span>
                                                  </div>
                                                  <div className="flex items-center gap-1.5">
                                                      <span className="w-3.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
                                                      <span className="text-gray-600 dark:text-zinc-400 font-bold">{t('promoPriceChartLegend')}</span>
                                                  </div>
                                              </div>
                                          </div>
                                      );
                                  })()}
                              </div>
                          </div>
                      ) : (
                          <div className="bg-gray-50 dark:bg-zinc-800/60 p-8 rounded-[2rem] border border-dashed border-gray-200 dark:border-zinc-800 text-center text-gray-400 dark:text-zinc-500 font-medium">
                              {t('noPriceHistory')}
                          </div>
                      )}
                  </div>

                  {/* Store Presence Detail Table */}
                  <div className="space-y-4">
                      <h3 className="text-xs font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                          <BuildingStorefrontIcon className="w-4 h-4 text-lime-600" />
                          {t('storePresenceTitle')}
                      </h3>

                      {productStats && productStats.storePresence && productStats.storePresence.length > 0 ? (
                          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden shadow-xs">
                              <div className="overflow-x-auto">
                                  <table className="min-w-full divide-y divide-gray-100 dark:divide-zinc-800">
                                      <thead className="bg-gray-50 dark:bg-zinc-800/60">
                                          <tr>
                                              <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">{t('store')}</th>
                                              <th scope="col" className="px-6 py-3.5 text-left text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">{t('chain')}</th>
                                              <th scope="col" className="px-6 py-3.5 text-center text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">{t('detectedUnits')}</th>
                                              <th scope="col" className="px-6 py-3.5 text-right text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">{t('avgRegularPrice')}</th>
                                              <th scope="col" className="px-6 py-3.5 text-right text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-zinc-500">{t('lastRecorded')}</th>
                                          </tr>
                                      </thead>
                                      <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-100 dark:divide-zinc-800 font-medium text-sm text-gray-750">
                                          {productStats.storePresence.map((presence, idx) => (
                                              <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                  <td className="px-6 py-4 whitespace-nowrap font-black text-gray-900 dark:text-zinc-100">{presence.storeName}</td>
                                                  <td className="px-6 py-4 whitespace-nowrap">
                                                      <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-800 shadow-xs">
                                                          {presence.chain}
                                                      </span>
                                                  </td>
                                                  <td className="px-6 py-4 text-center whitespace-nowrap font-bold text-gray-600 dark:text-zinc-400">{presence.count} {t('unitPieces')}</td>
                                                  <td className="px-6 py-4 text-right whitespace-nowrap font-black font-mono text-gray-900 dark:text-zinc-100">
                                                      {presence.avgPrice ? `${presence.avgPrice.toFixed(2)} ` : '—'}
                                                  </td>
                                                  <td className="px-6 py-4 text-right whitespace-nowrap text-xs text-gray-400 dark:text-zinc-500 font-mono">
                                                      {getHumanizedDate(presence.lastSeen)}
                                                  </td>
                                              </tr>
                                          ))}
                                      </tbody>
                                  </table>
                              </div>
                          </div>
                      ) : (
                          <div className="bg-gray-50 dark:bg-zinc-800/60 p-8 rounded-[2rem] border border-dashed border-gray-200 dark:border-zinc-800 text-center text-gray-400 dark:text-zinc-500 font-medium">
                              {t('noStoreConnections')}
                          </div>
                      )}
                  </div>

                  {/* Aliases Section */}
                  <div>
                     <h3 className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                         <TagIcon className="w-4 h-4" />
                         {t('knownAliases')} ({t('relatedAltNamesDesc')})
                     </h3>
                     <div className="flex flex-wrap gap-3">
                         {product.aliases && product.aliases.length > 0 ? product.aliases.map(alias => (
                             <span key={alias} className="px-4 py-2 bg-gray-50 dark:bg-zinc-800/60 text-gray-700 dark:text-zinc-300 rounded-xl text-sm font-black border border-gray-100 dark:border-zinc-800 shadow-sm hover:bg-gray-100/50 transition-colors">
                                 {alias}
                             </span>
                         )) : <span className="text-gray-400 dark:text-zinc-500 italic text-sm font-medium">{t('noAliases')}</span>}
                     </div>
                  </div>

                  {/* Visual Reference Images */}
                  <div>
                     <h3 className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-4">{t('referenceImagesDoc')}</h3>
                     <div className="flex flex-wrap gap-4">
                         {product.referenceImages && product.referenceImages.length > 0 ? product.referenceImages.map((img, i) => (
                              <div key={i} className="w-40 h-40 rounded-[2rem] border border-gray-100 dark:border-zinc-800 overflow-hidden bg-gray-50 dark:bg-zinc-800/60 shadow-sm hover:shadow-md transition-shadow">
                                 <img src={`data:image/jpeg;base64,${img}`} alt="Reference" className="w-full h-full object-contain p-4" />
                              </div>
                         )) : <span className="text-gray-400 dark:text-zinc-500 italic text-sm font-medium">{t('noImages')}</span>}
                     </div>
                  </div>
                  
                  {/* Visual parameters AI profiles */}
                  {product.visualFeatures && (
                     <div className="bg-gradient-to-br from-lime-50 to-emerald-50 p-8 rounded-[2rem] border border-lime-100/50 shadow-sm">
                         <h3 className="text-sm font-black text-lime-800 mb-4 flex items-center gap-3">
                             <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl shadow-sm">
                                 <LightBulbIcon className="w-5 h-5 text-lime-600" />
                             </div>
                             {t('aiVisualProfile')} ({t('uniqueVisualFeaturesDesc')})
                         </h3>
                         <p className="text-base text-lime-900 leading-relaxed font-semibold">{product.visualFeatures}</p>
                     </div>
                  )}
             </div>
        </div>
    );
};

export const ProductCatalogPanel: React.FC<ProductCatalogPanelProps> = ({ onProductSelect }) => {
    const { t, language } = useTranslation();
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingEntry, setEditingEntry] = useState<{ id: number; manufacturer: string } | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // View mode: 'grid' or 'list' for compact 1-line representation
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    
    // Batch Edit Modal State
    const [isBatchEditModalOpen, setIsBatchEditModalOpen] = useState(false);
    const [batchEditData, setBatchEditData] = useState({ manufacturer: '', category: '' });

    const rawCatalog = useLiveQuery(() => db.product_catalog.orderBy('canonicalName').toArray());
    const catalog = rawCatalog ?? EMPTY_ARRAY;

    // Calculate dynamic enriched stats for every catalog entry in single scan
    const enrichedStatsMap = useLiveQuery(async () => {
        const catalogItems = await db.product_catalog.toArray();
        const allAnalyses = await db.analyses.toArray();

        // Map format
        const statsMap: Record<number, {
            totalFindingsCount: number;
            avgPrice: number | null;
            lastSeenStore: string | null;
            lastSeenDate: string | null;
            storesCount: number;
        }> = {};

        catalogItems.forEach(item => {
            if (item.id !== undefined) {
                statsMap[item.id] = {
                    totalFindingsCount: 0,
                    avgPrice: null,
                    lastSeenStore: null,
                    lastSeenDate: null,
                    storesCount: 0
                };
            }
        });

        const nameToIdLookup = new Map<string, number>();
        catalogItems.forEach(item => {
            if (item.id === undefined) return;
            nameToIdLookup.set(normalizeProductName(item.canonicalName), item.id);
            if (item.aliases) {
                item.aliases.forEach(alias => {
                    nameToIdLookup.set(normalizeProductName(alias), item.id!);
                });
            }
        });

        const sortedAnalyses = [...allAnalyses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        const storeTracking: Record<number, Set<string>> = {};
        const priceCollector: Record<number, number[]> = {};

        sortedAnalyses.forEach(analysis => {
            const storeName = analysis.store?.name || t('otherStore') || 'Iná predajňa';
            const dateStr = analysis.createdAt;

            analysis.images.forEach(img => {
                const products = img.analysisResult?.products ?? EMPTY_ARRAY;
                products.forEach(p => {
                    if (!p || !p.name) return;
                    const catId = nameToIdLookup.get(normalizeProductName(p.name));
                    if (catId === undefined) return;

                    const stats = statsMap[catId];
                    if (!stats) return;

                    stats.totalFindingsCount++;
                    
                    if (!storeTracking[catId]) storeTracking[catId] = new Set();
                    storeTracking[catId].add(storeName);

                    if (!stats.lastSeenDate) {
                        stats.lastSeenDate = dateStr;
                        stats.lastSeenStore = storeName;
                    }

                    let val: number | null = null;
                    if (p.prices && p.prices.length > 0) {
                        p.prices.forEach(priceObj => {
                            const numPrice = parseFloat(priceObj.value.replace(',', '.'));
                            if (!isNaN(numPrice) && numPrice > 0) {
                                // Default to promo if available, else regular
                                if (priceObj.type === 'PROMO' || priceObj.type === 'ACTION') {
                                    val = numPrice;
                                } else if (priceObj.type === 'REGULAR' && val === null) {
                                    val = numPrice;
                                }
                            }
                        });
                    }

                    if (val !== null) {
                        if (!priceCollector[catId]) priceCollector[catId] = [];
                        priceCollector[catId].push(val);
                    }
                });
            });
        });

        catalogItems.forEach(item => {
            if (item.id === undefined) return;
            const stats = statsMap[item.id];
            if (!stats) return;

            stats.storesCount = storeTracking[item.id] ? storeTracking[item.id].size : 0;
            const prices = priceCollector[item.id];
            if (prices && prices.length > 0) {
                stats.avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
            }
        });

        return statsMap;
    }, [catalog, t]);

    useEffect(() => {
        if (rawCatalog !== undefined) {
            setIsLoading(false);
        }
    }, [rawCatalog]);

    const handleManufacturerSave = async () => {
        if (!editingEntry) return;
        
        await db.product_catalog.update(editingEntry.id, { manufacturer: editingEntry.manufacturer });
        setEditingEntry(null);
    };

    const filteredCatalog = useMemo(() => catalog.filter(entry => 
        entry.canonicalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.manufacturer && entry.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()))
    ), [catalog, searchTerm]);

    // Selection Logic
    const toggleSelection = (id: number) => {
        const newSelection = new Set(selectedIds);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedIds(newSelection);
    };

    const toggleSelectAll = () => {
        if (filteredCatalog.length > 0 && selectedIds.size === filteredCatalog.length) {
            setSelectedIds(new Set<number>()); // Deselect all
        } else {
            const allIds = new Set(filteredCatalog.map(e => e.id!));
            setSelectedIds(allIds);
        }
    };

    // Bulk actions
    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (window.confirm(t('deleteSelectedConfirm', { count: selectedIds.size }))) {
            setIsLoading(true);
            await bulkDeleteCatalogEntries(Array.from(selectedIds));
            setSelectedIds(new Set<number>());
        }
    };

    const handleBulkTrain = async () => {
        if (selectedIds.size === 0) return;
        setIsLoading(true);
        let trainedCount = 0;
        
        const allEntries = await getCatalogEntries();
        const selectedEntries = allEntries.filter(e => selectedIds.has(e.id!));

        for (const entry of selectedEntries) {
            if (entry.referenceImages && entry.referenceImages.length > 0) {
                try {
                    const visualDescription = await createVisualFingerprint(entry.canonicalName, entry.referenceImages);
                    if (visualDescription) {
                        await updateCatalogEntry(entry.id!, { visualFeatures: visualDescription });
                        trainedCount++;
                    }
                } catch (err) {
                    console.error(`Failed to train ${entry.canonicalName}:`, err);
                }
            }
        }
        
        setIsLoading(false);
        setSelectedIds(new Set<number>());
        alert(t('bulkTrainComplete', { count: trainedCount }));
    };

    const handleBatchEditSave = async () => {
        if (selectedIds.size === 0) return;
        
        const updates: Partial<ProductCatalogEntry> = {};
        if (batchEditData.manufacturer.trim()) updates.manufacturer = batchEditData.manufacturer.trim();
        if (batchEditData.category.trim()) updates.category = batchEditData.category.trim();

        if (Object.keys(updates).length > 0) {
            setIsLoading(true);
            await bulkUpdateCatalogEntries(Array.from(selectedIds), updates);
        }
        
        setIsBatchEditModalOpen(false);
        setBatchEditData({ manufacturer: '', category: '' });
        setSelectedIds(new Set<number>());
    };

    // Format localized short date (e.g. 13. 9. or Sep 13)
    const formatShortDate = useCallback((dateStr: string | null) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const localeMap: Record<string, string> = {
            sk: 'sk-SK',
            cs: 'cs-CZ',
            de: 'de-DE',
            hu: 'hu-HU',
            hr: 'hr-HR',
            en: 'en-US'
        };
        return d.toLocaleDateString(localeMap[language] || 'en-US', { day: 'numeric', month: 'numeric' });
    }, [language]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <SpinnerIcon className="w-12 h-12 text-lime-500" />
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-zinc-800 text-gray-900 dark:text-zinc-100 h-full flex flex-col relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                     <span className="text-[10px] font-black text-lime-650 uppercase tracking-widest block mb-0.5">{t('masterDataInventory')}</span>
                     <h2 className="text-2xl font-black text-gray-900 dark:text-zinc-100 flex items-center gap-3 tracking-tight leading-none">
                         <div className="bg-lime-100 p-2 rounded-xl">
                             <BookOpenIcon className="w-6 h-6 text-lime-600" />
                         </div>
                         {t('myCatalog')}
                     </h2>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                    {/* View Switcher grid vs list */}
                    <div className="flex items-center gap-1 bg-gray-50 dark:bg-zinc-800 p-1 rounded-xl border border-gray-100 dark:border-zinc-700">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-sm' : 'text-gray-400 hover:text-gray-650 dark:hover:text-zinc-200'}`}
                            title={t('gridViewCards')}
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white dark:bg-zinc-700 text-gray-900 dark:text-zinc-100 shadow-sm' : 'text-gray-400 hover:text-gray-650 dark:hover:text-zinc-200'}`}
                            title={t('listViewCompact')}
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex items-center bg-gray-50 dark:bg-zinc-800/60 p-2 rounded-xl border border-gray-100 dark:border-zinc-800">
                        <input 
                            type="checkbox" 
                            className="rounded border-gray-300 dark:border-zinc-700 text-lime-600 focus:ring-lime-500 w-5 h-5 cursor-pointer transition-colors"
                            checked={filteredCatalog.length > 0 && selectedIds.size === filteredCatalog.length}
                            onChange={toggleSelectAll}
                            title={t('selectAll') || 'Vybrať všetko'}
                        />
                    </div>
                    <div className="relative w-full md:w-72">
                        <input
                            type="text"
                            placeholder={t('searchInCatalog')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-xl border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/60 py-2.5 pl-4 pr-10 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-inset focus:ring-lime-500 focus:bg-white transition-all sm:text-sm font-semibold"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 hover:text-gray-600 cursor-pointer"
                            >
                                <CloseIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 pb-24">
                {filteredCatalog.length > 0 ? (
                    viewMode === 'grid' ? (
                        <div className="space-y-4">
                            {filteredCatalog.map(entry => {
                                const stats = enrichedStatsMap ? enrichedStatsMap[entry.id!] : undefined;
                                return (
                                    <div 
                                        key={entry.id} 
                                        onClick={() => onProductSelect(entry)}
                                        className={`w-full text-left bg-white dark:bg-zinc-900 p-6 rounded-2xl border transition-all duration-300 cursor-pointer flex gap-5 items-start group ${selectedIds.has(entry.id!) ? 'border-lime-500 bg-lime-50/50 shadow-md shadow-lime-100' : 'border-gray-100 hover:border-lime-300 hover:shadow-md shadow-sm'}`}
                                    >
                                        <div onClick={(e) => e.stopPropagation()} className="pt-1.5 animate-fadeIn">
                                            <input 
                                                type="checkbox" 
                                                className="rounded-md border-gray-300 dark:border-zinc-700 text-lime-600 focus:ring-lime-500 w-5 h-5 cursor-pointer transition-colors shadow-sm"
                                                checked={selectedIds.has(entry.id!)}
                                                onChange={() => toggleSelection(entry.id!)}
                                            />
                                        </div>
                                        <div className="flex-grow">
                                            <div className="flex justify-between items-start gap-4 mb-2">
                                                <div>
                                                    <p className="font-black text-xl text-gray-900 dark:text-zinc-100 group-hover:text-lime-700 transition-colors tracking-tight leading-tight">{entry.canonicalName}</p>
                                                    {entry.sku && <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-500 font-bold block mt-0.5">SKU: #{entry.sku}</span>}
                                                </div>
                                                <span className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest bg-gray-50 dark:bg-zinc-800/60 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm shrink-0">{entry.category || t('other') || 'Iná'}</span>
                                            </div>

                                            {/* Advanced stats block */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 mt-3 bg-gray-50/50 dark:bg-zinc-900/60 rounded-xl border border-gray-100/50 text-xs">
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">{t('facingsCountHeader')}</span>
                                                    <span className="font-extrabold text-gray-900 dark:text-zinc-100">{stats?.totalFindingsCount || 0} {t('unitPieces')}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">{t('colAvgPrice')}</span>
                                                    <span className="font-black text-lime-700 font-mono">
                                                        {stats?.avgPrice ? `${stats.avgPrice.toFixed(2)} ` : '—'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">{t('storeDistribution')}</span>
                                                    <span className="font-extrabold text-gray-900 dark:text-zinc-100">{stats?.storesCount || 0} {t('storesWord')}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block mb-1">{t('lastOccurrence')}</span>
                                                    <span className="font-bold text-gray-900 dark:text-zinc-100 block truncate" title={stats?.lastSeenStore || ''}>
                                                        {stats?.lastSeenStore ? (
                                                            <>
                                                                <span className="text-[10px] font-black uppercase text-gray-400 dark:text-zinc-500">{formatShortDate(stats.lastSeenDate)}</span>
                                                                <span className="ml-1 font-semibold">{stats.lastSeenStore.split(',')[0]}</span>
                                                            </>
                                                        ) : '—'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Manufacturer */}
                                            <div className="mt-4 flex items-center gap-4 text-xs font-medium">
                                                <span className="font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest text-[9px]">{t('manufacturer')}:</span>
                                                {editingEntry?.id === entry.id ? (
                                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="text"
                                                            value={editingEntry.manufacturer}
                                                            onChange={(e) => setEditingEntry({ ...editingEntry, manufacturer: e.target.value })}
                                                            className="block w-full rounded-xl border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-1.5 px-3 text-xs text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-inset focus:ring-lime-500 font-bold transition-colors shadow-inner"
                                                            autoFocus
                                                        />
                                                        <button onClick={handleManufacturerSave} className="p-1.5 text-white bg-lime-600 hover:bg-lime-700 rounded-xl shadow-sm transition-colors active:scale-95 cursor-pointer" title={t('saveManufacturer')}>
                                                            <SaveIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-gray-900 dark:text-zinc-100 font-black">{entry.manufacturer || t('laterEntry')}</span>
                                                        <button onClick={(e) => { e.stopPropagation(); setEditingEntry({ id: entry.id!, manufacturer: entry.manufacturer || '' })}} className="p-1 text-gray-400 dark:text-zinc-500 hover:text-lime-600 hover:bg-lime-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all active:scale-95 cursor-pointer" title={t('editManufacturer')}>
                                                            <EditIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {entry.aliases && entry.aliases.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-gray-50 flex flex-wrap gap-1.5">
                                                    {entry.aliases.slice(0, 3).map((alias, i) => (
                                                        <span key={i} className="flex items-center gap-1.5 text-[9px] font-bold bg-gray-50 dark:bg-zinc-800/60 text-gray-500 dark:text-zinc-400 border border-gray-100 dark:border-zinc-800 px-2 py-1 rounded-lg">
                                                            <TagIcon className="w-2.5 h-2.5 text-gray-400 dark:text-zinc-500" />
                                                            {alias}
                                                        </span>
                                                    ))}
                                                    {entry.aliases.length > 3 && (
                                                        <span className="text-[9px] text-gray-400 dark:text-zinc-500 font-bold self-center">+ {entry.aliases.length - 3} {t('othersMore')}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {/* Table Header */}
                            <div className="hidden lg:grid grid-cols-12 gap-3 px-6 py-3.5 bg-gray-50 dark:bg-zinc-800/60 rounded-xl border border-gray-100 dark:border-zinc-800 text-[10px] uppercase font-black tracking-wider text-gray-400 dark:text-zinc-500 mb-1">
                                <div className="col-span-1 flex items-center">{t('colSelection')}</div>
                                <div className="col-span-3">{t('colProductNameSku')}</div>
                                <div className="col-span-2">{t('colManufacturerClickEdit')}</div>
                                <div className="col-span-1 text-center font-black">{t('colDetections')}</div>
                                <div className="col-span-1 text-right">{t('colAvgPrice')}</div>
                                <div className="col-span-1 text-center">{t('colStores')}</div>
                                <div className="col-span-2 text-right">{t('colSeenInField')}</div>
                                <div className="col-span-1 text-right pr-2">{t('colActions')}</div>
                            </div>

                            {filteredCatalog.map(entry => {
                                const stats = enrichedStatsMap ? enrichedStatsMap[entry.id!] : undefined;
                                return (
                                    <div 
                                        key={entry.id} 
                                        onClick={() => onProductSelect(entry)}
                                        className={`w-full text-left bg-white dark:bg-zinc-900 py-3 px-6 rounded-xl border transition-all duration-200 cursor-pointer grid grid-cols-1 lg:grid-cols-12 items-center gap-3 group relative ${selectedIds.has(entry.id!) ? 'border-lime-500 bg-lime-50/20 shadow-xs' : 'border-gray-100 hover:border-lime-200 hover:bg-gray-50/30'}`}
                                    >
                                        {/* Selection Checkbox */}
                                        <div className="col-span-1 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-gray-300 dark:border-zinc-700 text-lime-600 focus:ring-lime-500 w-4.5 h-4.5 cursor-pointer transition-colors shadow-sm animate-fadeIn"
                                                checked={selectedIds.has(entry.id!)}
                                                onChange={() => toggleSelection(entry.id!)}
                                            />
                                            <span className="lg:hidden text-[10px] font-black uppercase text-gray-400 dark:text-zinc-500">{t('colSelection')}</span>
                                        </div>

                                        {/* Name / Product label */}
                                        <div className="col-span-1 lg:col-span-3 min-w-0 flex flex-col">
                                            <span className="font-extrabold text-sm text-gray-900 dark:text-zinc-100 truncate group-hover:text-lime-700 transition-colors" title={entry.canonicalName}>
                                                {entry.canonicalName}
                                            </span>
                                            {entry.sku && (
                                                <span className="text-[9px] font-mono font-bold text-gray-400 dark:text-zinc-500 block mt-0.5">
                                                    #{entry.sku}
                                                </span>
                                            )}
                                        </div>

                                        {/* Manufacturer */}
                                        <div className="col-span-1 lg:col-span-2 flex items-center gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
                                            <span className="lg:hidden text-[10px] font-black uppercase text-gray-400 dark:text-zinc-500 mr-2">{t('manufacturer')}:</span>
                                            {editingEntry?.id === entry.id ? (
                                                <div className="flex items-center gap-1.5 w-full">
                                                    <input
                                                        type="text"
                                                        value={editingEntry.manufacturer}
                                                        onChange={(e) => setEditingEntry({ ...editingEntry, manufacturer: e.target.value })}
                                                        className="block w-full rounded-lg border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-1 px-2.5 text-xs text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-inset focus:ring-lime-500 font-bold transition-colors shadow-inner"
                                                        autoFocus
                                                    />
                                                    <button onClick={handleManufacturerSave} className="p-1 text-white bg-lime-600 hover:bg-lime-700 rounded-lg shadow-sm transition-colors active:scale-95 cursor-pointer" title={t('saveManufacturer')}>
                                                        <SaveIcon className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-gray-800 dark:text-zinc-200 font-bold">{entry.manufacturer || '—'}</span>
                                                    <button onClick={(e) => { e.stopPropagation(); setEditingEntry({ id: entry.id!, manufacturer: entry.manufacturer || '' })}} className="p-1 text-gray-400 dark:text-zinc-500 hover:text-lime-600 hover:bg-lime-50 rounded-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer" title={t('editManufacturer')}>
                                                        <EditIcon className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Facings detected inline */}
                                        <div className="col-span-1 lg:col-span-1 lg:text-center text-xs font-bold text-gray-700 dark:text-zinc-300">
                                            <span className="lg:hidden text-[10px] font-black uppercase text-gray-400 dark:text-zinc-500 mr-2">{t('colDetections')}:</span>
                                            <span>{stats?.totalFindingsCount || 0} {t('unitPieces')}</span>
                                        </div>

                                        {/* Avg Price inline */}
                                        <div className="col-span-1 lg:col-span-1 lg:text-right text-xs font-black font-mono text-lime-700">
                                            <span className="lg:hidden text-[10px] font-black uppercase text-gray-400 dark:text-zinc-500 mr-2">{t('colAvgPrice')}:</span>
                                            <span>{stats?.avgPrice ? `${stats.avgPrice.toFixed(2)} ` : '—'}</span>
                                        </div>

                                        {/* Stores coverage list */}
                                        <div className="col-span-1 lg:col-span-1 lg:text-center text-xs font-bold text-gray-700 dark:text-zinc-300">
                                            <span className="lg:hidden text-[10px] font-black uppercase text-gray-400 dark:text-zinc-500 mr-2">{t('colStores')}:</span>
                                            <span>{stats?.storesCount || 0}</span>
                                        </div>

                                        {/* Last Seen relative detailed string */}
                                        <div className="col-span-1 lg:col-span-2 lg:text-right text-xs text-gray-500 dark:text-zinc-400 font-semibold truncate" title={stats?.lastSeenStore || ''}>
                                            <span className="lg:hidden text-[10px] font-black uppercase text-gray-400 dark:text-zinc-500 mr-2">{t('colSeenInField')}:</span>
                                            {stats?.lastSeenStore ? (
                                                <span>
                                                    <span className="font-mono text-gray-400 dark:text-zinc-500 font-bold text-[10px] mr-1">{formatShortDate(stats.lastSeenDate)}</span>
                                                    {stats.lastSeenStore.split(',')[0]}
                                                </span>
                                            ) : '—'}
                                        </div>

                                        {/* Action buttons detail button */}
                                        <div className="col-span-1 lg:col-span-1 flex justify-end items-center gap-1.5">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onProductSelect(entry); }}
                                                className="px-2.5 py-1 text-[10px] font-black text-gray-500 dark:text-zinc-400 hover:text-lime-700 hover:bg-lime-50 rounded bg-gray-50/50 dark:bg-zinc-900/60 transition-all border border-transparent hover:border-lime-250 hover:shadow-xs cursor-pointer"
                                            >
                                                {t('photoDetailAction') || 'Detail'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                ) : (
                    <div className="text-center py-32 flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-800/60 rounded-[2rem] border border-dashed border-gray-200 dark:border-zinc-800 shadow-sm animate-fade-in mx-4">
                        <div className="bg-white dark:bg-zinc-900 w-24 h-24 rounded-full flex items-center justify-center mb-8 shadow-sm border border-gray-100 dark:border-zinc-800">
                            <BookOpenIcon className="w-10 h-10 text-gray-300" />
                        </div>
                        <p className="text-xl font-black text-gray-900 dark:text-zinc-100 mb-3 tracking-tight">
                            {searchTerm ? t('noResultsFound') : t('noProductsInCatalog')}
                        </p>
                        <p className="text-gray-500 dark:text-zinc-400 max-w-sm text-base font-medium leading-relaxed">
                            {searchTerm ? t('tryChangingSearchTerm') : t('catalogAutoPopulates')}
                        </p>
                    </div>
                )}
            </div>
            
            {/* Selection bottom bulk commands */}
            {selectedIds.size > 0 && (
                <div className="absolute bottom-8 left-8 right-8 bg-gray-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between z-10 animate-fade-in-up border border-gray-800">
                    <div className="font-bold px-4 flex items-center gap-3">
                        <span className="bg-lime-500 text-gray-900 dark:text-zinc-100 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black">
                            {selectedIds.size}
                        </span>
                        {t('selectedItems', { count: selectedIds.size })}
                    </div>
                    <div className="flex gap-3 overflow-x-auto pr-2 custom-scrollbar">
                        <button 
                            onClick={handleBulkTrain}
                            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl transition-all font-bold text-sm whitespace-nowrap shadow-md shadow-purple-900 hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                        >
                            <MagicWandIcon className="w-4 h-4" />
                            {t('trainVisualAi')}
                        </button>
                        <button 
                            onClick={() => setIsBatchEditModalOpen(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl transition-all font-bold text-sm whitespace-nowrap hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                        >
                            <AdjustmentsHorizontalIcon className="w-4 h-4" />
                            {t('batchEdit')}
                        </button>
                        <button 
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl transition-all font-bold text-sm whitespace-nowrap shadow-md shadow-red-900 hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                        >
                            <TrashIcon className="w-4 h-4" />
                            {t('deleteSelected')}
                        </button>
                    </div>
                </div>
            )}

            {/* Batch Edit Modal */}
            {isBatchEditModalOpen && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl w-full max-w-md p-8 animate-fade-in-up border border-gray-100 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-zinc-100 tracking-tight">{t('batchEditTitle', { count: selectedIds.size })}</h3>
                            <button onClick={() => setIsBatchEditModalOpen(false)} className="p-2.5 text-gray-400 dark:text-zinc-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-2xl transition-all active:scale-95 cursor-pointer">
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">{t('manufacturer')}</label>
                                <input 
                                    type="text" 
                                    className="block w-full rounded-2xl border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/60 py-3.5 px-4 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-inset focus:ring-lime-500 focus:bg-white transition-all sm:text-sm font-bold shadow-inner"
                                    placeholder={t('leaveEmptyToKeep')}
                                    value={batchEditData.manufacturer}
                                    onChange={e => setBatchEditData({ ...batchEditData, manufacturer: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-2">{t('category')}</label>
                                <input 
                                    type="text" 
                                    className="block w-full rounded-2xl border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/60 py-3.5 px-4 text-gray-900 dark:text-zinc-100 focus:ring-2 focus:ring-inset focus:ring-lime-500 focus:bg-white transition-all sm:text-sm font-bold shadow-inner"
                                    placeholder={t('leaveEmptyToKeep')}
                                    value={batchEditData.category}
                                    onChange={e => setBatchEditData({ ...batchEditData, category: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="mt-10 flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-zinc-800">
                            <button onClick={() => setIsBatchEditModalOpen(false)} className="px-6 py-3.5 border border-gray-200 dark:border-zinc-800 rounded-2xl text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/60 text-sm font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer">
                                {t('cancelButton')}
                            </button>
                            <button onClick={handleBatchEditSave} className="px-6 py-3.5 bg-lime-600 text-white rounded-2xl hover:bg-lime-700 text-sm font-black uppercase tracking-widest shadow-md shadow-lime-200 hover:-translate-y-0.5 active:scale-95 transition-all cursor-pointer">
                                {t('save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
