import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../i18n/index.tsx';
import { getAnalyses } from '../db.ts';
import type { SerializableImageState, DetectedProduct } from '../types.ts';
import { getCategoryFromName, base64ToFile, getImageStoreName } from '../utils/helpers.ts';
import { 
    AppIcon, 
    SpinnerIcon, 
    SearchIcon, 
    BuildingStorefrontIcon, 
    CloseIcon, 
    CalendarDaysIcon,
    ChevronRightIcon,
    ArrowLeftIcon,
    CircleStackIcon
} from './Icons.tsx';

interface GalleryItem {
    id: string;
    analysisId: string;
    analysisName: string;
    imageUrl: string;
    uploadDate: Date;
    storeName: string;
    products: DetectedProduct[];
    rawImage: SerializableImageState;
}

export const GalleryPanel: React.FC = () => {
    const { t } = useTranslation();
    const [items, setItems] = useState<GalleryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
    
    // Filtre
    const [searchProduct, setSearchProduct] = useState('');
    const [selectedStore, setSelectedStore] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Metadáta pre filtre
    const [allStores, setAllStores] = useState<string[]>([]);
    const [allCategories, setAllCategories] = useState<string[]>([]);

    useEffect(() => {
        const createdUrls: string[] = [];

        const loadGallery = async () => {
            setIsLoading(true);
            try {
                const analyses = await getAnalyses();
                const flattened: GalleryItem[] = [];
                const storesSet = new Set<string>();
                const categoriesSet = new Set<string>();

                analyses.forEach(analysis => {
                    analysis.images.forEach(img => {
                        const file = base64ToFile(img.file.data, img.file.name, img.file.type, img.file.lastModified);
                        const url = URL.createObjectURL(file);
                        createdUrls.push(url);
                        
                        const storeName = getImageStoreName(img, t('unknownStore'), analysis.store?.name || null);
                        storesSet.add(storeName);
                        
                        const products = img.analysisResult?.products || [];
                        products.forEach(p => {
                            categoriesSet.add(getCategoryFromName(p.name, t('unassignedCategory')));
                        });

                        flattened.push({
                            id: img.id,
                            analysisId: analysis.id,
                            analysisName: analysis.name,
                            imageUrl: url,
                            uploadDate: new Date(img.uploadDate),
                            storeName,
                            products,
                            rawImage: img
                        });
                    });
                });

                setItems(flattened.sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime()));
                setAllStores(Array.from(storesSet).sort());
                setAllCategories(Array.from(categoriesSet).sort());
            } catch (e) {
                console.error("Gallery load error:", e);
            } finally {
                setIsLoading(false);
            }
        };
        loadGallery();

        return () => {
            createdUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [t]);

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchesProduct = searchProduct === '' || 
                item.products.some(p => p.name.toLowerCase().includes(searchProduct.toLowerCase()));
            
            const matchesStore = selectedStore === 'all' || item.storeName === selectedStore;
            
            const matchesCategory = selectedCategory === 'all' || 
                item.products.some(p => getCategoryFromName(p.name, t('unassignedCategory')) === selectedCategory);

            return matchesProduct && matchesStore && matchesCategory;
        });
    }, [items, searchProduct, selectedStore, selectedCategory, t]);

    // Zoskupenie produktov pre detail fotografie
    const groupedProductsOnImage = useMemo(() => {
        if (!selectedItem) return [];
        
        const groupMap = new Map<string, { product: DetectedProduct, count: number }>();
        
        selectedItem.products.forEach(p => {
            const existing = groupMap.get(p.name);
            if (existing) {
                existing.count++;
            } else {
                groupMap.set(p.name, { product: p, count: 1 });
            }
        });
        
        return Array.from(groupMap.values()).sort((a, b) => b.count - a.count);
    }, [selectedItem]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <SpinnerIcon className="w-12 h-12 text-lime-600 animate-spin" />
                <p className="mt-4 text-gray-500 font-medium">{t('pleaseWait')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
            {/* Filter Bar */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 items-center sticky top-0 z-20">
                <div className="relative flex-grow w-full">
                    <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                        type="text"
                        placeholder={t('filterByProduct')}
                        className="w-full pl-14 pr-6 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-lime-500 shadow-inner transition-shadow"
                        value={searchProduct}
                        onChange={(e) => setSearchProduct(e.target.value)}
                    />
                </div>
                
                <div className="flex gap-4 w-full md:w-auto">
                    <select 
                        className="flex-1 md:w-56 bg-gray-50 border-none rounded-2xl text-sm font-bold py-4 px-6 focus:ring-2 focus:ring-lime-500 shadow-inner transition-shadow appearance-none cursor-pointer"
                        value={selectedStore}
                        onChange={(e) => setSelectedStore(e.target.value)}
                    >
                        <option value="all">{t('allStores')}</option>
                        {allStores.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    <select 
                        className="flex-1 md:w-56 bg-gray-50 border-none rounded-2xl text-sm font-bold py-4 px-6 focus:ring-2 focus:ring-lime-500 shadow-inner transition-shadow appearance-none cursor-pointer"
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                        <option value="all">{t('allCategories')}</option>
                        {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            {/* Gallery Grid */}
            {filteredItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {filteredItems.map(item => (
                        <div 
                            key={item.id}
                            onClick={() => setSelectedItem(item)}
                            className="group relative aspect-square bg-gray-100 rounded-[2rem] overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100"
                        >
                            <img 
                                src={item.imageUrl} 
                                alt={item.analysisName} 
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                loading="lazy"
                            />
                            {/* Overlay info */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-6 flex flex-col justify-end">
                                <p className="text-white text-sm font-black uppercase tracking-widest truncate mb-2 drop-shadow-md">{item.storeName}</p>
                                <p className="text-white/90 text-[10px] font-bold uppercase tracking-widest drop-shadow-md">{item.uploadDate.toLocaleDateString()}</p>
                                <div className="mt-4 flex items-center gap-2">
                                    <span className="bg-lime-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl shadow-md">
                                        {item.products.length} {t('totalLabel')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-32 flex flex-col items-center justify-center bg-gray-50 rounded-[3rem] border border-dashed border-gray-200 shadow-sm animate-fade-in mx-4">
                    <div className="bg-white w-24 h-24 rounded-full flex items-center justify-center mb-8 shadow-sm border border-gray-100">
                        <AppIcon className="w-10 h-10 text-gray-300" />
                    </div>
                    <p className="text-2xl font-black text-gray-900 mb-4 tracking-tight">
                        {t('noImagesInGallery')}
                    </p>
                    <p className="text-gray-500 max-w-sm text-lg font-medium leading-relaxed">
                        Skúste zmeniť filtre alebo vyhľadávanie.
                    </p>
                </div>
            )}

            {/* Detail Lightbox */}
            {selectedItem && (
                <div className="fixed inset-0 bg-gray-950/95 z-[100] flex animate-fade-in">
                    <div className="flex-grow relative flex items-center justify-center p-6">
                        <img 
                            src={selectedItem.imageUrl} 
                            alt="Full preview"
                            className="max-w-full max-h-full object-contain rounded-[2rem] shadow-2xl"
                        />
                        <button 
                            onClick={() => setSelectedItem(null)}
                            className="absolute top-10 left-10 p-5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-md active:scale-95 shadow-lg"
                        >
                            <ArrowLeftIcon className="w-7 h-7" />
                        </button>
                    </div>

                    {/* Side Info Panel */}
                    <div className="w-full md:w-[480px] bg-white h-full flex flex-col shadow-[-20px_0_40px_rgba(0,0,0,0.3)]">
                        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-2xl font-black text-gray-900 tracking-tight">{t('photoDetail')}</h3>
                            <button onClick={() => setSelectedItem(null)} className="p-3 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-2xl transition-all active:scale-95"><CloseIcon className="w-6 h-6" /></button>
                        </div>

                        <div className="flex-grow overflow-y-auto p-8 space-y-10 custom-scrollbar">
                            {/* Metadata */}
                            <section className="space-y-6">
                                <div className="flex items-start gap-5">
                                    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-sm">
                                        <BuildingStorefrontIcon className="w-7 h-7 text-blue-600" />
                                    </div>
                                    <div className="pt-1">
                                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">{t('storeName')}</p>
                                        <p className="text-xl font-black text-gray-900 leading-tight">{selectedItem.storeName}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-5">
                                    <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl shadow-sm">
                                        <CalendarDaysIcon className="w-7 h-7 text-orange-600" />
                                    </div>
                                    <div className="pt-1">
                                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">{t('detectedAt')}</p>
                                        <p className="text-lg font-bold text-gray-700 leading-tight">{selectedItem.uploadDate.toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-5">
                                    <div className="p-4 bg-gradient-to-br from-lime-50 to-emerald-50 rounded-2xl shadow-sm">
                                        <CircleStackIcon className="w-7 h-7 text-lime-600" />
                                    </div>
                                    <div className="pt-1">
                                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Analýza</p>
                                        <p className="text-lg font-bold text-gray-700 leading-tight">{selectedItem.analysisName}</p>
                                    </div>
                                </div>
                            </section>

                            {/* Grouped Products List */}
                            <section>
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest">{t('productsOnImage')}</h4>
                                    <span className="bg-lime-600 text-white text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-sm">{selectedItem.products.length} ks celkovo</span>
                                </div>
                                <div className="space-y-3">
                                    {groupedProductsOnImage.map((group, idx) => (
                                        <div key={idx} className="bg-gray-50 p-5 rounded-2xl border border-gray-100 flex justify-between items-center transition-all hover:border-lime-200 hover:shadow-md group">
                                            <div className="min-w-0 flex-1 pr-4">
                                                <p className="text-[9px] text-lime-700 font-black uppercase tracking-widest opacity-70 mb-1.5">
                                                    {getCategoryFromName(group.product.name, t('unassignedCategory'))}
                                                </p>
                                                <p className="text-sm font-bold text-gray-900 truncate group-hover:text-lime-700 transition-colors">
                                                    {group.product.name}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-4 flex-shrink-0">
                                                {group.product.prices && group.product.prices.length > 0 && (
                                                    <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl shadow-sm ${group.product.prices[0].type === 'PROMO' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-white text-gray-800 border border-gray-200'}`}>
                                                        {group.product.prices[0].value}
                                                    </span>
                                                )}
                                                <div className="bg-white border-2 border-lime-500 text-lime-700 text-sm font-black w-11 h-11 flex items-center justify-center rounded-full shadow-sm">
                                                    {group.count}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>

                        {/* Actions */}
                        <div className="p-8 bg-gray-50/50 border-t border-gray-100">
                             <button 
                                onClick={() => {
                                    setSelectedItem(null);
                                }}
                                className="w-full py-4 bg-gray-900 text-white font-black rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm shadow-xl shadow-gray-200 hover:-translate-y-1 active:scale-95"
                             >
                                <ChevronRightIcon className="w-5 h-5 text-lime-500" />
                                {t('viewInAnalysis')}
                             </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};