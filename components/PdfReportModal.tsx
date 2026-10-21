import React, { useState, useMemo, useRef } from 'react';
import type { SerializableImageState, BrandClassifications } from '../types.ts';
import type { ImageState } from '../hooks/useImageAnalysis.ts';
import { getBrandFromName, getCategoryFromName, getImageStoreName } from '../utils/helpers.ts';
import { exportToPDF } from '../utils/export.ts';
import { useTranslation } from '../i18n/index.tsx';
import {
  Printer,
  X,
  Copy,
  Check,
  Download,
  FileText,
  SlidersHorizontal,
  Tag,
  Building2,
  Calendar,
  Percent,
  TrendingDown,
  Layers,
  Award,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Loader2
} from 'lucide-react';

export interface PdfReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisName?: string;
  storeName?: string;
  storeAddress?: string;
  analysisDate?: string;
  images: Array<ImageState | SerializableImageState>;
  brandClassifications?: BrandClassifications;
}

interface ReportRow {
  id: string;
  name: string;
  brand: string;
  category: string;
  store: string;
  regularPrice: number | null;
  promoPrice: number | null;
  discountPercent: number | null;
  isPromo: boolean;
  facings: number;
  confidence: number;
  isOurBrand: boolean;
  isCompetitorBrand: boolean;
  isGhost: boolean;
}

export const PdfReportModal: React.FC<PdfReportModalProps> = ({
  isOpen,
  onClose,
  analysisName,
  storeName,
  storeAddress,
  analysisDate,
  images,
  brandClassifications,
}) => {
  const { t, language } = useTranslation();
  const reportRef = useRef<HTMLDivElement>(null);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [includePromoOnly, setIncludePromoOnly] = useState(false);
  const [includeThumbnails, setIncludeThumbnails] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [teamNote, setTeamNote] = useState<string>(
    t('defaultShelfAuditObjective') || 'Cenový audit regálu zameraný na zistenie dodržiavania odporúčaných cien, zliav a prítomnosti POS materiálov pre interný tím predaja.'
  );

  // Extract products from all images
  const allRows = useMemo(() => {
    const list: ReportRow[] = [];
    const ourBrandsSet = new Set((brandClassifications?.ourBrands || []).map(b => b.toLowerCase()));
    const compBrandsSet = new Set((brandClassifications?.competitorBrands || []).map(b => b.toLowerCase()));

    images.forEach(img => {
      if (!img.analysisResult?.products) return;
      const sName = getImageStoreName(img as any, storeName || t('store') || 'Predajňa', null);

      img.analysisResult.products.forEach(p => {
        if (!p || p.type === 'pos_material' || p.isGhost || p.isDiscarded) return; // handle separately

        const pName = p.name || t('unknownProduct') || 'Neznámy produkt';
        const brand = p.brand || getBrandFromName(pName);
        const category = getCategoryFromName(pName, t('generalCategory') || 'Všeobecné');

        let regPrice: number | null = typeof p.regularPrice === 'number' && p.regularPrice > 0 ? p.regularPrice : null;
        let promoPrice: number | null = typeof p.promoPrice === 'number' && p.promoPrice > 0 ? p.promoPrice : null;

        (p.prices || []).forEach(price => {
          const cleaned = price.value.replace(/[^\d.,]/g, '').replace(',', '.');
          const val = parseFloat(cleaned);
          if (!isNaN(val) && val > 0) {
            if (price.type === 'PROMO') {
              if (promoPrice === null || val < promoPrice) promoPrice = val;
            } else {
              if (regPrice === null || val > regPrice) regPrice = val;
            }
          }
        });

        // Compute discount if both exist
        let discountPercent: number | null = null;
        if (regPrice && promoPrice && regPrice > promoPrice) {
          discountPercent = Math.round(((regPrice - promoPrice) / regPrice) * 100);
        }

        const isPromo = promoPrice !== null || (discountPercent !== null && discountPercent > 0);
        const bLower = brand.toLowerCase();

        list.push({
          id: p.id || `${pName}-${Math.random()}`,
          name: pName,
          brand,
          category,
          store: sName,
          regularPrice: regPrice,
          promoPrice: promoPrice,
          discountPercent,
          isPromo,
          facings: 1,
          confidence: Math.round((p.confidence || 0.85) * 100),
          isOurBrand: ourBrandsSet.has(bLower),
          isCompetitorBrand: compBrandsSet.has(bLower),
          isGhost: Boolean(p.isGhost),
        });
      });
    });

    // Group duplicate products by name + store + price to count facings
    const grouped = new Map<string, ReportRow>();
    list.forEach(row => {
      const key = `${row.store}|${row.name}|${row.regularPrice}|${row.promoPrice}`;
      if (!grouped.has(key)) {
        grouped.set(key, { ...row });
      } else {
        const existing = grouped.get(key)!;
        existing.facings += 1;
        existing.confidence = Math.round((existing.confidence + row.confidence) / 2);
      }
    });

    return Array.from(grouped.values()).sort((a, b) => {
      // Sort: Promo items first, then by category, then by name
      if (a.isPromo && !b.isPromo) return -1;
      if (!a.isPromo && b.isPromo) return 1;
      return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
    });
  }, [images, storeName, brandClassifications, t]);

  // Categories list
  const categories = useMemo(() => {
    return Array.from(new Set(allRows.map(r => r.category))).sort();
  }, [allRows]);

  // Filtered rows for the report
  const filteredRows = useMemo(() => {
    return allRows.filter(row => {
      if (includePromoOnly && !row.isPromo) return false;
      if (selectedCategory !== 'ALL' && row.category !== selectedCategory) return false;
      return true;
    });
  }, [allRows, includePromoOnly, selectedCategory]);

  // Executive KPI calculations
  const kpis = useMemo(() => {
    const totalItems = allRows.reduce((sum, r) => sum + r.facings, 0);
    const uniqueSkus = allRows.length;
    const promoItems = allRows.filter(r => r.isPromo);
    const promoCount = promoItems.reduce((sum, r) => sum + r.facings, 0);
    const promoShare = totalItems > 0 ? Math.round((promoCount / totalItems) * 100) : 0;

    const itemsWithPrice = allRows.filter(r => r.regularPrice !== null || r.promoPrice !== null);
    const priceCoverage = uniqueSkus > 0 ? Math.round((itemsWithPrice.length / uniqueSkus) * 100) : 0;

    const regPrices = allRows.map(r => r.regularPrice).filter((p): p is number => p !== null);
    const avgRegPrice = regPrices.length > 0 ? regPrices.reduce((a, b) => a + b, 0) / regPrices.length : null;

    const promPrices = allRows.map(r => r.promoPrice).filter((p): p is number => p !== null);
    const avgPromoPrice = promPrices.length > 0 ? promPrices.reduce((a, b) => a + b, 0) / promPrices.length : null;

    const discounts = allRows.map(r => r.discountPercent).filter((d): d is number => d !== null);
    const avgDiscount = discounts.length > 0 ? Math.round(discounts.reduce((a, b) => a + b, 0) / discounts.length) : null;

    // POS materials
    let posCount = 0;
    images.forEach(img => {
      (img.analysisResult?.products || []).forEach(p => {
        if (p.type === 'pos_material') posCount++;
      });
    });

    let pendingExceptions = 0;
    allRows.forEach(r => {
      if (r.regularPrice === null && r.promoPrice === null) pendingExceptions++;
      if (r.regularPrice !== null && r.promoPrice !== null && r.promoPrice > r.regularPrice) pendingExceptions++;
    });

    return {
      totalItems,
      uniqueSkus,
      promoCount,
      promoShare,
      priceCoverage,
      avgRegPrice,
      avgPromoPrice,
      avgDiscount,
      posCount,
      pendingExceptions,
    };
  }, [allRows, images]);

  // Detected promo highlights
  const promoHighlights = useMemo(() => {
    return allRows
      .filter(r => r.isPromo && (r.discountPercent || 0) >= 10)
      .sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0))
      .slice(0, 6);
  }, [allRows]);

  if (!isOpen) return null;

  // Generate and download full PDF report, with fallback to browser print
  const handlePrintOrSavePdf = async () => {
    if (!reportRef.current || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setPdfSuccess(false);

    const safeName = (analysisName || 'Cenovy_Report_Regal')
      .replace(/[^a-zA-Z0-9_\u00C0-\u017F-]/g, '_')
      .replace(/_+/g, '_');
    const filename = `${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;

    try {
      const ok = await exportToPDF(reportRef.current, {
        filename,
        scale: 1.6,
        marginMm: 8,
      });

      if (ok) {
        setPdfSuccess(true);
        setTimeout(() => setPdfSuccess(false), 3500);
      } else {
        // Fallback to browser print if canvas generation failed
        try {
          window.print();
        } catch (printErr) {
          console.warn('Fallback print failed:', printErr);
        }
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      try {
        window.print();
      } catch (printErr) {
        console.warn('Browser print failed:', printErr);
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleBrowserPrint = () => {
    try {
      window.print();
    } catch (err) {
      console.warn('Browser print dialog could not be opened:', err);
    }
  };

  // Copy Executive Summary for Slack / Teams / Email
  const handleCopySummary = async () => {
    const formattedDate = analysisDate
      ? new Date(analysisDate).toLocaleDateString(language === 'sk' ? 'sk-SK' : 'en-US')
      : new Date().toLocaleDateString(language === 'sk' ? 'sk-SK' : 'en-US');

    let text = `📊 *${t('priceAndShelfAudit') || 'CENOVÝ REPORT REGÁLOV'} • ${analysisName || (t('audit') || 'Audit')}*\n`;
    text += `🏢 ${t('storeLabel') || 'Predajňa:'} ${storeName || (t('retailStore') || 'Maloobchod')} ${storeAddress ? `(${storeAddress})` : ''}\n`;
    text += `📅 ${t('auditDateLabel') || 'Dátum auditu:'} ${formattedDate}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🔹 ${t('totalFacingsCount') || 'Celkovo produktov (facingov):'} ${kpis.totalItems} ${t('pcs') || 'ks'} (${kpis.uniqueSkus} ${t('uniqueSkusLabel') || 'unikátnych SKU'})\n`;
    text += `🔹 ${t('priceCoveragePercent') || 'Pokrytie cenovkami:'} ${kpis.priceCoverage}%\n`;
    text += `🔹 ${t('promoGoodsCount') || 'Akciový tovar:'} ${kpis.promoCount} ${t('pcs') || 'ks'} (${kpis.promoShare}% ${t('promoShare') || 'podiel na regáli'})\n`;
    if (kpis.avgRegPrice) text += `🔹 ${t('avgRegularPriceLabel') || 'Priemerná bežná cena:'} ${kpis.avgRegPrice.toFixed(2)} €\n`;
    if (kpis.avgPromoPrice) text += `🔹 ${t('avgPromoPriceLabel') || 'Priemerná akciová cena:'} ${kpis.avgPromoPrice.toFixed(2)} €\n`;
    if (kpis.avgDiscount) text += `🔹 ${t('avgPromoDiscountLabel') || 'Priemerná zľava v akcii:'} -${kpis.avgDiscount}%\n`;
    if (kpis.posCount > 0) text += `🔹 ${t('posPresenceLabel') || 'Prítomnosť POS materiálov:'} ${kpis.posCount} ${t('pcs') || 'ks'}\n`;

    if (promoHighlights.length > 0) {
      text += `\n🔥 *${t('topPromosHeader') || 'TOP AKCIE & ZĽAVY NA REGÁLI:'}*\n`;
      promoHighlights.forEach(h => {
        text += `• ${h.name} (${h.brand}): ${h.promoPrice?.toFixed(2)} € (${t('originally') || 'pôvodne'} ${h.regularPrice?.toFixed(2)} €, -${h.discountPercent}%)\n`;
      });
    }

    if (teamNote) {
      text += `\n📝 *${t('teamNotePrefix') || 'Poznámka pre tím: '}*\n${teamNote}\n`;
    }

    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  // Download standalone offline HTML report
  const handleDownloadHtml = () => {
    const reportHtml = reportRef.current?.innerHTML || '';
    const fullHtml = `<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <title>${analysisName || (t('priceAndProductsReport') || 'Cenový Report Regálov')} - Salesapp Vision</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      @page { size: A4; margin: 12mm; }
    }
    body { font-family: system-ui, -apple-system, sans-serif; background-color: #f4f4f5; }
  </style>
</head>
<body class="p-6 flex justify-center">
  <div class="max-w-4xl w-full bg-white p-8 rounded-2xl shadow-xl">
    ${reportHtml}
  </div>
</body>
</html>`;

    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Report_${(analysisName || 'Shelf').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formattedDate = analysisDate
    ? new Date(analysisDate).toLocaleDateString(language === 'sk' ? 'sk-SK' : 'en-US')
    : new Date().toLocaleDateString(language === 'sk' ? 'sk-SK' : 'en-US');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex justify-center items-start p-2 sm:p-4 md:p-6 transition-all animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-5xl rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Top Control Bar (Hidden on print) */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 shadow-2xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                <span>{t('pdfReportTitle') || 'PDF Cenový & Regálový Report'}</span>
                <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full uppercase">
                  {t('teamExport') || 'Tímový export'}
                </span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                {t('pdfReportSubtitle') || 'Pripravený formát A4 pre tlač do PDF, zdieľanie v tíme alebo archiváciu'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Copy for Slack / Teams */}
            <button
              onClick={handleCopySummary}
              className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border shadow-2xs ${
                isCopied
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-white hover:bg-zinc-100 text-zinc-700 border-zinc-200'
              }`}
              title={t('copySummaryTitle') || 'Skopírovať zhrnutie pre Slack, MS Teams alebo e-mail'}
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{isCopied ? (t('copied') || 'Skopírované!') : (t('copySummary') || 'Kopírovať súhrn')}</span>
            </button>

            {/* Download Standalone HTML */}
            <button
              onClick={handleDownloadHtml}
              className="px-3 py-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-zinc-200 dark:border-zinc-800 shadow-2xs"
              title={t('downloadHtmlTitle') || 'Stiahnuť offline HTML verziu reportu'}
            >
              <Download className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              <span>{t('downloadHtml') || 'Stiahnuť HTML'}</span>
            </button>

            {/* Print / Save to PDF */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrintOrSavePdf}
                disabled={isGeneratingPdf}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-sm shadow-rose-200 active:scale-95 disabled:opacity-75 disabled:cursor-wait"
                title={t('printOrSavePdfTitle') || 'Vytlačiť alebo uložiť ako PDF súbor na disk'}
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>{t('preparingPdf') || 'Pripravujem PDF...'}</span>
                  </>
                ) : pdfSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>{t('pdfSaved') || 'PDF Uložené!'}</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>{t('printOrSavePdf') || 'Vytlačiť / Uložiť PDF'}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleBrowserPrint}
                className="p-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-all shadow-2xs cursor-pointer"
                title={t('directBrowserPrint') || 'Priama tlač cez prehliadač (Ctrl+P)'}
                aria-label={t('directBrowserPrint') || 'Tlač cez prehliadač'}
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 rounded-xl transition-colors cursor-pointer"
              aria-label={t('close') || 'Zavrieť'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Options Toolbar (Hidden on print) */}
        <div className="px-5 py-3 bg-zinc-100/70 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs no-print">
          <div className="flex items-center gap-2 font-bold text-zinc-600 dark:text-zinc-400">
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
            <span>{t('customizeReport') || 'Prispôsobiť report:'}</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Category filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">{t('colCategory') || 'Kategória'}:</span>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="bg-white dark:bg-zinc-900 border border-zinc-300 rounded-lg px-2 py-1 text-xs font-bold text-zinc-800 dark:text-zinc-200 focus:ring-1 focus:ring-rose-500"
              >
                <option value="ALL">{t('all') || 'Všetky'} ({allRows.length})</option>
                {categories.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Promo only toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer font-bold text-zinc-700 dark:text-zinc-300 select-none">
              <input
                type="checkbox"
                checked={includePromoOnly}
                onChange={e => setIncludePromoOnly(e.target.checked)}
                className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500"
              />
              <span>{t('promoItemsOnly', { count: kpis.promoCount }) || `Iba akciové položky (${kpis.promoCount})`}</span>
            </label>

            {/* Include thumbnails toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer font-bold text-zinc-700 dark:text-zinc-300 select-none">
              <input
                type="checkbox"
                checked={includeThumbnails}
                onChange={e => setIncludeThumbnails(e.target.checked)}
                className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500"
              />
              <span>{t('photoPreviews') || 'Náhľady fotografií'}</span>
            </label>
          </div>
        </div>

        {/* Scrollable Document Body */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-8 bg-zinc-200/50 flex justify-center custom-scrollbar">
          {/* Printable Sheet (White A4 representation) */}
          <div
            ref={reportRef}
            className="bg-white dark:bg-zinc-900 w-full max-w-4xl p-8 sm:p-10 rounded-2xl shadow-xl border border-zinc-200/80 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 space-y-6 print:shadow-none print:border-none print:p-0 print:m-0"
          >
            {/* Document Header */}
            <div className="border-b-2 border-zinc-900 pb-5 flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse"></span>
                  <span className="text-[11px] font-black uppercase tracking-widest text-rose-700">
                    SALESAPP VISION • {t('priceAndShelfAudit') || 'CENOVÝ & REGÁLOVÝ AUDIT'}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-zinc-100 tracking-tight mt-1.5">
                  {analysisName || (t('shelfPriceReportTitle') || 'Správa o cenovej analýze regálu')}
                </h1>
                <div className="flex items-center gap-3 mt-2 text-xs text-zinc-600 dark:text-zinc-400 font-semibold flex-wrap">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                    <strong>{storeName || (t('retailStore') || 'Predajňa maloobchodu')}</strong>
                    {storeAddress && <span>• {storeAddress}</span>}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{t('date') || 'Dátum'}: {formattedDate}</span>
                  </span>
                </div>
              </div>

              <div className="sm:text-right text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 sm:bg-transparent p-3 sm:p-0 rounded-xl w-full sm:w-auto border sm:border-none border-zinc-200 dark:border-zinc-800">
                <div className="font-bold text-zinc-800 dark:text-zinc-200">{t('officialTeamOutput') || 'Oficiálny výstup pre tím'}</div>
                <div>{t('generatedAt') || 'Vygenerované'}: {new Date().toLocaleString(language === 'sk' ? 'sk-SK' : 'en-US')}</div>
                <div className="text-rose-600 font-black">
                  {t('analyzedPhotosCount') || 'Analyzovaných fotografií:'} {images.length} {t('pcs') || 'ks'}
                </div>
              </div>
            </div>

            {/* Executive KPI Summary Cards */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2.5 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-rose-600" />
                <span>{t('executiveSummary') || 'Kľúčové zistenia z regálu (Executive Summary)'}</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[10px] font-bold text-zinc-400 uppercase">{t('detectedProducts') || 'Detegované produkty'}</div>
                  <div className="text-xl font-black text-zinc-950 dark:text-zinc-100 mt-0.5">{kpis.totalItems} {t('pcs') || 'ks'}</div>
                  <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                    {kpis.uniqueSkus} {t('uniqueSkusLabel') || 'unikátnych SKU'}
                  </div>
                </div>

                <div className="p-3.5 bg-rose-50/60 rounded-xl border border-rose-200/80">
                  <div className="text-[10px] font-bold text-rose-800 uppercase flex items-center justify-between">
                    <span>{t('promoGoodsCount') || 'Tovar v akcii'}</span>
                    <Percent className="w-3 h-3 text-rose-600" />
                  </div>
                  <div className="text-xl font-black text-rose-700 mt-0.5">{kpis.promoShare}%</div>
                  <div className="text-[10px] text-rose-800 font-medium mt-0.5">
                    {kpis.promoCount} {t('discountedPieces') || 'zľavnených kusov'}
                  </div>
                </div>

                <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80">
                  <div className="text-[10px] font-bold text-emerald-800 uppercase flex items-center justify-between">
                    <span>{t('priceCoverage') || 'Pokrytie cenovkami'}</span>
                    <Tag className="w-3 h-3 text-emerald-600" />
                  </div>
                  <div className="text-xl font-black text-emerald-700 mt-0.5">{kpis.priceCoverage}%</div>
                  <div className="text-[10px] text-emerald-800 font-medium mt-0.5">
                    {t('shelfOcrSuccess') || 'OCR úspešnosť regálu'}
                  </div>
                </div>

                <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/80">
                  <div className="text-[10px] font-bold text-blue-800 uppercase flex items-center justify-between">
                    <span>{t('avgRegularVsPromo') || 'Priem. bežná vs. akcia'}</span>
                    <TrendingDown className="w-3 h-3 text-blue-600" />
                  </div>
                  <div className="text-base font-black text-blue-900 mt-0.5">
                    {kpis.avgRegPrice ? `${kpis.avgRegPrice.toFixed(2)} €` : '-'}
                    {kpis.avgPromoPrice && (
                      <span className="text-xs text-rose-600 font-bold ml-1">
                        / {kpis.avgPromoPrice.toFixed(2)} €
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-blue-800 font-medium mt-0.5">
                    {kpis.avgDiscount ? `${t('discountApprox') || 'Zľava cca'} -${kpis.avgDiscount}%` : (t('priceAverage') || 'Cenový priemer')}
                  </div>
                </div>

                <div className={`p-3.5 rounded-xl border ${kpis.pendingExceptions === 0 ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-amber-50/70 border-amber-200 text-amber-900'}`}>
                  <div className="text-[10px] font-bold uppercase flex items-center justify-between">
                    <span>Audit Triage</span>
                    {kpis.pendingExceptions === 0 ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                    )}
                  </div>
                  <div className="text-base font-black mt-0.5">
                    {kpis.pendingExceptions === 0 ? (t('hundredPercentApproved') || '100% Schválené') : `${kpis.pendingExceptions} ${t('exceptionsCount') || 'výnimiek'}`}
                  </div>
                  <div className="text-[10px] opacity-80 font-medium mt-0.5">
                    {kpis.pendingExceptions === 0 ? (t('allPricesVerified') || 'Všetky ceny overené') : (t('requiresReview') || 'Vyžaduje kontrolu')}
                  </div>
                </div>
              </div>
            </div>

            {/* Promo Highlights Section */}
            {promoHighlights.length > 0 && (
              <div className="p-4 bg-gradient-to-r from-rose-50 to-orange-50 rounded-2xl border border-rose-200">
                <div className="flex items-center gap-2 mb-2.5">
                  <Sparkles className="w-4 h-4 text-rose-600" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-rose-950">
                    {t('topDiscountsAndPromos') || 'Najvýraznejšie zľavy a promo akcie na regáli'}
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {promoHighlights.map(h => (
                    <div
                      key={h.id}
                      className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-rose-150 shadow-2xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase truncate">
                            {h.brand}
                          </span>
                          {h.discountPercent && (
                            <span className="px-1.5 py-0.2 bg-rose-600 text-white rounded text-[10px] font-black">
                              -{h.discountPercent}%
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-black text-zinc-900 dark:text-zinc-100 truncate mt-0.5" title={h.name}>
                          {h.name}
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1.5 mt-2 pt-1 border-t border-zinc-100">
                        <span className="text-sm font-black text-rose-600">
                          {h.promoPrice ? `${h.promoPrice.toFixed(2)} €` : '-'}
                        </span>
                        {h.regularPrice && (
                          <span className="text-xs text-zinc-400 line-through">
                            {h.regularPrice.toFixed(2)} €
                          </span>
                        )}
                        <span className="text-[9px] text-zinc-400 ml-auto">{h.facings}{t('facingsShort') || 'x'} {t('onShelf') || 'na regáli'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Photo Thumbnails */}
            {includeThumbnails && images.length > 0 && (
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{t('sourceAuditPhotos') || 'Zdrojové fotografie auditu'} ({images.length})</span>
                </h4>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {images.slice(0, 6).map((img, idx) => (
                    <div
                      key={img.id}
                      className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 aspect-square bg-zinc-100 dark:bg-zinc-800 shadow-2xs"
                    >
                      <img
                        src={(img as any).imageUrl || ''}
                        alt={`${t('shelfPhoto') || 'Snímka regálu'} ${idx + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Note / Field Directive for Team */}
            <div className="bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs">
              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1 no-print">
                {t('teamNotesAndInstructions') || 'Poznámka a pokyny pre obchodný tím:'}
              </label>
              <textarea
                value={teamNote}
                onChange={e => setTeamNote(e.target.value)}
                rows={2}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 text-zinc-800 dark:text-zinc-200 text-xs font-medium focus:ring-1 focus:ring-rose-500 no-print"
                placeholder={t('writeInstructionsPlaceholder') || 'Napíšte pokyny pre tím...'}
              />
              {teamNote && (
                <div className="text-zinc-800 dark:text-zinc-200 italic mt-1 pt-1 border-t border-zinc-200/60 dark:border-zinc-800 print:block">
                  <strong className="not-italic text-zinc-900 dark:text-zinc-100 font-bold">{t('teamNotePrefix') || 'Poznámka pre tím: '}</strong>
                  <span>{teamNote}</span>
                </div>
              )}
            </div>

            {/* Detailed Products & Prices Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  {t('detailedProductAndPriceList') || 'Podrobný súpis tovaru a cenoviek'} ({filteredRows.length} {t('items') || 'položiek'})
                </h3>
                {selectedCategory !== 'ALL' && (
                  <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold px-2 py-0.5 rounded">
                    Filter: {selectedCategory}
                  </span>
                )}
              </div>

              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-black uppercase text-[9px] tracking-wider border-b border-zinc-200 dark:border-zinc-800">
                      <th className="py-2 px-2 text-center w-8">#</th>
                      <th className="py-2 px-2">{t('productAndSkuCol') || 'Produkt & SKU'}</th>
                      <th className="py-2 px-2">{t('colBrand') || 'Značka'}</th>
                      <th className="py-2 px-2">{t('colCategory') || 'Kategória'}</th>
                      <th className="py-2 px-2 text-center w-14">{t('facings') || 'Facingy'}</th>
                      <th className="py-2 px-2 text-right">{t('colRegularPrice') || 'Bežná cena'}</th>
                      <th className="py-2 px-2 text-right">{t('colPromoPrice') || 'Akciová cena'}</th>
                      <th className="py-2 px-2 text-center">{t('discount') || 'Zľava'}</th>
                      <th className="py-2 px-2 text-center w-14">{t('confidence') || 'Istota'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {filteredRows.slice(0, 150).map((row, idx) => (
                      <tr
                        key={row.id}
                        className={`${
                          row.isPromo ? 'bg-rose-50/20' : ''
                        } hover:bg-zinc-50/80 transition-colors`}
                      >
                        <td className="py-1.5 px-2 text-center text-zinc-400 text-[10px]">{idx + 1}</td>
                        <td className="py-1.5 px-2 font-bold text-zinc-900 dark:text-zinc-100">
                          <div className="flex items-center gap-1.5">
                            {row.isPromo && (
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                            )}
                            <span className="truncate max-w-[200px]" title={row.name}>
                              {row.name}
                            </span>
                            {row.isOurBrand && (
                              <span className="text-[8px] font-black bg-lime-100 text-lime-800 px-1 rounded uppercase">
                                {t('ourBrand') || 'Naša'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-zinc-600 dark:text-zinc-400 truncate max-w-[90px]">{row.brand}</td>
                        <td className="py-1.5 px-2 text-zinc-500 dark:text-zinc-400 truncate max-w-[90px]">{row.category}</td>
                        <td className="py-1.5 px-2 text-center font-bold text-zinc-800 dark:text-zinc-200">{row.facings}x</td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-zinc-800 dark:text-zinc-200">
                          {row.regularPrice !== null ? `${row.regularPrice.toFixed(2)} €` : '-'}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-black text-rose-600">
                          {row.promoPrice !== null ? `${row.promoPrice.toFixed(2)} €` : '-'}
                        </td>
                        <td className="py-1.5 px-2 text-center font-bold">
                          {row.discountPercent ? (
                            <span className="text-rose-600 bg-rose-100/70 px-1.5 py-0.5 rounded text-[10px]">
                              -{row.discountPercent}%
                            </span>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                          {row.confidence}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredRows.length > 150 && (
                <p className="text-center text-xs text-zinc-400 italic pt-2">
                  {t('showingFirst150Notice', { total: filteredRows.length }) || `(Zobrazených prvých 150 položiek z celkového počtu ${filteredRows.length}. Kompletné dáta nájdete v CSV exporte.)`}
                </p>
              )}
            </div>

            {/* Document Footer */}
            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-end text-[10px] text-zinc-400 gap-4">
              <div>
                <div className="font-bold text-zinc-600 dark:text-zinc-400">Salesapp Vision Retail AI Suite</div>
                <div>{t('autoRecognitionNotice') || 'Automatické rozpoznávanie produktov, cenoviek a podielu regálu (SOS / OSP)'}</div>
              </div>
              <div className="text-right">
                <div className="border-b border-zinc-300 w-48 mb-1"></div>
                <div>{t('auditorSignatureNotice') || 'Podpis vedúceho auditu / obchodného zástupcu'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfReportModal;
