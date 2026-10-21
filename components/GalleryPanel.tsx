import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from '../i18n/index.tsx';
import { db, seedSampleAnalyses } from '../db.ts';
import type { SerializableImageState, DetectedProduct, Analysis } from '../types.ts';
import type { ImageState } from '../hooks/useImageAnalysis.ts';
import { getCategoryFromName, getImageStoreName } from '../utils/helpers.ts';
import { 
    SpinnerIcon, 
    SearchIcon, 
    BuildingStorefrontIcon, 
    CalendarDaysIcon,
    ChevronRightIcon
} from './Icons.tsx';
import { 
    Box, 
    Upload, 
    Sparkles, 
    Camera, 
    Maximize2,
    Check,
    X,
    Tag,
    Eye
} from 'lucide-react';

export interface GalleryItem {
    id: string;
    analysisId?: string;
    analysisName: string;
    imageUrl: string;
    uploadDate: Date;
    storeName: string;
    products: DetectedProduct[];
    rawImage?: SerializableImageState | ImageState;
    isVideo?: boolean;
    isActiveAnalysis?: boolean;
    sourceType: 'active' | 'analysis' | 'qualityCheck';
}

interface GalleryPanelProps {
    activeImages?: ImageState[];
    activeAnalysis?: Analysis | null;
    onNavigateToImage?: (imageId: string) => void;
    onLoadAnalysis?: (analysisId: string) => void;
    onStartAnalysis?: (files?: File[]) => void;
}

export const GalleryPanel: React.FC<GalleryPanelProps> = ({
    activeImages = [],
    activeAnalysis = null,
    onNavigateToImage,
    onLoadAnalysis,
    onStartAnalysis
}) => {
    const { t, language } = useTranslation();
    const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Filtre
    const [searchProduct, setSearchProduct] = useState('');
    const [selectedStore, setSelectedStore] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedSource, setSelectedSource] = useState<'all' | 'active' | 'analysis' | 'qualityCheck'>('all');

    // Live query z Dexie - automatická reaktivita pri akejkoľvek zmene v databáze
    const rawAnalyses = useLiveQuery(() => db.analyses.toArray());
    const rawQualityChecks = useLiveQuery(() => db.quality_checks.toArray());
    const dbAnalyses = useMemo(() => rawAnalyses || [], [rawAnalyses]);
    const dbQualityChecks = useMemo(() => rawQualityChecks || [], [rawQualityChecks]);

    // Automatický seed pri úplne prázdnej databáze a nulových aktívnych snímkach
    useEffect(() => {
        let isMounted = true;
        const checkAndSeed = async () => {
            try {
                const count = await db.analyses.count();
                if (count === 0 && activeImages.length === 0) {
                    setIsSeeding(true);
                    await seedSampleAnalyses();
                    if (isMounted) setIsSeeding(false);
                }
            } catch (err) {
                console.warn('Auto-seed check failed:', err);
                if (isMounted) setIsSeeding(false);
            }
        };
        checkAndSeed();
        return () => { isMounted = false; };
    }, [activeImages.length]);

    // Bezpečný prevod obrázka do funkčnej URL
    const getSafeUrl = useCallback((img: any): string => {
        if (!img) return '';
        if (img.file instanceof Blob) {
            return URL.createObjectURL(img.file);
        }
        const b64 = img.file?.data || img.compressedBase64 || img.base64 || img.data;
        if (b64 && typeof b64 === 'string') {
            if (b64.startsWith('data:') || b64.startsWith('blob:') || b64.startsWith('http')) {
                return b64;
            }
            const mime = img.file?.type || (img.isVideo ? 'video/mp4' : 'image/jpeg');
            return `data:${mime};base64,${b64}`;
        }
        if (img.imageUrl && typeof img.imageUrl === 'string' && img.imageUrl.trim() !== '') {
            return img.imageUrl;
        }
        return '';
    }, []);

    // Spracovanie všetkých dostupných obrázkov
    const { items, allStores, allCategories } = useMemo(() => {
        const flattened: GalleryItem[] = [];
        const storesSet = new Set<string>();
        const categoriesSet = new Set<string>();
        const seenImageIds = new Set<string>();

        // 1. Aktívne snímky z otvorenej analýzy (v pamäti)
        if (activeImages && activeImages.length > 0) {
            const currentAnalysisName = activeAnalysis?.name || t('currentAnalysis') || 'Aktuálna analýza';
            activeImages.forEach(img => {
                if (!img || seenImageIds.has(img.id)) return;
                seenImageIds.add(img.id);

                const rawStore = getImageStoreName(img, t('unknownStore'), activeAnalysis?.store?.name || null);
                const storeName = (!rawStore || rawStore.trim().toLowerCase() === 'null')
                    ? (t('unknownStore') || t('retailDefault') || 'Predajňa maloobchodu')
                    : rawStore;
                if (storeName) storesSet.add(storeName);

                const products = img.analysisResult?.products || [];
                products.forEach(p => {
                    if (p && p.name) {
                        categoriesSet.add(getCategoryFromName(p.name, t('unassignedCategory')));
                    }
                });

                const uploadDate = img.uploadDate instanceof Date 
                    ? img.uploadDate 
                    : new Date(img.uploadDate || Date.now());

                const finalUrl = getSafeUrl(img);
                if (!finalUrl) return;

                flattened.push({
                    id: img.id,
                    analysisId: activeAnalysis?.id,
                    analysisName: currentAnalysisName,
                    imageUrl: finalUrl,
                    uploadDate,
                    storeName,
                    products,
                    rawImage: img,
                    isVideo: Boolean(img.file?.type?.startsWith('video/') || img.isVideoMode),
                    isActiveAnalysis: true,
                    sourceType: 'active'
                });
            });
        }

        // 2. Uložené analýzy z IndexedDB
        dbAnalyses.forEach(analysis => {
            (analysis.images || []).forEach(img => {
                if (!img || seenImageIds.has(img.id)) return;
                seenImageIds.add(img.id);

                const finalUrl = getSafeUrl(img);
                if (!finalUrl) return;

                const rawStore = getImageStoreName(img, t('unknownStore'), analysis.store?.name || null);
                const storeName = (!rawStore || rawStore.trim().toLowerCase() === 'null')
                    ? (t('unknownStore') || t('retailDefault') || 'Predajňa maloobchodu')
                    : rawStore;
                if (storeName) storesSet.add(storeName);

                const products = img.analysisResult?.products || [];
                products.forEach(p => {
                    if (p && p.name) {
                        categoriesSet.add(getCategoryFromName(p.name, t('unassignedCategory')));
                    }
                });

                const uploadDate = img.uploadDate 
                    ? new Date(img.uploadDate) 
                    : (analysis.createdAt ? new Date(analysis.createdAt) : new Date());

                flattened.push({
                    id: img.id,
                    analysisId: analysis.id,
                    analysisName: analysis.name || t('shelfAnalysisDefault') || 'Analýza regálu',
                    imageUrl: finalUrl,
                    uploadDate,
                    storeName,
                    products,
                    rawImage: img,
                    isVideo: Boolean(img.file?.type?.startsWith('video/')),
                    isActiveAnalysis: false,
                    sourceType: 'analysis'
                });
            });
        });

        // 3. Snímky z kontroly kvality (Quality Check predajní a planogramov)
        dbQualityChecks.forEach(qc => {
            (qc.submissions || []).forEach(sub => {
                if (!sub || !sub.imageUrl || seenImageIds.has(sub.id)) return;
                seenImageIds.add(sub.id);

                const storeName = sub.storeName || t('storeQcDefault') || 'Kontrola kvality predajne';
                storesSet.add(storeName);
                categoriesSet.add(t('planogramQcCategory') || 'Kontrola kvality (Planogram)');

                const uploadDate = sub.createdAt ? new Date(sub.createdAt) : new Date();

                flattened.push({
                    id: sub.id,
                    analysisName: `${qc.name || t('sourceQualityCheck') || 'Kontrola kvality'} - ${sub.fileName || t('audit') || 'Audit'}`,
                    imageUrl: sub.imageUrl,
                    uploadDate,
                    storeName,
                    products: [],
                    isVideo: false,
                    isActiveAnalysis: false,
                    sourceType: 'qualityCheck'
                });
            });
        });

        const sortedItems = flattened.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime());
        return {
            items: sortedItems,
            allStores: Array.from(storesSet).filter(Boolean).sort(),
            allCategories: Array.from(categoriesSet).filter(Boolean).sort()
        };
    }, [activeImages, activeAnalysis, dbAnalyses, dbQualityChecks, t, getSafeUrl]);

    // Filtrované položky
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            if (selectedSource !== 'all' && item.sourceType !== selectedSource) {
                return false;
            }

            const matchesProduct = searchProduct === '' || 
                item.products.some(p => p.name.toLowerCase().includes(searchProduct.toLowerCase())) ||
                item.storeName.toLowerCase().includes(searchProduct.toLowerCase()) ||
                item.analysisName.toLowerCase().includes(searchProduct.toLowerCase());
            
            const matchesStore = selectedStore === 'all' || item.storeName === selectedStore;
            
            const matchesCategory = selectedCategory === 'all' || 
                (selectedCategory === (t('planogramQcCategory') || 'Kontrola kvality (Planogram)') && item.sourceType === 'qualityCheck') ||
                item.products.some(p => getCategoryFromName(p.name, t('unassignedCategory')) === selectedCategory);

            return matchesProduct && matchesStore && matchesCategory;
        });
    }, [items, searchProduct, selectedStore, selectedCategory, selectedSource, t]);

    // Automatický výber prvej položky alebo zachovanie vybranej položky pri zmene filtrov
    useEffect(() => {
        if (filteredItems.length > 0) {
            if (!selectedItem || !filteredItems.some(i => i.id === selectedItem.id)) {
                setSelectedItem(filteredItems[0]);
            }
        } else {
            setSelectedItem(null);
        }
    }, [filteredItems, selectedItem]);

    // Zoskupenie produktov pre detail fotografie
    const groupedProductsOnImage = useMemo(() => {
        if (!selectedItem || !selectedItem.products.length) return [];
        
        const sortedProducts = [...selectedItem.products].sort((a, b) => {
            const rowA = Math.round((a.boundingBox?.y || 0) * 20);
            const rowB = Math.round((b.boundingBox?.y || 0) * 20);
            if (rowA !== rowB) return rowA - rowB;
            return (a.boundingBox?.x || 0) - (b.boundingBox?.x || 0);
        });

        const groupMap = new Map<string, { product: DetectedProduct; count: number }>();
        sortedProducts.forEach(p => {
            const existing = groupMap.get(p.name);
            if (existing) {
                existing.count++;
            } else {
                groupMap.set(p.name, { product: p, count: 1 });
            }
        });
        
        return Array.from(groupMap.values());
    }, [selectedItem]);

    // Formátovanie facingov s podporou lokalizácie (SK, CS, EN, DE, HU, HR)
    const formatFacings = useCallback((count: number) => {
        if (language === 'sk') {
            if (count === 1) return '1 facing';
            if (count >= 2 && count <= 4) return `${count} facingy`;
            return `${count} facingov`;
        }
        if (language === 'cs') {
            if (count === 1) return '1 facing';
            if (count >= 2 && count <= 4) return `${count} facingy`;
            return `${count} facingů`;
        }
        if (language === 'de') {
            return count === 1 ? '1 Facing' : `${count} Facings`;
        }
        if (language === 'hu') {
            return `${count} facing`;
        }
        if (language === 'hr') {
            return count === 1 ? '1 facing' : `${count} facinga`;
        }
        return count === 1 ? '1 facing' : `${count} facings`;
    }, [language]);

    // Formátovanie dátumu podľa aktívneho jazyka
    const formatDate = useCallback((date: Date | undefined) => {
        if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
            return t('unknownDate') || 'Neznámy';
        }
        const localeMap: Record<string, string> = {
            sk: 'sk-SK',
            cs: 'cs-CZ',
            de: 'de-DE',
            hu: 'hu-HU',
            hr: 'hr-HR',
            en: 'en-US'
        };
        return date.toLocaleDateString(localeMap[language] || 'en-US');
    }, [language, t]);

    // Obsluha nahrávania súborov priamo z galérie
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            if (onStartAnalysis) {
                onStartAnalysis(files);
            }
        }
    };

    // Manuálne načítanie / reset ukážkových regálov
    const handleSeedSamples = async () => {
        setIsSeeding(true);
        try {
            await seedSampleAnalyses(true);
        } catch (err) {
            console.error('Failed to seed sample shelf analyses:', err);
        } finally {
            setIsSeeding(false);
        }
    };

    return (
        <div className="space-y-6 max-w-[1750px] mx-auto pb-12">
            {/* Top Header & Quick Actions */}
            <div className="bg-white dark:bg-zinc-900 p-6 sm:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-zinc-800 flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-lime-50 dark:bg-lime-950/40 text-lime-800 dark:text-lime-300 rounded-full text-[11px] font-black uppercase tracking-wider mb-2 border border-lime-200 dark:border-lime-800">
                        <Camera className="w-3.5 h-3.5 text-lime-600 dark:text-lime-400" />
                        {t('galleryBadge')}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
                        {t('galleryTitle')}
                    </h1>
                    <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400 mt-1">
                        {t('gallerySubtitle')}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileSelect} 
                        multiple 
                        accept="image/*,video/*" 
                        className="hidden" 
                    />
                    
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 sm:flex-none px-6 py-3.5 bg-lime-600 hover:bg-lime-700 active:bg-lime-800 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                        <Upload className="w-4 h-4" />
                        {t('galleryUploadPhotos')}
                    </button>

                    <button
                        type="button"
                        onClick={handleSeedSamples}
                        disabled={isSeeding}
                        className="flex-1 sm:flex-none px-5 py-3.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 active:bg-slate-300 text-slate-800 dark:text-zinc-200 font-bold text-xs uppercase tracking-wider rounded-2xl border border-slate-200 dark:border-zinc-800 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                        title={t('gallerySampleShelvesTooltip')}
                    >
                        {isSeeding ? (
                            <SpinnerIcon className="w-4 h-4 text-lime-600 animate-spin" />
                        ) : (
                            <Sparkles className="w-4 h-4 text-amber-500" />
                        )}
                        {t('gallerySampleShelves')}
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] shadow-sm border border-slate-100 dark:border-zinc-800 flex flex-col md:flex-row gap-4 items-center sticky top-2 z-20 backdrop-blur-md bg-white/95 dark:bg-zinc-900/95">
                <div className="relative flex-grow w-full">
                    <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
                    <input 
                        type="text"
                        placeholder={t('gallerySearchPlaceholder')}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-800 rounded-xl text-xs sm:text-sm font-bold focus:ring-2 focus:ring-lime-500 focus:bg-white dark:focus:bg-zinc-900 transition-all outline-hidden text-slate-800 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-500"
                        value={searchProduct}
                        onChange={(e) => setSearchProduct(e.target.value)}
                    />
                </div>
                
                <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full md:w-auto">
                    <select 
                        className="flex-1 md:w-48 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-800 rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-lime-500 focus:bg-white dark:focus:bg-zinc-900 transition-all cursor-pointer text-slate-800 dark:text-zinc-200"
                        value={selectedStore}
                        onChange={(e) => setSelectedStore(e.target.value)}
                    >
                        <option value="all">{t('allStores') || 'Všetky predajne'}</option>
                        {allStores.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <select 
                        className="flex-1 md:w-48 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-800 rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-lime-500 focus:bg-white dark:focus:bg-zinc-900 transition-all cursor-pointer text-slate-800 dark:text-zinc-200"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                        <option value="all">{t('allCategories') || 'Všetky kategórie'}</option>
                        {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <select 
                        className="flex-1 md:w-48 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/60 dark:border-zinc-800 rounded-xl text-xs font-bold py-3 px-4 focus:ring-2 focus:ring-lime-500 focus:bg-white dark:focus:bg-zinc-900 transition-all cursor-pointer text-slate-800 dark:text-zinc-200"
                        value={selectedSource}
                        onChange={(e) => setSelectedSource(e.target.value as any)}
                    >
                        <option value="all">{t('allSources', { count: items.length })}</option>
                        <option value="active">{t('sourceActiveAnalysis')}</option>
                        <option value="analysis">{t('sourceAuditArchive')}</option>
                        <option value="qualityCheck">{t('sourceQualityCheck')}</option>
                    </select>
                </div>
            </div>

            {/* MAIN CONTENT: Photos Grid & Photo Detail SIDE BY SIDE */}
            {filteredItems.length > 0 ? (
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                    {/* LEFT SIDE: Gallery Photos Grid */}
                    <div className="flex-1 min-w-0 w-full space-y-3">
                        <div className="flex items-center justify-between px-2 text-xs font-bold text-slate-500 dark:text-zinc-400">
                            <span>{t('showingPhotosCount', { count: filteredItems.length })}</span>
                            <span className="hidden sm:inline text-[11px] text-slate-400 dark:text-zinc-500">
                                {t('galleryClickHint')}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filteredItems.map(item => {
                                const isSelected = selectedItem?.id === item.id;
                                return (
                                    <div 
                                        key={item.id}
                                        onClick={() => setSelectedItem(item)}
                                        className={`group relative aspect-4/3 bg-slate-900 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 transform hover:-translate-y-1 ${
                                            isSelected
                                                ? 'ring-3 ring-lime-500 dark:ring-lime-400 border-2 border-lime-500 shadow-lg scale-[1.01]'
                                                : 'border border-slate-200/80 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 shadow-xs hover:shadow-md'
                                        }`}
                                    >
                                        {item.isVideo ? (
                                            <video 
                                                src={item.imageUrl} 
                                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                muted
                                                loop
                                                autoPlay
                                                playsInline
                                            />
                                        ) : (
                                            <img 
                                                src={item.imageUrl} 
                                                alt={item.analysisName} 
                                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                loading="lazy"
                                            />
                                        )}

                                        {/* Top Badges: Store Name & Selected indicator */}
                                        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none z-10 gap-1.5">
                                            <span className="bg-slate-950/85 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border border-white/10 shadow-xs truncate max-w-[65%]">
                                                {item.storeName || t('retailDefault')}
                                            </span>
                                            {isSelected ? (
                                                <span className="bg-lime-500 text-slate-950 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg shadow-sm flex items-center gap-1">
                                                    <Check className="w-3 h-3 stroke-[3]" />
                                                    {t('photoActive')}
                                                </span>
                                            ) : item.products.length > 0 ? (
                                                <span className="bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg shadow-xs">
                                                    {formatFacings(item.products.length)}
                                                </span>
                                            ) : (
                                                <span className="bg-zinc-700/90 text-zinc-200 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg shadow-xs">
                                                    {t('audit') || 'Audit'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Bottom Overlay Info */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent opacity-90 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-end">
                                            <p className="text-white text-xs font-black uppercase tracking-wider truncate">
                                                {item.analysisName}
                                            </p>
                                            <div className="flex items-center justify-between mt-1 text-[10px] text-slate-300">
                                                <span>
                                                    {formatDate(item.uploadDate)}
                                                </span>
                                                <span className="text-lime-400 font-bold flex items-center gap-0.5">
                                                    <Eye className="w-3 h-3" />
                                                    {t('photoDetailAction')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* RIGHT SIDE: Photo Detail (Detail fotografie) - SIDE BY SIDE */}
                    <div className="w-full lg:w-[460px] xl:w-[500px] shrink-0 sticky top-24 space-y-4">
                        {selectedItem ? (
                            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] border border-slate-200/90 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col">
                                {/* Header */}
                                <div className="p-5 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/60 dark:bg-zinc-800/40">
                                    <div className="min-w-0 flex-1 pr-3">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="inline-block w-2 h-2 rounded-full bg-lime-500"></span>
                                            <h3 className="text-lg font-black text-slate-900 dark:text-zinc-100 tracking-tight">
                                                {t('photoDetail')}
                                            </h3>
                                        </div>
                                        <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 truncate">
                                            {selectedItem.analysisName}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setIsFullScreen(true)}
                                        className="p-2.5 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                                        title={t('maximizePhotoTooltip')}
                                    >
                                        <Maximize2 className="w-4 h-4 text-slate-600 dark:text-zinc-300" />
                                        <span className="hidden sm:inline">{t('maximizePhoto')}</span>
                                    </button>
                                </div>

                                {/* Preview Image / Video */}
                                <div className="relative aspect-4/3 bg-slate-950 flex items-center justify-center overflow-hidden group">
                                    {selectedItem.isVideo ? (
                                        <video 
                                            src={selectedItem.imageUrl} 
                                            className="w-full h-full object-contain"
                                            controls
                                            playsInline
                                        />
                                    ) : (
                                        <img 
                                            src={selectedItem.imageUrl} 
                                            alt={selectedItem.analysisName} 
                                            className="w-full h-full object-contain cursor-zoom-in"
                                            onClick={() => setIsFullScreen(true)}
                                        />
                                    )}

                                    {/* Quick full-screen floating button on image */}
                                    <button
                                        type="button"
                                        onClick={() => setIsFullScreen(true)}
                                        className="absolute bottom-3 right-3 p-2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-xl backdrop-blur-md opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer shadow-md"
                                        title={t('viewFullscreen')}
                                    >
                                        <Maximize2 className="w-4 h-4 text-lime-400" />
                                    </button>
                                </div>

                                {/* Metadata Cards & Detected Products */}
                                <div className="p-5 space-y-5 max-h-[calc(100vh-440px)] overflow-y-auto custom-scrollbar">
                                    {/* Store & Date Cards */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-150 dark:border-zinc-800">
                                            <div className="flex items-center gap-2 mb-1">
                                                <BuildingStorefrontIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-black uppercase tracking-wider">{t('store')}</span>
                                            </div>
                                            <p className="text-xs font-black text-slate-900 dark:text-zinc-100 truncate" title={selectedItem.storeName}>
                                                {selectedItem.storeName}
                                            </p>
                                        </div>

                                        <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-150 dark:border-zinc-800">
                                            <div className="flex items-center gap-2 mb-1">
                                                <CalendarDaysIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-black uppercase tracking-wider">{t('date')}</span>
                                            </div>
                                            <p className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate">
                                                {formatDate(selectedItem.uploadDate)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Products & Facings List */}
                                    <div>
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="text-xs font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                                                <Box className="w-4 h-4 text-lime-600 dark:text-lime-400" />
                                                {t('productsAndFacingsOnPhoto')}
                                            </h4>
                                            <span className="bg-lime-100 dark:bg-lime-950/60 text-lime-800 dark:text-lime-300 text-[10px] font-black px-2.5 py-0.5 rounded-lg uppercase tracking-wider border border-lime-200 dark:border-lime-800">
                                                {formatFacings(selectedItem.products.length)}
                                            </span>
                                        </div>

                                        {groupedProductsOnImage.length > 0 ? (
                                            <div className="space-y-2">
                                                {groupedProductsOnImage.map((group, idx) => (
                                                    <div 
                                                        key={idx} 
                                                        className="bg-slate-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-slate-150 dark:border-zinc-800 flex justify-between items-center hover:border-lime-300 dark:hover:border-lime-700 transition-all"
                                                    >
                                                        <div className="min-w-0 flex-1 pr-3">
                                                            <p className="text-[9px] text-lime-700 dark:text-lime-400 font-black uppercase tracking-wider mb-0.5">
                                                                {getCategoryFromName(group.product.name, t('category'))}
                                                            </p>
                                                            <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate" title={group.product.name}>
                                                                {group.product.name}
                                                            </p>
                                                            {group.product.prices && group.product.prices.length > 0 && (
                                                                <div className="flex items-center gap-1.5 mt-1">
                                                                    <Tag className="w-3 h-3 text-slate-400" />
                                                                    <span className="text-[10px] font-black text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 px-1.5 py-0.5 rounded">
                                                                        {group.product.prices[0].value}
                                                                        {group.product.prices[0].type === 'PROMO' && (
                                                                            <span className="ml-1 text-red-600 font-extrabold">{t('promoBadge')}</span>
                                                                        )}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            <div className="bg-white dark:bg-zinc-900 border border-lime-500 text-lime-700 dark:text-lime-400 font-black text-xs px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1">
                                                                <Box className="w-3 h-3" />
                                                                {formatFacings(group.count)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 bg-slate-50 dark:bg-zinc-800/40 rounded-xl border border-slate-150 dark:border-zinc-800">
                                                <p className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                                                    {selectedItem.sourceType === 'qualityCheck' 
                                                        ? t('qcPhotoNotice') 
                                                        : t('noDetectedProductsOnPhoto')}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Bottom Action */}
                                <div className="p-4 bg-slate-50/60 dark:bg-zinc-800/40 border-t border-slate-100 dark:border-zinc-800">
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            if (selectedItem.isActiveAnalysis && onNavigateToImage) {
                                                onNavigateToImage(selectedItem.id);
                                            } else if (selectedItem.analysisId && onLoadAnalysis) {
                                                onLoadAnalysis(selectedItem.analysisId);
                                            } else if (onNavigateToImage) {
                                                onNavigateToImage(selectedItem.id);
                                            }
                                        }}
                                        className="w-full py-3.5 bg-slate-900 hover:bg-black dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-black rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-xs shadow-md active:scale-95 cursor-pointer"
                                    >
                                        <ChevronRightIcon className="w-4 h-4 text-lime-400 dark:text-lime-600" />
                                        {t('viewInAnalysis')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] p-8 border border-dashed border-slate-200 dark:border-zinc-800 text-center">
                                <Camera className="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                                <p className="text-xs font-bold text-slate-400 dark:text-zinc-500">
                                    {t('selectPhotoToViewDetail')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* Empty state when no photos match filters or database is empty */
                <div className="text-center py-20 px-6 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 rounded-[3rem] border border-dashed border-slate-200 dark:border-zinc-800 shadow-sm">
                    <div className="w-20 h-20 bg-lime-50 dark:bg-lime-950/40 text-lime-600 dark:text-lime-400 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                        <Camera className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-zinc-100 mb-2 tracking-tight">
                        {t('noImagesInGallery')}
                    </h3>
                    <p className="text-slate-500 dark:text-zinc-400 max-w-md text-sm font-semibold leading-relaxed mb-8">
                        {t('emptyGallerySubtitle')}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-6 py-3.5 bg-lime-600 hover:bg-lime-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                        >
                            <Upload className="w-4 h-4" />
                            {t('uploadStorePhotos')}
                        </button>
                        <button
                            type="button"
                            onClick={handleSeedSamples}
                            disabled={isSeeding}
                            className="px-6 py-3.5 bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            {t('loadSampleShelves')}
                        </button>
                    </div>
                </div>
            )}

            {/* Optional Fullscreen Modal View */}
            {isFullScreen && selectedItem && (
                <div className="fixed inset-0 bg-slate-950/95 z-50 flex items-center justify-center p-4 sm:p-8 backdrop-blur-md">
                    <div className="relative max-w-7xl max-h-[90vh] w-full flex items-center justify-center">
                        {selectedItem.isVideo ? (
                            <video 
                                src={selectedItem.imageUrl} 
                                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10"
                                controls
                                autoPlay
                                loop
                            />
                        ) : (
                            <img 
                                src={selectedItem.imageUrl} 
                                alt={selectedItem.analysisName} 
                                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10"
                            />
                        )}

                        <button 
                            type="button"
                            onClick={() => setIsFullScreen(false)}
                            className="absolute top-2 right-2 sm:-top-4 sm:-right-4 p-3 bg-white/15 hover:bg-white/25 text-white rounded-full transition-all active:scale-95 backdrop-blur-md shadow-lg cursor-pointer"
                            title={t('closeFullscreen')}
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
