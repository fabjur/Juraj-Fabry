import React, { useState, useMemo } from 'react';
import { useTranslation } from '../i18n/index.tsx';
import type { StoreCentricSummary, BrandClassifications } from '../types';
import { buildPriceGapAnalytics, parseNumericPrice } from '../utils/priceAnalytics';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  AlertTriangle, 
  Scale, 
  Package, 
  Building2, 
  Search, 
  Download, 
  Layers, 
  ArrowUpDown, 
  Tag, 
  Percent, 
  Check 
} from 'lucide-react';

interface PriceGapAnalysisPanelProps {
  storeData: StoreCentricSummary[];
  brandClassifications: BrandClassifications;
  onOpenBrandDefinition?: () => void;
}

export const PriceGapAnalysisPanel: React.FC<PriceGapAnalysisPanelProps> = ({
  storeData,
  brandClassifications,
  onOpenBrandDefinition
}) => {
  const { t } = useTranslation();
  const liveCatalog = useLiveQuery(() => db.product_catalog.toArray());
  const catalog = useMemo(() => liveCatalog || [], [liveCatalog]);

  const [activeSubTab, setActiveSubTab] = useState<'radar' | 'moc' | 'unitPrices' | 'crossChain'>('radar');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedChain, setSelectedChain] = useState<string>('all');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<'all' | 'our' | 'competitor'>('all');
  const [selectedMocFilter, setSelectedMocFilter] = useState<'all' | 'deviations' | 'overpriced' | 'underpriced' | 'compliant'>('all');
  
  // Quick MOC edit state
  const [editingMocProduct, setEditingMocProduct] = useState<string | null>(null);
  const [editingMocValue, setEditingMocValue] = useState<string>('');

  const analytics = useMemo(() => {
    return buildPriceGapAnalytics(storeData, catalog, brandClassifications);
  }, [storeData, catalog, brandClassifications]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    analytics.items.forEach(i => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set).sort();
  }, [analytics.items]);

  const chains = useMemo(() => {
    const set = new Set<string>();
    analytics.items.forEach(i => {
      if (i.chain) set.add(i.chain);
    });
    return Array.from(set).sort();
  }, [analytics.items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return analytics.items.filter(item => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = item.productName.toLowerCase().includes(term);
        const matchesBrand = item.brand.toLowerCase().includes(term);
        const matchesStore = item.storeName.toLowerCase().includes(term);
        if (!matchesName && !matchesBrand && !matchesStore) return false;
      }

      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (selectedChain !== 'all' && item.chain !== selectedChain) return false;

      if (selectedBrandFilter === 'our' && !item.isOurBrand) return false;
      if (selectedBrandFilter === 'competitor' && item.isOurBrand) return false;

      if (selectedMocFilter === 'deviations' && (item.mocStatus === 'COMPLIANT' || item.mocStatus === 'NO_MOC')) return false;
      if (selectedMocFilter === 'overpriced' && item.mocStatus !== 'OVERPRICED') return false;
      if (selectedMocFilter === 'underpriced' && item.mocStatus !== 'UNDERPRICED') return false;
      if (selectedMocFilter === 'compliant' && item.mocStatus !== 'COMPLIANT') return false;

      return true;
    });
  }, [analytics.items, searchTerm, selectedCategory, selectedChain, selectedBrandFilter, selectedMocFilter]);

  // Key KPI metrics
  const kpis = useMemo(() => {
    const totalItems = analytics.items.length;
    if (totalItems === 0) {
      return {
        avgPrice: 0,
        ourAvgPrice: 0,
        competitorAvgPrice: 0,
        ourPriceIndexVsCategory: 100,
        mocTrackedCount: 0,
        mocComplianceRate: 0,
        overpricedCount: 0,
        underpricedCount: 0,
        unitPricesCount: 0
      };
    }

    const ourItems = analytics.items.filter(i => i.isOurBrand);
    const compItems = analytics.items.filter(i => !i.isOurBrand);

    const ourSum = ourItems.reduce((acc, i) => acc + i.actualPrice, 0);
    const compSum = compItems.reduce((acc, i) => acc + i.actualPrice, 0);
    const totalSum = analytics.items.reduce((acc, i) => acc + i.actualPrice, 0);

    const ourAvg = ourItems.length > 0 ? ourSum / ourItems.length : 0;
    const compAvg = compItems.length > 0 ? compSum / compItems.length : 0;
    const totalAvg = totalSum / totalItems;

    const ourPriceIndex = totalAvg > 0 && ourAvg > 0 ? Math.round((ourAvg / totalAvg) * 100) : 100;

    const itemsWithMoc = analytics.items.filter(i => i.recommendedPrice && i.recommendedPrice > 0);
    const compliantCount = itemsWithMoc.filter(i => i.mocStatus === 'COMPLIANT').length;
    const overpriced = itemsWithMoc.filter(i => i.mocStatus === 'OVERPRICED').length;
    const underpriced = itemsWithMoc.filter(i => i.mocStatus === 'UNDERPRICED').length;
    const complianceRate = itemsWithMoc.length > 0 ? Math.round((compliantCount / itemsWithMoc.length) * 100) : 0;

    const withUnitPrices = analytics.items.filter(i => i.unitPrice && i.unitPrice > 0).length;

    return {
      avgPrice: parseFloat(totalAvg.toFixed(2)),
      ourAvgPrice: parseFloat(ourAvg.toFixed(2)),
      competitorAvgPrice: parseFloat(compAvg.toFixed(2)),
      ourPriceIndexVsCategory: ourPriceIndex,
      mocTrackedCount: itemsWithMoc.length,
      mocComplianceRate: complianceRate,
      overpricedCount: overpriced,
      underpricedCount: underpriced,
      unitPricesCount: withUnitPrices
    };
  }, [analytics.items]);

  // Product dispersion aggregation (grouping items by unique product name across stores)
  const productDispersions = useMemo(() => {
    const groups = new Map<string, {
      productName: string;
      brand: string;
      category: string;
      isOurBrand: boolean;
      prices: { store: string; chain: string; price: number; type: 'REGULAR' | 'PROMO' }[];
      unitPrice?: number;
      unitLabel?: string;
      detectedVolume?: string;
      recommendedPrice?: number;
    }>();

    analytics.items.forEach(item => {
      if (!groups.has(item.productName)) {
        groups.set(item.productName, {
          productName: item.productName,
          brand: item.brand,
          category: item.category,
          isOurBrand: item.isOurBrand,
          prices: [],
          unitPrice: item.unitPrice,
          unitLabel: item.unitLabel,
          detectedVolume: item.detectedVolume,
          recommendedPrice: item.recommendedPrice
        });
      }
      groups.get(item.productName)!.prices.push({
        store: item.storeName,
        chain: item.chain || 'Iné',
        price: item.actualPrice,
        type: item.priceType
      });
    });

    return Array.from(groups.values()).map(g => {
      const priceVals = g.prices.map(p => p.price);
      const minPrice = Math.min(...priceVals);
      const maxPrice = Math.max(...priceVals);
      const avgPrice = parseFloat((priceVals.reduce((a, b) => a + b, 0) / priceVals.length).toFixed(2));
      const deltaSpread = parseFloat((maxPrice - minPrice).toFixed(2));
      const deltaSpreadPercent = minPrice > 0 ? Math.round(((maxPrice - minPrice) / minPrice) * 100) : 0;

      return {
        ...g,
        minPrice,
        maxPrice,
        avgPrice,
        deltaSpread,
        deltaSpreadPercent,
        storeCount: g.prices.length
      };
    }).sort((a, b) => b.deltaSpreadPercent - a.deltaSpreadPercent);
  }, [analytics.items]);

  // Save quick MOC to catalog
  const handleSaveMoc = async (productName: string) => {
    const numeric = parseNumericPrice(editingMocValue);
    if (numeric === null || numeric <= 0) {
      setEditingMocProduct(null);
      return;
    }

    try {
      const existing = await db.product_catalog
        .filter(p => p.canonicalName.toLowerCase().trim() === productName.toLowerCase().trim())
        .first();

      if (existing && existing.id) {
        await db.product_catalog.update(existing.id, { recommendedPrice: numeric });
      } else {
        await db.product_catalog.add({
          canonicalName: productName,
          aliases: [],
          recommendedPrice: numeric,
          category: 'Potraviny'
        });
      }
    } catch (e) {
      console.error('Failed to save MOC:', e);
    }
    setEditingMocProduct(null);
  };

  // Export to CSV
  const handleExportCsv = () => {
    const headers = ['Produkt', 'Značka', 'Kategória', 'Typ značky', 'Predajňa', 'Reťazec', 'Cena ()', 'Typ ceny', 'MOC ()', 'MOC Odchýlka (%)', 'MOC Stav', 'Jednotková cena (/j)', 'Objem/Váha', 'Cenový Index (%)'];
    
    const rows = filteredItems.map(i => [
      `"${i.productName.replace(/"/g, '""')}"`,
      `"${i.brand}"`,
      `"${i.category}"`,
      i.isOurBrand ? 'Naša značka' : 'Konkurencia',
      `"${i.storeName.replace(/"/g, '""')}"`,
      `"${i.chain || ''}"`,
      i.actualPrice.toFixed(2),
      i.priceType,
      i.recommendedPrice ? i.recommendedPrice.toFixed(2) : '',
      i.mocDiffPercent ? `${i.mocDiffPercent}%` : '',
      i.mocStatus || '',
      i.unitPrice ? `${i.unitPrice} ${i.unitLabel || ''}` : '',
      i.detectedVolume || '',
      i.priceIndex ? `${i.priceIndex}%` : ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Price_Intelligence_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-200/80 shadow-3xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60">
              <Scale className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-black text-slate-900 dark:text-zinc-100 tracking-tight">
              Cenový Monitoring & Price Gap Index
            </h2>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200/60">
              Dynamic Pricing
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 max-w-2xl">
            Automatický výpočet cenového indexu (Price Gap) voči kategórii, sledovanie odporúčaných cien (MOC compliance) a prepočet jednotkových cien (/kg, /l) pre odhalenie shrinkflácie.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onOpenBrandDefinition && (
            <button
              onClick={onOpenBrandDefinition}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 border border-slate-200/80 transition-colors"
            >
              <Tag className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
              Klasifikácia značiek
            </button>
          )}
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-3xs transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            Exportovať XLS/CSV
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Price Index */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200/80 shadow-3xs">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Cenový Index (Naša značka)</span>
            <span className={`p-2 rounded-xl text-xs font-black ${kpis.ourPriceIndexVsCategory >= 100 ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {kpis.ourPriceIndexVsCategory}%
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-zinc-100">{kpis.ourAvgPrice > 0 ? `${kpis.ourAvgPrice} ` : '—'}</span>
            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500">vs priemer {kpis.avgPrice} </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold">
            {kpis.ourPriceIndexVsCategory > 100 ? (
              <span className="text-indigo-600 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> +{kpis.ourPriceIndexVsCategory - 100}% Prémiový index
              </span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" /> -{100 - kpis.ourPriceIndexVsCategory}% Diskontný index
              </span>
            )}
          </div>
        </div>

        {/* 2. MOC Compliance */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200/80 shadow-3xs">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">MOC Compliance</span>
            <span className={`p-2 rounded-xl text-xs font-black ${kpis.mocComplianceRate >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {kpis.mocComplianceRate}%
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-zinc-100">{kpis.mocTrackedCount}</span>
            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500">produktov s MOC</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] font-bold">
            <span className="text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
              +{kpis.overpricedCount} predražené
            </span>
            <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
              -{kpis.underpricedCount} podhodnotené
            </span>
          </div>
        </div>

        {/* 3. Extrahované jednotkové ceny */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200/80 shadow-3xs">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Jednotkové ceny (/kg, /l)</span>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-black">
              OCR Ready
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-zinc-100">{kpis.unitPricesCount}</span>
            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500">prepočítaných balení</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-zinc-400">
            <Package className="w-3.5 h-3.5 text-blue-600" /> Detekcia gramáže a shrinkflácie
          </div>
        </div>

        {/* 4. Medzireťazcový rozptyl */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200/80 shadow-3xs">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Monitorované reťazce</span>
            <span className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-black">
              {chains.length} sietí
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-zinc-100">{productDispersions.length}</span>
            <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500">unikátnych SKU</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-zinc-400">
            <Building2 className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-400" />
            Max rozptyl cien: <strong className="text-slate-800 dark:text-zinc-200">{productDispersions[0]?.deltaSpreadPercent || 0}%</strong>
          </div>
        </div>
      </div>

      {/* SubTab Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('radar')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'radar'
                ? 'bg-blue-600 text-white shadow-3xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            Cenový Index & Radar Kategórií
          </button>

          <button
            onClick={() => setActiveSubTab('moc')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'moc'
                ? 'bg-blue-600 text-white shadow-3xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            MOC Compliance Tracker
            {kpis.overpricedCount + kpis.underpricedCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${activeSubTab === 'moc' ? 'bg-white dark:bg-zinc-900 text-blue-600' : 'bg-rose-100 text-rose-700'}`}>
                {kpis.overpricedCount + kpis.underpricedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('unitPrices')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'unitPrices'
                ? 'bg-blue-600 text-white shadow-3xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Jednotkové Ceny & Shrinkflácia
          </button>

          <button
            onClick={() => setActiveSubTab('crossChain')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'crossChain'
                ? 'bg-blue-600 text-white shadow-3xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            Cenový Rozptyl Predajní
          </button>
        </div>

        {/* Global Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('filterProductsPlaceholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200/90 rounded-xl text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-44"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200/90 rounded-xl text-xs font-semibold focus:outline-hidden"
          >
            <option value="all">{t('allCategories')}</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select
            value={selectedChain}
            onChange={e => setSelectedChain(e.target.value)}
            className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200/90 rounded-xl text-xs font-semibold focus:outline-hidden"
          >
            <option value="all">{t('allChains')}</option>
            {chains.map(ch => <option key={ch} value={ch}>{ch}</option>)}
          </select>

          <select
            value={selectedBrandFilter}
            onChange={e => setSelectedBrandFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200/90 rounded-xl text-xs font-semibold focus:outline-hidden"
          >
            <option value="all">{t('allBrands')}</option>
            <option value="our">{t('ourBrandsOnly')}</option>
            <option value="competitor">{t('competitorsOnly')}</option>
          </select>
        </div>
      </div>

      {/* SubTab 1: Price Gap Radar */}
      {activeSubTab === 'radar' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Category Benchmarks List */}
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-slate-200/80 shadow-3xs space-y-4">
              <h3 className="text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                Priemerné ceny podľa kategórií
              </h3>
              <div className="space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                {Object.entries(analytics.categoryAverages).map(([cat, avg]) => {
                  const ourAvg = analytics.ourBrandAverages[cat];
                  const gap = ourAvg ? Math.round(((ourAvg - avg) / avg) * 100) : null;
                  return (
                    <div key={cat} className="p-3 bg-slate-50/70 rounded-2xl border border-slate-200/60 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">{cat}</span>
                        <span className="text-xs font-black text-slate-900 dark:text-zinc-100">{avg} </span>
                      </div>
                      {ourAvg ? (
                        <div className="flex justify-between items-center text-[11px] pt-1 border-t border-slate-200/50">
                          <span className="text-slate-500 dark:text-zinc-400 font-semibold">Naša značka: <strong>{ourAvg} </strong></span>
                          <span className={`font-black px-1.5 py-0.2 rounded text-[10px] ${gap && gap > 0 ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {gap && gap > 0 ? `+${gap}%` : `${gap}%`}
                          </span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 dark:text-zinc-500 italic">Bez našej značky na regáli</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Price Index Horizontal Radar Bars */}
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-slate-200/80 shadow-3xs space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                  <Percent className="w-4 h-4 text-blue-600" />
                  Price Gap Index jednotlivých produktov
                </h3>
                <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500">100% = priemer kategórie</span>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-2">
                {filteredItems.slice(0, 30).map((item, idx) => {
                  const pIndex = item.priceIndex || 100;
                  const isHigher = pIndex > 100;
                  return (
                    <div key={idx} className="p-3 rounded-2xl border border-slate-200/70 hover:border-blue-300 transition-all bg-white dark:bg-zinc-900">
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900 dark:text-zinc-100 truncate">{item.productName}</span>
                            {item.isOurBrand && (
                              <span className="text-[9px] font-black uppercase text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                                Naša značka
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500">{item.storeName} ({item.category})</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-black text-slate-900 dark:text-zinc-100">{item.actualPrice.toFixed(2)} </span>
                          <span className={`block text-[10px] font-bold ${isHigher ? 'text-indigo-600' : 'text-emerald-600'}`}>
                            Index: {pIndex}% ({item.benchmarkGapPercent && item.benchmarkGapPercent > 0 ? `+${item.benchmarkGapPercent}%` : `${item.benchmarkGapPercent}%`})
                          </span>
                        </div>
                      </div>

                      {/* Visual Progress Bar centered on 100% */}
                      <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden relative border border-slate-200/60">
                        <div 
                          className={`h-full transition-all rounded-full ${item.isOurBrand ? 'bg-blue-600' : 'bg-slate-400'}`}
                          style={{ width: `${Math.min(100, (pIndex / 200) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 2: MOC Compliance Tracker */}
      {activeSubTab === 'moc' && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-200/80 shadow-3xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Sledovanie dodržiavania MOC (Doporučená maloobchodná cena)
              </h3>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 mt-0.5">
                Okamžitá identifikácia regálových cien, ktoré sa odchyľujú od zmluvnej / doporučenej ceny o viac ako ±3%.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedMocFilter}
                onChange={e => setSelectedMocFilter(e.target.value as any)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold"
              >
                <option value="all">{t('allMocStatuses')}</option>
                <option value="deviations">{t('deviationsOnly')}</option>
                <option value="overpriced">{t('overpricedOnly')}</option>
                <option value="underpriced">{t('underpricedOnly')}</option>
                <option value="compliant">{t('compliantOnly')}</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-400 dark:text-zinc-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Produkt</th>
                  <th className="py-3 px-3">Predajňa & Reťazec</th>
                  <th className="py-3 px-3">Regálová cena</th>
                  <th className="py-3 px-3">Doporučená MOC</th>
                  <th className="py-3 px-3">Odchýlka</th>
                  <th className="py-3 px-3">Stav zhody</th>
                  <th className="py-3 px-3 text-right">Rýchla úprava MOC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 font-semibold text-slate-700 dark:text-zinc-300">
                {filteredItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-zinc-100">
                      <div className="flex items-center gap-2">
                        <span>{item.productName}</span>
                        {item.isOurBrand && (
                          <span className="text-[9px] font-black uppercase text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                            Naša
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-500 dark:text-zinc-400">
                      {item.storeName}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-extrabold text-slate-900 dark:text-zinc-100 text-xs px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded-md">
                        {item.actualPrice.toFixed(2)} 
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {editingMocProduct === item.productName ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editingMocValue}
                            onChange={e => setEditingMocValue(e.target.value)}
                            placeholder="napr. 1.99"
                            className="w-16 px-1.5 py-0.5 text-xs border rounded focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveMoc(item.productName)}
                            className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-600 dark:text-zinc-400 font-bold">
                          {item.recommendedPrice ? `${item.recommendedPrice.toFixed(2)} ` : <span className="text-slate-300 italic text-[11px]">Nenastavené</span>}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {item.mocDiffPercent ? (
                        <span className={`font-black ${item.mocDiffPercent > 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                          {item.mocDiffPercent > 0 ? `+${item.mocDiffPercent}%` : `${item.mocDiffPercent}%`}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-3">
                      {item.mocStatus === 'COMPLIANT' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> V norme
                        </span>
                      ) : item.mocStatus === 'OVERPRICED' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" /> Predražené (+{item.mocDiffPercent}%)
                        </span>
                      ) : item.mocStatus === 'UNDERPRICED' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                          <TrendingDown className="w-3 h-3" /> Podhodnotené ({item.mocDiffPercent}%)
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500">Bez referenčnej MOC</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => {
                          setEditingMocProduct(item.productName);
                          setEditingMocValue(item.recommendedPrice ? item.recommendedPrice.toString() : '');
                        }}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {item.recommendedPrice ? 'Zmeniť MOC' : '+ Nastaviť MOC'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SubTab 3: Unit Prices & Shrinkflation Tracker */}
      {activeSubTab === 'unitPrices' && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-200/80 shadow-3xs space-y-4">
          <div>
            <h3 className="text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              Prepočet Jednotkových Cien (/kg, /l) & Shrinkflácia
            </h3>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 mt-0.5">
              Normalizované porovnanie cien na 1 kg alebo 1 liter pre odhalenie neefektívnych balení, skrytého zdražovania a odlišných formátov.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.filter(i => i.unitPrice && i.unitPrice > 0).map((item, idx) => (
              <div key={idx} className="p-4 rounded-2xl border border-slate-200/80 hover:shadow-xs transition-all bg-white dark:bg-zinc-900 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                      {item.category}
                    </span>
                    <span className="text-xs font-extrabold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-lg">
                      {item.detectedVolume || 'Balenie'}
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-zinc-100 line-clamp-2">{item.productName}</h4>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 font-semibold">{item.storeName}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 block font-semibold">Cena na regáli:</span>
                    <span className="text-sm font-black text-slate-900 dark:text-zinc-100">{item.actualPrice.toFixed(2)} </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 block font-semibold">Jednotková cena:</span>
                    <span className="text-sm font-black text-blue-600">
                      {item.unitPrice?.toFixed(2)} {item.unitLabel}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SubTab 4: Cross-Chain Price Dispersion */}
      {activeSubTab === 'crossChain' && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-slate-200/80 shadow-3xs space-y-4">
          <div>
            <h3 className="text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-blue-600" />
              Medzireťazcový Cenový Rozptyl (Price Dispersion)
            </h3>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 mt-0.5">
              Porovnanie minimálnej, priemernej a maximálnej zistenej ceny pre identické produkty naprieč predajňami a sieťami.
            </p>
          </div>

          <div className="space-y-3">
            {productDispersions.map((pd, idx) => (
              <div key={idx} className="p-4 rounded-2xl border border-slate-200/80 bg-white dark:bg-zinc-900 hover:border-slate-300 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900 dark:text-zinc-100">{pd.productName}</span>
                      {pd.isOurBrand && (
                        <span className="text-[9px] font-black uppercase text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">
                          Naša značka
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-semibold">{pd.category} • nájdené na {pd.storeCount} predajniach</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 block font-semibold">Cenový rozptyl:</span>
                      <span className={`text-xs font-black ${pd.deltaSpreadPercent > 15 ? 'text-rose-600' : 'text-slate-700'}`}>
                        +{pd.deltaSpread.toFixed(2)}  ({pd.deltaSpreadPercent}%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Min - Avg - Max Price Indicators */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-slate-200/60 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 block font-bold uppercase">Min cena</span>
                    <span className="text-xs font-black text-emerald-600">{pd.minPrice.toFixed(2)} </span>
                  </div>
                  <div className="border-x border-slate-200 dark:border-zinc-800">
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 block font-bold uppercase">Priemer</span>
                    <span className="text-xs font-black text-slate-900 dark:text-zinc-100">{pd.avgPrice.toFixed(2)} </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 block font-bold uppercase">Max cena</span>
                    <span className="text-xs font-black text-rose-600">{pd.maxPrice.toFixed(2)} </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
