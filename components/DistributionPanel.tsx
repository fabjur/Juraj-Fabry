
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from '../i18n/index.tsx';
import { getAnalyses, getCatalogProductNames, saveDistributionReport, getDistributionReports, deleteDistributionReport, getStores } from '../db.ts';
import { DistributionMatrix, DistributionRow, DistributionReport, DistributionCell } from '../types.ts';
import { removeDateFromStoreName, findBestMatch } from '../utils/helpers.ts';
import { exportDistributionToXLS } from '../utils/export.ts';
import { 
    TableCellsIcon, 
    FunnelIcon, 
    SpinnerIcon, 
    ArrowDownTrayIcon, 
    SaveIcon, 
    FolderOpenIcon, 
    TrashIcon, 
    CloseIcon
} from './Icons.tsx';
import { 
    HelpCircle, 
    ChevronDown, 
    ChevronUp, 
    AlertTriangle, 
    Search, 
    Store, 
    Check, 
    X,
    ClipboardCheck,
    AlertOctagon
} from 'lucide-react';
import type { ImageState } from '../hooks/useImageAnalysis.ts';

interface DistributionPanelProps {
    activeImages?: ImageState[]; // NEW: Pridané pre spracovanie aj neuložených analýz
}

export const DistributionPanel: React.FC<DistributionPanelProps> = ({ activeImages = [] }) => {
    const { t } = useTranslation();
    const [allCatalogProducts, setAllCatalogProducts] = useState<string[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
    const [matrix, setMatrix] = useState<DistributionMatrix | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);

    // Guide and Stats States
    const [storesCount, setStoresCount] = useState<number>(0);
    const [analysesCount, setAnalysesCount] = useState<number>(0);
    const [isGuideOpen, setIsGuideOpen] = useState<boolean>(true);
    const [productSearchTerm, setProductSearchTerm] = useState<string>('');

    // Report Management States
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
    const [newReportName, setNewReportName] = useState('');
    const [savedReports, setSavedReports] = useState<DistributionReport[]>([]);

    const toggleProductSelection = (product: string) => {
        setSelectedProducts(prev => 
            prev.includes(product) 
                ? prev.filter(p => p !== product)
                : [...prev, product]
        );
    };

    const selectAll = () => setSelectedProducts(allCatalogProducts);
    const deselectAll = () => setSelectedProducts([]);

    const generateMatrix = useCallback(async () => {
        if (selectedProducts.length === 0) return;
        setIsCalculating(true);

        try {
            const archivedAnalyses = await getAnalyses();
            const allStores = await getStores();
            
            // Map: UniqueIdentifier -> { name, code, productData: Map<CanonicalProductName, { count: number, maxConfidence: number }>, totalFacings: number }
            // FIX: Refactored internal storage to satisfy count and totalFacings requirements in DistributionCell and DistributionRow
            const storeInventory = new Map<string, { 
                name: string, 
                code?: string, 
                productData: Map<string, { count: number, maxConfidence: number }>,
                totalFacings: number 
            }>();

            // 1. PRE-FILL: Inicializácia inventára pre VŠETKY známe predajne z DB
            allStores.forEach(store => {
                const uniqueKey = `ID_${store.id}`;
                storeInventory.set(uniqueKey, { 
                    name: store.name, 
                    code: store.code, 
                    productData: new Map(),
                    totalFacings: 0 
                });
            });

            // 2. LIVE: Spracovanie AKTÍVNYCH dát z prebiehajúcej analýzy (SESSION DATA)
            activeImages.forEach(img => {
                if (img.status !== 'success' || !img.analysisResult) return;
                
                let uniqueKey = '';
                if (img.assignedStoreId) {
                    uniqueKey = `ID_${img.assignedStoreId}`;
                } else if (img.analysisResult.storeInfo) {
                    const chain = removeDateFromStoreName(img.analysisResult.storeInfo.chain);
                    uniqueKey = `RAW_${chain}`;
                }

                if (!uniqueKey) return;
                
                // Ak predajňa ešte nie je v inventári (nie je v DB), pridáme ju ad-hoc
                if (!storeInventory.has(uniqueKey)) {
                    storeInventory.set(uniqueKey, { 
                        name: uniqueKey.replace('RAW_', '').replace('ID_', 'Predajňa #'), 
                        productData: new Map(),
                        totalFacings: 0
                    });
                }

                const inventory = storeInventory.get(uniqueKey)!;
                img.analysisResult.products.forEach(p => {
                    // Update total store facings
                    if (p.type === 'product' && !p.isGhost) {
                        inventory.totalFacings++;
                    }

                    // Berieme len produkty s aspoň 70% istotou pre OSA report
                    if (p.confidence < 0.7) return;
                    
                    const matchedName = findBestMatch(p.name, selectedProducts);
                    if (matchedName) {
                        const current = inventory.productData.get(matchedName) || { count: 0, maxConfidence: 0 };
                        inventory.productData.set(matchedName, {
                            count: current.count + 1,
                            maxConfidence: Math.max(current.maxConfidence, p.confidence)
                        });
                    }
                });
            });

            // 3. ARCHIVE: Spracovanie ARCHÍVNYCH dát
            archivedAnalyses.forEach(analysis => {
                analysis.images.forEach(img => {
                    if (!img.analysisResult) return;
                    
                    let uniqueKey = '';
                    if (img.assignedStoreId) {
                        uniqueKey = `ID_${img.assignedStoreId}`;
                    } else if (img.analysisResult.storeInfo) {
                        const chain = removeDateFromStoreName(img.analysisResult.storeInfo.chain);
                        uniqueKey = `RAW_${chain}`;
                    }

                    if (!uniqueKey || !storeInventory.has(uniqueKey)) return;

                    const inventory = storeInventory.get(uniqueKey)!;
                    img.analysisResult.products.forEach(p => {
                        if (p.type === 'product' && !p.isGhost) {
                            inventory.totalFacings++;
                        }

                        const matchedName = findBestMatch(p.name, selectedProducts);
                        if (matchedName) {
                            const current = inventory.productData.get(matchedName) || { count: 0, maxConfidence: 0 };
                            inventory.productData.set(matchedName, {
                                count: current.count + 1,
                                maxConfidence: Math.max(current.maxConfidence, p.confidence)
                            });
                        }
                    });
                });
            });

            // 4. Budovanie riadkov matice
            const rows: DistributionRow[] = [];
            const columnCounts: Record<string, number> = {};
            selectedProducts.forEach(p => columnCounts[p] = 0);

            for (const [key, data] of storeInventory.entries()) {
                const presenceRecord: Record<string, DistributionCell> = {};
                let presentInStoreCount = 0;

                selectedProducts.forEach(targetProduct => {
                    const stats = data.productData.get(targetProduct) || { count: 0, maxConfidence: 0 };
                    const isPresent = stats.count > 0;

                    // FIX: Added missing count property to DistributionCell
                    presenceRecord[targetProduct] = { isPresent, count: stats.count, maxConfidence: stats.maxConfidence };
                    if (isPresent) {
                        presentInStoreCount++;
                        columnCounts[targetProduct]++;
                    }
                });

                const fulfillment = selectedProducts.length > 0 ? (presentInStoreCount / selectedProducts.length) * 100 : 0;

                // Do reportu zahrnieme predajňu ak má aspoň jeden produkt alebo je to "ID" predajňa (oficiálna z DB)
                if (presentInStoreCount > 0 || key.startsWith('ID_')) {
                    // FIX: Added missing totalFacings property to DistributionRow
                    rows.push({
                        storeName: data.name,
                        storeId: key.startsWith('ID_') ? parseInt(key.split('_')[1]) : undefined,
                        storeCode: data.code,
                        presence: presenceRecord,
                        totalFacings: data.totalFacings,
                        fulfillment
                    });
                }
            }

            // Zoradenie: Najprv predajne s najvyšším plnením
            rows.sort((a, b) => b.fulfillment - a.fulfillment || a.storeName.localeCompare(b.storeName));

            const columnSummaries: Record<string, number> = {};
            const totalRowsInMatrix = rows.length;
            
            selectedProducts.forEach(p => {
                columnSummaries[p] = totalRowsInMatrix > 0 ? (columnCounts[p] / totalRowsInMatrix) * 100 : 0;
            });

            // FIX: Set matrix state properties (selectedEntities, mode) to match DistributionMatrix interface
            setMatrix({ 
                rows, 
                columnSummaries, 
                selectedEntities: selectedProducts,
                mode: 'sku'
            });
        } catch (error) {
            console.error("Distribution error:", error);
        } finally {
            setIsCalculating(false);
        }
    }, [selectedProducts, activeImages]);

    const handleExport = () => {
        if (matrix) exportDistributionToXLS(matrix, t);
    };

    useEffect(() => {
        const loadData = async () => {
            const [products, stores, analyses] = await Promise.all([
                getCatalogProductNames(),
                getStores(),
                getAnalyses()
            ]);
            
            setAllCatalogProducts(products.sort());
            setStoresCount(stores?.length || 0);
            setAnalysesCount(analyses?.length || 0);
            
            // AUTOMATIC PRE-SELECTION: Ak užívateľ nemá nič vybrané, pre-selectneme produkty z aktuálnej dávky
            if (selectedProducts.length === 0 && activeImages.length > 0) {
                const foundInCurrent = new Set<string>();
                activeImages.forEach(img => {
                    img.analysisResult?.products.forEach(p => {
                        if (p.name) foundInCurrent.add(p.name);
                    });
                });
                
                if (foundInCurrent.size > 0) {
                    const toSelect = products.filter(p => foundInCurrent.has(p));
                    if (toSelect.length > 0) {
                        setSelectedProducts(toSelect);
                    }
                }
            }
        };
        loadData();
    }, [activeImages, selectedProducts.length]);

    // Prepočet kedykoľvek sa zmení výber alebo pribudnú nové úspešné analýzy
    const successfulActiveCount = useMemo(() => 
        activeImages.filter(img => img.status === 'success').length, 
    [activeImages]);

    useEffect(() => {
        if (selectedProducts.length > 0) {
            generateMatrix();
        } else {
            setMatrix(null);
        }
    }, [selectedProducts, successfulActiveCount, generateMatrix]);

    const openSaveModal = () => {
        const today = new Date();
        const defaultName = `${t('distributionModule')} - ${today.getDate()}.${today.getMonth() + 1}.${today.getFullYear()}`;
        setNewReportName(defaultName);
        setIsSaveModalOpen(true);
    };

    const handleSaveReport = async () => {
        if (!newReportName.trim()) return;
        await saveDistributionReport({
            name: newReportName.trim(),
            createdAt: new Date().toISOString(),
            selectedProducts: selectedProducts
        });
        setIsSaveModalOpen(false);
    };

    const openLoadModal = async () => {
        const reports = await getDistributionReports();
        setSavedReports(reports);
        setIsLoadModalOpen(true);
    };

    const handleLoadReport = (report: DistributionReport) => {
        setSelectedProducts(report.selectedProducts);
        setIsLoadModalOpen(false);
    };

    const handleDeleteReport = async (id?: number) => {
        if (id && window.confirm(t('deleteReportConfirm'))) {
             await deleteDistributionReport(id);
             const reports = await getDistributionReports();
             setSavedReports(reports);
        }
    };

    const osaMetrics = useMemo(() => {
        if (!matrix || matrix.rows.length === 0) return null;
        
        // 1. Average Availability
        const totalFulfillment = matrix.rows.reduce((sum, row) => sum + row.fulfillment, 0);
        const avgFulfillment = Math.round(totalFulfillment / matrix.rows.length);
        
        // 2. Critical Store (worst fulfillment)
        let worstStore = matrix.rows[0];
        matrix.rows.forEach(row => {
            if (row.fulfillment < worstStore.fulfillment) {
                worstStore = row;
            }
        });
        
        // 3. Worst Product (lowest columnSummaries percentage, representing highest out of stock)
        let worstProduct = '';
        let lowestPercentage = 101;
        
        matrix.selectedEntities.forEach(p => {
            const pct = matrix.columnSummaries[p] ?? 0;
            if (pct < lowestPercentage) {
                lowestPercentage = pct;
                worstProduct = p;
            }
        });
        
        return {
            avgFulfillment,
            worstStore: worstStore ? { name: worstStore.storeName, fulfillment: Math.round(worstStore.fulfillment) } : null,
            worstProduct: worstProduct ? { name: worstProduct, availability: Math.round(lowestPercentage) } : null
        };
    }, [matrix]);

    const renderCell = (cell?: DistributionCell) => {
        if (cell?.isPresent) {
            return (
                <div className="flex items-center justify-center p-1.5" title={`${t('presenceYes')} (${Math.round(cell.maxConfidence * 100)}% istota)`}>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-green-50 text-green-750 border border-green-200/60 shadow-xs">
                        <Check className="w-3.5 h-3.5 text-green-600" />
                        <span>ÁNO</span>
                        {cell.count && cell.count > 1 ? (
                            <span className="bg-green-200/60 text-[10px] px-1.5 rounded-md text-green-800 font-extrabold">
                                {cell.count} ks
                            </span>
                        ) : null}
                    </span>
                </div>
            );
        }
        return (
            <div className="flex items-center justify-center p-1.5" title={t('presenceNo')}>
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black tracking-wider bg-rose-50 text-rose-600 border border-rose-205/60 shadow-xs">
                    <X className="w-3 h-3 text-rose-500" />
                    <span>VÝPADOK</span>
                </span>
            </div>
        );
    };

    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 h-full flex flex-col max-w-[98vw] mx-auto animate-fade-in">
             {/* Save Modal */}
            {isSaveModalOpen && (
                <div className="fixed inset-0 bg-gray-800/80 flex items-center justify-center z-50 p-4">
                     <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8 border border-gray-100">
                        <h3 className="text-xl font-black mb-6 uppercase tracking-tight">{t('saveReportTitle')}</h3>
                        <input 
                            type="text" 
                            value={newReportName} 
                            onChange={(e) => setNewReportName(e.target.value)}
                            className="w-full bg-gray-50 border-none rounded-2xl p-4 mb-6 font-bold text-sm focus:ring-2 focus:ring-lime-500"
                            placeholder={t('reportNamePlaceholder')}
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setIsSaveModalOpen(false)} className="px-6 py-3 bg-gray-100 rounded-2xl hover:bg-gray-200 text-gray-600 font-bold transition-all">{t('cancelButton')}</button>
                            <button onClick={handleSaveReport} className="px-6 py-3 bg-lime-600 text-white rounded-2xl hover:bg-lime-700 font-bold shadow-lg shadow-lime-100 transition-all">{t('save')}</button>
                        </div>
                     </div>
                </div>
            )}

             {/* Load Modal */}
             {isLoadModalOpen && (
                <div className="fixed inset-0 bg-gray-800/80 flex items-center justify-center z-50 p-4">
                     <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-8 flex flex-col max-h-[85vh] border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                             <h3 className="text-xl font-black uppercase tracking-tight">{t('savedReports')}</h3>
                             <button onClick={() => setIsLoadModalOpen(false)}><CloseIcon className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <div className="flex-grow overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            {savedReports.length === 0 ? (
                                <p className="text-center text-gray-400 py-10 italic font-medium">{t('noSavedReports')}</p>
                            ) : (
                                savedReports.map(report => (
                                    <div key={report.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all border border-gray-100">
                                        <div className="min-w-0 flex-grow cursor-pointer" onClick={() => handleLoadReport(report)}>
                                            <p className="font-bold text-gray-900 truncate">{report.name}</p>
                                            <p className="text-[10px] text-gray-400 font-black uppercase">{new Date(report.createdAt).toLocaleDateString()} | {report.selectedProducts.length} SKU</p>
                                        </div>
                                        <div className="flex gap-1 ml-4">
                                            <button onClick={() => handleLoadReport(report)} className="p-2 text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors" title={t('load')}><FolderOpenIcon className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteReport(report.id)} className="p-2 text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors" title={t('delete')}><TrashIcon className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                     </div>
                </div>
            )}

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 flex items-center gap-4 tracking-tight">
                        <div className="p-3 bg-gradient-to-br from-lime-100 to-emerald-100 rounded-2xl shadow-sm">
                            <TableCellsIcon className="w-7 h-7 text-lime-600" />
                        </div>
                        {t('distributionModule')}
                    </h2>
                    {successfulActiveCount > 0 && (
                        <p className="text-xs text-lime-700 font-bold mt-3 bg-lime-50 border border-lime-100 px-4 py-1.5 rounded-xl w-fit flex items-center gap-2 shadow-sm">
                            <span className="w-2 h-2 rounded-full bg-lime-500 animate-pulse"></span>
                            LIVE SESSION: {t('analyzed')}: {successfulActiveCount} fotiek
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap gap-3">
                    <button onClick={openLoadModal} className="flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-widest rounded-2xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all active:scale-95">
                        <FolderOpenIcon className="w-5 h-5" /> {t('savedReports')}
                    </button>
                    {selectedProducts.length > 0 && (
                        <button onClick={openSaveModal} className="flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-widest rounded-2xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all active:scale-95">
                            <SaveIcon className="w-5 h-5" /> {t('saveReport')}
                        </button>
                    )}
                    {matrix && (
                         <button onClick={handleExport} className="flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-widest rounded-2xl bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95">
                            <ArrowDownTrayIcon className="w-5 h-5" /> {t('exportToXLS')}
                        </button>
                    )}
                </div>
            </div>

            {/* INTERAKTÍVNY SPRIEVODCA OSA AUDITOM */}
            <div className="mb-8 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 rounded-3xl p-6 border border-blue-100 shadow-xs transition-all no-print">
                <div 
                    onClick={() => setIsGuideOpen(!isGuideOpen)}
                    className="flex justify-between items-center cursor-pointer select-none"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-xl text-white">
                            <HelpCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-sm text-blue-900 uppercase tracking-wider">
                                Sprievodca úspešným OSA auditom
                            </h3>
                            <p className="text-xs text-blue-600/80 font-bold mt-0.5">
                                Postupujte krok za krokom pre sledovanie dostupnosti vašich tovarov na pulte.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-100/60 px-2.5 py-1 rounded-lg">
                            {isGuideOpen ? 'Skryť návod' : 'Zobraziť návod'}
                        </span>
                        {isGuideOpen ? (
                            <ChevronUp className="w-4 h-4 text-blue-800" />
                        ) : (
                            <ChevronDown className="w-4 h-4 text-blue-800" />
                        )}
                    </div>
                </div>

                {isGuideOpen && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4 pt-5 border-t border-blue-100/50 animate-fade-in text-left">
                        {/* Step 1 */}
                        <div className="bg-white p-5 rounded-2xl border border-blue-50/50 shadow-xs flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-[10px] uppercase tracking-widest bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-black">
                                        Krok 1
                                    </span>
                                    {allCatalogProducts.length > 0 ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-green-700 bg-green-50 px-2 py-0.5 rounded-lg">
                                            <Check className="w-3 h-3 stroke-[3]" /> Hotovo
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg animate-pulse">
                                            Chýba
                                        </span>
                                    )}
                                </div>
                                <h4 className="font-extrabold text-xs text-gray-900 mb-1">Tréning Produktov</h4>
                                <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">
                                    Pridajte položky do produktového katalógu (databáza SKU), ktoré chcete v systéme sledovať a analyzovať na policiach.
                                </p>
                            </div>
                            <div className="mt-4 pt-2.5 border-t border-gray-50 text-[10px] font-black text-gray-400 uppercase">
                                Stav: <span className={allCatalogProducts.length > 0 ? "text-green-600 font-extrabold" : "text-amber-600 font-extrabold"}>{allCatalogProducts.length} SKU vytvorených</span>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="bg-white p-5 rounded-2xl border border-blue-50/50 shadow-xs flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-[10px] uppercase tracking-widest bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-black">
                                        Krok 2
                                    </span>
                                    {storesCount > 0 ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-green-700 bg-green-50 px-2 py-0.5 rounded-lg">
                                            <Check className="w-3 h-3 stroke-[3]" /> Hotovo
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg animate-pulse">
                                            Chýba
                                        </span>
                                    )}
                                </div>
                                <h4 className="font-extrabold text-xs text-gray-900 mb-1">Vytvorenie Predajní</h4>
                                <p className="text-[11px] text-gray-550 leading-relaxed font-semibold">
                                    V sekcii <strong className="text-gray-900">Predajne</strong> si nadefinujte obchody. Každý regálový audit musí byť priradený ku konkrétnej lokácii pre korektný výpočet.
                                </p>
                            </div>
                            <div className="mt-4 pt-2.5 border-t border-gray-50 text-[10px] font-black text-gray-400 uppercase">
                                Stav: <span className={storesCount > 0 ? "text-green-600 font-extrabold" : "text-amber-600 font-extrabold"}>{storesCount} predajní v DB</span>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="bg-white p-5 rounded-2xl border border-blue-50/50 shadow-xs flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-[10px] uppercase tracking-widest bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-black">
                                        Krok 3
                                    </span>
                                    {(analysesCount > 0 || successfulActiveCount > 0) ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-green-700 bg-green-50 px-2 py-0.5 rounded-lg">
                                            <Check className="w-3 h-3 stroke-[3]" /> Hotovo
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg animate-pulse">
                                            Chýba
                                        </span>
                                    )}
                                </div>
                                <h4 className="font-extrabold text-xs text-gray-900 mb-1">Skenovanie OSA Auditu</h4>
                                <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">
                                    Spusťte <strong className="text-gray-900">Novú analýzu</strong>, zvoľte režim <strong className="text-gray-900">OSA (Availability)</strong>. Vyberte priradenú predajňu a nahrávajte fotky celého regálu.
                                </p>
                            </div>
                            <div className="mt-4 pt-2.5 border-t border-gray-50 text-[10px] font-black text-gray-400 uppercase">
                                Stav: <span className={(analysesCount > 0 || successfulActiveCount > 0) ? "text-green-600 font-extrabold" : "text-amber-600 font-extrabold"}>{analysesCount + successfulActiveCount} analýz celkovo</span>
                            </div>
                        </div>

                        {/* Step 4 */}
                        <div className="bg-white p-5 rounded-2xl border border-blue-50/50 shadow-xs flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-[10px] uppercase tracking-widest bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-black">
                                        Krok 4
                                    </span>
                                    {selectedProducts.length > 0 ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-green-700 bg-green-50 px-2 py-0.5 rounded-lg">
                                            <Check className="w-3 h-3 stroke-[3]" /> Sledujete
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg">
                                            Výber
                                        </span>
                                    )}
                                </div>
                                <h4 className="font-extrabold text-xs text-gray-900 mb-1">Voľba SKU & Report</h4>
                                <p className="text-[11px] text-gray-550 leading-relaxed font-semibold">
                                    Nižšie označte vybrané SKU, ktoré chcete porovnať. Systém automaticky zostaví maticu výskytu ("ÁNO" vs. "VÝPADOK") a spočíta plnenie.
                                </p>
                            </div>
                            <div className="mt-4 pt-2.5 border-t border-gray-50 text-[10px] font-black text-gray-400 uppercase">
                                Výber: <span className={selectedProducts.length > 0 ? "text-green-600 font-extrabold" : "text-gray-400 font-extrabold"}>{selectedProducts.length} aktívnych SKU</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* KPI STATS CARDS */}
            {osaMetrics && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-left">
                    {/* Card 1: Průměrná OSA */}
                    <div className="bg-gradient-to-br from-lime-600 to-emerald-700 p-6 rounded-3xl text-white shadow-lg shadow-lime-100/50 flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <span className="text-xs font-black uppercase tracking-widest text-lime-100">Dostupnosť OSA</span>
                            <div className="p-2 bg-white/20 rounded-xl">
                                <ClipboardCheck className="w-5 h-5 text-lime-50" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <span className="text-4xl font-black">{osaMetrics.avgFulfillment}%</span>
                            <p className="text-xs text-lime-100/90 font-bold mt-1.5 leading-relaxed">
                                Priemerné plnenie distribuovaného tovaru na sledovaných predajniach.
                            </p>
                        </div>
                    </div>

                    {/* Card 2: Najhorší produkt (Most OOS) */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <span className="text-xs font-black uppercase tracking-widest text-red-500 flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" /> Výpadok (OOS Alert)
                            </span>
                            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                                <AlertOctagon className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <span className="text-lg font-black text-gray-900 block truncate" title={osaMetrics.worstProduct?.name || 'Všetko OK'}>
                                {osaMetrics.worstProduct ? osaMetrics.worstProduct.name : 'Všetky SKU sú prítomné'}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-black text-red-650 px-2 py-0.5 rounded bg-rose-50 border border-rose-100 uppercase tracking-wider">
                                    Iba {osaMetrics.worstProduct?.availability}% výskyt
                                </span>
                                <span className="text-[11px] text-gray-400 font-bold">Najviac chýba na policiach</span>
                            </div>
                        </div>
                    </div>

                    {/* Card 3: Najhoršia predajňa */}
                    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xs flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <span className="text-xs font-black uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                                Kľúčová náprava (Worst shop)
                            </span>
                            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                                <Store className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-4">
                            <span className="text-lg font-black text-gray-900 block truncate" title={osaMetrics.worstStore?.name || 'Bez chýb'}>
                                {osaMetrics.worstStore ? osaMetrics.worstStore.name : 'Všetky predajne OK'}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-black text-amber-750 px-2 py-0.5 rounded bg-amber-50 border border-amber-100 uppercase tracking-wider">
                                    OSA: {osaMetrics.worstStore?.fulfillment}%
                                </span>
                                <span className="text-[11px] text-gray-400 font-bold">Najnižšie plnenie regála</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Selector */}
            <div className="bg-gray-50/50 p-8 rounded-[2rem] mb-8 border border-gray-100 shadow-inner text-left no-print">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-5 border-b border-gray-200/50">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <FunnelIcon className="w-5 h-5" /> {t('selectProducts')}
                    </h3>
                    
                    {/* Hľadanie produktu */}
                    <div className="relative w-full md:w-80">
                        <input
                            type="text"
                            placeholder="Vyhľadať produkt v katalógu..."
                            value={productSearchTerm}
                            onChange={(e) => setProductSearchTerm(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-xl py-2 pl-9 pr-4 text-xs font-bold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-transparent transition-all"
                        />
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                        {productSearchTerm && (
                            <button 
                                onClick={() => setProductSearchTerm('')} 
                                className="absolute right-3 top-2 text-gray-400 hover:text-gray-650 transition-colors text-[10px] font-bold bg-gray-100 px-1.5 py-0.5 rounded-md"
                            >
                                Zmazať
                            </button>
                        )}
                    </div>

                    <div className="flex gap-4 self-end md:self-auto">
                        <button onClick={selectAll} className="text-[10px] font-black text-lime-600 hover:text-lime-700 uppercase tracking-widest">{t('selectAll')}</button>
                        <button onClick={deselectAll} className="text-[10px] font-black text-gray-400 hover:text-gray-500 uppercase tracking-widest">{t('deselectAll')}</button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {allCatalogProducts
                        .filter(p => !productSearchTerm || p.toLowerCase().includes(productSearchTerm.toLowerCase()))
                        .map(p => (
                            <button
                                key={p}
                                onClick={() => toggleProductSelection(p)}
                                className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all border-2 ${
                                    selectedProducts.includes(p)
                                    ? 'bg-lime-600 border-lime-600 text-white shadow-md shadow-lime-200 scale-105'
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-lime-300 hover:text-lime-700 hover:bg-lime-50/50'
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                    {allCatalogProducts.filter(p => !productSearchTerm || p.toLowerCase().includes(productSearchTerm.toLowerCase())).length === 0 && (
                        <p className="text-sm text-gray-400 italic py-2">
                            {allCatalogProducts.length === 0 ? t('noProductsInCatalog') : 'Žiadne produkty nezodpovedajú vyhľadávaniu'}
                        </p>
                    )}
                </div>
            </div>

            {/* Matrix Result */}
            <div className="flex-grow bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
                {isCalculating ? (
                    <div className="flex flex-col items-center justify-center py-32">
                        <SpinnerIcon className="w-12 h-12 text-lime-500 animate-spin" />
                        <p className="mt-6 text-sm font-black text-gray-400 uppercase tracking-widest">{t('calculating')}</p>
                    </div>
                ) : matrix && matrix.rows.length > 0 ? (
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="min-w-full divide-y divide-gray-100 border-collapse">
                            <thead className="bg-gray-900 text-white sticky top-0 z-10">
                                <tr>
                                    <th className="px-8 py-6 text-left text-[10px] font-black uppercase tracking-widest min-w-[250px] sticky left-0 bg-gray-900 border-r border-gray-800">
                                        {t('storeName')}
                                    </th>
                                    {matrix.selectedEntities.map(p => (
                                        <th key={p} className="px-4 py-6 text-center text-[10px] font-black uppercase tracking-tighter min-w-[120px] border-l border-gray-800">
                                            <div className="truncate max-w-[150px] mx-auto" title={p}>{p}</div>
                                        </th>
                                    ))}
                                    <th className="px-8 py-6 text-center text-[10px] font-black uppercase tracking-widest bg-lime-600 min-w-[120px]">
                                        {t('storeFulfillment')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {matrix.rows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-lime-50/60 transition-colors group">
                                        <td className="px-8 py-5 text-sm font-bold text-gray-900 sticky left-0 bg-white border-r border-gray-50 shadow-[4px_0_10_rgba(0,0,0,0.02)] group-hover:bg-lime-50/60 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <span className="truncate">{row.storeName}</span>
                                                {row.storeCode && <span className="flex-shrink-0 text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-black uppercase tracking-widest">#{row.storeCode}</span>}
                                            </div>
                                        </td>
                                        {matrix.selectedEntities.map(p => (
                                            <td key={p} className="px-4 py-5 text-center border-l border-gray-50/50">
                                                {renderCell(row.presence[p])}
                                            </td>
                                        ))}
                                        <td className="px-8 py-5 text-center text-sm font-black text-lime-700 bg-lime-50/30">
                                            {Math.round(row.fulfillment)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t-2 border-gray-100">
                                <tr>
                                    <td className="px-8 py-6 text-[10px] uppercase font-black text-gray-400 sticky left-0 bg-gray-50 border-r border-gray-100">
                                        {t('distributionShare')}
                                    </td>
                                    {matrix.selectedEntities.map(p => (
                                        <td key={p} className="px-4 py-6 text-center text-sm font-black text-lime-700 border-l border-gray-100">
                                            {Math.round(matrix.columnSummaries[p])}%
                                        </td>
                                    ))}
                                    <td className="bg-lime-100/50"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <div className="p-8 bg-gray-50 rounded-full mb-6">
                            <TableCellsIcon className="w-16 h-16 text-gray-300" />
                        </div>
                        <p className="text-gray-400 font-black uppercase tracking-widest text-sm">{t('selectProductsAndCalculate')}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
