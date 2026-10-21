import React, { useState } from 'react';
import type { Analysis, BrandClassifications, SingleShareMetric } from '../types.ts';
import type { ImageState } from '../hooks/useImageAnalysis.ts';
import { calculateAuditMetrics } from '../utils/auditMetrics.ts';
import { exportPriceMonitoringToXLS, exportToPDF } from '../utils/export.ts';
import { useTranslation } from '../i18n/index.tsx';
import {
  FileDown,
  FileSpreadsheet,
  Printer,
  Copy,
  Check,
  X,
  SlidersHorizontal,
  ShieldCheck,
  Loader2,
  Calendar,
  Store as StoreIcon
} from 'lucide-react';

export interface AuditExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: ImageState[];
  activeAnalysis: Analysis | null;
  brandClassifications?: BrandClassifications;
  activeFilters?: {
    searchTerm?: string;
    category?: string;
    chain?: string;
    minPrice?: string;
    maxPrice?: string;
    confidence?: number;
    hideGhosts?: boolean;
    posFilter?: string;
  };
}

export const AuditExportModal: React.FC<AuditExportModalProps> = ({
  isOpen,
  onClose,
  images,
  activeAnalysis,
  brandClassifications,
  activeFilters = {},
}) => {
  const { t, language } = useTranslation();
  const [exportFormat, setExportFormat] = useState<'pdf' | 'xlsx' | 'csv'>('pdf');
  const [exportScope, setExportScope] = useState<'all' | 'filtered' | 'exceptions'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  // Calculate audit metrics using shared calculation engine
  const metrics = calculateAuditMetrics(images, activeAnalysis, {}, brandClassifications);

  // Active filter count and human readable summary
  const activeFiltersList: string[] = [];
  if (activeFilters.searchTerm?.trim()) activeFiltersList.push(`${t('search') || 'Hľadanie'}: "${activeFilters.searchTerm}"`);
  if (activeFilters.category) activeFiltersList.push(`${t('colCategory') || 'Kategória'}: ${activeFilters.category}`);
  if (activeFilters.chain) activeFiltersList.push(`${t('colStoreChain') || 'Reťazec'}: ${activeFilters.chain}`);
  if (activeFilters.minPrice) activeFiltersList.push(`Min. ${t('price') || 'cena'}: ${activeFilters.minPrice} €`);
  if (activeFilters.maxPrice) activeFiltersList.push(`Max. ${t('price') || 'cena'}: ${activeFilters.maxPrice} €`);
  if (activeFilters.hideGhosts) activeFiltersList.push(t('hiddenVirtualItems') || 'Skryté neoverené / virtuálne položky');
  if (activeFilters.posFilter && activeFilters.posFilter !== 'all') {
    const posLabel = activeFilters.posFilter === 'products_only' ? (t('productsOnly') || 'Products only')
      : activeFilters.posFilter === 'pos_only' ? (t('posOnly') || 'POS materials only')
      : activeFilters.posFilter === 'wobbler' ? (t('posWobbler') || 'POS: Wobblers')
      : activeFilters.posFilter === 'stopper' ? (t('posStopper') || 'POS: Stoppers')
      : activeFilters.posFilter === 'stand' ? (t('posStand') || 'POS: Stands')
      : activeFilters.posFilter === 'pallet' ? (t('posPallet') || 'POS: Pallets')
      : `POS: ${activeFilters.posFilter}`;
    activeFiltersList.push(posLabel);
  }

  const storeName = activeAnalysis?.store?.name || t('retailStore') || 'Maloobchodná predajňa';
  const auditDateStr = activeAnalysis?.createdAt 
    ? new Date(activeAnalysis.createdAt).toLocaleDateString(language === 'sk' ? 'sk-SK' : 'en-US')
    : new Date().toLocaleDateString(language === 'sk' ? 'sk-SK' : 'en-US');

  const handleExecuteExport = async () => {
    setIsExporting(true);
    try {
      if (exportFormat === 'pdf') {
        const printableElement = document.querySelector('.printable-content') as HTMLElement || document.body;
        await exportToPDF(printableElement, {
          title: `${t('shelfAudit') || 'Audit regálu'} - ${storeName}`,
          fileName: `Audit_${storeName.replace(/\s+/g, '_')}_${auditDateStr}.pdf`,
          orientation: 'portrait'
        });
      } else if (exportFormat === 'xlsx') {
        exportPriceMonitoringToXLS(images, t, activeAnalysis?.store?.name || undefined);
      } else if (exportFormat === 'csv') {
        // Generate CSV with BOM and active filters header
        const delimiter = ';';
        const lines: string[] = [];
        lines.push(`${t('shelfAudit') || 'AUDIT REGÁLU'}: ${storeName}`);
        lines.push(`${t('date') || 'DÁTUM'}: ${auditDateStr}`);
        lines.push(`${t('scope') || 'ROZSAH'}: ${exportScope === 'all' ? (t('wholeAudit') || 'Celý audit') : exportScope === 'filtered' ? (t('filteredData') || 'Vyfiltrované dáta') : (t('exceptionsOnly') || 'Len výnimky')}`);
        lines.push(`${t('verificationStatus') || 'STAV OVERENIA'}: ${t('verified') || 'Overené'}: ${metrics.verifiedCount + metrics.autoAcceptedCount}/${metrics.totalFacings} (${metrics.verificationProgressPercent}%)`);
        if (activeFiltersList.length > 0) {
          lines.push(`${t('activeFilters') || 'AKTÍVNE FILTRE'}: ${activeFiltersList.join(', ')}`);
        }
        lines.push('');
        lines.push([
          t('productSku') || 'Produkt / SKU',
          t('brand') || 'Značka',
          t('category') || 'Kategória',
          t('regularPrice') || 'Bežná cena',
          t('promoPrice') || 'Akciová cena',
          t('facings') || 'Facingy',
          t('verificationStatus') || 'Stav overenia',
          t('photo') || 'Fotografia'
        ].join(delimiter));

        images.forEach(img => {
          (img.analysisResult?.products || []).forEach(p => {
            if (p.isGhost && activeFilters.hideGhosts) return;
            if (exportScope === 'exceptions') {
              const hasNoPrice = !p.prices || p.prices.length === 0;
              const isUncertain = (p.confidence ?? 0.85) < 0.8;
              if (!hasNoPrice && !isUncertain && p.verificationStatus === 'human_verified') return;
            }
            if (exportScope === 'filtered') {
              if (activeFilters.category && p.category !== activeFilters.category) return;
              if (activeFilters.searchTerm && !p.name.toLowerCase().includes(activeFilters.searchTerm.toLowerCase())) return;
            }

            const regPrice = p.prices?.find(pr => pr.type === 'REGULAR')?.value || '-';
            const promoPrice = p.prices?.find(pr => pr.type === 'PROMO')?.value || '-';
            const statusLabel = p.verificationStatus === 'human_verified' ? (t('humanVerified') || 'Overené človekom') :
                                p.verificationStatus === 'auto_accepted' ? (t('autoAccepted') || 'Automaticky prijaté') :
                                p.verificationStatus === 'unresolvable' ? (t('unresolvable') || 'Nevyhodnotiteľné') : (t('needsReview') || 'Na kontrolu');

            lines.push([
              `"${(p.name || '').replace(/"/g, '""')}"`,
              `"${(p.brand || '').replace(/"/g, '""')}"`,
              `"${(p.category || '').replace(/"/g, '""')}"`,
              regPrice,
              promoPrice,
              p.facings || 1,
              statusLabel,
              `"${img.file?.name || ''}"`
            ].join(delimiter));
          });
        });

        const csvContent = '\uFEFF' + lines.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Audit_${storeName.replace(/\s+/g, '_')}_${auditDateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      onClose();
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopySummary = () => {
    const summaryText = `${t('shelfAudit') || 'AUDIT REGÁLU'} - ${storeName} (${auditDateStr})
- ${t('totalFacingsCount') || 'Celkovo facingov:'} ${metrics.totalFacings} ${t('pcs') || 'ks'}
- ${t('uniqueSkusLabel') || 'Unikátnych SKU'}: ${metrics.uniqueSkusCount}
- ${t('priceCoverage') || 'Pokrytie cenoviek'}: ${metrics.priceCoveragePercent}% (${metrics.withPriceCount} ${t('identifiedPrices') || 'zistených cien'})
- ${t('dataVerificationStatus') || 'Stav overenia dát'}: ${metrics.verificationProgressPercent}% ${t('verified') || 'overených'} (${metrics.verifiedCount} ${t('byHuman') || 'človekom'}, ${metrics.autoAcceptedCount} ${t('automatically') || 'automaticky'})
- ${t('itemsForReview') || 'Položky na kontrolu'}: ${metrics.pendingReviewCount} ${t('pcs') || 'ks'}
- ${t('categoryShares') || 'Podiely kategórií'}: ${metrics.categoryShares.slice(0, 3).map((c: SingleShareMetric) => `${c.category}: ${c.facingSharePercent}%`).join(', ')}
${activeFiltersList.length > 0 ? `\n${t('activeFilters') || 'Aplikované filtre'}: ${activeFiltersList.join(', ')}` : ''}`;

    navigator.clipboard.writeText(summaryText);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in no-print">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-xl w-full border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-zinc-900 text-white flex items-center justify-between border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-lime-400 text-zinc-950 dark:text-zinc-100 rounded-xl font-black">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">{t('exportAuditResults') || 'Exportovať výsledky auditu'}</h3>
              <p className="text-xs text-zinc-400">
                {t('exportAuditDesc') || 'Jednotný export s overením dát a aktívnymi filtrami'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label={t('close') || "Zavrieť"}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1 text-xs">
          {/* Audit Metadata Context Card */}
          <div className="bg-zinc-50 dark:bg-zinc-800/60 p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-zinc-700 dark:text-zinc-300">
            <div className="flex items-center gap-2">
              <StoreIcon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{storeName}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium">
              <Calendar className="w-3.5 h-3.5" />
              <span>{auditDateStr}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 font-mono text-[11px]">
              <span className="text-zinc-500 dark:text-zinc-400">{t('facingsShort') || 'Facingy'}:</span>
              <strong className="text-zinc-900 dark:text-zinc-100">{metrics.totalFacings} ks</strong>
            </div>
          </div>

          {/* Verification Status Pill */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/70 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold text-emerald-950">{t('dataVerificationStatus') || 'Stav overenia dát'}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-bold text-emerald-800">
                {metrics.verificationProgressPercent}% {t('verified') || 'overené'}
              </span>
              <span className="text-zinc-400 font-mono">
                ({metrics.verifiedCount} {t('byHuman') || 'človekom'} / {metrics.pendingReviewCount} {t('forReview') || 'na kontrolu'})
              </span>
            </div>
          </div>

          {/* Active Filters Display */}
          {activeFiltersList.length > 0 && (
            <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-2xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{t('activeAuditFiltersNotice') || 'Aktívne filtre auditu (budú zaznamenané v exporte):'}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeFiltersList.map((f, i) => (
                  <span key={i} className="px-2 py-0.5 bg-white dark:bg-zinc-900 text-amber-950 text-[10px] font-semibold rounded-md border border-amber-200">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 1. Format Selection */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
              1. {t('fileFormat') || 'Formát súboru'}
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setExportFormat('pdf')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-22 ${
                  exportFormat === 'pdf'
                    ? 'border-zinc-900 bg-zinc-900 text-white shadow-md'
                    : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800'
                }`}
              >
                <Printer className={`w-5 h-5 ${exportFormat === 'pdf' ? 'text-lime-400' : 'text-zinc-500'}`} />
                <div>
                  <p className="font-bold text-xs">PDF Report</p>
                  <p className={`text-[10px] ${exportFormat === 'pdf' ? 'text-zinc-300' : 'text-zinc-500'}`}>{t('printAndManagement') || 'Tlač & Manažment'}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('xlsx')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-22 ${
                  exportFormat === 'xlsx'
                    ? 'border-zinc-900 bg-zinc-900 text-white shadow-md'
                    : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800'
                }`}
              >
                <FileSpreadsheet className={`w-5 h-5 ${exportFormat === 'xlsx' ? 'text-lime-400' : 'text-emerald-600'}`} />
                <div>
                  <p className="font-bold text-xs">Excel (.xlsx)</p>
                  <p className={`text-[10px] ${exportFormat === 'xlsx' ? 'text-zinc-300' : 'text-zinc-500'}`}>{t('structuredTable') || 'Štruktúrovaná tabuľka'}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('csv')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-22 ${
                  exportFormat === 'csv'
                    ? 'border-zinc-900 bg-zinc-900 text-white shadow-md'
                    : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-800'
                }`}
              >
                <FileDown className={`w-5 h-5 ${exportFormat === 'csv' ? 'text-lime-400' : 'text-blue-600'}`} />
                <div>
                  <p className="font-bold text-xs">{t('csvFormat') || 'CSV formát'}</p>
                  <p className={`text-[10px] ${exportFormat === 'csv' ? 'text-zinc-300' : 'text-zinc-500'}`}>{t('dataForErpBi') || 'Dáta pre ERP / BI'}</p>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Scope Selection */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
              2. {t('exportScope') || 'Rozsah exportovaných dát'}
            </label>
            <div className="space-y-1.5">
              {[
                { id: 'all', title: t('wholeAudit') || 'Celý audit', desc: `${t('allRecognizedProducts') || 'Všetky rozpoznané produkty'} (${metrics.totalFacings} ${t('facingsShort') || 'facingov'})` },
                { id: 'filtered', title: t('onlyFilteredItems') || 'Iba vyfiltrované položky', desc: t('respectsActiveFilters') || 'Rešpektuje aktívne zobrazené kategórie a vyhľadávanie' },
                { id: 'exceptions', title: t('onlyExceptionsAndReview') || 'Iba výnimky a položky na kontrolu', desc: `${t('missingPricesAnomalies') || 'Chýbajúce ceny, anomálie a neisté SKU'} (${metrics.pendingReviewCount + metrics.missingPriceCount} ${t('recordsShort') || 'záznamov'})` }
              ].map(scope => (
                <label
                  key={scope.id}
                  className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                    exportScope === scope.id
                      ? 'border-zinc-900 bg-zinc-50 shadow-2xs'
                      : 'border-zinc-200 hover:bg-zinc-50/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="exportScope"
                    checked={exportScope === scope.id}
                    onChange={() => setExportScope(scope.id as any)}
                    className="mt-0.5 text-zinc-900 dark:text-zinc-100 focus:ring-zinc-900"
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-900 dark:text-zinc-100 text-xs">{scope.title}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{scope.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-800/60 border-t border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer text-xs"
            title={t('copySummaryClipboard') || 'Kopírovať súhrnný text do schránky'}
          >
            {copySuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />}
            <span>{copySuccess ? (t('copied') || 'Skopírované!') : (t('copySummary') || 'Kopírovať súhrn')}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 font-bold transition-colors cursor-pointer text-xs"
            >
              {t('cancel') || 'Zrušiť'}
            </button>
            <button
              type="button"
              onClick={handleExecuteExport}
              disabled={isExporting}
              className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50 text-xs"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-lime-400" />
                  <span>{t('generatingExport') || 'Generujem export...'}</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 text-lime-400" />
                  <span>{t('downloadFile') || 'Stiahnuť súbor'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditExportModal;
