import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  seedCompetitorPrices,
  addCompetitorPrice,
  updateCompetitorPrice,
  deleteCompetitorPrice
} from '../db.ts';
import { useTranslation } from '../i18n/index.tsx';
import type {
  SerializableImageState,
  Analysis,
  CompetitorPriceEntry,
  CompetitorComparisonRow,
  ActiveView
} from '../types.ts';
import {
  getBrandFromName,
  getCategoryFromName,
  getImageStoreName,
  calculateStringSimilarity
} from '../utils/helpers.ts';
import { exportToPDF } from '../utils/export.ts';
import {
  ArrowLeftRight,
  TrendingDown,
  TrendingUp,
  Equal,
  Plus,
  Edit2,
  Trash2,
  Search,
  ArrowUpDown,
  FileSpreadsheet,
  Printer,
  X,
  RotateCcw,
  Store,
  Layers,
  Link as LinkIcon,
  Loader2,
  Check
} from 'lucide-react';

export interface CompetitorPriceComparisonPanelProps {
  activeImages?: SerializableImageState[];
  activeAnalysis?: Analysis | null;
  onNavigateToImage?: (imageId: string) => void;
  onNavigateToView?: (view: ActiveView) => void;
}

type DataSource = 'active' | 'all' | 'specific';
type DifferenceFilter = 'ALL' | 'CHEAPER' | 'MORE_EXPENSIVE' | 'COMPETITIVE' | 'UNPAIRED';

const parsePriceVal = (priceStr?: string | null): number | null => {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/\s/g, '').replace('€', '').replace(',', '.').replace(/[^\d.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

const formatPriceEUR = (val: number | null | undefined, decSep = ','): string => {
  if (val === null || val === undefined) return '-';
  const fixed = val.toFixed(2);
  return (decSep === ',' ? fixed.replace('.', ',') : fixed) + ' €';
};

export const CompetitorPriceComparisonPanel: React.FC<CompetitorPriceComparisonPanelProps> = ({
  activeImages = [],
  activeAnalysis = null,
  onNavigateToImage,
  onNavigateToView
}) => {
  const { t, language } = useTranslation();

  // 1. Database Queries
  const dbAnalyses = useLiveQuery(() => db.analyses.orderBy('createdAt').reverse().toArray());
  const savedAnalyses = useMemo(() => dbAnalyses || [], [dbAnalyses]);

  const dbCompetitorPrices = useLiveQuery(() => db.competitor_prices.toArray());
  const competitorBenchmarks = useMemo(() => dbCompetitorPrices || [], [dbCompetitorPrices]);

  // Seed default competitor benchmarks if database is currently empty
  useEffect(() => {
    seedCompetitorPrices(false);
  }, []);

  // 2. Data Scope Selection
  const hasActiveSession = activeImages.length > 0;
  const [dataSource, setDataSource] = useState<DataSource>(hasActiveSession ? 'active' : 'all');
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>('');

  // 3. Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStore, setSelectedStore] = useState('ALL');
  const [differenceFilter, setDifferenceFilter] = useState<DifferenceFilter>('ALL');

  // 4. Sorting & Pagination
  const [sortBy, setSortBy] = useState<'diffPercent' | 'name' | 'actualPrice' | 'competitorPrice'>('diffPercent');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // 5. Manual Pairings Override Map (productId -> competitorPriceEntryId)
  const [customPairings, setCustomPairings] = useState<Record<string, number>>({});
  const [pairingModalItem, setPairingModalItem] = useState<CompetitorComparisonRow | null>(null);

  // 6. Manage Benchmark Database Modal
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [benchmarkSearchTerm, setBenchmarkSearchTerm] = useState('');
  const [editingBenchmark, setEditingBenchmark] = useState<Partial<CompetitorPriceEntry> | null>(null);
  const [isSavingBenchmark, setIsSavingBenchmark] = useState(false);

  // PDF Export
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);

  // Extract identified products with prices from the selected data source
  const identifiedProducts = useMemo(() => {
    const list: {
      rowId: string;
      productName: string;
      brand: string;
      category: string;
      storeName: string;
      storeChain: string;
      actualPrice: number;
      actualPriceType: 'REGULAR' | 'PROMO';
      confidence: number;
      imageId: string;
      imageUrl?: string;
    }[] = [];

    const unassignedCategory = t('unassignedCategory') || 'Nezaradené';

    const extractFromImage = (img: SerializableImageState, defaultStore: any) => {
      if (!img.analysisResult?.products || !Array.isArray(img.analysisResult.products)) return;

      const storeName = getImageStoreName(img, defaultStore?.name || t('unknownStore'), defaultStore);
      const storeChain = img.assignedStore?.chain || defaultStore?.chain || 'Neznámy reťazec';

      img.analysisResult.products.forEach((prod, pIdx) => {
        if (!prod || !prod.name || prod.type === 'pos_material' || prod.isGhost || prod.isDiscarded) return;

        const prices = prod.prices || [];
        const promoPriceObj = prices.find(p => p.type === 'PROMO');
        const regPriceObj = prices.find(p => p.type === 'REGULAR');

        const promoPrice = typeof prod.promoPrice === 'number' && prod.promoPrice > 0
          ? prod.promoPrice
          : (promoPriceObj ? parsePriceVal(promoPriceObj.value) : null);
        const regPrice = typeof prod.regularPrice === 'number' && prod.regularPrice > 0
          ? prod.regularPrice
          : (regPriceObj ? parsePriceVal(regPriceObj.value) : null);

        const effectivePrice = promoPrice !== null ? promoPrice : regPrice;
        if (effectivePrice === null || effectivePrice <= 0) return;

        const brand = prod.brand || getBrandFromName(prod.name) || '-';
        const category = img.productCategory || getCategoryFromName(prod.name, unassignedCategory);

        list.push({
          rowId: `${img.id}_${prod.id || pIdx}`,
          productName: prod.name,
          brand,
          category,
          storeName,
          storeChain,
          actualPrice: effectivePrice,
          actualPriceType: promoPrice !== null ? 'PROMO' : 'REGULAR',
          confidence: Math.round((prod.confidence || 0.8) * 100),
          imageId: img.id,
          imageUrl: img.imageUrl
        });
      });
    };

    if (dataSource === 'active' && activeImages.length > 0) {
      activeImages.forEach(img => extractFromImage(img, activeAnalysis?.store));
    } else if (dataSource === 'specific' && selectedAnalysisId) {
      const target = savedAnalyses.find(a => a.id === selectedAnalysisId);
      if (target && target.images) {
        target.images.forEach(img => extractFromImage(img, target.store));
      }
    } else {
      savedAnalyses.forEach(analysis => {
        if (analysis.images && Array.isArray(analysis.images)) {
          analysis.images.forEach(img => extractFromImage(img, analysis.store));
        }
      });
    }

    return list;
  }, [dataSource, activeImages, activeAnalysis, selectedAnalysisId, savedAnalyses, t]);

  // Match identified products against predefined competitor benchmark prices
  const comparisonRows = useMemo<CompetitorComparisonRow[]>(() => {
    return identifiedProducts.map(item => {
      // Check if user manually paired this product
      let matchedBenchmark: CompetitorPriceEntry | undefined;
      const customId = customPairings[item.rowId];

      if (customId) {
        matchedBenchmark = competitorBenchmarks.find(b => b.id === customId);
      }

      // If no manual pairing, perform automatic matching
      if (!matchedBenchmark && competitorBenchmarks.length > 0) {
        const itemNorm = item.productName.toLowerCase().trim();

        // 1. Exact match on target productName
        matchedBenchmark = competitorBenchmarks.find(
          b => b.productName.toLowerCase().trim() === itemNorm
        );

        // 2. High similarity match (score >= 0.65)
        if (!matchedBenchmark) {
          let highestScore = 0;
          let bestCandidate: CompetitorPriceEntry | undefined;

          competitorBenchmarks.forEach(b => {
            const bNorm = b.productName.toLowerCase().trim();
            const score = calculateStringSimilarity(itemNorm, bNorm);
            if (score > highestScore && score >= 0.65) {
              highestScore = score;
              bestCandidate = b;
            }
          });

          matchedBenchmark = bestCandidate;
        }

        // 3. Fallback: match by brand and category if exact product is not present
        if (!matchedBenchmark) {
          matchedBenchmark = competitorBenchmarks.find(
            b => b.category.toLowerCase() === item.category.toLowerCase() &&
                 b.productName.toLowerCase().includes(item.brand.toLowerCase())
          );
        }
      }

      if (matchedBenchmark && matchedBenchmark.competitorPrice > 0) {
        const compPrice = matchedBenchmark.competitorPrice;
        const diffEur = parseFloat((item.actualPrice - compPrice).toFixed(2));
        const diffPercent = parseFloat((((item.actualPrice - compPrice) / compPrice) * 100).toFixed(1));
        const priceIndex = Math.round((item.actualPrice / compPrice) * 100);

        let status: 'cheaper' | 'competitive' | 'more_expensive' = 'competitive';
        if (diffPercent <= -2.5) {
          status = 'cheaper';
        } else if (diffPercent >= 2.5) {
          status = 'more_expensive';
        }

        return {
          id: item.rowId,
          productName: item.productName,
          brand: item.brand,
          category: item.category,
          storeName: item.storeName,
          storeChain: item.storeChain,
          actualPrice: item.actualPrice,
          actualPriceType: item.actualPriceType,
          competitorPriceEntry: matchedBenchmark,
          competitorProductName: matchedBenchmark.competitorProduct,
          competitorBrand: matchedBenchmark.competitorBrand,
          competitorPrice: compPrice,
          competitorChain: matchedBenchmark.chain,
          priceDiffEur: diffEur,
          priceDiffPercent: diffPercent,
          priceIndex,
          status,
          confidence: item.confidence,
          imageId: item.imageId
        };
      }

      // Unpaired row
      return {
        id: item.rowId,
        productName: item.productName,
        brand: item.brand,
        category: item.category,
        storeName: item.storeName,
        storeChain: item.storeChain,
        actualPrice: item.actualPrice,
        actualPriceType: item.actualPriceType,
        competitorPriceEntry: null,
        competitorProductName: '-',
        competitorBrand: '-',
        competitorPrice: 0,
        competitorChain: '-',
        priceDiffEur: 0,
        priceDiffPercent: 0,
        priceIndex: 100,
        status: 'unpaired',
        confidence: item.confidence,
        imageId: item.imageId
      };
    });
  }, [identifiedProducts, competitorBenchmarks, customPairings]);

  // Unique categories and stores for filters
  const filterOptions = useMemo(() => {
    const cats = new Set<string>();
    const stores = new Set<string>();

    comparisonRows.forEach(r => {
      if (r.category && r.category !== '-') cats.add(r.category);
      if (r.storeName && r.storeName !== '-') stores.add(r.storeName);
    });

    return {
      categories: Array.from(cats).sort(),
      stores: Array.from(stores).sort()
    };
  }, [comparisonRows]);

  // Filtered & sorted comparison rows
  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const result = comparisonRows.filter(row => {
      if (term) {
        const matchName = row.productName.toLowerCase().includes(term);
        const matchBrand = row.brand.toLowerCase().includes(term);
        const matchCompProd = row.competitorProductName.toLowerCase().includes(term);
        const matchCompBrand = row.competitorBrand.toLowerCase().includes(term);
        const matchStore = row.storeName.toLowerCase().includes(term);
        if (!matchName && !matchBrand && !matchCompProd && !matchCompBrand && !matchStore) {
          return false;
        }
      }

      if (selectedCategory !== 'ALL' && row.category !== selectedCategory) {
        return false;
      }

      if (selectedStore !== 'ALL' && row.storeName !== selectedStore) {
        return false;
      }

      if (differenceFilter === 'CHEAPER' && row.status !== 'cheaper') {
        return false;
      }
      if (differenceFilter === 'MORE_EXPENSIVE' && row.status !== 'more_expensive') {
        return false;
      }
      if (differenceFilter === 'COMPETITIVE' && row.status !== 'competitive') {
        return false;
      }
      if (differenceFilter === 'UNPAIRED' && row.status !== 'unpaired') {
        return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'diffPercent':
          cmp = a.priceDiffPercent - b.priceDiffPercent;
          break;
        case 'name':
          cmp = a.productName.localeCompare(b.productName, language === 'sk' ? 'sk' : 'en');
          break;
        case 'actualPrice':
          cmp = a.actualPrice - b.actualPrice;
          break;
        case 'competitorPrice':
          cmp = a.competitorPrice - b.competitorPrice;
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [
    comparisonRows,
    searchTerm,
    selectedCategory,
    selectedStore,
    differenceFilter,
    sortBy,
    sortDirection,
    language
  ]);

  // Paginated rows
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRows.slice(start, start + itemsPerPage);
  }, [filteredRows, currentPage, itemsPerPage]);

  // KPI Statistics
  const stats = useMemo(() => {
    const total = comparisonRows.length;
    const paired = comparisonRows.filter(r => r.status !== 'unpaired');
    const cheaper = paired.filter(r => r.status === 'cheaper');
    const moreExpensive = paired.filter(r => r.status === 'more_expensive');
    const competitive = paired.filter(r => r.status === 'competitive');

    const totalDiffPercent = paired.length > 0
      ? paired.reduce((acc, r) => acc + r.priceDiffPercent, 0) / paired.length
      : 0;

    const avgActual = paired.length > 0
      ? paired.reduce((acc, r) => acc + r.actualPrice, 0) / paired.length
      : 0;

    const avgComp = paired.length > 0
      ? paired.reduce((acc, r) => acc + r.competitorPrice, 0) / paired.length
      : 0;

    return {
      total,
      pairedCount: paired.length,
      unpairedCount: total - paired.length,
      coveragePercent: total > 0 ? Math.round((paired.length / total) * 100) : 0,
      cheaperCount: cheaper.length,
      cheaperPercent: paired.length > 0 ? Math.round((cheaper.length / paired.length) * 100) : 0,
      moreExpensiveCount: moreExpensive.length,
      moreExpensivePercent: paired.length > 0 ? Math.round((moreExpensive.length / paired.length) * 100) : 0,
      competitiveCount: competitive.length,
      avgDiffPercent: parseFloat(totalDiffPercent.toFixed(1)),
      avgActualPrice: parseFloat(avgActual.toFixed(2)),
      avgCompetitorPrice: parseFloat(avgComp.toFixed(2))
    };
  }, [comparisonRows]);

  // Export comparison table to CSV
  const handleExportCSV = useCallback(() => {
    if (filteredRows.length === 0) return;

    const headers = [
      'Identifikovaný produkt',
      'Značka',
      'Kategória',
      'Predajňa',
      'Naša zistená cena (EUR)',
      'Typ ceny',
      'Konkurenčný produkt',
      'Konkurenčná značka',
      'Konkurenčný reťazec',
      'Konkurenčná cena (EUR)',
      'Cenový rozdiel (EUR)',
      'Cenový rozdiel (%)',
      'Cenový index',
      'Cenová pozícia'
    ];

    const escapeCell = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(';') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredRows.map(r => {
      const positionText = r.status === 'cheaper'
        ? 'Lacnejší ako konkurencia'
        : r.status === 'more_expensive'
        ? 'Drahší ako konkurencia'
        : r.status === 'competitive'
        ? 'Porovnateľná hladina'
        : 'Nespárované';

      return [
        r.productName,
        r.brand,
        r.category,
        r.storeName,
        r.actualPrice.toFixed(2).replace('.', ','),
        r.actualPriceType === 'PROMO' ? 'Akcia' : 'Bežná',
        r.competitorProductName,
        r.competitorBrand,
        r.competitorChain || '-',
        r.competitorPrice > 0 ? r.competitorPrice.toFixed(2).replace('.', ',') : '',
        r.status !== 'unpaired' ? r.priceDiffEur.toFixed(2).replace('.', ',') : '',
        r.status !== 'unpaired' ? `${r.priceDiffPercent.toFixed(1).replace('.', ',')}%` : '',
        r.status !== 'unpaired' ? r.priceIndex : '',
        positionText
      ].map(escapeCell).join(';');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCell).join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);

    const a = document.createElement('a');
    a.href = url;
    a.download = `Porovnanie_Konkurencnych_Cien_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filteredRows]);

  // Print / Save Comparison Report to PDF
  const handlePrint = async () => {
    if (!printAreaRef.current || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setPdfSuccess(false);

    try {
      const ok = await exportToPDF(printAreaRef.current, {
        filename: `Porovnanie_cien_s_konkurenciou_${new Date().toISOString().slice(0, 10)}.pdf`,
        orientation: 'landscape',
        scale: 1.6,
        marginMm: 8,
      });

      if (ok) {
        setPdfSuccess(true);
        setTimeout(() => setPdfSuccess(false), 3500);
      } else {
        try {
          window.print();
        } catch (printErr) {
          console.warn('Fallback print failed:', printErr);
        }
      }
    } catch (err) {
      console.error('Failed to generate comparison PDF:', err);
      try {
        window.print();
      } catch (printErr) {
        console.warn('Browser print failed:', printErr);
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDirection('asc');
    }
  };

  // Save / Update Benchmark Entry
  const handleSaveBenchmark = async () => {
    if (!editingBenchmark || !editingBenchmark.productName || !editingBenchmark.competitorPrice) {
      return;
    }

    setIsSavingBenchmark(true);
    try {
      const entryData: Omit<CompetitorPriceEntry, 'id'> = {
        productName: editingBenchmark.productName.trim(),
        competitorProduct: (editingBenchmark.competitorProduct || editingBenchmark.productName).trim(),
        competitorBrand: (editingBenchmark.competitorBrand || 'Konkurencia').trim(),
        category: (editingBenchmark.category || 'Všeobecné').trim(),
        competitorPrice: Number(editingBenchmark.competitorPrice),
        chain: editingBenchmark.chain || 'Všetky',
        notes: editingBenchmark.notes || ''
      };

      if (editingBenchmark.id) {
        await updateCompetitorPrice(editingBenchmark.id, entryData);
      } else {
        await addCompetitorPrice(entryData);
      }
      setEditingBenchmark(null);
    } catch (err) {
      console.error('Failed to save competitor price entry', err);
    } finally {
      setIsSavingBenchmark(false);
    }
  };

  const handleDeleteBenchmark = async (id: number) => {
    if (window.confirm('Naozaj chcete vymazať túto konkurenčnú cenu?')) {
      await deleteCompetitorPrice(id);
    }
  };

  const handleResetBenchmarks = async () => {
    if (window.confirm('Naozaj chcete obnoviť databázu na predvolené konkurenčné ceny?')) {
      await seedCompetitorPrices(true);
    }
  };

  return (
    <div className="space-y-6 pb-12 select-text">
      {/* 1. Header Toolbar */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-150">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">
                Priame porovnanie cien s konkurenciou
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
                Porovnanie cien zistených na regáloch s vopred definovanou databázou benchmarkových cien konkurencie
              </p>
            </div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {onNavigateToView && (
            <button
              onClick={() => onNavigateToView('priceMonitoring')}
              className="px-3 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-100 transition-colors"
            >
              Monitoring cien &rarr;
            </button>
          )}

          <button
            onClick={() => setIsManageModalOpen(true)}
            className="px-3.5 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-150 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-800"
            title="Spravovať databázu konkurenčných cien"
          >
            <Store className="w-3.5 h-3.5 text-indigo-600" />
            <span>Databáza konkurencie ({competitorBenchmarks.length})</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={filteredRows.length === 0 || isGeneratingPdf}
            className="px-3.5 py-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-800 disabled:opacity-50 disabled:cursor-wait active:scale-98"
            title="Tlač alebo export reportu do PDF"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-600 dark:text-zinc-400" />
                <span>Pripravujem PDF...</span>
              </>
            ) : pdfSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">PDF Uložené!</span>
              </>
            ) : (
              <>
                <Printer className="w-3.5 h-3.5" />
                <span>Tlačiť / PDF</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredRows.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-xs disabled:opacity-50 active:scale-98"
            title="Stiahnuť porovnanie v CSV formáte"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
            <span>Exportovať CSV</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 no-print">
        {/* Total Compared Products */}
        <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Porovnaných</div>
          <div className="text-lg font-black text-zinc-900 dark:text-zinc-100 mt-1">
            {stats.pairedCount} <span className="text-xs font-normal text-zinc-400">/ {stats.total}</span>
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            {stats.coveragePercent}% pokrytie databázou
          </div>
        </div>

        {/* Average Price Difference % */}
        <div className={`bg-white dark:bg-zinc-900 p-3.5 rounded-xl border shadow-2xs ${
          stats.avgDiffPercent < 0
            ? 'border-emerald-200 bg-emerald-50/20'
            : stats.avgDiffPercent > 0
            ? 'border-red-200 bg-red-50/20'
            : 'border-zinc-200'
        }`}>
          <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Priemerný rozdiel</div>
          <div className={`text-lg font-black mt-1 flex items-center gap-1 ${
            stats.avgDiffPercent < 0
              ? 'text-emerald-700'
              : stats.avgDiffPercent > 0
              ? 'text-red-700'
              : 'text-zinc-800'
          }`}>
            {stats.avgDiffPercent < 0 ? <TrendingDown className="w-4 h-4" /> : stats.avgDiffPercent > 0 ? <TrendingUp className="w-4 h-4" /> : null}
            <span>{stats.avgDiffPercent > 0 ? `+${stats.avgDiffPercent}%` : `${stats.avgDiffPercent}%`}</span>
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            {stats.avgDiffPercent < 0 
              ? (t('weAreCheaperOnAverage') || 'Sme v priemere lacnejší') 
              : stats.avgDiffPercent > 0 
              ? (t('weAreMoreExpensiveOnAverage') || 'Sme v priemere drahší') 
              : (t('matchingPriceLevel') || 'Zhodná cenová hladina')}
          </div>
        </div>

        {/* Cheaper Items */}
        <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
            {t('cheaperAtOurStores') || 'Lacnejšie u nás'}
          </div>
          <div className="text-lg font-black text-emerald-800 mt-1">
            {stats.cheaperCount} <span className="text-xs font-normal text-zinc-400">({stats.cheaperPercent}%)</span>
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            {t('competitiveAdvantage') || 'Konkurenčná výhoda'}
          </div>
        </div>

        {/* More Expensive Items */}
        <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-red-600">
            {t('moreExpensiveAtOurStores') || 'Drahšie u nás'}
          </div>
          <div className="text-lg font-black text-red-800 mt-1">
            {stats.moreExpensiveCount} <span className="text-xs font-normal text-zinc-400">({stats.moreExpensivePercent}%)</span>
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            {t('competitorIsCheaper') || 'Konkurencia je lacnejšia'}
          </div>
        </div>

        {/* Our Average Price */}
        <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t('ourAveragePrice') || 'Naša priemerná cena'}
          </div>
          <div className="text-lg font-black text-zinc-900 dark:text-zinc-100 mt-1">
            {formatPriceEUR(stats.avgActualPrice)}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            {t('identifiedInStores') || 'Zistená na predajniach'}
          </div>
        </div>

        {/* Competitor Average Price */}
        <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-indigo-600">
            {t('competitorPrice') || 'Konkurenčná cena'}
          </div>
          <div className="text-lg font-black text-indigo-900 mt-1">
            {formatPriceEUR(stats.avgCompetitorPrice)}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            {t('benchmarkInDb') || 'Benchmark v databáze'}
          </div>
        </div>
      </div>

      {/* 3. Scope & Filter Controls */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-4 no-print">
        {/* Source selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-zinc-150 dark:border-zinc-800 gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
              {t('sourceOfComparedProducts') || 'Zdroj porovnávaných produktov:'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex-wrap">
            {hasActiveSession && (
              <button
                onClick={() => {
                  setDataSource('active');
                  setSelectedAnalysisId('');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  dataSource === 'active'
                    ? 'bg-white text-indigo-800 shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-100'
                }`}
              >
                {t('activeSession') || 'Aktívna relácia'} ({activeImages.length})
              </button>
            )}

            <button
              onClick={() => {
                setDataSource('all');
                setSelectedAnalysisId('');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dataSource === 'all'
                  ? 'bg-white text-indigo-800 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {t('allAnalyses') || 'Všetky analýzy'} ({savedAnalyses.length})
            </button>

            <button
              onClick={() => {
                setDataSource('specific');
                if (!selectedAnalysisId && savedAnalyses.length > 0) {
                  setSelectedAnalysisId(savedAnalyses[0].id);
                }
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dataSource === 'specific'
                  ? 'bg-white text-indigo-800 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {t('specificAnalysis') || 'Konkrétna analýza'}
            </button>
          </div>
        </div>

        {/* Specific Analysis Picker */}
        {dataSource === 'specific' && (
          <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
            <span className="text-xs font-bold text-indigo-900">
              {t('selectAnalysisToCompare') || 'Vyberte analýzu na porovnanie:'}
            </span>
            <select
              value={selectedAnalysisId}
              onChange={e => {
                setSelectedAnalysisId(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white dark:bg-zinc-900 border border-indigo-200 text-xs font-semibold rounded-lg px-3 py-1.5 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-indigo-500 max-w-full sm:max-w-md"
            >
              {savedAnalyses.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({new Date(a.createdAt).toLocaleDateString(language === 'sk' ? 'sk-SK' : 'en-US')} • {a.images?.length || 0} {t('imagesCountShort') || 'fotiek'})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t('searchOurOrCompetitorProduct') || 'Hľadať náš alebo konkurenčný produkt...'}
              className="w-full pl-8.5 pr-8 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-800 dark:text-zinc-200 focus:bg-white focus:ring-1 focus:ring-indigo-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Difference Status Filter */}
          <div>
            <select
              value={differenceFilter}
              onChange={e => {
                setDifferenceFilter(e.target.value as DifferenceFilter);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-2.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:bg-white focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">{t('allPriceRanges') || 'Všetky cenové relácie'}</option>
              <option value="CHEAPER">{t('onlyCheaper') || 'Iba lacnejšie ako konkurencia (Úspora)'}</option>
              <option value="MORE_EXPENSIVE">{t('onlyMoreExpensive') || 'Iba drahšie ako konkurencia (Prirážka)'}</option>
              <option value="COMPETITIVE">{t('onlyComparablePrices') || 'Iba porovnateľné ceny (Zhoda +/- 2.5%)'}</option>
              <option value="UNPAIRED">{t('unpairedStatus') || 'Iba bez referencie (Nespárované)'}</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={e => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-2.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:bg-white focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">
                {t('allCategoriesFilter') || 'Všetky kategórie'} ({filterOptions.categories.length})
              </option>
              {filterOptions.categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Store Filter */}
          <div>
            <select
              value={selectedStore}
              onChange={e => {
                setSelectedStore(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-2.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:bg-white focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">
                {t('allStoresFilter') || 'Všetky predajne'} ({filterOptions.stores.length})
              </option>
              {filterOptions.stores.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Comparison Results Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
        {/* Table header bar */}
        <div className="p-4 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3 no-print bg-zinc-50/50 dark:bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              {t('directPriceComparisonResults') || 'Výsledky priameho porovnania cien'}
            </span>
            <span className="text-xs bg-zinc-200/70 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded-md font-bold">
              {filteredRows.length} {t('itemsCount') || 'položiek'}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{t('rowCount') || 'Počet riadkov:'}</span>
            <select
              value={itemsPerPage}
              onChange={e => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-800 dark:text-zinc-200"
            >
              <option value={15}>15</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Empty State */}
        {filteredRows.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <ArrowLeftRight className="w-12 h-12 text-zinc-300 mx-auto" />
            <h3 className="text-base font-bold text-zinc-700 dark:text-zinc-300">
              {t('noProductsMatchFilters') || 'Žiadne produkty nevyhovujú zadaným filtrom'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              {t('tryChangingFiltersDesc') || 'Skúste zmeniť podmienky vyhľadávania, zvoliť iný zdroj dát alebo pridať nové referencie v databáze konkurencie.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300 border-collapse">
              <thead>
                <tr className="bg-zinc-100/70 border-b border-zinc-200/80 dark:border-zinc-800 text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th
                    onClick={() => handleSort('name')}
                    className="py-3 px-3 cursor-pointer hover:text-zinc-900 dark:text-zinc-100 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t('ourProductShelf') || 'Náš produkt (Regál)'}</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                    </div>
                  </th>
                  <th className="py-3 px-3">{t('store') || 'Predajňa'}</th>
                  <th
                    onClick={() => handleSort('actualPrice')}
                    className="py-3 px-3 text-right cursor-pointer hover:text-zinc-900 dark:text-zinc-100 transition-colors select-none"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{t('ourPrice') || 'Naša cena'}</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                    </div>
                  </th>
                  <th className="py-3 px-3">{t('competitorBenchmark') || 'Konkurenčný benchmark'}</th>
                  <th
                    onClick={() => handleSort('competitorPrice')}
                    className="py-3 px-3 text-right cursor-pointer hover:text-zinc-900 dark:text-zinc-100 transition-colors select-none"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{t('competitorPrice') || 'Cena konkurencie'}</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-right">{t('differenceEur') || 'Rozdiel (€)'}</th>
                  <th
                    onClick={() => handleSort('diffPercent')}
                    className="py-3 px-3 text-right cursor-pointer hover:text-zinc-900 dark:text-zinc-100 transition-colors select-none"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{t('differencePercent') || 'Rozdiel (%)'}</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center">{t('priceIndex') || 'Cenový index'}</th>
                  <th className="py-3 px-3 text-center w-20 no-print">{t('actions') || 'Akcie'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                {paginatedRows.map((row, idx) => {
                  const globalIdx = (currentPage - 1) * itemsPerPage + idx + 1;
                  const isCheaper = row.status === 'cheaper';
                  const isMoreExpensive = row.status === 'more_expensive';
                  const isUnpaired = row.status === 'unpaired';

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-indigo-50/20 transition-colors group"
                    >
                      <td className="py-3 px-3 text-center text-zinc-400 font-mono text-[11px]">
                        {globalIdx}
                      </td>

                      {/* Identified Product */}
                      <td className="py-3 px-3">
                        <div className="min-w-0">
                          {onNavigateToImage ? (
                            <button
                              type="button"
                              onClick={() => onNavigateToImage(row.imageId)}
                              className="font-extrabold text-zinc-900 dark:text-zinc-100 truncate max-w-[200px] sm:max-w-xs text-left hover:text-indigo-600 transition-colors block"
                              title={t('showOnPhoto') || 'Zobraziť na snímke'}
                            >
                              {row.productName}
                            </button>
                          ) : (
                            <p className="font-extrabold text-zinc-900 dark:text-zinc-100 truncate max-w-[200px] sm:max-w-xs" title={row.productName}>
                              {row.productName}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-medium">
                            <span>{row.brand}</span>
                            <span aria-hidden="true">·</span>
                            <span>{row.category}</span>
                          </div>
                        </div>
                      </td>

                      {/* Store */}
                      <td className="py-3 px-3">
                        <div className="text-zinc-800 dark:text-zinc-200 font-semibold truncate max-w-[140px]" title={row.storeName}>
                          {row.storeName}
                        </div>
                        <div className="text-[10px] text-zinc-400">{row.storeChain}</div>
                      </td>

                      {/* Actual Price */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {formatPriceEUR(row.actualPrice)}
                        </div>
                        <div className="text-[10px] font-medium text-zinc-400">
                          {row.actualPriceType === 'PROMO' ? (
                            <span className="text-red-600 font-bold uppercase">{t('promoPriceShort') || 'Akcia'}</span>
                          ) : (
                            t('regularPriceShort') || 'Bežná'
                          )}
                        </div>
                      </td>

                      {/* Competitor Benchmark Info */}
                      <td className="py-3 px-3">
                        {!isUnpaired ? (
                          <div>
                            <div className="font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[180px]" title={row.competitorProductName}>
                              {row.competitorProductName}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                              <span className="font-semibold text-indigo-700">{row.competitorBrand}</span>
                              {row.competitorChain && row.competitorChain !== '-' && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{row.competitorChain}</span>
                                </>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-zinc-400 italic text-[11px]">
                            <span>{t('benchmarkNotFound') || 'Nenájdený benchmark'}</span>
                          </div>
                        )}
                      </td>

                      {/* Competitor Price */}
                      <td className="py-3 px-3 text-right">
                        {!isUnpaired ? (
                          <div className="font-mono font-bold text-indigo-900">
                            {formatPriceEUR(row.competitorPrice)}
                          </div>
                        ) : (
                          <span className="text-zinc-300">-</span>
                        )}
                      </td>

                      {/* Price Difference in EUR */}
                      <td className="py-3 px-3 text-right font-mono font-bold">
                        {!isUnpaired ? (
                          <span className={isCheaper ? 'text-emerald-700' : isMoreExpensive ? 'text-red-700' : 'text-zinc-700'}>
                            {row.priceDiffEur > 0 ? `+${row.priceDiffEur.toFixed(2)} €` : `${row.priceDiffEur.toFixed(2)} €`}
                          </span>
                        ) : (
                          <span className="text-zinc-300">-</span>
                        )}
                      </td>

                      {/* Percentage Difference */}
                      <td className="py-3 px-3 text-right">
                        {!isUnpaired ? (
                          <div className="inline-flex items-center justify-end gap-1 font-mono font-black text-xs">
                            {isCheaper ? (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5">
                                <TrendingDown className="w-3 h-3 text-emerald-600" />
                                {row.priceDiffPercent.toFixed(1)}%
                              </span>
                            ) : isMoreExpensive ? (
                              <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 flex items-center gap-0.5">
                                <TrendingUp className="w-3 h-3 text-red-600" />
                                +{row.priceDiffPercent.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 flex items-center gap-0.5">
                                <Equal className="w-3 h-3 text-zinc-400" />
                                {row.priceDiffPercent > 0 ? `+${row.priceDiffPercent.toFixed(1)}%` : `${row.priceDiffPercent.toFixed(1)}%`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {t('unpairedStatus') || 'Nespárované'}
                          </span>
                        )}
                      </td>

                      {/* Price Index */}
                      <td className="py-3 px-3 text-center">
                        {!isUnpaired ? (
                          <span className="font-mono text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                            {row.priceIndex}
                          </span>
                        ) : (
                          <span className="text-zinc-300">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center no-print">
                        <button
                          onClick={() => setPairingModalItem(row)}
                          className="p-1.5 hover:bg-indigo-50 text-zinc-400 hover:text-indigo-600 rounded-lg transition-colors"
                          title={t('changeOrSetBenchmarkTitle') || 'Zmeniť alebo nastaviť referenčný benchmark'}
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {filteredRows.length > 0 && (
          <div className="p-4 border-t border-zinc-150 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3 no-print bg-zinc-50/30">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {t('showingItemsOfTotal') || 'Zobrazené'} <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> {t('to') || 'až'}{' '}
              <strong>{Math.min(currentPage * itemsPerPage, filteredRows.length)}</strong> {t('ofTotal') || 'z celkovo'}{' '}
              <strong>{filteredRows.length}</strong>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 disabled:opacity-40 transition-all"
              >
                {t('previousPage') || 'Predchádzajúca'}
              </button>
              <span className="px-3 py-1.5 text-xs font-black text-zinc-800 dark:text-zinc-200">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 disabled:opacity-40 transition-all"
              >
                {t('nextPage') || 'Ďalšia'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Pairing Modal (Allows manual mapping of identified product to any competitor benchmark) */}
      {pairingModalItem && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in no-print">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                  {t('assignCompetitorBenchmark') || 'Priradiť konkurenčný benchmark'}
                </h3>
              </div>
              <button
                onClick={() => setPairingModalItem(null)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs space-y-1">
              <span className="text-[10px] font-black uppercase text-zinc-400 block">
                {t('ourProduct') || 'Náš produkt'}:
              </span>
              <div className="font-extrabold text-zinc-900 dark:text-zinc-100">{pairingModalItem.productName}</div>
              <div className="text-zinc-500 dark:text-zinc-400">
                {t('detectedPrice') || 'Zistená cena'}: <strong className="text-zinc-800 dark:text-zinc-200">{formatPriceEUR(pairingModalItem.actualPrice)}</strong>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block">
                {t('selectCompetitorFromDb') || 'Vyberte konkurenčný produkt z databázy:'}
              </label>
              <div className="max-h-60 overflow-y-auto custom-scrollbar border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100">
                {competitorBenchmarks.map(b => (
                  <button
                    key={b.id}
                    onClick={() => {
                      if (b.id) {
                        setCustomPairings(prev => ({
                          ...prev,
                          [pairingModalItem.id]: b.id!
                        }));
                      }
                      setPairingModalItem(null);
                    }}
                    className="w-full p-2.5 text-left hover:bg-indigo-50/50 flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <div className="font-bold text-zinc-900 dark:text-zinc-100">{b.competitorProduct}</div>
                      <div className="text-[10px] text-zinc-400">{b.competitorBrand} · {b.category} ({b.chain || t('allChains') || 'Všetky'})</div>
                    </div>
                    <div className="font-mono font-extrabold text-indigo-900 text-sm">
                      {formatPriceEUR(b.competitorPrice)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-zinc-150 dark:border-zinc-800">
              <button
                onClick={() => {
                  setCustomPairings(prev => {
                    const copy = { ...prev };
                    delete copy[pairingModalItem.id];
                    return copy;
                  });
                  setPairingModalItem(null);
                }}
                className="text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-red-600 transition-colors"
              >
                {t('unpairAction') || 'Zrušiť priradenie'}
              </button>
              <button
                onClick={() => setPairingModalItem(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all"
              >
                {t('close') || 'Zavrieť'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Competitor Benchmark Database Management Modal */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in no-print">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/60">
              <div className="flex items-center gap-2.5">
                <Store className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                    {t('competitorPredefinedDbTitle') || 'Databáza vopred definovaných cien konkurencie'}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t('manageCompetitorDbDesc') || 'Spravujte referenčné ceny konkurenčných produktov pre porovnávacie audity'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetBenchmarks}
                  className="px-3 py-1.5 text-xs font-bold text-zinc-600 hover:text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200/50 rounded-lg flex items-center gap-1.5 transition-colors"
                  title={t('restoreDefaultBenchmarksTitle') || 'Obnoviť predvolený zoznam benchmarkov'}
                >
                  <RotateCcw className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                  <span>{t('restoreSamplePrices') || 'Obnoviť vzorové ceny'}</span>
                </button>
                <button
                  onClick={() => {
                    setIsManageModalOpen(false);
                    setEditingBenchmark(null);
                  }}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              {/* Add / Edit Form */}
              <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-150 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                    {editingBenchmark?.id ? <Edit2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>{editingBenchmark?.id ? (t('editBenchmark') || 'Upraviť referenčnú cenu') : (t('addBenchmark') || 'Pridať nový konkurenčný benchmark')}</span>
                  </h4>
                  {editingBenchmark && (
                    <button
                      onClick={() => setEditingBenchmark(null)}
                      className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800"
                    >
                      {t('cancelEdit') || 'Zrušiť úpravu'}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-600 dark:text-zinc-400 block mb-1">
                      {t('ourReferenceProduct') || 'Náš referenčný produkt *'}
                    </label>
                    <input
                      type="text"
                      placeholder="napr. Kofola Original 2L"
                      value={editingBenchmark?.productName || ''}
                      onChange={e => setEditingBenchmark(prev => ({ ...prev, productName: e.target.value }))}
                      className="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-600 dark:text-zinc-400 block mb-1">
                      {t('competitorProductField') || 'Konkurenčný produkt *'}
                    </label>
                    <input
                      type="text"
                      placeholder="napr. Coca-Cola Original 2L"
                      value={editingBenchmark?.competitorProduct || ''}
                      onChange={e => setEditingBenchmark(prev => ({ ...prev, competitorProduct: e.target.value }))}
                      className="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-600 dark:text-zinc-400 block mb-1">
                      {t('competitorPriceField') || 'Konkurenčná cena (€) *'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="1.89"
                      value={editingBenchmark?.competitorPrice ?? ''}
                      onChange={e => setEditingBenchmark(prev => ({ ...prev, competitorPrice: parseFloat(e.target.value) || 0 }))}
                      className="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-zinc-800 dark:text-zinc-200 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-600 dark:text-zinc-400 block mb-1">
                      {t('competitorBrandField') || 'Konkurenčná značka'}
                    </label>
                    <input
                      type="text"
                      placeholder="napr. Coca-Cola"
                      value={editingBenchmark?.competitorBrand || ''}
                      onChange={e => setEditingBenchmark(prev => ({ ...prev, competitorBrand: e.target.value }))}
                      className="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-600 dark:text-zinc-400 block mb-1">
                      {t('category') || 'Kategória'}
                    </label>
                    <input
                      type="text"
                      placeholder="napr. Nealko nápoje"
                      value={editingBenchmark?.category || ''}
                      onChange={e => setEditingBenchmark(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-600 dark:text-zinc-400 block mb-1">
                      {t('chainOrStore') || 'Reťazec / Predajňa'}
                    </label>
                    <input
                      type="text"
                      placeholder="napr. Tesco, Billa alebo Všetky"
                      value={editingBenchmark?.chain || ''}
                      onChange={e => setEditingBenchmark(prev => ({ ...prev, chain: e.target.value }))}
                      className="w-full p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveBenchmark}
                    disabled={isSavingBenchmark || !editingBenchmark?.productName || !editingBenchmark?.competitorPrice}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50"
                  >
                    {editingBenchmark?.id ? (t('saveChanges') || 'Uložiť zmeny') : (t('addToDatabase') || '+ Pridať do databázy')}
                  </button>
                </div>
              </div>

              {/* Benchmarks List Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    {t('recordedReferencePrices') || 'Evidované referenčné ceny'} ({competitorBenchmarks.length})
                  </h4>
                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder={t('searchInDb') || 'Hľadať v databáze...'}
                      value={benchmarkSearchTerm}
                      onChange={e => setBenchmarkSearchTerm(e.target.value)}
                      className="w-full pl-8.5 pr-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-zinc-100 dark:bg-zinc-800 text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400">
                      <tr>
                        <th className="p-2.5">{t('ourProduct') || 'Náš produkt'}</th>
                        <th className="p-2.5">{t('competitorProduct') || 'Konkurenčný produkt'}</th>
                        <th className="p-2.5">{t('brand') || 'Značka'}</th>
                        <th className="p-2.5">{t('category') || 'Kategória'}</th>
                        <th className="p-2.5 text-right">{t('referencePrice') || 'Referenčná cena'}</th>
                        <th className="p-2.5">{t('chain') || 'Reťazec'}</th>
                        <th className="p-2.5 text-center w-20">{t('actions') || 'Akcie'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                      {competitorBenchmarks
                        .filter(b => {
                          if (!benchmarkSearchTerm.trim()) return true;
                          const t = benchmarkSearchTerm.toLowerCase();
                          return (
                            b.productName.toLowerCase().includes(t) ||
                            b.competitorProduct.toLowerCase().includes(t) ||
                            b.competitorBrand.toLowerCase().includes(t) ||
                            b.category.toLowerCase().includes(t)
                          );
                        })
                        .map(b => (
                          <tr key={b.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                            <td className="p-2.5 font-bold text-zinc-900 dark:text-zinc-100">{b.productName}</td>
                            <td className="p-2.5 text-zinc-800 dark:text-zinc-200">{b.competitorProduct}</td>
                            <td className="p-2.5 text-zinc-600 dark:text-zinc-400">{b.competitorBrand}</td>
                            <td className="p-2.5 text-zinc-500 dark:text-zinc-400">{b.category}</td>
                            <td className="p-2.5 text-right font-mono font-black text-indigo-900">
                              {formatPriceEUR(b.competitorPrice)}
                            </td>
                            <td className="p-2.5 text-zinc-500 dark:text-zinc-400">{b.chain || t('allChains') || 'Všetky'}</td>
                            <td className="p-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => setEditingBenchmark(b)}
                                  className="p-1 text-zinc-400 hover:text-indigo-600 rounded"
                                  title={t('edit') || 'Upraviť'}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => b.id && handleDeleteBenchmark(b.id)}
                                  className="p-1 text-zinc-400 hover:text-red-600 rounded"
                                  title={t('delete') || 'Vymazať'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Printable View for window.print() / PDF export */}
      <div ref={printAreaRef} className="hidden print:block print:w-full text-zinc-950 dark:text-zinc-100 p-4 bg-white dark:bg-zinc-900">
        <div className="border-b-2 border-zinc-900 pb-3 mb-4 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black">Salesapp Vision • Porovnanie cien s konkurenciou</h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Dátum reportu: {new Date().toLocaleDateString('sk-SK')} | Porovnaných: {stats.pairedCount} položiek
            </p>
          </div>
          <div className="text-right text-xs">
            <div>Priemerný cenový rozdiel: <strong>{stats.avgDiffPercent > 0 ? `+${stats.avgDiffPercent}%` : `${stats.avgDiffPercent}%`}</strong></div>
            <div>Lacnejšie: {stats.cheaperCount} ({stats.cheaperPercent}%) | Drahšie: {stats.moreExpensiveCount} ({stats.moreExpensivePercent}%)</div>
          </div>
        </div>

        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="border-b-2 border-zinc-800 text-left font-black uppercase text-[9px]">
              <th className="py-1 px-1">#</th>
              <th className="py-1 px-2">Náš produkt</th>
              <th className="py-1 px-2">Predajňa</th>
              <th className="py-1 px-2 text-right">Naša cena</th>
              <th className="py-1 px-2">Konkurenčný benchmark</th>
              <th className="py-1 px-2 text-right">Cena konkurenta</th>
              <th className="py-1 px-2 text-right">Rozdiel (€)</th>
              <th className="py-1 px-2 text-right">Rozdiel (%)</th>
              <th className="py-1 px-1 text-center">Index</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filteredRows.map((row, idx) => (
              <tr key={row.id} className="break-inside-avoid">
                <td className="py-1 px-1 text-zinc-400">{idx + 1}</td>
                <td className="py-1 px-2 font-bold">{row.productName}</td>
                <td className="py-1 px-2">{row.storeName}</td>
                <td className="py-1 px-2 text-right font-mono font-bold">
                  {formatPriceEUR(row.actualPrice)}
                </td>
                <td className="py-1 px-2">{row.competitorProductName} ({row.competitorBrand})</td>
                <td className="py-1 px-2 text-right font-mono">
                  {row.competitorPrice > 0 ? formatPriceEUR(row.competitorPrice) : '-'}
                </td>
                <td className="py-1 px-2 text-right font-mono">
                  {row.status !== 'unpaired' ? `${row.priceDiffEur > 0 ? '+' : ''}${row.priceDiffEur.toFixed(2)} €` : '-'}
                </td>
                <td className="py-1 px-2 text-right font-mono font-bold">
                  {row.status !== 'unpaired' ? `${row.priceDiffPercent > 0 ? '+' : ''}${row.priceDiffPercent.toFixed(1)}%` : 'Nespárované'}
                </td>
                <td className="py-1 px-1 text-center font-mono">{row.priceIndex}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CompetitorPriceComparisonPanel;
