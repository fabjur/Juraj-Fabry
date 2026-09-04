import React, { useRef, useState, useMemo } from 'react';
import type { ImageState } from '../hooks/useImageAnalysis';
import type { BrandClassifications, PromoAlertItem } from '../types';
import { useTranslation } from '../i18n';
import { getImageStoreName } from '../utils/helpers';
import { ArrowDownTrayIcon, DocumentTextIcon, UsersIcon } from './Icons';
import { exportPromoAlertToXLS, exportToPDF } from '../utils/export';
import { 
    Tag, 
    Percent, 
    TrendingDown, 
    Store, 
    HelpCircle, 
    ChevronDown, 
    ChevronUp, 
    AlertTriangle, 
    Check, 
    Search,
    Flame,
    AlertOctagon,
    Info,
    Sparkles
} from 'lucide-react';

interface PromoAlertPanelProps {
    images: ImageState[];
    brandClassifications: BrandClassifications;
    onOpenBrandDefinition?: () => void;
}

// Helper to extract a clean float number from price strings (e.g. "1.99 EUR", "1,49 €")
const parseNumericPrice = (pStr?: string): number | null => {
    if (!pStr) return null;
    const cleanStr = pStr.replace(/[^0-9,.]/g, '').replace(',', '.');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? null : num;
};

// Helper for consistent Slovak currency formatting
const formatPriceWithCurrency = (pStr?: string): string => {
    if (!pStr) return '—';
    const trimmed = pStr.trim();
    if (trimmed.includes('€') || trimmed.includes('EUR') || trimmed.includes('$')) {
        return trimmed;
    }
    return `${trimmed} €`;
};

const AlertCard: React.FC<{ alert: PromoAlertItem }> = ({ alert }) => {
    const { t } = useTranslation();
    let regularPrice = alert.product.prices?.find(p => p.type === 'REGULAR')?.value;
    let promoPrice = alert.product.prices?.find(p => p.type === 'PROMO')?.value;

    let numReg = parseNumericPrice(regularPrice);
    let numPromo = parseNumericPrice(promoPrice);

    // Dynamic verification & automatic swap when action price is higher than regular
    if (numReg !== null && numPromo !== null && numPromo > numReg) {
        const tempPrice = regularPrice;
        regularPrice = promoPrice;
        promoPrice = tempPrice;

        const tempNum = numReg;
        numReg = numPromo;
        numPromo = tempNum;
    }

    let savingsPercent = 0;
    let savingsAbsolute = 0;
    if (numReg && numPromo && numReg > numPromo) {
        savingsAbsolute = numReg - numPromo;
        savingsPercent = Math.round((savingsAbsolute / numReg) * 100);
    }

    const hasSavings = savingsPercent > 0;

    // Custom background and styling classes based on Promo Alert Type
    let cardBorderTheme = '';
    let categoryBadgeTheme = '';
    let discountRibbonTheme = '';
    let priceLabelTheme = '';
    let typeLabelSlovak = '';

    switch (alert.type) {
        case 'competitor_promo':
            cardBorderTheme = 'border-blue-200 hover:border-blue-400 bg-gradient-to-br from-white to-blue-50/20';
            categoryBadgeTheme = 'bg-blue-50 text-blue-800 border-blue-100';
            discountRibbonTheme = 'bg-blue-600 text-white';
            priceLabelTheme = 'text-blue-900';
            typeLabelSlovak = t('competitorPromoTag') || 'Akcia konkurencie';
            break;
        case 'our_promo':
            cardBorderTheme = 'border-emerald-200 hover:border-emerald-400 bg-gradient-to-br from-white to-emerald-50/10';
            categoryBadgeTheme = 'bg-emerald-50 text-emerald-800 border-emerald-100';
            discountRibbonTheme = 'bg-emerald-600 text-white';
            priceLabelTheme = 'text-emerald-900';
            typeLabelSlovak = t('ourActivePromoTag') || 'Naša akcia';
            break;
        case 'missing_promo':
            cardBorderTheme = 'border-amber-200 hover:border-amber-400 bg-gradient-to-br from-white to-amber-50/30';
            categoryBadgeTheme = 'bg-amber-50 text-amber-800 border-amber-100';
            discountRibbonTheme = 'bg-amber-600 text-white';
            priceLabelTheme = 'text-amber-900';
            typeLabelSlovak = t('missingPromoTagTitle') || 'Chýbajúca akčná cenovka';
            break;
    }

    return (
        <div className={`p-5 bg-white rounded-3xl border transition-all duration-300 shadow-xs hover:shadow-md hover:-translate-y-0.5 relative group overflow-hidden text-left ${cardBorderTheme}`}>
            {/* Top row: Brand & Store metadata */}
            <div className="flex justify-between items-start mb-3.5 gap-2">
                <div className="min-w-0">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border shadow-2xs ${categoryBadgeTheme}`}>
                        {typeLabelSlovak}
                    </span>
                    <p className="font-extrabold text-[10px] text-gray-400 uppercase tracking-widest mt-1.5 flex items-center gap-1">
                        <Store className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="truncate">{alert.store}</span>
                    </p>
                </div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 shrink-0">
                    {alert.product.brand || t('otherBrand') || 'Ostatné'}
                </span>
            </div>

            {/* Product description */}
            <h4 className="font-black text-gray-900 text-base leading-snug group-hover:text-lime-700 transition-colors tracking-tight line-clamp-2" title={alert.product.name}>
                {alert.product.name}
            </h4>

            {/* Pricing Section - Realistic Price Tag Mockup */}
            <div className="mt-4 pt-4 border-t border-gray-100/60">
                {alert.type === 'missing_promo' ? (
                    /* WARNING BOX FOR MISSING PROMO */
                    <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200/50 flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                        <div>
                            <p className="text-xs font-extrabold text-amber-900">{t('unidentifiedPromoPrice') || 'Vystavenie bez akciovej ceny'}</p>
                            <p className="text-[11px] text-amber-700/90 font-bold mt-0.5">
                                {t('missingPromoWarning') || 'Evidovaná iba bežná cena:'} <strong className="text-amber-900 font-extrabold">{formatPriceWithCurrency(regularPrice)}</strong>
                            </p>
                        </div>
                    </div>
                ) : (
                    /* SIDE-BY-SIDE PHYSICAL PRICE TAG VIEW FOR ACTIVE PROMOTIONS */
                    <div className="bg-yellow-50/40 p-4 rounded-2xl border border-dashed border-amber-200/80 flex items-center justify-between relative shadow-xs overflow-hidden">
                        {/* Interactive savings ribbon */}
                        {hasSavings && (
                            <span className={`absolute top-0 right-0 rounded-bl-xl px-2.5 py-1 text-[10px] font-black tracking-wider uppercase flex items-center gap-0.5 shadow-sm ${discountRibbonTheme}`}>
                                <TrendingDown className="w-3 h-3 text-white" />
                                <span>-{savingsPercent}%</span>
                            </span>
                        )}

                        <div className="space-y-1">
                            <span className="text-[9px] uppercase font-black text-amber-600 tracking-wider block">{t('promoPriceLabel') || 'Akciová cena'}</span>
                            <span className={`text-2xl font-black tracking-tight ${priceLabelTheme}`}>
                                {formatPriceWithCurrency(promoPrice)}
                            </span>
                        </div>

                        {/* Slashed-through original standard price */}
                        <div className="text-right border-l border-amber-200/50 pl-4 space-y-1">
                            <span className="text-[9px] uppercase font-black text-gray-400 tracking-wider block">{t('regularPriceLabel') || 'Bežná cena'}</span>
                            <span className="text-sm font-extrabold text-gray-400 line-through tracking-tight">
                                {formatPriceWithCurrency(regularPrice)}
                            </span>
                        </div>
                    </div>
                )}

                {/* Micro savings details */}
                {alert.type !== 'missing_promo' && hasSavings && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700 font-black bg-emerald-50 px-2.5 py-1 rounded-lg w-fit border border-emerald-100 shadow-2xs uppercase tracking-wide">
                        <Flame className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                        <span>{t('priceDiffLabel', { diff: savingsAbsolute.toFixed(2) }) || `Úspora ${savingsAbsolute.toFixed(2)} €`}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export const PromoAlertPanel: React.FC<PromoAlertPanelProps> = ({ images, brandClassifications, onOpenBrandDefinition }) => {
    const { t } = useTranslation();
    const panelRef = useRef<HTMLDivElement>(null);

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'our' | 'competitor' | 'missing'>('all');
    const [selectedStore, setSelectedStore] = useState<string>('all');
    const [isGuideOpen, setIsGuideOpen] = useState(false);

    const hasClassifications = brandClassifications.ourBrands.length > 0 || brandClassifications.competitorBrands.length > 0;

    // Generate alerts array
    const alerts = useMemo(() => {
        const generatedAlerts: PromoAlertItem[] = [];

        images.forEach(image => {
            const store = getImageStoreName(image, t('unknownStore') || 'Neznáma predajňa', null);
            if (!image.analysisResult?.products || !Array.isArray(image.analysisResult.products)) return;
            
            image.analysisResult.products.forEach(product => {
                const brand = product.brand || '';
                const isPromo = product.prices?.some(p => p.type === 'PROMO');

                if (hasClassifications) {
                    if (brandClassifications.competitorBrands.includes(brand) && isPromo) {
                        generatedAlerts.push({ type: 'competitor_promo', product, store });
                    } else if (brandClassifications.ourBrands.includes(brand)) {
                        if (isPromo) {
                            generatedAlerts.push({ type: 'our_promo', product, store });
                        } else {
                            generatedAlerts.push({ type: 'missing_promo', product, store });
                        }
                    } else if (isPromo) {
                        // Unclassified brand with promo price defaults to competitor promo
                        generatedAlerts.push({ type: 'competitor_promo', product, store });
                    }
                } else {
                    // Fallback when no brand classifications defined yet: include all promos
                    if (isPromo) {
                        generatedAlerts.push({ type: 'our_promo', product, store });
                    }
                }
            });
        });
        return generatedAlerts;
    }, [images, brandClassifications, hasClassifications, t]);

    // Available unique stores for filter dropdown
    const uniqueStores = useMemo(() => {
        return Array.from(new Set(alerts.map(a => a.store))).sort();
    }, [alerts]);

    // Live filtering for the parsed elements
    const filteredAlerts = useMemo(() => {
        return alerts.filter(alert => {
            // Store dropdown filter
            if (selectedStore !== 'all' && alert.store !== selectedStore) return false;

            // Text Search filter (matching product name, brand, or store name)
            const sLower = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm ||
                alert.product.name.toLowerCase().includes(sLower) ||
                (alert.product.brand && alert.product.brand.toLowerCase().includes(sLower)) ||
                alert.store.toLowerCase().includes(sLower);

            if (!matchesSearch) return false;

            // Tab selection filter
            if (activeFilterTab === 'our') return alert.type === 'our_promo';
            if (activeFilterTab === 'competitor') return alert.type === 'competitor_promo';
            if (activeFilterTab === 'missing') return alert.type === 'missing_promo';
            return true;
        });
    }, [alerts, searchTerm, activeFilterTab, selectedStore]);

    // Compute dynamic KPI stats for summary cards
    const stats = useMemo(() => {
        let totalPromoDiscountPercentSum = 0;
        let countWithBothPrices = 0;

        alerts.forEach(a => {
            if (a.type !== 'missing_promo') {
                const reg = parseNumericPrice(a.product.prices?.find(p => p.type === 'REGULAR')?.value);
                const pro = parseNumericPrice(a.product.prices?.find(p => p.type === 'PROMO')?.value);
                if (reg && pro && reg > pro) {
                    const diff = reg - pro;
                    totalPromoDiscountPercentSum += (diff / reg) * 100;
                    countWithBothPrices++;
                }
            }
        });

        const avgDiscount = countWithBothPrices > 0 ? Math.round(totalPromoDiscountPercentSum / countWithBothPrices) : 0;
        const competitorPromosCount = alerts.filter(a => a.type === 'competitor_promo').length;
        const ourPromosCount = alerts.filter(a => a.type === 'our_promo').length;
        const missingPromosCount = alerts.filter(a => a.type === 'missing_promo').length;

        return {
            avgDiscount,
            competitorPromosCount,
            ourPromosCount,
            missingPromosCount,
            totalActiveCount: competitorPromosCount + ourPromosCount
        };
    }, [alerts]);

    const competitorAlertsFiltered = filteredAlerts.filter(a => a.type === 'competitor_promo');
    const ourActiveAlertsFiltered = filteredAlerts.filter(a => a.type === 'our_promo');
    const missingPromoAlertsFiltered = filteredAlerts.filter(a => a.type === 'missing_promo');

    return (
        <div ref={panelRef} className="space-y-8 printable-content animate-fade-in text-left">
            
            {/* Header section with branding & custom exports */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print border-b border-gray-100 pb-5">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
                        <div className="p-3 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl shadow-xs border border-amber-200/50">
                            <Tag className="w-6 h-6 text-amber-700" />
                        </div>
                        {t('promoAlert') || 'Promócie a akčné ponuky'}
                    </h2>
                    <p className="text-xs text-gray-500 font-bold mt-1">
                        {t('promoAlertSubtitle') || 'Prehľad akciových cien, letákových kampaní a chýbajúcich promo označení na predajniach.'}
                    </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {onOpenBrandDefinition && (
                        <button
                            onClick={onOpenBrandDefinition}
                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/80 shadow-xs"
                        >
                            <UsersIcon className="w-4 h-4 text-amber-600" />
                            <span>{t('defineBrandsTitle') || 'Zaradenie značiek'}</span>
                        </button>
                    )}
                    {alerts.length > 0 && (
                        <>
                            <button
                                onClick={() => exportPromoAlertToXLS(alerts, t)}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all bg-lime-600 text-white hover:bg-lime-700 shadow-md shadow-lime-200 active:scale-95"
                                aria-label={t('exportToXLS')}
                            >
                                <ArrowDownTrayIcon className="w-4 h-4" />
                                {t('exportToXLS')}
                            </button>
                            <button
                                onClick={() => exportToPDF(panelRef.current)}
                                className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all bg-gray-900 text-white hover:bg-black shadow-md shadow-gray-200 active:scale-95"
                                aria-label={t('exportToPDF')}
                            >
                                <DocumentTextIcon className="w-4 h-4" />
                                {t('exportToPDF')}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Classification recommendation banner when no brands classified */}
            {!hasClassifications && images.length > 0 && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-3xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs no-print">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 bg-blue-600 rounded-2xl text-white shadow-xs shrink-0 mt-0.5">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="font-extrabold text-sm text-blue-950">
                                {t('defineBrandsPromptTitle') || 'Chcete oddeliť vaše akcie od akcií konkurencie?'}
                            </h4>
                            <p className="text-xs text-blue-700/90 font-medium mt-0.5">
                                {t('defineBrandsPromptDesc') || 'Označte vaše vlastné značky pre presnú analýzu akcií konkurencie a kontrolu pokrytia promo cenovkami.'}
                            </p>
                        </div>
                    </div>
                    {onOpenBrandDefinition && (
                        <button
                            onClick={onOpenBrandDefinition}
                            className="px-5 py-2.5 bg-blue-600 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200 shrink-0 self-stretch md:self-auto"
                        >
                            {t('defineBrandsTitle') || 'Rozradiť značky'}
                        </button>
                    )}
                </div>
            )}

            {/* INTERACTIVE GUIDE ON CHECKING PROMOTIONS */}
            <div className="bg-gradient-to-r from-amber-50/50 to-orange-50/30 rounded-3xl p-6 border border-amber-100/60 shadow-xs no-print">
                <div 
                    onClick={() => setIsGuideOpen(!isGuideOpen)}
                    className="flex justify-between items-center cursor-pointer select-none"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-600 rounded-xl text-white">
                            <HelpCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-sm text-amber-900 uppercase tracking-wider">
                                {t('promoGuideTitle') || 'Návod na prácu s modulom Promócií'}
                            </h3>
                            <p className="text-xs text-amber-650 font-bold mt-0.5">
                                {t('promoGuideSubtitle') || 'Postup pre správnu interpretáciu akciových cien a promo podkladov'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-amber-700 bg-amber-100/60 px-2.5 py-1 rounded-lg">
                            {isGuideOpen ? (t('hideInfo') || 'Skryť') : (t('showInfo') || 'Zobraziť tipy')}
                        </span>
                        {isGuideOpen ? (
                            <ChevronUp className="w-4 h-4 text-amber-800" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-amber-800" />
                        )}
                    </div>
                </div>

                {isGuideOpen && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 pt-5 border-t border-amber-200/30 text-left">
                        {/* Step 1 */}
                        <div className="bg-white p-5 rounded-2xl border border-amber-100/30 shadow-xs flex flex-col justify-between">
                            <div>
                                <span className="text-[10px] uppercase tracking-widest bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg font-black">
                                    {t('step1') || '1. Krok'}
                                </span>
                                <h4 className="font-extrabold text-xs text-gray-900 mt-3 mb-1">{t('step1Title') || 'Identifikácia akcií'}</h4>
                                <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">
                                    {t('step1Desc') || 'Systém vyhodnocuje špeciálne akčné vysačky, letáky a porovnáva bežnú cenovku s akčnou.'}
                                </p>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="bg-white p-5 rounded-2xl border border-amber-100/30 shadow-xs flex flex-col justify-between">
                            <div>
                                <span className="text-[10px] uppercase tracking-widest bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg font-black">
                                    {t('step2') || '2. Krok'}
                                </span>
                                <h4 className="font-extrabold text-xs text-gray-900 mt-3 mb-1">{t('step2Title') || 'Sledovanie konkurencie'}</h4>
                                <p className="text-[11px] text-gray-550 leading-relaxed font-semibold">
                                    {t('step2Desc') || 'Akcie konkurenčných značiek sú automaticky zatriedené do samostatného modulu.'}
                                </p>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="bg-white p-5 rounded-2xl border border-amber-100/30 shadow-xs flex flex-col justify-between">
                            <div>
                                <span className="text-[10px] uppercase tracking-widest bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg font-black">
                                    {t('step3') || '3. Krok'}
                                </span>
                                <h4 className="font-extrabold text-xs text-gray-900 mt-3 mb-1">{t('step3Title') || 'Chýbajúce oznamy'}</h4>
                                <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">
                                    {t('step3Desc') || 'Varovanie pri produktoch, ktoré majú mať plánovanú akciu, ale na regáli chýba akčná cenovka.'}
                                </p>
                            </div>
                        </div>

                        {/* Step 4 */}
                        <div className="bg-white p-5 rounded-2xl border border-amber-100/30 shadow-xs flex flex-col justify-between">
                            <div>
                                <span className="text-[10px] uppercase tracking-widest bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg font-black">
                                    {t('step4') || '4. Krok'}
                                </span>
                                <h4 className="font-extrabold text-xs text-gray-900 mt-3 mb-1">{t('step4Title') || 'Export & Reporty'}</h4>
                                <p className="text-[11px] text-gray-550 leading-relaxed font-semibold">
                                    {t('step4Desc') || 'Výsledné zistenia môžete jedným kliknutím exportovať do Excelu alebo PDF reportu.'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* KPI STATS BAR */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-left">
                {/* 1. Average discount percentage */}
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 rounded-3xl text-white shadow-md shadow-amber-200/50 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-100">{t('avgDiscount') || 'Priemerné zníženie'}</span>
                        <div className="p-1.5 bg-white/25 rounded-lg">
                            <Percent className="w-4 h-4 text-white" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <span className="text-4xl font-black">-{stats.avgDiscount}%</span>
                        <p className="text-[10px] text-amber-100/90 font-bold mt-1 shadow-sm uppercase tracking-wide">
                            {t('priceReductionDesc') || 'Priemerná zľava pri akčných cenách'}
                        </p>
                    </div>
                </div>

                {/* 2. Total active tracked */}
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('totalActivePromos') || 'Spolu akčných položiek'}</span>
                        <div className="p-1.5 bg-gray-50 text-gray-500 rounded-lg border border-gray-150">
                            <Flame className="w-4 h-4 text-amber-600" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <span className="text-3xl font-black text-gray-900">{stats.totalActiveCount} {t('pcs') || 'ks'}</span>
                        <p className="text-[11px] text-gray-500 font-bold mt-1">
                            {t('ourAndCompetitorSum') || 'Súčet našich a konkurenčných akčných cien'}
                        </p>
                    </div>
                </div>

                {/* 3. Our active promotions */}
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{t('ourCampaigns') || 'Naše aktívne akcie'}</span>
                        <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                            <Check className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <span className="text-3xl font-black text-emerald-800">{stats.ourPromosCount} {t('pcs') || 'ks'}</span>
                        <p className="text-[11px] text-gray-500 font-bold mt-1">
                            {t('activatedInStores') || 'Správne označené v predajniach'}
                        </p>
                    </div>
                </div>

                {/* 4. Missing banner opportunities */}
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between font-bold text-left">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">{t('missingSupport') || 'Chýbajúce promo'}</span>
                        <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
                            <AlertOctagon className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <span className="text-3xl font-black text-amber-800">{stats.missingPromosCount} {t('pcs') || 'ks'}</span>
                        <p className="text-[11px] text-gray-500 font-bold mt-1">
                            {t('ourSkuRegularOnly') || 'Produkty len s bežnou cenovkou'}
                        </p>
                    </div>
                </div>
            </div>

            {/* TOOL AND FILTERING SEGMENT - NO-PRINT */}
            <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-150/60 shadow-inner no-print flex flex-col lg:flex-row gap-4 items-center justify-between">
                
                {/* Interactive Pills for Filters */}
                <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-gray-150 shadow-xs w-full lg:w-auto">
                    <button
                        onClick={() => setActiveFilterTab('all')}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeFilterTab === 'all' ? 'bg-gray-900 text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        {t('allPromosTab', { count: alerts.length }) || `Všetky akcie (${alerts.length})`}
                    </button>
                    <button
                        onClick={() => setActiveFilterTab('our')}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeFilterTab === 'our' ? 'bg-emerald-600 text-white shadow-xs animate-fade-in' : 'text-emerald-650 hover:bg-emerald-50/50'}`}
                    >
                        {t('ourPromosTab', { count: stats.ourPromosCount }) || `Naše akcie (${stats.ourPromosCount})`}
                    </button>
                    <button
                        onClick={() => setActiveFilterTab('competitor')}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${activeFilterTab === 'competitor' ? 'bg-blue-600 text-white shadow-xs animate-fade-in' : 'text-blue-650 hover:bg-blue-50/50'}`}
                    >
                        {t('competitorPromosTab', { count: stats.competitorPromosCount }) || `Konkurencia (${stats.competitorPromosCount})`}
                    </button>
                    <button
                        onClick={() => setActiveFilterTab('missing')}
                        className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide transition-all ${activeFilterTab === 'missing' ? 'bg-amber-600 text-white shadow-xs animate-fade-in' : 'text-amber-650 hover:bg-amber-50/50'}`}
                    >
                        {t('missingPromosTab', { count: stats.missingPromosCount }) || `Chýbajúce akcie (${stats.missingPromosCount})`}
                    </button>
                </div>

                {/* Filters right side: Store selector & Search Text Input */}
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                    {/* Store Filter Dropdown */}
                    {uniqueStores.length > 1 && (
                        <div className="relative w-full sm:w-52">
                            <select
                                value={selectedStore}
                                onChange={(e) => setSelectedStore(e.target.value)}
                                className="w-full bg-white border border-gray-250 rounded-2xl py-2.5 pl-3 pr-8 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-lime-500 appearance-none cursor-pointer"
                            >
                                <option value="all">{t('allStoresOption') || 'Všetky predajne'}</option>
                                {uniqueStores.map(st => (
                                    <option key={st} value={st}>{st}</option>
                                ))}
                            </select>
                            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
                        </div>
                    )}

                    {/* Search Text Input */}
                    <div className="relative w-full sm:w-64">
                        <input
                            type="text"
                            placeholder={t('searchByProductBrandStore') || 'Hľadať produkt, značku, predajňu...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-gray-250 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-bold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lime-500 transition-all border-dashed"
                        />
                        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3.5 top-2.5 text-gray-400 hover:text-gray-700 font-bold text-[10px] bg-gray-100 px-2 py-0.5 rounded-lg"
                            >
                                {t('clearSearch') || 'Vymazať'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* MAIN DATA COLUMNS / RESULTS PREVIEW */}
            {filteredAlerts.length > 0 ? (
                activeFilterTab === 'all' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Competitor promotions column */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-3">
                                <span className="text-xs font-black uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                    {t('competitorPromosCol') || 'Akcie konkurencie'}
                                </span>
                                <span className="text-xs text-gray-400 font-bold">
                                    {t('itemsCountCol', { count: competitorAlertsFiltered.length }) || `${competitorAlertsFiltered.length} položiek`}
                                </span>
                            </div>
                            <div className="space-y-4 max-h-[750px] overflow-y-auto pr-1 custom-scrollbar">
                                {competitorAlertsFiltered.length > 0 ? (
                                    competitorAlertsFiltered.map((alert, i) => (
                                        <AlertCard key={`comp-${alert.product.id}-${i}`} alert={alert} />
                                    ))
                                ) : (
                                    <div className="text-center py-10 bg-gray-50/55 rounded-2xl border border-dashed border-gray-200 text-xs text-gray-400 font-bold">
                                        {t('noRecordedCompetitorPromos') || 'Neboli zistené žiadne akcie konkurencie.'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Our active promotions column */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-3">
                                <span className="text-xs font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                                    {t('ourActivePromosCol') || 'Naše aktívne akcie'}
                                </span>
                                <span className="text-xs text-gray-400 font-bold">
                                    {t('itemsCountCol', { count: ourActiveAlertsFiltered.length }) || `${ourActiveAlertsFiltered.length} položiek`}
                                </span>
                            </div>
                            <div className="space-y-4 max-h-[750px] overflow-y-auto pr-1 custom-scrollbar">
                                {ourActiveAlertsFiltered.length > 0 ? (
                                    ourActiveAlertsFiltered.map((alert, i) => (
                                        <AlertCard key={`our-${alert.product.id}-${i}`} alert={alert} />
                                    ))
                                ) : (
                                    <div className="text-center py-10 bg-gray-50/55 rounded-2xl border border-dashed border-gray-200 text-xs text-gray-400 font-bold">
                                        {t('noRecordedOurPromos') || 'Neboli zistené žiadne naše akcie.'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Missing promotions column */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-3">
                                <span className="text-xs font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                                    {t('missingSupportCol') || 'Chýbajúce promo cenovky'}
                                </span>
                                <span className="text-xs text-gray-400 font-bold">
                                    {t('itemsCountCol', { count: missingPromoAlertsFiltered.length }) || `${missingPromoAlertsFiltered.length} položiek`}
                                </span>
                            </div>
                            <div className="space-y-4 max-h-[750px] overflow-y-auto pr-1 custom-scrollbar flex-1">
                                {missingPromoAlertsFiltered.length > 0 ? (
                                    missingPromoAlertsFiltered.map((alert, i) => (
                                        <AlertCard key={`miss-${alert.product.id}-${i}`} alert={alert} />
                                    ))
                                ) : (
                                    <div className="text-center py-10 bg-gray-50/55 rounded-2xl border border-dashed border-gray-200 text-xs text-gray-400 font-bold">
                                        {t('noMissingPromoSupport') || 'Žiadne chýbajúce akčné cenovky.'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* FLUID BENTO GRID FOR INDIVIDUAL FILTER TABS */
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <span className={`text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-xl border shadow-2xs ${
                                activeFilterTab === 'our' ? 'text-emerald-700 bg-emerald-50 border-emerald-100' :
                                activeFilterTab === 'competitor' ? 'text-blue-700 bg-blue-50 border-blue-100' :
                                'text-amber-700 bg-amber-50 border-amber-100'
                            }`}>
                                {activeFilterTab === 'our' ? (t('ourActivePromosCol') || 'Naše akcie') :
                                 activeFilterTab === 'competitor' ? (t('competitorPromosCol') || 'Akcie konkurencie') :
                                 (t('missingSupportCol') || 'Chýbajúce promo cenovky')}
                            </span>
                            <span className="text-xs text-gray-400 font-extrabold bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-150">
                                {t('totalItemsDisplayed', { count: filteredAlerts.length }) || `Zobrazených: ${filteredAlerts.length}`}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredAlerts.map((alert, i) => (
                                <AlertCard key={`tab-${alert.product.id}-${i}`} alert={alert} />
                            ))}
                        </div>
                    </div>
                )
            ) : (
                <div className="text-center py-20 bg-gray-50 rounded-[2rem] border border-dashed border-gray-200 flex flex-col items-center justify-center animate-fade-in mx-4">
                    <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-sm border border-gray-100">
                        <Info className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-lg font-black text-gray-900 mb-2">{t('noPromosMatchFilter') || 'Žiadne akcie nezodpovedajú zvolenému filtru'}</p>
                    <p className="text-xs text-gray-400/90 font-bold max-w-md leading-relaxed">
                        {t('clearSearchHint') || 'Skúste vymazať vyhľadávací výraz alebo zmeniť výber predajne / záložky.'}
                    </p>
                </div>
            )}
        </div>
    );
};
