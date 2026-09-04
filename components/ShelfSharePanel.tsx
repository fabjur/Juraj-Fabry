import React, { useMemo, useState, useRef } from 'react';
import type { ImageState } from '../hooks/useImageAnalysis.ts';
import { getCategoryFromName, findBestMatch, removeDateFromStoreName } from '../utils/helpers.ts';
import { ChartPieIcon, ArrowDownTrayIcon, DocumentTextIcon } from './Icons.tsx';
import { useTranslation } from '../i18n/index.tsx';
import { DetectedProduct, StoreInfo } from '../types.ts';
import { exportShelfShareToXLS, exportToPDF } from '../utils/export.ts';
import { BoundingBoxOverlay } from './BoundingBoxOverlay.tsx';
import { 
    Layers, 
    Grid, 
    Search, 
    Sparkles, 
    Award, 
    ChevronDown, 
    ChevronUp, 
    Info, 
    PieChart, 
    Maximize2, 
    FolderOpen,
    HelpCircle,
    Eye,
    Camera,
    CheckSquare,
    Square,
    X,
    ChevronLeft,
    ChevronRight,
    Tag,
    Filter,
    Box
} from 'lucide-react';

interface ConstituentProduct {
    name: string;
    brand?: string;
    count: number;
    area: number;
    categoryShare: number; // Share relative to the category's total
    globalShare: number;   // Share relative to the global total
}

interface ShelfShareData {
    category: string;
    share: number;
    count: number;
    area: number;
    constituents: ConstituentProduct[];
}

interface BrandShareData {
    brand: string;
    category: string;
    count: number;
    area: number;
    brandShare: number; // Share relative to total facing count/area
}

const getCategoryColorStyles = (index: number) => {
    const palettes = [
        { bg: 'bg-lime-500', text: 'text-lime-700', bgLight: 'bg-lime-50/70', border: 'border-lime-200', textLight: 'text-lime-600', fill: '#84cc16' },
        { bg: 'bg-teal-500', text: 'text-teal-700', bgLight: 'bg-teal-50/70', border: 'border-teal-200', textLight: 'text-teal-600', fill: '#14b8a6' },
        { bg: 'bg-sky-500', text: 'text-sky-700', bgLight: 'bg-sky-50/70', border: 'border-sky-200', textLight: 'text-sky-600', fill: '#0ea5e9' },
        { bg: 'bg-blue-500', text: 'text-blue-700', bgLight: 'bg-blue-50/70', border: 'border-blue-200', textLight: 'text-blue-600', fill: '#3b82f6' },
        { bg: 'bg-indigo-500', text: 'text-indigo-700', bgLight: 'bg-indigo-50/70', border: 'border-indigo-200', textLight: 'text-indigo-600', fill: '#6366f1' },
        { bg: 'bg-violet-500', text: 'text-violet-700', bgLight: 'bg-violet-50/70', border: 'border-violet-200', textLight: 'text-violet-600', fill: '#8b5cf6' },
        { bg: 'bg-purple-500', text: 'text-purple-700', bgLight: 'bg-purple-50/70', border: 'border-purple-200', textLight: 'text-purple-600', fill: '#a855f7' },
        { bg: 'bg-fuchsia-500', text: 'text-fuchsia-700', bgLight: 'bg-fuchsia-50/70', border: 'border-fuchsia-200', textLight: 'text-fuchsia-600', fill: '#d946ef' },
        { bg: 'bg-pink-500', text: 'text-pink-700', bgLight: 'bg-pink-50/70', border: 'border-pink-200', textLight: 'text-pink-600', fill: '#ec4899' },
        { bg: 'bg-rose-500', text: 'text-rose-700', bgLight: 'bg-rose-50/70', border: 'border-rose-200', textLight: 'text-rose-600', fill: '#f43f5e' },
    ];
    return palettes[index % palettes.length];
};

export const ShelfSharePanel: React.FC<{ images: ImageState[] }> = ({ images }) => {
    const [selectedChain, setSelectedChain] = useState<string>('all');
    const [selectedPhotoId, setSelectedPhotoId] = useState<string>('all');
    const [excludedPhotoIds, setExcludedPhotoIds] = useState<Set<string>>(new Set());
    const [shareMode, setShareMode] = useState<'area' | 'count'>('area');
    const [activeTab, setActiveTab] = useState<'planogram' | 'donut' | 'brands'>('planogram');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [inspectedImage, setInspectedImage] = useState<ImageState | null>(null);
    const [modalHighlightedProduct, setModalHighlightedProduct] = useState<string | null>(null);
    const [activeDonutSlice, setActiveDonutSlice] = useState<number | null>(null);

    const { t } = useTranslation();
    const unassignedCategory = t('unassignedCategory');
    const panelRef = useRef<HTMLDivElement>(null);

    const getStoreIdentifier = React.useCallback((storeInfo?: StoreInfo) => {
        const unknownStore = t('unknownStore');
        if (storeInfo) {
            const { chain, address } = storeInfo;
            const cleanedChain = removeDateFromStoreName(chain);
            const cleanedAddress = removeDateFromStoreName(address);

            if (cleanedChain && cleanedAddress) return `${cleanedChain}, ${cleanedAddress}`;
            return cleanedChain || cleanedAddress || unknownStore;
        }
        return unknownStore;
    }, [t]);

    const availableChains = useMemo(() => {
        const chains = new Set<string>();
        images.forEach(image => {
            if (image.analysisResult) {
                 const chainName = getStoreIdentifier(image.analysisResult.storeInfo);
                 chains.add(chainName);
            }
        });
        return Array.from(chains).sort();
    }, [images, getStoreIdentifier]);

    // Toggle exclusion of photo from SOS computation
    const togglePhotoExclusion = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setExcludedPhotoIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const selectAllPhotos = () => {
        setExcludedPhotoIds(new Set());
    };

    const deselectAllPhotos = () => {
        const allIds = new Set(images.map(img => img.id));
        setExcludedPhotoIds(allIds);
    };

    // Filter images active for computation
    const activeImages = useMemo(() => {
        return images.filter(img => {
            if (excludedPhotoIds.has(img.id)) return false;
            if (selectedChain !== 'all') {
                const chainName = getStoreIdentifier(img.analysisResult?.storeInfo);
                if (chainName !== selectedChain) return false;
            }
            if (selectedPhotoId !== 'all' && img.id !== selectedPhotoId) return false;
            return true;
        });
    }, [images, excludedPhotoIds, selectedChain, selectedPhotoId, getStoreIdentifier]);

    // Enhanced compute logic with detailed constituent product breakdown
    const shelfShareData = useMemo<ShelfShareData[]>(() => {
        const categoryAreas: Record<string, number> = {};
        let totalArea = 0;
        const categoryCounts: Record<string, number> = {};
        let totalCount = 0;

        const categoryToProductsList: Record<string, Array<{ name: string; brand?: string; count: number; area: number }>> = {};

        const allProducts = activeImages
            .flatMap(image => (Array.isArray(image.analysisResult?.products) ? image.analysisResult?.products : []) || [])
            .filter((p): p is DetectedProduct => !!(p && p.name));
        
        const productMap = new Map<string, { name: string; brand?: string; products: DetectedProduct[] }>();
        allProducts.forEach(product => {
            const currentName = product.name.trim();
            const existingCanonicalNames = Array.from(productMap.keys());
            const matchedCanonicalName = findBestMatch(currentName, existingCanonicalNames);
            const canonicalName = matchedCanonicalName || currentName;

            const entry = productMap.get(canonicalName);
            if (entry) {
                entry.products.push(product);
            } else {
                productMap.set(canonicalName, { name: canonicalName, brand: product.brand, products: [product] });
            }
        });

        productMap.forEach((group) => {
            const category = getCategoryFromName(group.name, unassignedCategory);
            let groupArea = 0;
            let groupCount = 0;
            
            group.products.forEach(product => {
                if (!product.boundingBox) return;
                const { width, height } = product.boundingBox;
                const area = (width || 0) * (height || 0);
                if (area > 0) {
                    groupArea += area;
                }
                groupCount++;
            });

            if (groupCount > 0) {
                categoryAreas[category] = (categoryAreas[category] || 0) + groupArea;
                totalArea += groupArea;

                categoryCounts[category] = (categoryCounts[category] || 0) + groupCount;
                totalCount += groupCount;

                if (!categoryToProductsList[category]) {
                    categoryToProductsList[category] = [];
                }
                categoryToProductsList[category].push({
                    name: group.name,
                    brand: group.brand,
                    count: groupCount,
                    area: groupArea
                });
            }
        });

        const result: ShelfShareData[] = [];
        const categoriesList = Object.keys(categoryCounts);

        categoriesList.forEach(category => {
            const catArea = categoryAreas[category] || 0;
            const catCount = categoryCounts[category] || 0;
            
            const areaPct = totalArea > 0 ? (catArea / totalArea) * 100 : 0;
            const activeShare = shareMode === 'area' ? areaPct : (totalCount > 0 ? (catCount / totalCount) * 100 : 0);

            const rawConstituents = categoryToProductsList[category] || [];
            const totalCatMeasure = shareMode === 'area' ? catArea : catCount;

            const constituents: ConstituentProduct[] = rawConstituents.map(c => {
                const measure = shareMode === 'area' ? c.area : c.count;
                const categoryShare = totalCatMeasure > 0 ? (measure / totalCatMeasure) * 100 : 0;
                const globalMeasureTotal = shareMode === 'area' ? totalArea : totalCount;
                const globalShare = globalMeasureTotal > 0 ? (measure / globalMeasureTotal) * 100 : 0;

                return {
                    name: c.name,
                    brand: c.brand,
                    count: c.count,
                    area: c.area,
                    categoryShare,
                    globalShare
                };
            }).sort((a, b) => b.categoryShare - a.categoryShare);

            result.push({
                category,
                share: activeShare,
                count: catCount,
                area: catArea,
                constituents
            });
        });

        return result.sort((a, b) => b.share - a.share);
    }, [activeImages, shareMode, unassignedCategory]);

    // Compute Brand Share breakdown
    const brandShareData = useMemo<BrandShareData[]>(() => {
        const brandCounts: Record<string, { brand: string; category: string; count: number; area: number }> = {};
        let totalCount = 0;
        let totalArea = 0;

        const allProducts = activeImages
            .flatMap(image => (Array.isArray(image.analysisResult?.products) ? image.analysisResult?.products : []) || [])
            .filter((p): p is DetectedProduct => !!(p && p.name));

        allProducts.forEach(p => {
            const brandName = (p.brand || 'Iné / Neznáma').trim();
            const category = getCategoryFromName(p.name, unassignedCategory);
            const { width = 0, height = 0 } = p.boundingBox || {};
            const area = width * height;

            if (!brandCounts[brandName]) {
                brandCounts[brandName] = { brand: brandName, category, count: 0, area: 0 };
            }
            brandCounts[brandName].count += 1;
            brandCounts[brandName].area += area;
            totalCount += 1;
            totalArea += area;
        });

        const totalMeasure = shareMode === 'area' ? totalArea : totalCount;

        return Object.values(brandCounts).map(b => {
            const measure = shareMode === 'area' ? b.area : b.count;
            const brandShare = totalMeasure > 0 ? (measure / totalMeasure) * 100 : 0;
            return {
                ...b,
                brandShare
            };
        }).sort((a, b) => b.brandShare - a.brandShare);
    }, [activeImages, shareMode, unassignedCategory]);

    // Live filtering for categories
    const filteredShareData = useMemo(() => {
        if (!searchTerm.trim()) return shelfShareData;
        const sLower = searchTerm.toLowerCase();
        return shelfShareData.filter(item => {
            const catMatches = item.category.toLowerCase().includes(sLower);
            const productMatches = item.constituents.some(c => 
                c.name.toLowerCase().includes(sLower) || 
                (c.brand && c.brand.toLowerCase().includes(sLower))
            );
            return catMatches || productMatches;
        });
    }, [shelfShareData, searchTerm]);

    // KPI Summary Metrics
    const stats = useMemo(() => {
        if (shelfShareData.length === 0) return null;
        
        const leaderCategory = shelfShareData[0]?.category || '—';
        const leaderShare = shelfShareData[0]?.share || 0;
        const totalItemsCount = shelfShareData.reduce((acc, curr) => acc + (curr.count || 0), 0);
        const totalScannedArea = shelfShareData.reduce((acc, curr) => acc + (curr.area || 0), 0);
        const uniqueBrands = brandShareData.length;
        const includedPhotosCount = activeImages.length;
        const totalPhotosCount = images.length;

        return {
            categoryCount: shelfShareData.length,
            leaderCategory,
            leaderShare,
            totalItemsCount,
            totalScannedArea,
            uniqueBrands,
            includedPhotosCount,
            totalPhotosCount
        };
    }, [shelfShareData, brandShareData, activeImages, images]);
    
    const handleExportShelfShare = () => {
        exportShelfShareToXLS(shelfShareData, selectedChain, shareMode, t);
    };

    const descriptionText = selectedChain === 'all'
        ? t('shelfShareContextAll')
        : t('shelfShareContextChain', { chain: selectedChain });
        
    const shareModeText = shareMode === 'area' ? t('shelfShareModeArea') : t('shelfShareModeCount');

    // Toggle expansion safely
    const toggleCategoryExpand = (cat: string) => {
        setExpandedCategory(prev => prev === cat ? null : cat);
    };

    // Calculate SVG Donut Paths for Category Donut Chart
    const donutSlices = useMemo(() => {
        let cumulativePercent = 0;
        return shelfShareData.map((item, idx) => {
            const style = getCategoryColorStyles(idx);
            const percent = item.share / 100;
            const startAngle = cumulativePercent * 360;
            cumulativePercent += percent;
            const endAngle = cumulativePercent * 360;

            // SVG Arc Calculation
            const radius = 80;
            const hole = 52;
            const cx = 100;
            const cy = 100;

            const startRad = (startAngle - 90) * (Math.PI / 180);
            const endRad = (endAngle - 90) * (Math.PI / 180);

            const x1 = cx + radius * Math.cos(startRad);
            const y1 = cy + radius * Math.sin(startRad);
            const x2 = cx + radius * Math.cos(endRad);
            const y2 = cy + radius * Math.sin(endRad);

            const x3 = cx + hole * Math.cos(endRad);
            const y3 = cy + hole * Math.sin(endRad);
            const x4 = cx + hole * Math.cos(startRad);
            const y4 = cy + hole * Math.sin(startRad);

            const largeArc = percent > 0.5 ? 1 : 0;

            const pathData = [
                `M ${x1} ${y1}`,
                `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
                `L ${x3} ${y3}`,
                `A ${hole} ${hole} 0 ${largeArc} 0 ${x4} ${y4}`,
                'Z'
            ].join(' ');

            return {
                category: item.category,
                share: item.share,
                count: item.count,
                pathData,
                color: style.fill,
                style
            };
        });
    }, [shelfShareData]);

    if (images.length === 0) {
        return (
            <div className="space-y-6 animate-fade-in text-left">
                <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center">
                    <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-sm border border-gray-100">
                        <ChartPieIcon className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-lg font-black text-gray-900 mb-2">{t('noDataForShelfShare')}</p>
                    <p className="text-xs text-gray-400 font-bold max-w-sm text-center leading-relaxed">{t('noDataForShelfShareHint')}</p>
                </div>
            </div>
        );
    }

    return (
        <div ref={panelRef} className="space-y-8 printable-content animate-fade-in text-left">
            
            {/* Header portion */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print border-b border-gray-100 pb-5">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3 tracking-tight">
                        <div className="p-3 bg-gradient-to-br from-lime-100 to-emerald-100 rounded-2xl shadow-xs">
                            <PieChart className="w-6 h-6 text-lime-700" />
                        </div>
                        {t('shelfShare')}
                    </h2>
                    <p className="text-xs text-gray-500 font-bold mt-1">
                        {t('shelfShareSubTitle')}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={handleExportShelfShare}
                        className="flex-grow sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all bg-lime-600 text-white hover:bg-lime-700 shadow-md shadow-lime-200 active:scale-95 cursor-pointer"
                        aria-label={t('exportToXLS')}
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        {t('exportToXLS')}
                    </button>
                    <button
                        onClick={() => exportToPDF(panelRef.current)}
                        className="flex-grow sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all bg-gray-900 text-white hover:bg-black shadow-md shadow-gray-200 active:scale-95 cursor-pointer"
                        aria-label={t('exportToPDF')}
                    >
                        <DocumentTextIcon className="w-4 h-4" />
                        {t('exportToPDF')}
                    </button>
                </div>
            </div>

            {/* SOURCE AUDIT PHOTOS CONTROL STRIP & VISUAL AUDIT */}
            <div className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-xs no-print space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                            <Camera className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-wider text-gray-900">
                                {t('sourcePhotosControl')}
                            </h3>
                            <p className="text-[10px] text-gray-400 font-bold">
                                {t('includedPhotos', { included: images.length - excludedPhotoIds.size, total: images.length })}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold">
                        <button
                            onClick={selectAllPhotos}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] uppercase tracking-wider font-extrabold transition-colors cursor-pointer"
                        >
                            <CheckSquare className="w-3.5 h-3.5 text-lime-600" />
                            {t('selectAll')}
                        </button>
                        <button
                            onClick={deselectAllPhotos}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] uppercase tracking-wider font-extrabold transition-colors cursor-pointer"
                        >
                            <Square className="w-3.5 h-3.5 text-gray-400" />
                            {t('deselectAll')}
                        </button>
                    </div>
                </div>

                {/* Source Photo Thumbnails Strip */}
                <div className="flex gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                    {images.map((img, idx) => {
                        const isExcluded = excludedPhotoIds.has(img.id);
                        const productCount = img.analysisResult?.products?.length || 0;
                        const storeName = getStoreIdentifier(img.analysisResult?.storeInfo);

                        return (
                            <div
                                key={img.id}
                                className={`relative shrink-0 w-44 bg-gray-50 rounded-2xl border transition-all p-2.5 flex flex-col justify-between group ${
                                    isExcluded 
                                        ? 'border-gray-200 opacity-50 grayscale' 
                                        : 'border-blue-200 bg-blue-50/20 shadow-2xs'
                                }`}
                            >
                                <div className="relative w-full h-24 bg-gray-200 rounded-xl overflow-hidden mb-2 border border-gray-200">
                                    {img.imageUrl ? (
                                        <img 
                                            src={img.imageUrl} 
                                            alt={img.file.name} 
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            <Camera className="w-6 h-6" />
                                        </div>
                                    )}

                                    {/* Facing count badge */}
                                    <span className="absolute bottom-1.5 left-1.5 bg-black/75 backdrop-blur-xs text-lime-400 text-[9px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                                        <Box className="w-2.5 h-2.5" />
                                        {productCount} {t('pcs')}
                                    </span>

                                    {/* Toggle Inclusion Checkbox */}
                                    <button
                                        onClick={(e) => togglePhotoExclusion(img.id, e)}
                                        className={`absolute top-1.5 right-1.5 p-1 rounded-md transition-all shadow-xs cursor-pointer ${
                                            isExcluded 
                                                ? 'bg-gray-800/80 text-gray-400 hover:text-white' 
                                                : 'bg-lime-500 text-white'
                                        }`}
                                        title={t('togglePhotoInclusion')}
                                    >
                                        {isExcluded ? <Square className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
                                    </button>

                                    {/* Inspect button overlay */}
                                    <button
                                        onClick={() => setInspectedImage(img)}
                                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white font-black text-[10px] uppercase tracking-wider cursor-pointer"
                                    >
                                        <Eye className="w-4 h-4" />
                                        {t('inspectPhoto')}
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    <p className="text-[11px] font-black text-gray-900 truncate" title={img.file.name}>
                                        #{idx + 1} {img.file.name}
                                    </p>
                                    <p className="text-[9.5px] font-bold text-gray-500 truncate" title={storeName}>
                                        {storeName}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Filter Bar & Chain Filter */}
            {availableChains.length > 0 && (
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs no-print flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="w-full sm:w-1/2">
                        <label htmlFor="chain-filter-main" className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                            {t('filterByChain')}
                        </label>
                        <select
                            id="chain-filter-main"
                            value={selectedChain}
                            onChange={(e) => setSelectedChain(e.target.value)}
                            className="block w-full rounded-2xl border-gray-250 bg-gray-50/50 py-2.5 pl-4 pr-10 text-gray-900 focus:ring-2 focus:ring-inset focus:ring-lime-500 text-xs font-bold transition-all cursor-pointer"
                        >
                            <option value="all">{t('allStores')}</option>
                            {availableChains.map(chain => (
                                <option key={chain} value={chain}>{chain}</option>
                            ))}
                        </select>
                    </div>

                    <div className="w-full sm:w-1/2">
                        <label htmlFor="photo-filter-select" className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                            {t('photoFilter')}
                        </label>
                        <select
                            id="photo-filter-select"
                            value={selectedPhotoId}
                            onChange={(e) => setSelectedPhotoId(e.target.value)}
                            className="block w-full rounded-2xl border-gray-250 bg-gray-50/50 py-2.5 pl-4 pr-10 text-gray-900 focus:ring-2 focus:ring-inset focus:ring-lime-500 text-xs font-bold transition-all cursor-pointer"
                        >
                            <option value="all">{t('allPhotos')}</option>
                            {images.map((img, idx) => (
                                <option key={img.id} value={img.id}>
                                    #{idx + 1} - {img.file.name} ({img.analysisResult?.products?.length || 0} fejsov)
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Calculation Mode selection & Info Switcher */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 no-print bg-gray-50/50 p-4 rounded-3xl border border-gray-150/60 shadow-inner">
                <div className="flex items-center gap-2 max-w-md">
                    <Info className="w-4 h-4 text-lime-650 shrink-0 select-none" />
                    <p className="text-[11px] text-gray-500 font-bold leading-relaxed">
                        {t('shelfShareDescription', { mode: shareModeText, context: descriptionText })}
                    </p>
                </div>
                
                <div className="bg-gray-100/80 p-1.5 rounded-2xl flex w-full sm:w-80 border border-gray-150 shadow-2xs shrink-0 select-none">
                    <button
                        onClick={() => setShareMode('area')}
                        className={`w-1/2 rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${shareMode === 'area' ? 'bg-white text-lime-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        aria-pressed={shareMode === 'area'}
                    >
                        {t('shareByArea')}
                    </button>
                    <button
                        onClick={() => setShareMode('count')}
                        className={`w-1/2 rounded-xl py-2.5 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${shareMode === 'count' ? 'bg-white text-lime-700 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                        aria-pressed={shareMode === 'count'}
                    >
                        {t('shareByCount')}
                    </button>
                </div>
            </div>

            {/* SPRIEVODCA PRE REPORTY METRÍK */}
            <div className="bg-gradient-to-r from-lime-50/50 to-emerald-50/30 rounded-3xl p-5 border border-lime-150/60 shadow-xs no-print">
                <div 
                    onClick={() => setIsGuideOpen(!isGuideOpen)}
                    className="flex justify-between items-center cursor-pointer select-none"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-lime-600 rounded-xl text-white">
                            <HelpCircle className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-xs text-lime-900 uppercase tracking-widest">
                                {t('sosGuideTitle')}
                            </h3>
                            <p className="text-[11px] text-lime-700/90 font-bold mt-0.5">
                                {t('sosGuideSubtitle')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black uppercase text-lime-700 bg-lime-100/60 px-2 py-0.5 rounded-lg">
                            {isGuideOpen ? t('hideInfo') : t('showInfo')}
                        </span>
                        {isGuideOpen ? (
                            <ChevronUp className="w-4 h-4 text-lime-800" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-lime-800" />
                        )}
                    </div>
                </div>

                {isGuideOpen && (
                    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-lime-200/30 text-xs">
                        <div className="bg-white p-4 rounded-xl border border-lime-100/45 shadow-3xs">
                            <h4 className="font-extrabold text-lime-900 uppercase tracking-wider mb-1">{t('areaMetricTitle')}</h4>
                            <p className="text-gray-500 leading-relaxed font-semibold">
                                {t('areaMetricDesc')}
                            </p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-lime-100/45 shadow-3xs">
                            <h4 className="font-extrabold text-lime-900 uppercase tracking-wider mb-1">{t('countMetricTitle')}</h4>
                            <p className="text-gray-500 leading-relaxed font-semibold">
                                {t('countMetricDesc')}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* DYNAMIC KPI SUMMARY STATS BAR */}
            {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-left">
                    {/* 1. Category Count Card */}
                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('activeCategories')}</span>
                            <div className="p-1.5 bg-gray-50 text-gray-500 rounded-lg border border-gray-150">
                                <Layers className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-gray-900">{stats.categoryCount}</span>
                            <p className="text-[11px] text-gray-500 font-bold mt-1">
                                {t('monitoredSections')}
                            </p>
                        </div>
                    </div>

                    {/* 2. Leader Category Card */}
                    <div className="bg-gradient-to-br from-lime-500 to-emerald-600 p-5 rounded-3xl text-white shadow-sm flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-black uppercase tracking-widest text-lime-100">{t('dominantSection')}</span>
                            <div className="p-1.5 bg-white/20 rounded-lg">
                                <Award className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <span className="text-2xl font-black truncate block tracking-tight" title={stats.leaderCategory}>
                                {stats.leaderCategory}
                            </span>
                            <p className="text-[11px] text-lime-100 font-bold mt-1 uppercase tracking-wide">
                                {t('shareUpTo', { share: stats.leaderShare.toFixed(1) })}
                            </p>
                        </div>
                    </div>

                    {/* 3. Total Items Counts Card */}
                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('totalFacingCount')}</span>
                            <div className="p-1.5 bg-gray-50 text-gray-500 rounded-lg border border-gray-150">
                                <Grid className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-gray-900">{stats.totalItemsCount} {t('pcs')}</span>
                            <p className="text-[11px] text-gray-500 font-bold mt-1">
                                {t('detectedFacings')}
                            </p>
                        </div>
                    </div>

                    {/* 4. Brand Diversity */}
                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('uniqueBrandsCount')}</span>
                            <div className="p-1.5 bg-gray-50 text-gray-500 rounded-lg border border-gray-150">
                                <Tag className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <span className="text-3xl font-black text-gray-900">{stats.uniqueBrands}</span>
                            <p className="text-[11px] text-gray-500 font-bold mt-1">
                                {t('brandName')}
                            </p>
                        </div>
                    </div>

                    {/* 5. Total Area metrics */}
                    <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{t('scannedArea')}</span>
                            <div className="p-1.5 bg-gray-50 text-gray-500 rounded-lg border border-gray-150">
                                <Maximize2 className="w-3.5 h-3.5" />
                            </div>
                        </div>
                        <div className="mt-4 font-bold">
                            <span className="text-xl font-black text-gray-900">
                                {stats.totalScannedArea > 0 ? `${(stats.totalScannedArea / 1000).toFixed(0)}k px²` : '—'}
                            </span>
                            <p className="text-[11px] text-gray-550 font-semibold mt-1.5">
                                {t('totalBoundingPixels')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* MULTI-VIEW TAB NAVIGATION */}
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2 no-print">
                <button
                    onClick={() => setActiveTab('planogram')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                        activeTab === 'planogram'
                            ? 'bg-lime-600 text-white shadow-md shadow-lime-200'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                >
                    <Sparkles className="w-4 h-4" />
                    {t('viewPlanogram')}
                </button>

                <button
                    onClick={() => setActiveTab('donut')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                        activeTab === 'donut'
                            ? 'bg-lime-600 text-white shadow-md shadow-lime-200'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                >
                    <PieChart className="w-4 h-4" />
                    {t('viewDonutChart')}
                </button>

                <button
                    onClick={() => setActiveTab('brands')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                        activeTab === 'brands'
                            ? 'bg-lime-600 text-white shadow-md shadow-lime-200'
                            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    }`}
                >
                    <Award className="w-4 h-4" />
                    {t('viewBrandLeaderboard')}
                </button>
            </div>

            {/* TAB 1: DIGITAL TWIN SHELF PLANOGRAM REPRESENTATION */}
            {activeTab === 'planogram' && (
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-3.5">
                    <div className="flex justify-between items-center px-1 select-none">
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-lime-600 shrink-0" />
                                {t('shelfLayoutBlueprint')}
                            </h3>
                            <p className="text-[11px] text-gray-400 font-bold mt-0.5">
                                {t('shelfLayoutDesc')}
                            </p>
                        </div>
                        <span className="text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-1 bg-gray-100 text-gray-500 rounded-lg border border-gray-150 shrink-0">
                            {shareMode === 'area' ? t('calcFromArea') : t('calcFromCount')}
                        </span>
                    </div>

                    {/* Simulated Stacked Shelf Rack Row */}
                    <div className="w-full bg-gray-100 p-2.5 rounded-2xl border border-gray-150/80 flex gap-1 items-stretch min-h-[60px] overflow-hidden shadow-inner">
                        {shelfShareData.map((item, index) => {
                            const style = getCategoryColorStyles(index);
                            const shareVal = item.share;
                            if (shareVal < 1) return null; // Skip tiny elements for readability

                            return (
                                <div
                                    key={`visual-${item.category}`}
                                    onClick={() => toggleCategoryExpand(item.category)}
                                    className={`h-14 rounded-xl transition-all duration-300 hover:brightness-95 hover:scale-[1.01] active:scale-95 cursor-pointer text-white flex flex-col justify-center items-center px-2 select-none text-center relative group min-w-[32px] shadow-3xs ${style.bg}`}
                                    style={{ width: `${shareVal}%` }}
                                    title={`${item.category}: ${shareVal.toFixed(1)}%`}
                                >
                                    <span className="text-[10px] font-black uppercase tracking-wider truncate w-full">
                                        {item.category.substring(0, 8)}
                                    </span>
                                    <span className="text-[9px] font-bold opacity-90 leading-tight">
                                        {shareVal.toFixed(1)}%
                                    </span>

                                    {/* Rich Tooltip on Hover */}
                                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 transition-all bg-gray-900 text-white border border-gray-800 text-[10.5px] p-3 rounded-xl whitespace-nowrap z-50 shadow-xl pointer-events-none flex flex-col gap-1">
                                        <p className="font-extrabold tracking-wide uppercase text-lime-400">{item.category}</p>
                                        <div className="flex justify-between gap-6 font-bold text-gray-400 text-[10px] border-t border-gray-800 pt-1.5 mt-1">
                                            <span>{t('distributionShare')}: <strong className="text-white">{shareVal.toFixed(1)}%</strong></span>
                                            <span>{t('quantity')}: <strong className="text-white">{item.count} {t('pcs')}</strong></span>
                                        </div>
                                        <p className="text-[9px] font-bold text-gray-500 mt-0.5">{t('clickToOpenDetail')}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 2: CATEGORY DONUT CHART */}
            {activeTab === 'donut' && (
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    {/* SVG Interactive Donut Chart */}
                    <div className="flex flex-col items-center justify-center relative">
                        <svg viewBox="0 0 200 200" className="w-64 h-64 drop-shadow-md">
                            {donutSlices.map((slice, idx) => (
                                <path
                                    key={slice.category}
                                    d={slice.pathData}
                                    fill={slice.color}
                                    className="transition-all duration-300 cursor-pointer hover:opacity-85 hover:scale-105 origin-center"
                                    onMouseEnter={() => setActiveDonutSlice(idx)}
                                    onMouseLeave={() => setActiveDonutSlice(null)}
                                    onClick={() => toggleCategoryExpand(slice.category)}
                                />
                            ))}
                        </svg>

                        {/* Central Stat Ring Info */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            {activeDonutSlice !== null && donutSlices[activeDonutSlice] ? (
                                <div className="text-center animate-fade-in">
                                    <span className="text-[9px] font-black uppercase text-gray-400 block truncate max-w-[100px]">
                                        {donutSlices[activeDonutSlice].category}
                                    </span>
                                    <span className="text-xl font-black text-gray-900">
                                        {donutSlices[activeDonutSlice].share.toFixed(1)}%
                                    </span>
                                    <span className="text-[9px] font-bold text-lime-600 block">
                                        {donutSlices[activeDonutSlice].count} {t('pcs')}
                                    </span>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <span className="text-[9px] font-black uppercase text-gray-400 block">
                                        {t('activeCategories')}
                                    </span>
                                    <span className="text-2xl font-black text-gray-900">
                                        {shelfShareData.length}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Donut Legend List */}
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
                        <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">
                            {t('categoryDistribution')}
                        </h4>
                        {shelfShareData.map((item, idx) => {
                            const style = getCategoryColorStyles(idx);
                            const isHovered = activeDonutSlice === idx;

                            return (
                                <div
                                    key={`legend-${item.category}`}
                                    onMouseEnter={() => setActiveDonutSlice(idx)}
                                    onMouseLeave={() => setActiveDonutSlice(null)}
                                    onClick={() => toggleCategoryExpand(item.category)}
                                    className={`flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer border ${
                                        isHovered 
                                            ? 'bg-lime-50 border-lime-200 shadow-2xs' 
                                            : 'bg-gray-50/50 hover:bg-gray-100/80 border-gray-100'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`w-3.5 h-3.5 rounded-md shrink-0 ${style.bg}`} />
                                        <span className="text-xs font-bold text-gray-800 truncate">
                                            {item.category}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-xs font-black text-gray-900">
                                            {item.share.toFixed(1)}%
                                        </span>
                                        <span className="text-[10px] font-extrabold text-gray-400 bg-white px-2 py-0.5 rounded-md border border-gray-150">
                                            {item.count} {t('pcs')}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 3: BRAND SHARE LEADERBOARD */}
            {activeTab === 'brands' && (
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-4">
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-wider text-gray-900 flex items-center gap-2">
                                <Award className="w-4 h-4 text-amber-500" />
                                {t('brandShareTitle')}
                            </h3>
                            <p className="text-[11px] text-gray-400 font-bold mt-0.5">
                                {t('topBrandsRank')}
                            </p>
                        </div>
                        <span className="text-xs font-extrabold bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-xl">
                            {t('uniqueBrandsCount')}: <strong>{brandShareData.length}</strong>
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-150 text-[10px] font-black uppercase tracking-wider text-gray-400 bg-gray-50/50">
                                    <th className="py-3 px-4 w-16">#</th>
                                    <th className="py-3 px-4">{t('brandName')}</th>
                                    <th className="py-3 px-4">{t('brandCategory')}</th>
                                    <th className="py-3 px-4 text-center">{t('facingsCount')}</th>
                                    <th className="py-3 px-4 text-right">{t('brandShelfShare')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-xs font-bold text-gray-800">
                                {brandShareData.map((b, idx) => {
                                    const rankBadge = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                                    
                                    return (
                                        <tr key={`brand-${b.brand}-${idx}`} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="py-3.5 px-4 font-black text-sm text-gray-500">
                                                {rankBadge}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className="font-extrabold text-gray-900 text-sm">
                                                    {b.brand}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-gray-500 text-xs font-medium">
                                                {b.category}
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                <span className="bg-gray-100 text-gray-800 px-2.5 py-1 rounded-lg text-xs font-black">
                                                    {b.count} {t('pcs')}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <div className="w-24 bg-gray-100 h-2 rounded-full overflow-hidden hidden sm:block">
                                                        <div 
                                                            className="h-full bg-lime-500 rounded-full"
                                                            style={{ width: `${b.brandShare}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-black text-lime-700">
                                                        {b.brandShare.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* DYNAMIC SEARCH AND ADVANCED CATEGORY FILTER Segment - NO-PRINT */}
            <div className="bg-gray-50 p-5 rounded-[2rem] border border-gray-150/60 shadow-inner no-print flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div>
                    <span className="text-[9px] uppercase tracking-wider font-extrabold block text-gray-450 mb-1">{t('filteringAndSearch')}</span>
                    <h4 className="font-black text-xs text-gray-800">
                        {t('showingCatsOf', { count: filteredShareData.length, total: shelfShareData.length })}
                    </h4>
                </div>

                <div className="relative w-full sm:w-80">
                    <input
                        type="text"
                        placeholder={t('searchCategoryOrProduct')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white border border-gray-250 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-bold text-gray-850 placeholder-gray-450 focus:outline-none focus:ring-2 focus:ring-lime-500 transition-all border-dashed"
                    />
                    <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3.5 top-2.5 text-gray-400 hover:text-gray-750 font-bold text-[10px] bg-gray-100 px-2 py-0.5 rounded-lg cursor-pointer"
                        >
                            {t('clearSelection')}
                        </button>
                    )}
                </div>
            </div>

            {/* CATEGORIES DETAILED GRID */}
            <div className="space-y-4">
                {filteredShareData.map((item, index) => {
                    const isExpanded = expandedCategory === item.category;
                    const colorIndex = shelfShareData.findIndex(x => x.category === item.category);
                    const style = getCategoryColorStyles(colorIndex !== -1 ? colorIndex : index);

                    return (
                        <div 
                            key={`cat-card-${item.category}`} 
                            id={`cat-card-${item.category}`}
                            className={`bg-white rounded-[1.8rem] border transition-all duration-300 shadow-2xs group flex flex-col overflow-hidden ${isExpanded ? 'ring-1 ring-lime-400/50 border-lime-200' : 'border-gray-100'}`}
                        >
                            {/* Accordion Row Header */}
                            <div 
                                onClick={() => toggleCategoryExpand(item.category)}
                                className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/50 select-none"
                            >
                                <div className="flex items-center gap-4 w-full md:w-auto min-w-0">
                                    <div className={`p-3 rounded-xl shrink-0 ${style.bgLight} border ${style.border}`}>
                                        <FolderOpen className={`w-5 h-5 ${style.text}`} />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-black text-gray-900 text-sm uppercase tracking-wider truncate">
                                            {item.category}
                                        </h4>
                                        <p className="text-[11px] text-gray-400 font-bold mt-0.5 flex items-center gap-1.5">
                                            <span>{t('containsSku', { count: item.constituents.length })}</span>
                                            <span>•</span>
                                            <span>{t('totalPcs', { count: item.count })}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between md:justify-end gap-5 w-full md:w-auto border-t border-gray-100/50 md:border-0 pt-3 md:pt-0">
                                    <div className="text-left md:text-right">
                                        <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block">{t('capturedShare')}</span>
                                        <span className={`text-xl font-black ${style.text}`}>
                                            {item.share.toFixed(1)}%
                                        </span>
                                    </div>

                                    <div className="w-24 bg-gray-100 h-2.5 rounded-full overflow-hidden shrink-0 hidden sm:block">
                                        <div 
                                            className={`h-full rounded-full ${style.bg}`}
                                            style={{ width: `${item.share}%` }}
                                        />
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black uppercase text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 shrink-0">
                                            {isExpanded ? t('hideList') : t('expandProducts')}
                                        </span>
                                        <div className="p-1 px-1.5 bg-gray-100 rounded-lg text-gray-500">
                                            {isExpanded ? (
                                                <ChevronUp className="w-4 h-4 hover:translate-y-0.5" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 hover:-translate-y-0.5" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed breakdown sub-list section */}
                            {isExpanded && (
                                <div className="px-6 pb-6 pt-1 border-t border-dashed border-gray-100 bg-gray-50/20 text-left">
                                    
                                    <div className="mb-4 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-2.5">
                                        <span>{t('itemIdentifiedProduct')}</span>
                                        <div className="flex items-center gap-6">
                                            <span>{t('categoryShareLabel')}</span>
                                            <span className="w-20 text-right">{t('totalShareLabel')}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3.5">
                                        {item.constituents.map((c, i) => (
                                            <div 
                                                key={`constituent-${c.name}-${i}`}
                                                className="bg-white p-4 rounded-2xl border border-gray-100 shadow-3xs hover:border-gray-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="text-xs font-black text-gray-800 leading-snug tracking-tight">
                                                            {c.name}
                                                        </span>
                                                        {c.brand && (
                                                            <span className="text-[9px] uppercase font-black bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                                                                {c.brand}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 font-bold mt-1 flex items-center gap-2">
                                                        <span>{t('pcsCountLabel', { count: c.count })}</span>
                                                        <span>•</span>
                                                        <span>{t('measuredAreaLabel', { area: (c.area / 1000).toFixed(1) })}</span>
                                                    </p>
                                                </div>

                                                <div className="flex items-center justify-between sm:justify-end gap-6 border-t border-gray-50 pt-2.5 sm:pt-0 sm:border-0">
                                                    <div className="space-y-1">
                                                        <span className="text-[9px] uppercase font-black text-gray-400 tracking-wider block sm:text-right">
                                                            {t('shareWithinCategory')}
                                                        </span>
                                                        <div className="flex items-center gap-2.5 justify-end">
                                                            <div className="w-20 bg-gray-100 h-2 rounded-full overflow-hidden hidden sm:block">
                                                                <div 
                                                                    className={`h-full rounded-full ${style.bg}`}
                                                                    style={{ width: `${c.categoryShare}%` }}
                                                                />
                                                            </div>
                                                            <span className="text-xs font-extrabold text-gray-700 shrink-0">
                                                                {c.categoryShare.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="text-right border-l border-gray-150 pl-4">
                                                        <span className="text-[9px] uppercase font-black text-gray-400 tracking-wider block">
                                                            {t('totalShareLabel')}
                                                        </span>
                                                        <span className="text-sm font-black text-lime-600">
                                                            {c.globalShare.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {filteredShareData.length === 0 && (
                    <div className="text-center py-16 bg-gray-50 rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center">
                        <div className="bg-white w-14 h-14 rounded-full flex items-center justify-center mb-4 shadow-3xs border border-gray-100">
                            <Info className="w-6 h-6 text-gray-300" />
                        </div>
                        <p className="text-sm font-black text-gray-800">{t('noCategoriesMatch')}</p>
                        <p className="text-xs text-gray-400 font-bold mt-1 max-w-xs">{t('tryDifferentTerm')}</p>
                    </div>
                )}
            </div>

            {/* LIGHTBOX MODAL: SOURCE AUDIT PHOTO INSPECTOR */}
            {inspectedImage && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in no-print">
                    <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-gray-800">
                        {/* Modal Header */}
                        <div className="p-4 sm:p-5 bg-gray-900 text-white flex items-center justify-between border-b border-gray-800">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2 bg-lime-500/20 text-lime-400 rounded-xl">
                                    <Camera className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-extrabold text-sm truncate" title={inspectedImage.file.name}>
                                        {inspectedImage.file.name}
                                    </h3>
                                    <p className="text-[10px] text-gray-400 font-bold flex items-center gap-2">
                                        <span>{getStoreIdentifier(inspectedImage.analysisResult?.storeInfo)}</span>
                                        <span>•</span>
                                        <span>{inspectedImage.analysisResult?.products?.length || 0} fejsov</span>
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => togglePhotoExclusion(inspectedImage.id)}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                                        excludedPhotoIds.has(inspectedImage.id)
                                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                            : 'bg-lime-500/20 text-lime-400 border border-lime-500/30'
                                    }`}
                                >
                                    {excludedPhotoIds.has(inspectedImage.id) ? (
                                        <>
                                            <Square className="w-3.5 h-3.5" />
                                            {t('excludedFromSos')}
                                        </>
                                    ) : (
                                        <>
                                            <CheckSquare className="w-3.5 h-3.5" />
                                            {t('includedInSos')}
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => setInspectedImage(null)}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Main Content */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 bg-gray-950 text-white">
                            {/* Left Col: Interactive Bounding Box Overlay */}
                            <div className="lg:col-span-2 relative bg-black rounded-2xl overflow-hidden border border-gray-800 flex flex-col justify-center min-h-[400px]">
                                {inspectedImage.imageUrl ? (
                                    <BoundingBoxOverlay
                                        imageUrl={inspectedImage.imageUrl}
                                        imageAlt={inspectedImage.file.name}
                                        products={inspectedImage.analysisResult?.products || []}
                                        highlightedProductName={modalHighlightedProduct}
                                        onSelectProduct={(p) => setModalHighlightedProduct(p.name)}
                                        showControls={true}
                                        allowZoomPan={true}
                                        allowFullScreen={false}
                                    />
                                ) : (
                                    <p className="text-gray-500 font-bold text-xs text-center p-8">{t('noImagePreview')}</p>
                                )}
                            </div>

                            {/* Right Col: Detected Products Breakdown List */}
                            <div className="space-y-4 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-lime-400 flex items-center gap-1.5">
                                            <Box className="w-4 h-4" />
                                            {t('detectedProductsInPhoto')} ({inspectedImage.analysisResult?.products?.length || 0})
                                        </h4>
                                        {modalHighlightedProduct && (
                                            <button
                                                onClick={() => setModalHighlightedProduct(null)}
                                                className="text-[10px] text-gray-400 hover:text-white underline font-bold"
                                            >
                                                Zrušiť výber
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1 scrollbar-thin">
                                        {inspectedImage.analysisResult?.products?.map((p, pIdx) => {
                                            const isSelected = modalHighlightedProduct === p.name;
                                            return (
                                                <div 
                                                    key={`p-${p.id || pIdx}`}
                                                    onClick={() => setModalHighlightedProduct(isSelected ? null : p.name)}
                                                    onMouseEnter={() => setModalHighlightedProduct(p.name)}
                                                    className={`p-3 rounded-xl border text-xs flex justify-between items-center cursor-pointer transition-all ${
                                                        isSelected 
                                                            ? 'bg-lime-950/60 border-lime-500 ring-2 ring-lime-400/50 shadow-md' 
                                                            : 'bg-gray-900 border-gray-800 hover:border-gray-700 hover:bg-gray-850'
                                                    }`}
                                                >
                                                    <div className="min-w-0 pr-2">
                                                        <p className={`font-extrabold truncate ${isSelected ? 'text-lime-300' : 'text-white'}`}>{p.name}</p>
                                                        {p.brand && (
                                                            <span className="text-[9px] font-black uppercase text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                                                {p.brand}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {p.confidence && (
                                                        <span className="text-[10px] font-bold text-lime-400 bg-lime-500/10 px-2 py-0.5 rounded-md border border-lime-500/20 shrink-0">
                                                            {(p.confidence * 100).toFixed(0)}% AI
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-800">
                                    <button
                                        onClick={() => {
                                            setSelectedPhotoId(inspectedImage.id);
                                            setInspectedImage(null);
                                        }}
                                        className="w-full py-2.5 bg-lime-600 hover:bg-lime-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                                    >
                                        <Filter className="w-4 h-4" />
                                        {t('filterByThisPhoto')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer - Image Switching Controls */}
                        <div className="p-4 bg-gray-900 border-t border-gray-800 flex justify-between items-center text-xs text-gray-400 font-bold">
                            <span>
                                #{images.findIndex(img => img.id === inspectedImage.id) + 1} z {images.length}
                            </span>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        const curIdx = images.findIndex(img => img.id === inspectedImage.id);
                                        if (curIdx > 0) setInspectedImage(images[curIdx - 1]);
                                    }}
                                    disabled={images.findIndex(img => img.id === inspectedImage.id) === 0}
                                    className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors cursor-pointer flex items-center gap-1"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    {t('previousPage')}
                                </button>
                                <button
                                    onClick={() => {
                                        const curIdx = images.findIndex(img => img.id === inspectedImage.id);
                                        if (curIdx < images.length - 1) setInspectedImage(images[curIdx + 1]);
                                    }}
                                    disabled={images.findIndex(img => img.id === inspectedImage.id) === images.length - 1}
                                    className="p-2 rounded-xl bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors cursor-pointer flex items-center gap-1"
                                >
                                    {t('nextPage')}
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
