import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.ts';
import { useTranslation } from '../i18n/index.tsx';
import type { SerializableImageState, Analysis, ActiveView } from '../types.ts';
import { getBrandFromName, getCategoryFromName, getImageStoreName } from '../utils/helpers.ts';
import { exportToPDF } from '../utils/export.ts';
import {
  FileDown,
  FileSpreadsheet,
  Printer,
  Copy,
  Check,
  Search,
  SlidersHorizontal,
  Layers,
  X,
  ArrowUpDown,
  Package,
  Loader2
} from 'lucide-react';

export interface ExportReportsPanelProps {
  activeImages?: SerializableImageState[];
  activeAnalysis?: Analysis | null;
  onNavigateToImage?: (imageId: string) => void;
  onNavigateToView?: (view: ActiveView) => void;
  onStartNewAnalysis?: () => void;
}

export interface ExportProductItem {
  id: string;
  analysisId: string;
  analysisName: string;
  analysisDate: string;
  analysisDateObj: Date;
  imageId: string;
  imageName: string;
  imageUrl?: string;
  productName: string;
  brand: string;
  category: string;
  storeName: string;
  storeChain: string;
  storeCity: string;
  storeCode: string;
  objectType: 'product' | 'pos_material';
  posType?: string;
  isGhost: boolean;
  isCorrected: boolean;
  regularPrice: number | null;
  promoPrice: number | null;
  activePrice: number | null;
  priceType: 'REGULAR' | 'PROMO' | 'MISSING' | 'BOTH';
  priceStatusText: string;
  confidence: number;
  priceIntegrity: string;
  count: number;
}

type DataSource = 'active' | 'all' | 'specific';
type PriceFilter = 'ALL' | 'WITH_PRICE' | 'PROMO' | 'REGULAR' | 'MISSING';
type ObjectFilter = 'ALL' | 'PRODUCT' | 'POS';
type ConfidenceFilter = 0 | 0.5 | 0.7 | 0.85;
type GhostFilter = 'EXCLUDE' | 'INCLUDE' | 'ONLY_GHOST';

const parsePriceVal = (priceStr?: string | null): number | null => {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/\s/g, '').replace('€', '').replace(',', '.').replace(/[^\d.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

const formatPriceVal = (val: number | null, decSep = ','): string => {
  if (val === null || val === undefined) return '-';
  const formatted = val.toFixed(2);
  if (decSep === ',') {
    return formatted.replace('.', ',') + ' €';
  }
  return formatted + ' €';
};

export const ExportReportsPanel: React.FC<ExportReportsPanelProps> = ({
  activeImages = [],
  activeAnalysis = null,
  onNavigateToImage,
  onNavigateToView,
  onStartNewAnalysis
}) => {
  const { t, language } = useTranslation();

  // Database queries
  const dbAnalyses = useLiveQuery(() => db.analyses.orderBy('createdAt').reverse().toArray());
  const savedAnalyses = useMemo(() => dbAnalyses || [], [dbAnalyses]);

  // Configuration state
  const hasActiveSession = activeImages.length > 0;
  const [dataSource, setDataSource] = useState<DataSource>(hasActiveSession ? 'active' : 'all');
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>('');
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStore, setSelectedStore] = useState('ALL');
  const [selectedChain, setSelectedChain] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('ALL');
  const [objectFilter, setObjectFilter] = useState<ObjectFilter>('ALL');
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>(0);
  const [ghostFilter, setGhostFilter] = useState<GhostFilter>('EXCLUDE');

  // CSV formatting options
  const [csvDelimiter, setCsvDelimiter] = useState<';' | ','>(';');
  const [csvDecimalSep, setCsvDecimalSep] = useState<',' | '.'>(',');
  const [includeBOM] = useState(true);

  // Sorting & pagination
  const [sortBy, setSortBy] = useState<'name' | 'regularPrice' | 'promoPrice' | 'confidence' | 'store' | 'date'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    productName: true,
    brand: true,
    category: true,
    storeName: true,
    storeChain: true,
    analysisDate: true,
    regularPrice: true,
    promoPrice: true,
    activePrice: true,
    priceType: true,
    confidence: true,
    objectType: true,
    imageName: false
  });

  // UI state
  const [isCopied, setIsCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Extract items based on selected data source
  const rawItems = useMemo<ExportProductItem[]>(() => {
    const items: ExportProductItem[] = [];
    const unassignedCategory = t('unassignedCategory') || 'Nezaradené';

    const processImage = (img: SerializableImageState, analysisId: string, analysisName: string, defaultStore: any, defaultDate: string) => {
      if (!img.analysisResult?.products || !Array.isArray(img.analysisResult.products)) return;

      const dateStr = img.uploadDate || defaultDate || new Date().toISOString();
      const dateObj = new Date(dateStr);
      const storeName = getImageStoreName(img, defaultStore?.name || t('unknownStore'), defaultStore);
      const storeChain = img.assignedStore?.chain || defaultStore?.chain || '-';
      const storeCity = img.assignedStore?.city || defaultStore?.city || '-';
      const storeCode = img.assignedStore?.code || defaultStore?.code || '-';

      img.analysisResult.products.forEach((prod, pIdx) => {
        if (!prod || !prod.name || prod.isDiscarded) return;

        const prices = prod.prices || [];
        const regPriceObj = prices.find(p => p.type === 'REGULAR');
        const promoPriceObj = prices.find(p => p.type === 'PROMO');

        const regularPrice = typeof prod.regularPrice === 'number' && prod.regularPrice > 0 
          ? prod.regularPrice 
          : (regPriceObj ? parsePriceVal(regPriceObj.value) : null);
        const promoPrice = typeof prod.promoPrice === 'number' && prod.promoPrice > 0 
          ? prod.promoPrice 
          : (promoPriceObj ? parsePriceVal(promoPriceObj.value) : null);

        let activePrice: number | null = null;
        let priceType: 'REGULAR' | 'PROMO' | 'MISSING' | 'BOTH' = 'MISSING';
        let priceStatusText = t('missingPriceStatus') || 'Chýba cena';

        if (promoPrice !== null && regularPrice !== null) {
          priceType = 'BOTH';
          activePrice = promoPrice;
          priceStatusText = t('promoPlusRegularStatus') || 'Akcia + Bežná';
        } else if (promoPrice !== null) {
          priceType = 'PROMO';
          activePrice = promoPrice;
          priceStatusText = t('promoOnlyStatus') || t('promoShort') || 'Akcia';
        } else if (regularPrice !== null) {
          priceType = 'REGULAR';
          activePrice = regularPrice;
          priceStatusText = t('regularOnlyStatus') || t('regularShort') || 'Bežná';
        }

        const brand = prod.brand || getBrandFromName(prod.name) || '-';
        const category = img.productCategory || getCategoryFromName(prod.name, unassignedCategory);

        let priceIntegrity = prod.priceIntegrityStatus || 'valid';
        if (prices.some(p => p.isAnomalous)) {
          priceIntegrity = 'warning';
        }

        items.push({
          id: `${analysisId}_${img.id}_${prod.id || pIdx}`,
          analysisId,
          analysisName,
          analysisDate: dateObj.toLocaleDateString(language === 'sk' ? 'sk-SK' : 'en-US'),
          analysisDateObj: dateObj,
          imageId: img.id,
          imageName: img.file?.name || `${t('photo') || 'snímka'}_${img.id.slice(0, 6)}`,
          imageUrl: img.imageUrl,
          productName: prod.name,
          brand,
          category,
          storeName,
          storeChain,
          storeCity,
          storeCode,
          objectType: prod.type || 'product',
          posType: prod.posType,
          isGhost: Boolean(prod.isGhost),
          isCorrected: Boolean(prod.isCorrected),
          regularPrice,
          promoPrice,
          activePrice,
          priceType,
          priceStatusText,
          confidence: Math.round((prod.confidence || 0.8) * 100),
          priceIntegrity,
          count: 1
        });
      });
    };

    if (dataSource === 'active' && activeImages.length > 0) {
      const aName = activeAnalysis?.name || t('activeAnalysisSource') || 'Aktuálna aktívna relácia';
      activeImages.forEach(img => {
        processImage(img, activeAnalysis?.id || 'active', aName, activeAnalysis?.store, activeAnalysis?.createdAt || new Date().toISOString());
      });
    } else if (dataSource === 'specific' && selectedAnalysisId) {
      const target = savedAnalyses.find(a => a.id === selectedAnalysisId);
      if (target && target.images) {
        target.images.forEach(img => {
          processImage(img, target.id, target.name, target.store, target.createdAt);
        });
      }
    } else {
      // 'all' or fallback to saved analyses
      savedAnalyses.forEach(analysis => {
        if (analysis.images && Array.isArray(analysis.images)) {
          analysis.images.forEach(img => {
            processImage(img, analysis.id, analysis.name, analysis.store, analysis.createdAt);
          });
        }
      });
    }

    return items;
  }, [dataSource, activeImages, activeAnalysis, selectedAnalysisId, savedAnalyses, t, language]);

  // Available filter options
  const filterOptions = useMemo(() => {
    const stores = new Set<string>();
    const chains = new Set<string>();
    const categories = new Set<string>();

    rawItems.forEach(item => {
      if (item.storeName && item.storeName !== '-') stores.add(item.storeName);
      if (item.storeChain && item.storeChain !== '-') chains.add(item.storeChain);
      if (item.category && item.category !== '-') categories.add(item.category);
    });

    return {
      stores: Array.from(stores).sort(),
      chains: Array.from(chains).sort(),
      categories: Array.from(categories).sort()
    };
  }, [rawItems]);

  // Filtered & sorted items
  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const result = rawItems.filter(item => {
      // Search term
      if (term) {
        const matchesName = item.productName.toLowerCase().includes(term);
        const matchesBrand = item.brand.toLowerCase().includes(term);
        const matchesCategory = item.category.toLowerCase().includes(term);
        const matchesStore = item.storeName.toLowerCase().includes(term);
        const matchesChain = item.storeChain.toLowerCase().includes(term);
        if (!matchesName && !matchesBrand && !matchesCategory && !matchesStore && !matchesChain) {
          return false;
        }
      }

      // Store filter
      if (selectedStore !== 'ALL' && item.storeName !== selectedStore) {
        return false;
      }

      // Chain filter
      if (selectedChain !== 'ALL' && item.storeChain !== selectedChain) {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }

      // Price filter
      if (priceFilter === 'WITH_PRICE' && item.priceType === 'MISSING') {
        return false;
      }
      if (priceFilter === 'PROMO' && (item.priceType !== 'PROMO' && item.priceType !== 'BOTH')) {
        return false;
      }
      if (priceFilter === 'REGULAR' && (item.priceType !== 'REGULAR' && item.priceType !== 'BOTH')) {
        return false;
      }
      if (priceFilter === 'MISSING' && item.priceType !== 'MISSING') {
        return false;
      }

      // Object filter
      if (objectFilter === 'PRODUCT' && item.objectType !== 'product') {
        return false;
      }
      if (objectFilter === 'POS' && item.objectType !== 'pos_material') {
        return false;
      }

      // Confidence filter
      if (confidenceFilter > 0 && item.confidence < confidenceFilter * 100) {
        return false;
      }

      // Ghost filter
      if (ghostFilter === 'EXCLUDE' && item.isGhost) {
        return false;
      }
      if (ghostFilter === 'ONLY_GHOST' && !item.isGhost) {
        return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.productName.localeCompare(b.productName, language === 'sk' ? 'sk' : 'en');
          break;
        case 'regularPrice':
          comparison = (a.regularPrice ?? -1) - (b.regularPrice ?? -1);
          break;
        case 'promoPrice':
          comparison = (a.promoPrice ?? -1) - (b.promoPrice ?? -1);
          break;
        case 'confidence':
          comparison = a.confidence - b.confidence;
          break;
        case 'store':
          comparison = a.storeName.localeCompare(b.storeName);
          break;
        case 'date':
          comparison = a.analysisDateObj.getTime() - b.analysisDateObj.getTime();
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [
    rawItems,
    searchTerm,
    selectedStore,
    selectedChain,
    selectedCategory,
    priceFilter,
    objectFilter,
    confidenceFilter,
    ghostFilter,
    sortBy,
    sortDirection,
    language
  ]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  // Key KPI Metrics
  const metrics = useMemo(() => {
    const total = filteredItems.length;
    if (total === 0) {
      return {
        totalItems: 0,
        uniqueProducts: 0,
        itemsWithPrice: 0,
        priceCoveragePercent: 0,
        promoCount: 0,
        promoPercent: 0,
        avgRegularPrice: null as number | null,
        avgPromoPrice: null as number | null
      };
    }

    const uniqueSet = new Set(filteredItems.map(i => i.productName.trim().toLowerCase()));
    const withPrice = filteredItems.filter(i => i.priceType !== 'MISSING');
    const promos = filteredItems.filter(i => i.promoPrice !== null);

    const regPrices = filteredItems.map(i => i.regularPrice).filter((p): p is number => p !== null && p > 0);
    const promoPrices = filteredItems.map(i => i.promoPrice).filter((p): p is number => p !== null && p > 0);

    const avgReg = regPrices.length > 0 ? regPrices.reduce((a, b) => a + b, 0) / regPrices.length : null;
    const avgPromo = promoPrices.length > 0 ? promoPrices.reduce((a, b) => a + b, 0) / promoPrices.length : null;

    return {
      totalItems: total,
      uniqueProducts: uniqueSet.size,
      itemsWithPrice: withPrice.length,
      priceCoveragePercent: Math.round((withPrice.length / total) * 100),
      promoCount: promos.length,
      promoPercent: Math.round((promos.length / total) * 100),
      avgRegularPrice: avgReg,
      avgPromoPrice: avgPromo
    };
  }, [filteredItems]);

  // CSV Generator
  const handleExportCSV = useCallback(() => {
    if (filteredItems.length === 0) return;

    const escapeCell = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(csvDelimiter) || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const formatNum = (num: number | null): string => {
      if (num === null || num === undefined) return '';
      const fixed = num.toFixed(2);
      return csvDecimalSep === ',' ? fixed.replace('.', ',') : fixed;
    };

    // Columns definitions
    const columns: { header: string; getValue: (item: ExportProductItem) => string }[] = [];

    if (visibleColumns.productName) columns.push({ header: t('colProductName') || 'Produkt', getValue: i => i.productName });
    if (visibleColumns.brand) columns.push({ header: t('colBrand') || 'Značka', getValue: i => i.brand });
    if (visibleColumns.category) columns.push({ header: t('colCategory') || 'Kategória', getValue: i => i.category });
    if (visibleColumns.storeName) columns.push({ header: t('colStoreName') || 'Predajňa', getValue: i => i.storeName });
    if (visibleColumns.storeChain) columns.push({ header: t('colStoreChain') || 'Reťazec', getValue: i => i.storeChain });
    if (visibleColumns.analysisDate) columns.push({ header: t('colAnalysisDate') || 'Dátum auditu', getValue: i => i.analysisDate });
    if (visibleColumns.regularPrice) columns.push({ header: `${t('colRegularPrice') || 'Bežná cena'} (EUR)`, getValue: i => formatNum(i.regularPrice) });
    if (visibleColumns.promoPrice) columns.push({ header: `${t('colPromoPrice') || 'Akciová cena'} (EUR)`, getValue: i => formatNum(i.promoPrice) });
    if (visibleColumns.activePrice) columns.push({ header: `${t('colActivePrice') || 'Platná cena'} (EUR)`, getValue: i => formatNum(i.activePrice) });
    if (visibleColumns.priceType) columns.push({ header: t('priceType') || 'Typ ceny', getValue: i => i.priceStatusText });
    if (visibleColumns.confidence) columns.push({ header: `${t('detectionConfidence') || 'Istota detekcie'} (%)`, getValue: i => `${i.confidence}%` });
    if (visibleColumns.objectType) columns.push({ header: t('colObjectType') || 'Typ položky', getValue: i => i.objectType === 'pos_material' ? `POS (${i.posType || t('material') || 'materiál'})` : (t('product') || 'Produkt') });
    if (visibleColumns.imageName) columns.push({ header: t('colImageName') || 'Snímka', getValue: i => i.imageName });

    const headerLine = columns.map(c => escapeCell(c.header)).join(csvDelimiter);
    const dataLines = filteredItems.map(item => {
      return columns.map(c => escapeCell(c.getValue(item))).join(csvDelimiter);
    });

    const csvContent = (includeBOM ? '\uFEFF' : '') + [headerLine, ...dataLines].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    const filename = `Salesapp_Export_Produktov_Cien_${dateStr}_${timeStr}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredItems, visibleColumns, csvDelimiter, csvDecimalSep, includeBOM, t]);

  // Copy TSV table to clipboard
  const handleCopyToClipboard = useCallback(async () => {
    if (filteredItems.length === 0) return;

    const headers = [
      t('colProductName') || 'Produkt',
      t('colBrand') || 'Značka',
      t('colCategory') || 'Kategória',
      t('colStoreName') || 'Predajňa',
      t('colStoreChain') || 'Reťazec',
      t('date') || 'Dátum',
      `${t('colRegularPrice') || 'Bežná cena'} (EUR)`,
      `${t('colPromoPrice') || 'Akciová cena'} (EUR)`,
      `${t('colActivePrice') || 'Platná cena'} (EUR)`,
      t('priceType') || 'Typ ceny',
      `${t('confidence') || 'Istota'} (%)`
    ];

    const rows = filteredItems.map(i => [
      i.productName,
      i.brand,
      i.category,
      i.storeName,
      i.storeChain,
      i.analysisDate,
      i.regularPrice !== null ? i.regularPrice.toFixed(2).replace('.', ',') : '',
      i.promoPrice !== null ? i.promoPrice.toFixed(2).replace('.', ',') : '',
      i.activePrice !== null ? i.activePrice.toFixed(2).replace('.', ',') : '',
      i.priceStatusText,
      `${i.confidence}%`
    ]);

    const tsvContent = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');

    try {
      await navigator.clipboard.writeText(tsvContent);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (e) {
      console.error('Failed to copy to clipboard', e);
    }
  }, [filteredItems, t]);

  // Trigger Print to PDF
  const handlePrintPDF = useCallback(async () => {
    if (!printAreaRef.current || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setPdfSuccess(false);

    const safeName = (activeAnalysis?.name || 'Cenovy_Report_Produktov')
      .replace(/[^a-zA-Z0-9_\u00C0-\u017F-]/g, '_')
      .replace(/_+/g, '_');
    const filename = `${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;

    try {
      const ok = await exportToPDF(printAreaRef.current, {
        filename,
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
      console.error('Failed to generate PDF in ExportReportsPanel:', err);
      try {
        window.print();
      } catch (printErr) {
        console.warn('Browser print failed:', printErr);
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [activeAnalysis, isGeneratingPdf]);

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDirection('asc');
    }
  };

  return (
    <div className="space-y-6 pb-12 select-text">
      {/* 1. Header Toolbar */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-150">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-100 tracking-tight leading-none">
                {t('exportReportsTitle') || 'Export reportov produktov a cien'}
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
                {t('exportReportsSubtitle') || 'Export identifikovaných položiek, cien a informácií o predajniach do formátu CSV alebo PDF'}
              </p>
            </div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {onNavigateToView && (
            <button
              onClick={() => onNavigateToView('analyses')}
              className="px-3 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:text-zinc-100 transition-colors"
            >
              {t('analysisArchiveLink') || 'Archív analýz →'}
            </button>
          )}

          <button
            onClick={() => setShowOptionsModal(true)}
            className="px-3.5 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-150 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-800"
            title={t('formatAndColumnsTitle') || 'Nastavenia formátu CSV a stĺpcov'}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{t('formatAndColumnsBtn') || 'Formát & Stĺpce'}</span>
          </button>

          <button
            onClick={handleCopyToClipboard}
            disabled={filteredItems.length === 0}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border ${
              isCopied
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-white hover:bg-zinc-50 dark:bg-zinc-950/60 text-zinc-700 border-zinc-200 dark:border-zinc-800 disabled:opacity-50'
            }`}
            title={t('copyExcelTitle') || 'Kopírovať tabuľku vo formáte pre Excel'}
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopied ? (t('copiedToClipboard') || 'Skopírované!') : (t('copyToClipboard') || 'Kopírovať (Excel)')}</span>
          </button>

          <button
            onClick={() => setShowPdfPreview(true)}
            disabled={filteredItems.length === 0}
            className="px-4 py-2 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-xs disabled:opacity-50 active:scale-98"
            title={t('exportToPdfTitle') || 'Náhľad a tlač do PDF'}
          >
            <Printer className="w-4 h-4 text-zinc-300" />
            <span>{t('exportToPDF') || 'Exportovať do PDF'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredItems.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-xs disabled:opacity-50 active:scale-98"
            title={t('exportToCsvTitle') || 'Stiahnuť súbor CSV'}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
            <span>{t('exportToCSV') || 'Exportovať do CSV'}</span>
          </button>
        </div>
      </div>

      {/* 2. Data Scope Selection & Filters */}
      <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 shadow-xs space-y-4 no-print">
        {/* Source Selector Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-zinc-150 dark:border-zinc-800 gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200">
              {t('dataSource') || 'Zdroj dát'}:
            </span>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex-wrap">
            {hasActiveSession && (
              <button
                onClick={() => {
                  setDataSource('active');
                  setSelectedAnalysisId('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  dataSource === 'active'
                    ? 'bg-white text-blue-800 shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-100'
                }`}
              >
                {t('activeAnalysisSource') || 'Aktívna relácia'} ({activeImages.length})
              </button>
            )}

            <button
              onClick={() => {
                setDataSource('all');
                setSelectedAnalysisId('');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dataSource === 'all'
                  ? 'bg-white text-blue-800 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {t('allAnalysesSource') || 'Všetky analýzy'} ({savedAnalyses.length})
            </button>

            <button
              onClick={() => {
                setDataSource('specific');
                if (!selectedAnalysisId && savedAnalyses.length > 0) {
                  setSelectedAnalysisId(savedAnalyses[0].id);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                dataSource === 'specific'
                  ? 'bg-white text-blue-800 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {t('selectedAnalysisSource') || 'Konkrétna analýza'}
            </button>
          </div>
        </div>

        {/* Specific Analysis Picker if selected */}
        {dataSource === 'specific' && (
          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-150 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
            <span className="text-xs font-bold text-blue-900">
              {t('selectAnalysisFromHistory') || 'Vyberte analýzu z histórie:'}
            </span>
            <select
              value={selectedAnalysisId}
              onChange={e => setSelectedAnalysisId(e.target.value)}
              className="bg-white dark:bg-zinc-900 border border-blue-200 text-xs font-semibold rounded-lg px-3 py-1.5 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 max-w-full sm:max-w-md"
            >
              {savedAnalyses.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({new Date(a.createdAt).toLocaleDateString(language === 'sk' ? 'sk-SK' : 'en-US')} • {a.images?.length || 0} {t('imagesCountShort') || 'fotiek'})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Multi-parameter Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-1">
          {/* 1. Search */}
          <div className="col-span-1 sm:col-span-2 relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t('searchProductBrandChain') || 'Search product, brand, chain...'}
              className="w-full pl-8.5 pr-8 py-2 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-800 dark:text-zinc-200 focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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

          {/* 2. Store */}
          <div>
            <select
              value={selectedStore}
              onChange={e => {
                setSelectedStore(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-2.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:bg-white focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">{t('allStores') || 'Všetky predajne'} ({filterOptions.stores.length})</option>
              {filterOptions.stores.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* 3. Chain */}
          <div>
            <select
              value={selectedChain}
              onChange={e => {
                setSelectedChain(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-2.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:bg-white focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">{t('allChains') || 'Všetky reťazce'} ({filterOptions.chains.length})</option>
              {filterOptions.chains.map(ch => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
          </div>

          {/* 4. Category */}
          <div>
            <select
              value={selectedCategory}
              onChange={e => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-2.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:bg-white focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">{t('allCategories') || 'Všetky kategórie'} ({filterOptions.categories.length})</option>
              {filterOptions.categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 5. Price Status */}
          <div>
            <select
              value={priceFilter}
              onChange={e => {
                setPriceFilter(e.target.value as PriceFilter);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-2.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:bg-white focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">{t('allPrices') || 'Všetky ceny'}</option>
              <option value="WITH_PRICE">{t('withPriceOnly') || 'Iba s cenou'}</option>
              <option value="PROMO">{t('promoPricesOnly') || 'Iba akcie (Promo)'}</option>
              <option value="REGULAR">{t('regularPricesOnly') || 'Iba bežné ceny'}</option>
              <option value="MISSING">{t('missingPricesOnly') || 'Iba chýbajúce ceny'}</option>
            </select>
          </div>

          {/* 5. Object Type */}
          <div>
            <select
              value={objectFilter}
              onChange={e => {
                setObjectFilter(e.target.value as ObjectFilter);
                setCurrentPage(1);
              }}
              className="w-full py-2 px-2.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:bg-white focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">{t('allObjects') || 'Všetky objekty'}</option>
              <option value="PRODUCT">{t('productsOnly') || 'Iba produkty'}</option>
              <option value="POS">{t('posOnly') || 'Iba POS materiály'}</option>
            </select>
          </div>
        </div>

        {/* Advanced quick toggles row */}
        <div className="flex flex-wrap items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-100 gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={ghostFilter === 'INCLUDE'}
                onChange={e => setGhostFilter(e.target.checked ? 'INCLUDE' : 'EXCLUDE')}
                className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <span>{t('includeGhostDetections') || 'Zahrnúť nepriame detekcie (Ghost)'}</span>
            </label>

            <div className="flex items-center gap-1.5">
              <span>{t('minConfidence') || 'Minimálna istota:'}</span>
              <button
                onClick={() => setConfidenceFilter(0)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${confidenceFilter === 0 ? 'bg-blue-100 text-blue-800' : 'bg-zinc-100 text-zinc-600'}`}
              >
                {t('allConfidence') || 'Všetky'}
              </button>
              <button
                onClick={() => setConfidenceFilter(0.5)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${confidenceFilter === 0.5 ? 'bg-blue-100 text-blue-800' : 'bg-zinc-100 text-zinc-600'}`}
              >
                ≥ 50%
              </button>
              <button
                onClick={() => setConfidenceFilter(0.7)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold ${confidenceFilter === 0.7 ? 'bg-blue-100 text-blue-800' : 'bg-zinc-100 text-zinc-600'}`}
              >
                ≥ 70%
              </button>
            </div>
          </div>

          <div className="text-zinc-600 dark:text-zinc-400 font-semibold">
            {t('matchingCountOfTotal', { count: filteredItems.length, total: rawItems.length }) || `Vyhovuje: ${filteredItems.length} z ${rawItems.length} položiek`}
          </div>
        </div>
      </div>

      {/* 3. Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 no-print">
        {/* Total Facings / Items */}
        <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
            {t('totalItems') || 'Položky celkovo'}
          </div>
          <div className="text-lg font-black text-zinc-900 dark:text-zinc-100 mt-1">{metrics.totalItems}</div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            {t('identifiedOnShelves') || t('itemsOnShelves') || 'Identifikované v regáloch'}
          </div>
        </div>

        {/* Unique SKUs */}
        <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-blue-600">
            {t('uniqueSkusLabel') || 'Unikátne SKU'}
          </div>
          <div className="text-lg font-black text-blue-900 mt-1">{metrics.uniqueProducts}</div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            {t('distinctProducts') || t('distinctProductsLabel') || 'Odlišných produktov'}
          </div>
        </div>

        {/* Price Coverage */}
        <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
            {t('priceCoverage') || 'Cenové pokrytie'}
          </div>
          <div className="text-lg font-black text-emerald-800 mt-1">{metrics.priceCoveragePercent}%</div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            {t('itemsWithPriceCount', { count: metrics.itemsWithPrice }) || `${metrics.itemsWithPrice} položiek s cenou`}
          </div>
        </div>

        {/* Promo Items */}
        <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-orange-600">
            {t('promoShare') || 'Podiel akcií'}
          </div>
          <div className="text-lg font-black text-orange-800 mt-1">{metrics.promoPercent}%</div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            {metrics.promoCount} {t('inPromoAction') || 'v promo akcii'}
          </div>
        </div>

        {/* Average Regular Price */}
        <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t('averageRegularLabel') || 'Priemerná bežná'}
          </div>
          <div className="text-lg font-black text-zinc-900 dark:text-zinc-100 mt-1">
            {metrics.avgRegularPrice !== null ? formatPriceVal(metrics.avgRegularPrice) : '-'}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            {t('standardShelf') || t('standardShelfPriceLabel') || 'Štandardná regálová'}
          </div>
        </div>

        {/* Average Promo Price */}
        <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 shadow-2xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-red-600">
            {t('averagePromoLabel') || 'Priemerná akcia'}
          </div>
          <div className="text-lg font-black text-red-700 mt-1">
            {metrics.avgPromoPrice !== null ? formatPriceVal(metrics.avgPromoPrice) : '-'}
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
            {t('reducedPromo') || t('reducedPromoPriceLabel') || 'Znížená akciová'}
          </div>
        </div>
      </div>

      {/* 4. Data Preview Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800/80 shadow-xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3 no-print bg-zinc-50 dark:bg-zinc-950/60/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              {t('exportedDataPreview') || 'Náhľad exportovaných dát'}
            </span>
            <span className="text-xs bg-zinc-200/70 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded-md font-bold">
              {filteredItems.length} {t('rows') || 'riadkov'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <span>{t('showRows') || 'Zobraziť:'}</span>
              <select
                value={itemsPerPage}
                onChange={e => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-800 dark:text-zinc-200"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Empty state */}
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Package className="w-12 h-12 text-zinc-300 mx-auto" />
            <h3 className="text-base font-bold text-zinc-700 dark:text-zinc-300">
              {t('noDataToExport') || 'Žiadne produkty alebo ceny nevyhovujú zadaným filtrom.'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
              {t('noDataToExportDesc') || 'Skúste zmeniť podmienky vyhľadávania, zvoliť iný zdroj dát alebo nahrať nové fotografie na analýzu.'}
            </p>
            {onStartNewAnalysis && (
              <button
                onClick={onStartNewAnalysis}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                {t('startNewAnalysisBtn') || 'Spustiť novú analýzu'}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300 border-collapse">
              <thead>
                <tr className="bg-zinc-100/70 border-b border-zinc-200 dark:border-zinc-800/80 text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th
                    onClick={() => handleSort('name')}
                    className="py-3 px-3 cursor-pointer hover:text-zinc-900 dark:text-zinc-100 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t('productAndBrandCol') || 'Produkt & Značka'}</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                    </div>
                  </th>
                  <th className="py-3 px-3">{t('categoryCol') || 'Kategória'}</th>
                  <th
                    onClick={() => handleSort('store')}
                    className="py-3 px-3 cursor-pointer hover:text-zinc-900 dark:text-zinc-100 transition-colors select-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{t('storeAndChainCol') || 'Predajňa & Reťazec'}</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('regularPrice')}
                    className="py-3 px-3 text-right cursor-pointer hover:text-zinc-900 dark:text-zinc-100 transition-colors select-none"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{t('regularPriceCol') || 'Bežná cena'}</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('promoPrice')}
                    className="py-3 px-3 text-right cursor-pointer hover:text-zinc-900 dark:text-zinc-100 transition-colors select-none"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <span>{t('promoPriceCol') || 'Akciová cena'}</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center">{t('priceType') || 'Stav ceny'}</th>
                  <th
                    onClick={() => handleSort('confidence')}
                    className="py-3 px-3 text-center cursor-pointer hover:text-zinc-900 dark:text-zinc-100 transition-colors select-none"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{t('confidence') || 'Istota'}</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('date')}
                    className="py-3 px-3 text-center cursor-pointer hover:text-zinc-900 dark:text-zinc-100 transition-colors select-none"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{t('dateCol') || 'Dátum'}</span>
                      <ArrowUpDown className="w-3 h-3 text-zinc-400" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800">
                {paginatedItems.map((item, idx) => {
                  const globalIdx = (currentPage - 1) * itemsPerPage + idx + 1;
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-blue-50/20 transition-colors group"
                    >
                      <td className="py-2.5 px-3 text-center text-zinc-400 font-mono text-[11px]">
                        {globalIdx}
                      </td>

                      {/* Product & Brand */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className={`w-7 h-7 rounded-md object-cover border border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-100 ${
                                onNavigateToImage ? 'cursor-pointer hover:border-blue-400 hover:scale-105 transition-transform' : ''
                              }`}
                              loading="lazy"
                              onClick={() => onNavigateToImage?.(item.imageId)}
                              title={onNavigateToImage ? (t('viewInDetailPreview') || 'Zobraziť v detailnom náhľade') : undefined}
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 shrink-0 flex items-center justify-center text-[9px] font-bold text-zinc-400">
                              SKU
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-extrabold text-zinc-900 dark:text-zinc-100 truncate max-w-[220px] sm:max-w-xs" title={item.productName}>
                              {item.productName}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-medium">
                              <span>{item.brand}</span>
                              {item.objectType === 'pos_material' && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-purple-600 font-bold uppercase">POS ({item.posType || t('material') || 'materiál'})</span>
                                </>
                              )}
                              {item.isGhost && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-amber-600 font-bold">GHOST</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-400 font-medium">
                        {item.category}
                      </td>

                      {/* Store & Chain */}
                      <td className="py-2.5 px-3">
                        <div className="text-zinc-800 dark:text-zinc-200 font-semibold truncate max-w-[160px]" title={item.storeName}>
                          {item.storeName}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {item.storeChain} {item.storeCity !== '-' ? `· ${item.storeCity}` : ''}
                        </div>
                      </td>

                      {/* Regular Price */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-zinc-800 dark:text-zinc-200">
                        {item.regularPrice !== null ? formatPriceVal(item.regularPrice) : '-'}
                      </td>

                      {/* Promo Price */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {item.promoPrice !== null ? (
                          <span className="text-red-600 font-black">
                            {formatPriceVal(item.promoPrice)}
                          </span>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>

                      {/* Price Status */}
                      <td className="py-2.5 px-3 text-center">
                        {item.priceType === 'BOTH' ? (
                          <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-150">
                            {t('promoPlusRegularStatus') || 'Akcia + Bežná'}
                          </span>
                        ) : item.priceType === 'PROMO' ? (
                          <span className="text-[10px] font-black uppercase tracking-wider text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-150">
                            {t('promoOnlyStatus') || t('promoShort') || 'Akcia'}
                          </span>
                        ) : item.priceType === 'REGULAR' ? (
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-150">
                            {t('regularOnlyStatus') || 'Bežná'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                            {t('missingPriceStatus') || 'Chýba cena'}
                          </span>
                        )}
                      </td>

                      {/* Confidence */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                          item.confidence >= 80
                            ? 'text-emerald-700 bg-emerald-50'
                            : item.confidence >= 60
                            ? 'text-blue-700 bg-blue-50'
                            : 'text-amber-700 bg-amber-50'
                        }`}>
                          {item.confidence}%
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-2.5 px-3 text-center text-zinc-500 dark:text-zinc-400 text-[11px] font-medium">
                        {item.analysisDate}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        {filteredItems.length > 0 && (
          <div className="p-4 border-t border-zinc-150 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-3 no-print bg-zinc-50 dark:bg-zinc-950/60/30">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {t('showingRows', { 
                start: (currentPage - 1) * itemsPerPage + 1, 
                end: Math.min(currentPage * itemsPerPage, filteredItems.length), 
                total: filteredItems.length 
              }) || `Zobrazené riadky ${(currentPage - 1) * itemsPerPage + 1} až ${Math.min(currentPage * itemsPerPage, filteredItems.length)} z celkovo ${filteredItems.length}`}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-white border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 dark:bg-zinc-950/60 disabled:opacity-40 transition-all"
              >
                {t('prevPage') || 'Predchádzajúca'}
              </button>
              <span className="px-3 py-1.5 text-xs font-black text-zinc-800 dark:text-zinc-200">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-white border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 dark:bg-zinc-950/60 disabled:opacity-40 transition-all"
              >
                {t('nextPage') || 'Ďalšia'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. CSV Configuration & Column Visibility Modal */}
      {showOptionsModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in no-print">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                  {t('csvFormatAndColumnsModalTitle') || 'Nastavenia formátu a stĺpcov CSV'}
                </h3>
              </div>
              <button
                onClick={() => setShowOptionsModal(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg cursor-pointer"
                aria-label={t('close') || 'Zavrieť'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Delimiter & Number formatting */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block mb-2">
                  {t('csvDelimiter') || 'Oddeľovač stĺpcov (CSV Delimiter)'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCsvDelimiter(';')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                      csvDelimiter === ';'
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:bg-zinc-950/60 text-zinc-700'
                    }`}
                  >
                    <div className="font-black">{t('semicolon') || 'Stredník ( ; )'}</div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
                      {t('standardSkCzExcel') || 'Štandard pre slovenský/český Excel'}
                    </div>
                  </button>
                  <button
                    onClick={() => setCsvDelimiter(',')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                      csvDelimiter === ','
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:bg-zinc-950/60 text-zinc-700'
                    }`}
                  >
                    <div className="font-black">{t('comma') || 'Čiarka ( , )'}</div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
                      {t('internationalStandardCsv') || 'Medzinárodný štandard (US / RFC 4180)'}
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block mb-2">
                  {t('csvDecimalSeparator') || 'Desatinný oddeľovač čísel'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCsvDecimalSep(',')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                      csvDecimalSep === ','
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:bg-zinc-950/60 text-zinc-700'
                    }`}
                  >
                    <div className="font-black">{t('commaDecimal') || 'Čiarka ( 1,49 € )'}</div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
                      {t('forEuropeanLocalization') || 'Pre európsku lokalizáciu'}
                    </div>
                  </button>
                  <button
                    onClick={() => setCsvDecimalSep('.')}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                      csvDecimalSep === '.'
                        ? 'border-blue-500 bg-blue-50 text-blue-900'
                        : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:bg-zinc-950/60 text-zinc-700'
                    }`}
                  >
                    <div className="font-black">{t('dotDecimal') || 'Bodka ( 1.49 € )'}</div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
                      {t('forSoftwareImports') || 'Pre softvérové importy a databázy'}
                    </div>
                  </button>
                </div>
              </div>

              {/* Column check-boxes */}
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block mb-2">
                  {t('includeColumnsInExport') || 'Zahrnúť stĺpce v exporte:'}
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries({
                    productName: t('colProductName') || 'Názov produktu',
                    brand: t('colBrand') || 'Značka',
                    category: t('colCategory') || 'Kategória',
                    storeName: t('colStoreName') || 'Názov predajne',
                    storeChain: t('colStoreChain') || 'Reťazec',
                    analysisDate: t('colAnalysisDate') || 'Dátum auditu',
                    regularPrice: t('colRegularPrice') || 'Bežná cena',
                    promoPrice: t('colPromoPrice') || 'Akciová cena',
                    activePrice: t('colActivePrice') || 'Platná cena',
                    priceType: t('priceType') || 'Typ ceny',
                    confidence: `${t('detectionConfidence') || 'Istota AI'} (%)`,
                    objectType: t('colObjectType') || 'Typ položky',
                    imageName: t('colImageName') || 'Názov snímky'
                  }).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 dark:bg-zinc-950/60 rounded-lg cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visibleColumns[key as keyof typeof visibleColumns]}
                        onChange={e => {
                          setVisibleColumns(prev => ({
                            ...prev,
                            [key]: e.target.checked
                          }));
                        }}
                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-150 dark:border-zinc-800">
              <button
                onClick={() => setShowOptionsModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
              >
                {t('applySettings') || 'Použiť nastavenia'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. PDF Printable Preview Modal */}
      {showPdfPreview && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {/* Modal header (hidden on print) */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/60 no-print">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-black text-zinc-900 dark:text-zinc-100">
                  {t('previewPdf') || 'Náhľad tlačového PDF reportu'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintPDF}
                  disabled={isGeneratingPdf}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-xs transition-all active:scale-95 disabled:opacity-75 disabled:cursor-wait"
                >
                  {isGeneratingPdf ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('preparingPdf') || 'Pripravujem PDF...'}</span>
                    </>
                  ) : pdfSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{t('pdfSaved') || 'PDF Uložené!'}</span>
                    </>
                  ) : (
                    <>
                      <Printer className="w-3.5 h-3.5" />
                      <span>{t('printPdf') || 'Vytlačiť / Uložiť ako PDF'}</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowPdfPreview(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-700 rounded-xl"
                  aria-label={t('close') || 'Zavrieť'}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Printable Sheet Preview */}
            <div className="p-8 overflow-y-auto custom-scrollbar bg-zinc-100 dark:bg-zinc-800 flex-1 flex justify-center">
              <div
                ref={printAreaRef}
                className="bg-white dark:bg-zinc-900 p-8 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-800 max-w-3xl w-full text-zinc-900 dark:text-zinc-100 space-y-6 print:shadow-none print:border-none print:p-0"
              >
                {/* Header */}
                <div className="border-b-2 border-zinc-900 pb-4 flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                      SALESAPP VISION • {t('priceAndShelfAudit') || 'CENOVÝ & REGÁLOVÝ AUDIT'}
                    </span>
                    <h2 className="text-xl font-black tracking-tight text-zinc-950 dark:text-zinc-100 mt-1">
                      {t('priceAndProductsReport') || 'Report cien a identifikovaných produktov'}
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      {t('source') || 'Zdroj'}: {dataSource === 'active' ? (t('activeAnalysisSource') || 'Aktuálna relácia') : dataSource === 'specific' ? (t('selectedAnalysisSource') || 'Archívna analýza') : (t('allAnalysesSource') || 'Všetky archivované analýzy')}
                    </p>
                  </div>
                  <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                    <div>{t('reportDate') || 'Dátum reportu:'} <strong>{new Date().toLocaleDateString(language === 'sk' ? 'sk-SK' : 'en-US')}</strong></div>
                    <div>{t('generatedBy') || 'Vygeneroval:'} <strong>{t('auditSystem') || 'Audítorský systém'}</strong></div>
                    <div>{t('itemsCountLabel') || 'Počet položiek:'} <strong>{filteredItems.length}</strong></div>
                  </div>
                </div>

                {/* KPI Metrics Summary for PDF */}
                <div className="grid grid-cols-4 gap-3 bg-zinc-50 dark:bg-zinc-950/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <div>
                    <div className="text-[9px] font-black uppercase text-zinc-400">{t('itemsCapitalized') || 'Položky'}</div>
                    <div className="text-base font-black text-zinc-900 dark:text-zinc-100">{metrics.totalItems}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase text-zinc-400">{t('uniqueSkusLabel') || 'Unikátne SKU'}</div>
                    <div className="text-base font-black text-blue-700">{metrics.uniqueProducts}</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase text-zinc-400">{t('priceCoverage') || 'Pokrytie cenami'}</div>
                    <div className="text-base font-black text-emerald-700">{metrics.priceCoveragePercent}%</div>
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase text-zinc-400">{t('promoShare') || 'Podiel akcií'}</div>
                    <div className="text-base font-black text-red-600">{metrics.promoPercent}%</div>
                  </div>
                </div>

                {/* Table for PDF */}
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b-2 border-zinc-800 text-[9px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                      <th className="py-2 px-1">#</th>
                      <th className="py-2 px-2">{t('colProduct') || 'Produkt'}</th>
                      <th className="py-2 px-2">{t('colBrand') || 'Značka'}</th>
                      <th className="py-2 px-2">{t('colStore') || 'Predajňa'}</th>
                      <th className="py-2 px-2 text-right">{t('regularShort') || t('regularPriceShort') || 'Bežná'}</th>
                      <th className="py-2 px-2 text-right">{t('promoShort') || t('promoPriceShort') || 'Akciová'}</th>
                      <th className="py-2 px-2 text-center">{t('status') || 'Stav'}</th>
                      <th className="py-2 px-1 text-center">{t('confidence') || 'Istota'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {filteredItems.slice(0, 150).map((item, i) => (
                      <tr key={item.id} className="leading-tight">
                        <td className="py-1.5 px-1 text-zinc-400 text-[10px]">{i + 1}</td>
                        <td className="py-1.5 px-2 font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[180px]">{item.productName}</td>
                        <td className="py-1.5 px-2 text-zinc-600 dark:text-zinc-400 truncate max-w-[100px]">{item.brand}</td>
                        <td className="py-1.5 px-2 text-zinc-600 dark:text-zinc-400 truncate max-w-[120px]">{item.storeName}</td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-zinc-800 dark:text-zinc-200">
                          {item.regularPrice !== null ? `${item.regularPrice.toFixed(2)} €` : '-'}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-black text-red-600">
                          {item.promoPrice !== null ? `${item.promoPrice.toFixed(2)} €` : '-'}
                        </td>
                        <td className="py-1.5 px-2 text-center text-[9px] font-bold text-zinc-600 dark:text-zinc-400">
                          {item.priceStatusText}
                        </td>
                        <td className="py-1.5 px-1 text-center text-[10px] font-mono font-bold text-zinc-600 dark:text-zinc-400">
                          {item.confidence}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredItems.length > 150 && (
                  <p className="text-center text-xs text-zinc-400 italic pt-2">
                    {t('showingFirst150Notice', { total: filteredItems.length }) || `(Zobrazených prvých 150 položiek z celkového počtu ${filteredItems.length}. Kompletný zoznam exportujte do CSV.)`}
                  </p>
                )}

                {/* Footer notes & signature */}
                <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-end text-[10px] text-zinc-400">
                  <div>
                    {t('generatedBySalesappNotice') || 'Generované systémom Salesapp Vision • AI rozpoznávanie maloobchodných regálov'}
                  </div>
                  <div className="text-right">
                    {t('auditorSignature') || 'Podpis zodpovedného audítora: ___________________'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Hidden printable view specifically for direct window.print() */}
      <div className="hidden print:block print:w-full text-zinc-950 dark:text-zinc-100 p-4">
        <div className="border-b-2 border-zinc-900 pb-4 mb-4 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black">Salesapp Vision • {t('priceAndProductsReport') || 'Cenový report produktov'}</h1>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {t('generatedAt') || 'Generované'}: {new Date().toLocaleDateString(language === 'sk' ? 'sk-SK' : 'en-US')} | {t('itemsCapitalized') || 'Položiek'}: {filteredItems.length}
            </p>
          </div>
          <div className="text-right text-xs">
            <div>{t('priceCoverage') || 'Pokrytie'}: {metrics.priceCoveragePercent}%</div>
            <div>{t('promoShare') || 'Podiel akcií'}: {metrics.promoPercent}%</div>
          </div>
        </div>

        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-left font-black uppercase">
              <th className="py-1 px-1">#</th>
              <th className="py-1 px-2">{t('colProduct') || 'Produkt'}</th>
              <th className="py-1 px-2">{t('colBrand') || 'Značka'}</th>
              <th className="py-1 px-2">{t('colStore') || 'Predajňa'}</th>
              <th className="py-1 px-2 text-right">{t('colRegularPrice') || 'Bežná cena'}</th>
              <th className="py-1 px-2 text-right">{t('colPromoPrice') || 'Akciová cena'}</th>
              <th className="py-1 px-2 text-center">{t('status') || 'Stav'}</th>
              <th className="py-1 px-1 text-center">{t('confidence') || 'Istota'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filteredItems.map((item, idx) => (
              <tr key={item.id} className="break-inside-avoid">
                <td className="py-1 px-1">{idx + 1}</td>
                <td className="py-1 px-2 font-bold">{item.productName}</td>
                <td className="py-1 px-2">{item.brand}</td>
                <td className="py-1 px-2">{item.storeName}</td>
                <td className="py-1 px-2 text-right font-mono font-bold">
                  {item.regularPrice !== null ? `${item.regularPrice.toFixed(2)} €` : '-'}
                </td>
                <td className="py-1 px-2 text-right font-mono font-bold">
                  {item.promoPrice !== null ? `${item.promoPrice.toFixed(2)} €` : '-'}
                </td>
                <td className="py-1 px-2 text-center">{item.priceStatusText}</td>
                <td className="py-1 px-1 text-center font-mono">{item.confidence}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExportReportsPanel;
