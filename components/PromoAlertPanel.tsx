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
     
     
    HelpCircle, 
    ChevronDown, 
    ChevronUp, 
     
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

// Helper to extract a clean float number from price strings (e.g. "1.99 EUR", "1,49 ")
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
                if (!product || product.isDiscarded || product.type === 'pos_material' || product.isGhost) return;
                const brand = product.brand || '';
                const isPromo = Boolean(
                  (typeof product.promoPrice === 'number' && product.promoPrice > 0) ||
                  product.prices?.some(p => {
                    const tUpper = (p.type || '').toUpperCase();
                    return tUpper.includes('PROMO') || tUpper.includes('AKCIA') || tUpper.includes('ACTION');
                  })
                );

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
                const reg = typeof a.product.regularPrice === 'number' && a.product.regularPrice > 0 
                  ? a.product.regularPrice 
                  : parseNumericPrice(a.product.prices?.find(p => p.type === 'REGULAR')?.value);
                const pro = typeof a.product.promoPrice === 'number' && a.product.promoPrice > 0 
                  ? a.product.promoPrice 
                  : parseNumericPrice(a.product.prices?.find(p => p.type === 'PROMO')?.value);
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
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">{t('avgDiscount') || 'Priemerné zníženie'}</span>
                        <div className="p-1.5 bg-amber-50 rounded-lg border border-amber-100">
                            <Percent className="w-4 h-4 text-amber-600" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <span className="text-4xl font-black text-amber-600">-{stats.avgDiscount}%</span>
                        <p className="text-[10px] text-gray-500 font-bold mt-1 shadow-sm uppercase tracking-wide">
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

                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden w-full">
                    <div className="overflow-x-auto max-h-[750px] custom-scrollbar">
                        <table className="w-full text-left border-collapse text-[11px] font-sans">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-gray-50/95 backdrop-blur-xs text-[9px] font-black uppercase text-gray-500 tracking-wider border-b border-gray-200">
                                    <th className="px-4 py-3 whitespace-nowrap">{t('storeCol') || 'Predajňa'}</th>
                                    <th className="px-4 py-3 whitespace-nowrap">{t('brandCol') || 'Značka'}</th>
                                    <th className="px-4 py-3 whitespace-nowrap">{t('productCol') || 'Produkt'}</th>
                                    <th className="px-4 py-3 whitespace-nowrap text-center">{t('typeCol') || 'Typ'}</th>
                                    <th className="px-4 py-3 whitespace-nowrap text-right">{t('regularPriceCol') || 'Bežná cena'}</th>
                                    <th className="px-4 py-3 whitespace-nowrap text-right">{t('promoPriceCol') || 'Akciová cena'}</th>
                                    <th className="px-4 py-3 whitespace-nowrap text-right">{t('savingsCol') || 'Úspora'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredAlerts.map((alert, i) => {
                                    let regularPrice = alert.product.prices?.find(p => p.type === 'REGULAR')?.value;
                                    let promoPrice = alert.product.prices?.find(p => p.type === 'PROMO')?.value;
                                    let numReg = parseNumericPrice(regularPrice);
                                    let numPromo = parseNumericPrice(promoPrice);

                                    if (numReg !== null && numPromo !== null && numPromo > numReg) {
                                        const tempPrice = regularPrice; regularPrice = promoPrice; promoPrice = tempPrice;
                                        const tempNum = numReg; numReg = numPromo; numPromo = tempNum;
                                    }

                                    let savingsPercent = 0;
                                    if (numReg && numPromo && numReg > numPromo) {
                                        savingsPercent = Math.round(((numReg - numPromo) / numReg) * 100);
                                    }

                                    return (
                                        <tr key={`alert-${alert.product.id}-${i}`} className="hover:bg-slate-50/80 transition-colors text-slate-700">
                                            {/* Store */}
                                            <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                                                {alert.store}
                                            </td>
                                            {/* Brand */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">
                                                    {alert.product.brand || t('otherBrand') || 'Ostatné'}
                                                </span>
                                            </td>
                                            {/* Product */}
                                            <td className="px-4 py-3 font-bold min-w-[200px]">
                                                {alert.product.name}
                                            </td>
                                            {/* Type */}
                                            <td className="px-4 py-3 text-center whitespace-nowrap">
                                                {alert.type === 'our_promo' && (
                                                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider">
                                                        {t('ourActivePromoTag') || 'Naša akcia'}
                                                    </span>
                                                )}
                                                {alert.type === 'competitor_promo' && (
                                                    <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider">
                                                        {t('competitorPromoTag') || 'Konkurencia'}
                                                    </span>
                                                )}
                                                {alert.type === 'missing_promo' && (
                                                    <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider">
                                                        {t('missingPromoTagTitle') || 'Chýba'}
                                                    </span>
                                                )}
                                            </td>
                                            {/* Regular Price */}
                                            <td className="px-4 py-3 text-right font-mono font-medium whitespace-nowrap text-slate-500">
                                                <span className={alert.type !== 'missing_promo' && promoPrice ? 'line-through' : ''}>
                                                    {formatPriceWithCurrency(regularPrice)}
                                                </span>
                                            </td>
                                            {/* Promo Price */}
                                            <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                                                {alert.type === 'missing_promo' ? (
                                                    <span className="text-amber-600 text-[10px] italic">{t('notAvailable') || 'N/A'}</span>
                                                ) : (
                                                    <span className="text-slate-900">{formatPriceWithCurrency(promoPrice)}</span>
                                                )}
                                            </td>
                                            {/* Savings */}
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                {savingsPercent > 0 && alert.type !== 'missing_promo' ? (
                                                    <span className="text-emerald-600 font-black bg-emerald-50 px-2 py-0.5 rounded text-[10px]">
                                                        -{savingsPercent}%
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

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
