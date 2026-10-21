import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from '../i18n/index.tsx';
import { Analysis } from '../types.ts';
import { 
    FolderOpenIcon, 
    TrashIcon, 
    SearchIcon, 
    ClockIcon, 
    ChevronRightIcon,
    ChevronLeftIcon,
    EditIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    SaveIcon,
    CloseIcon,
    TagIcon,
    ChartPieIcon,
    TableCellsIcon,
    ClipboardDocumentListIcon,
    ShieldCheckIcon,
    SparklesIcon
} from './Icons.tsx';
import { getAnalyses, deleteAnalysis, renameAnalysis, verifyAndFixAllAnalysesPrices, healFailedAnalyses } from '../db.ts';
import { PdfReportModal } from './PdfReportModal.tsx';
import { Printer } from 'lucide-react';

interface AnalysesPanelProps {
    onNewAnalysis: () => void;
    onLoadAnalysis: (id: string) => void;
}

export const AnalysesPanel: React.FC<AnalysesPanelProps> = ({ onNewAnalysis, onLoadAnalysis }) => {
    const { t, language } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedChain, setSelectedChain] = useState<string>('ALL');
    const [selectedType, setSelectedType] = useState<string>('ALL');
    const [sortBy, setSortBy] = useState<'date' | 'name' | 'type' | 'images' | 'cost' | 'store'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Inline renaming state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [tempName, setTempName] = useState('');

    // Verification and fixing state
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationResult, setVerificationResult] = useState<{ updatedCount: number; fixedProductsCount: number } | null>(null);
    const [pdfExportAnalysis, setPdfExportAnalysis] = useState<Analysis | null>(null);

    const analyses = useLiveQuery(() => getAnalyses()) || [];

    const getAnalysisTypeInfo = (analysis: Analysis) => {
        let rawType = analysis.analysisType;
        if (!rawType && analysis.images && analysis.images.length > 0) {
            rawType = analysis.images.find(img => img.analysisType)?.analysisType;
        }
        if (!rawType) {
            rawType = 'both';
        }

        switch (rawType) {
            case 'price':
                return {
                    rawType,
                    label: t('analysisTypePriceButton') || 'OSP (Pricing)',
                    badgeClass: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
                    Icon: TagIcon
                };
            case 'shelfShare':
                return {
                    rawType,
                    label: t('analysisTypeShelfShareButton') || 'SOS (Shelf Share)',
                    badgeClass: 'bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800',
                    Icon: ChartPieIcon
                };
            case 'osa':
                return {
                    rawType,
                    label: t('analysisTypeOsaButton') || 'OSA (Availability)',
                    badgeClass: 'bg-sky-50 dark:bg-sky-950/50 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800',
                    Icon: TableCellsIcon
                };
            case 'promo':
                return {
                    rawType,
                    label: t('analysisTypePromoButton') || 'Promo Akcie & Rivali',
                    badgeClass: 'bg-orange-50 dark:bg-orange-950/50 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800',
                    Icon: SparklesIcon
                };
            case 'qualityCheck':
                return {
                    rawType,
                    label: t('qualityCheck') || 'Kontrola kvality',
                    badgeClass: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
                    Icon: ShieldCheckIcon
                };
            case 'both':
            default:
                return {
                    rawType: 'both',
                    label: t('analysisTypeBothButton') || 'Kompletná analýza',
                    badgeClass: 'bg-lime-50 dark:bg-lime-950/50 text-lime-800 dark:text-lime-300 border-lime-300 dark:border-lime-800',
                    Icon: ClipboardDocumentListIcon
                };
        }
    };

    const handleVerifyPrices = async () => {
        setIsVerifying(true);
        setVerificationResult(null);
        try {
            const res = await verifyAndFixAllAnalysesPrices();
            setVerificationResult(res);
        } catch (error) {
            console.error("Verification failed:", error);
            alert(t('deepPriceCheckError'));
        } finally {
            setIsVerifying(false);
        }
    };

    // Reset pagination to first page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedChain, selectedType, sortBy, sortOrder, itemsPerPage]);

    // Silently run deep validation, healing and correction on historical analyses upon panel initialization
    useEffect(() => {
        verifyAndFixAllAnalysesPrices().then(res => {
            if (res.fixedProductsCount > 0) {
                console.log(`Auto-verification: repaired regular vs. promo price logical anomalies for ${res.fixedProductsCount} products.`);
            }
        }).catch(err => {
            console.error("Auto-verification of past analyses prices failed silently:", err);
        });

        healFailedAnalyses().then(res => {
            if (res.healedCount > 0) {
                console.log(`Auto-healing: successfully restored ${res.healedCount} audits (${res.healedAnalysesNames.join(', ')}).`);
            }
        }).catch(err => {
            console.warn("Auto-healing failed silently:", err);
        });
    }, []);

    const handleDelete = async (id: string, name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(t('deleteAnalysisConfirm', { name }))) {
            await deleteAnalysis(id);
        }
    };

    const handleSort = (field: 'date' | 'name' | 'type' | 'images' | 'cost' | 'store') => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder(field === 'name' || field === 'store' || field === 'type' ? 'asc' : 'desc');
        }
    };

    const startRename = (id: string, name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(id);
        setTempName(name);
    };

    const saveRename = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (tempName.trim()) {
            await renameAnalysis(id, tempName.trim());
        }
        setEditingId(null);
    };

    const cancelRename = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(null);
    };

    // Extract unique chains for quick filtering
    const chainsList = Array.from(
        new Set(
            analyses
                .map(a => a.store?.chain)
                .filter((c): c is string => !!c && c.trim() !== '')
        )
    ).sort();

    // Filtering logic
    const filteredAnalyses = analyses.filter(a => {
        const matchesSearch = 
            a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (a.store && a.store.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (a.store && a.store.city && a.store.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (a.productCategory && a.productCategory.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesChain = selectedChain === 'ALL' || (a.store && a.store.chain === selectedChain);
        
        const typeInfo = getAnalysisTypeInfo(a);
        const matchesType = selectedType === 'ALL' || typeInfo.rawType === selectedType;

        return matchesSearch && matchesChain && matchesType;
    });

    // Sorting logic
    const sortedAnalyses = [...filteredAnalyses].sort((a, b) => {
        let comparison: number;
        const locale = language === 'sk' ? 'sk' : language === 'cs' ? 'cs' : language === 'de' ? 'de' : language === 'hu' ? 'hu' : language === 'hr' ? 'hr' : 'en';
        switch (sortBy) {
            case 'name':
                comparison = a.name.localeCompare(b.name, locale);
                break;
            case 'type': {
                const typeA = getAnalysisTypeInfo(a).label;
                const typeB = getAnalysisTypeInfo(b).label;
                comparison = typeA.localeCompare(typeB, locale);
                break;
            }
            case 'store': {
                const storeA = a.store?.name || '';
                const storeB = b.store?.name || '';
                comparison = storeA.localeCompare(storeB, locale);
                break;
            }
            case 'images':
                comparison = (a.images?.length || 0) - (b.images?.length || 0);
                break;
            case 'cost':
                comparison = (a.costInfo?.cost || 0) - (b.costInfo?.cost || 0);
                break;
            case 'date':
            default: {
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                comparison = (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
                break;
            }
        }
        return sortOrder === 'asc' ? comparison : -comparison;
    });

    // Pagination helper offsets
    const totalItems = sortedAnalyses.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    const paginatedAnalyses = sortedAnalyses.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Date formatter
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleString(language === 'sk' ? 'sk-SK' : 'en-US', {
                day: 'numeric',
                month: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr || '-';
        }
    };

    return (
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] shadow-sm border border-gray-150 dark:border-zinc-800 h-full flex flex-col animate-fade-in text-slate-700 dark:text-zinc-300">
            {/* Upper Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 flex items-center gap-4 tracking-tight">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 rounded-2xl shadow-2xs select-none">
                            <FolderOpenIcon className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                        </div>
                        {t('analyses')}
                    </h2>
                    <p className="text-xs text-slate-400 dark:text-zinc-400 font-bold mt-1.5 uppercase tracking-wider">
                        {t('analysesHistorySubtitle')}
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
                    <button 
                        onClick={handleVerifyPrices}
                        disabled={isVerifying}
                        className={`w-full sm:w-auto px-5 py-3 border border-orange-200 dark:border-orange-800/60 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-orange-900 dark:text-orange-200 text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-2xs active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${isVerifying ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                        {isVerifying ? (
                            <>
                                <span className="animate-spin text-base">⏳</span>
                                <span>{t('checkingPriceLogic')}</span>
                            </>
                        ) : (
                            <>
                                <span className="text-base select-none">⚖️</span>
                                <span>{t('checkPriceLogic')}</span>
                            </>
                        )}
                    </button>
                    <button 
                        onClick={onNewAnalysis} 
                        className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-md shadow-blue-200 dark:shadow-none active:scale-95 cursor-pointer"
                    >
                        {t('startNewAnalysis')}
                    </button>
                </div>
            </div>

            {/* Price Verification Results Banner */}
            {verificationResult && (
                <div className={`p-4 mb-6 rounded-2xl border transition-all animate-fade-in ${verificationResult.fixedProductsCount > 0 ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-250 dark:border-amber-800 text-amber-950 dark:text-amber-200 shadow-xs' : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-250 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 shadow-xs'}`}>
                    <div className="flex items-start sm:items-center gap-3.5 justify-between">
                        <div className="flex items-center gap-2.5">
                            <span className="text-xl shrink-0 select-none">
                                {verificationResult.fixedProductsCount > 0 ? '⚠️' : '✓'}
                            </span>
                            <div>
                                <p className="font-extrabold text-sm">
                                    {verificationResult.fixedProductsCount > 0 
                                        ? t('priceOptimizationSuccess')
                                        : t('allPricesLogical')
                                    }
                                </p>
                                <p className="text-[11px] opacity-90 font-bold mt-0.5">
                                    {verificationResult.fixedProductsCount > 0 
                                        ? t('priceErrorsFixedDesc', { fixedCount: verificationResult.fixedProductsCount, updatedCount: verificationResult.updatedCount })
                                        : t('deepPriceCheckOkDesc')
                                    }
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setVerificationResult(null)}
                            className="bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg px-2.5 py-1 text-[10px] uppercase font-black cursor-pointer shadow-3xs"
                        >
                            {t('close')}
                        </button>
                    </div>
                </div>
            )}

            {/* Smart Search & Advanced Filters bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 bg-slate-50/50 dark:bg-zinc-950/50 p-4 rounded-2xl border border-slate-150 dark:border-zinc-800 select-none">
                <div className="md:col-span-2 relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4">
                        <SearchIcon className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
                    </span>
                    <input
                        type="text"
                        placeholder={t('searchAnalysisPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 py-3 pl-11 pr-4 text-xs font-bold text-slate-800 dark:text-zinc-100 shadow-3xs focus:border-blue-500 dark:focus:border-blue-400 focus:outline-hidden placeholder-slate-400 dark:placeholder-zinc-500 transition-all"
                    />
                </div>
                <div>
                    <select
                        value={selectedChain}
                        onChange={(e) => setSelectedChain(e.target.value)}
                        className="block w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 py-3 px-3.5 text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-hidden shadow-3xs transition-all cursor-pointer"
                    >
                        <option value="ALL">{t('allChains')}</option>
                        {chainsList.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        className="block w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 py-3 px-3.5 text-xs font-black uppercase tracking-wider text-slate-800 dark:text-zinc-100 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-hidden shadow-3xs transition-all cursor-pointer"
                    >
                        <option value="ALL">{t('allTypes')}</option>
                        <option value="price">{t('analysisTypePriceButton')}</option>
                        <option value="shelfShare">{t('analysisTypeShelfShareButton')}</option>
                        <option value="osa">{t('analysisTypeOsaButton')}</option>
                        <option value="qualityCheck">{t('qualityCheck')}</option>
                        <option value="promo">{t('analysisTypePromoButton') || 'Promo Akcie & Rivali'}</option>
                        <option value="both">{t('analysisTypeBothButton')}</option>
                    </select>
                </div>
            </div>

            {/* Main Interactive Datagrid Container */}
            <div className="flex-grow overflow-x-auto custom-scrollbar border border-slate-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 shadow-3xs min-h-[350px]">
                {paginatedAnalyses.length > 0 ? (
                    <table className="w-full text-left border-collapse text-[11px] font-sans">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 text-[9px] font-black uppercase text-slate-500 dark:text-zinc-400 tracking-wider select-none">
                                <th 
                                    className="p-3.5 px-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800/50 transition-colors"
                                    onClick={() => handleSort('name')}
                                >
                                    <div className="flex items-center gap-1.5">
                                        {t('analysisNameCol')}
                                        {sortBy === 'name' && (
                                            sortOrder === 'asc' ? <ArrowUpIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" /> : <ArrowDownIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                        )}
                                    </div>
                                </th>
                                <th 
                                    className="p-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800/50 transition-colors"
                                    onClick={() => handleSort('type')}
                                >
                                    <div className="flex items-center gap-1.5">
                                        {t('analysisTypeCol')}
                                        {sortBy === 'type' && (
                                            sortOrder === 'asc' ? <ArrowUpIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" /> : <ArrowDownIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                        )}
                                    </div>
                                </th>
                                <th 
                                    className="p-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800/50 transition-colors"
                                    onClick={() => handleSort('store')}
                                >
                                    <div className="flex items-center gap-1.5">
                                        {t('storeAndChainCol')}
                                        {sortBy === 'store' && (
                                            sortOrder === 'asc' ? <ArrowUpIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" /> : <ArrowDownIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                        )}
                                    </div>
                                </th>
                                <th 
                                    className="p-3.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800/50 transition-colors"
                                    onClick={() => handleSort('date')}
                                >
                                    <div className="flex items-center gap-1.5">
                                        {t('auditDateCol')}
                                        {sortBy === 'date' && (
                                            sortOrder === 'asc' ? <ArrowUpIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" /> : <ArrowDownIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                        )}
                                    </div>
                                </th>
                                <th 
                                    className="p-3.5 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800/50 transition-colors w-28"
                                    onClick={() => handleSort('images')}
                                >
                                    <div className="flex items-center justify-center gap-1.5">
                                        {t('photoCountCol')}
                                        {sortBy === 'images' && (
                                            sortOrder === 'asc' ? <ArrowUpIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" /> : <ArrowDownIcon className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                        )}
                                    </div>
                                </th>
                                <th className="p-3.5 text-center w-40">{t('optionsCol')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 dark:divide-zinc-800 font-bold text-slate-700 dark:text-zinc-300">
                            {paginatedAnalyses.map(analysis => {
                                const isEditing = editingId === analysis.id;
                                return (
                                    <tr 
                                        key={analysis.id}
                                        onClick={() => !isEditing && onLoadAnalysis(analysis.id)}
                                        className="group hover:bg-blue-50/10 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors duration-150 relative text-slate-700 dark:text-zinc-300"
                                    >
                                        {/* Názov analýzy Column */}
                                        <td className="p-3.5 px-4">
                                            {isEditing ? (
                                                <div 
                                                    className="flex items-center gap-2"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <input
                                                        type="text"
                                                        value={tempName}
                                                        onChange={(e) => setTempName(e.target.value)}
                                                        className="px-2.5 py-1 text-xs font-bold border border-blue-400 rounded-md bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-52"
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={(e) => saveRename(analysis.id, e)}
                                                        className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-md transition-colors"
                                                        title={t('saveChange')}
                                                    >
                                                        <SaveIcon className="w-4 h-4" />
                                                     </button>
                                                     <button
                                                         onClick={cancelRename}
                                                         className="p-1 text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-md transition-colors"
                                                         title={t('cancelButton')}
                                                     >
                                                         <CloseIcon className="w-4 h-4" />
                                                     </button>
                                                 </div>
                                             ) : (
                                                 <div className="flex items-center gap-2 max-w-[240px] sm:max-w-md">
                                                     <span className="font-extrabold text-slate-900 dark:text-zinc-100 truncate group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                                                         {analysis.name}
                                                     </span>
                                                     {analysis.productCategory && (
                                                         <span className="hidden sm:inline bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-[9px] px-1.5 py-0.5 rounded-sm font-black uppercase tracking-wider">
                                                             {analysis.productCategory}
                                                         </span>
                                                     )}
                                                     <button
                                                         onClick={(e) => startRename(analysis.id, analysis.name, e)}
                                                         className="p-1 opacity-0 group-hover:opacity-100 text-slate-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-zinc-800 rounded transition-all"
                                                         title={t('rename')}
                                                     >
                                                         <EditIcon className="w-3.5 h-3.5" />
                                                     </button>
                                                 </div>
                                             )}
                                         </td>

                                         {/* Typ analýzy Column */}
                                         <td className="p-3.5 whitespace-nowrap">
                                             {(() => {
                                                 const typeInfo = getAnalysisTypeInfo(analysis);
                                                 const TypeIcon = typeInfo.Icon;
                                                 return (
                                                     <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-extrabold text-[10px] uppercase shadow-3xs ${typeInfo.badgeClass}`}>
                                                         <TypeIcon className="w-3.5 h-3.5 shrink-0" />
                                                         <span>{typeInfo.label}</span>
                                                     </span>
                                                 );
                                             })()}
                                         </td>

                                         {/* Predajňa & Reťazec Column */}
                                         <td className="p-3.5 whitespace-nowrap">
                                             {analysis.store ? (
                                                 <div className="flex items-center gap-2">
                                                     <span className="text-slate-800 dark:text-zinc-200 font-extrabold">{analysis.store.name}</span>
                                                     {analysis.store.chain && (
                                                         <span className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 text-[9px] px-1.5 py-0.5 rounded-md font-extrabold shadow-3xs uppercase">
                                                             {analysis.store.chain}
                                                         </span>
                                                     )}
                                                 </div>
                                             ) : (
                                                 <span className="text-slate-400 dark:text-zinc-500 italic font-medium">{t('unassignedStore')}</span>
                                             )}
                                         </td>

                                         {/* Dátum auditovania Column */}
                                         <td className="p-3.5 text-slate-500 dark:text-zinc-400 font-mono text-[10px] whitespace-nowrap">
                                             <div className="flex items-center gap-1.5">
                                                 <ClockIcon className="w-3.5 h-3.5 text-slate-450 dark:text-zinc-500" />
                                                 {formatDate(analysis.createdAt)}
                                             </div>
                                         </td>

                                         {/* Počet snímok Column */}
                                         <td className="p-3.5 text-center whitespace-nowrap">
                                             <span className="bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 font-extrabold text-[10px] px-2.5 py-1 rounded-lg shadow-3xs">
                                                 {analysis.images?.length || 0}
                                             </span>
                                         </td>

                                         {/* Možnosti Actions Column */}
                                         <td className="p-3.5 whitespace-nowrap">
                                             <div className="flex items-center justify-center gap-1.5">
                                                 {(!analysis.images || analysis.images.length === 0 || analysis.images.every(img => img.status === 'error' || !img.analysisResult || (img.analysisResult.products || []).length === 0)) && (
                                                     <button
                                                         onClick={async (e) => {
                                                             e.stopPropagation();
                                                             await healFailedAnalyses(analysis.id);
                                                             onLoadAnalysis(analysis.id);
                                                         }}
                                                         className="px-2 py-1 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-[10px] font-black uppercase rounded-lg transition-colors flex items-center gap-1 shadow-3xs cursor-pointer"
                                                         title={t("repairAuditProcess") || "Repair process and load recovered audit results"}
                                                     >
                                                         <span>{t("repair") || "Repair"}</span>
                                                     </button>
                                                 )}
                                                 <button
                                                     onClick={(e) => {
                                                         e.stopPropagation();
                                                         setPdfExportAnalysis(analysis);
                                                     }}
                                                     className="px-2 py-1 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-[10px] font-black uppercase rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                                     title={t("exportPdfReport") || "Export to PDF report for team"}
                                                 >
                                                     <Printer className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                                     <span>PDF</span>
                                                 </button>
                                                 <button
                                                     onClick={() => onLoadAnalysis(analysis.id)}
                                                     className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                                 >
                                                     <span>{t('open')}</span>
                                                     <ChevronRightIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                                 </button>
                                                 <button
                                                     onClick={(e) => handleDelete(analysis.id, analysis.name, e)}
                                                     className="p-1 px-1.5 border border-transparent hover:border-red-100 dark:hover:border-red-900/30 text-slate-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all cursor-pointer"
                                                     title={t('delete')}
                                                 >
                                                     <TrashIcon className="w-4 h-4" />
                                                 </button>
                                             </div>
                                         </td>
                                     </tr>
                                 );
                             })}
                         </tbody>
                     </table>
                 ) : (
                     <div className="flex flex-col items-center justify-center py-20 text-center p-8 bg-slate-50/50 dark:bg-zinc-950/50">
                         <div className="bg-white dark:bg-zinc-800 p-5 rounded-full shadow-3xs border border-slate-150 dark:border-zinc-700 mb-4">
                             <FolderOpenIcon className="w-10 h-10 text-slate-300 dark:text-zinc-600" />
                         </div>
                         <p className="text-slate-900 dark:text-zinc-100 font-black text-base mb-1.5">
                             {searchTerm || selectedChain !== 'ALL' ? t('noResultsFound') : t('noSavedAnalyses')}
                         </p>
                         <p className="text-slate-400 dark:text-zinc-400 text-[11px] font-bold max-w-sm mx-auto uppercase tracking-wide">
                             {searchTerm || selectedChain !== 'ALL' 
                                 ? t('tryChangingSearchTerm') 
                                 : t('startNewAnalysisPrompt')
                             }
                         </p>
                     </div>
                 )}
             </div>

             {/* Slovak datagrid footer pagination block */}
             <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6 border-t border-slate-150 dark:border-zinc-800 pt-5 text-xs text-slate-500 dark:text-zinc-400 font-bold select-none">
                 <div className="flex items-center gap-4">
                     <span>
                         {t('showingItemsPagination', {
                             from: totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0,
                             to: Math.min(currentPage * itemsPerPage, totalItems),
                             total: totalItems
                         })}
                     </span>
                     <div className="flex items-center gap-1.5">
                         <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-black">{t('displayPerPage')}</span>
                         <select
                             value={itemsPerPage}
                             onChange={(e) => {
                                 setItemsPerPage(Number(e.target.value));
                                 setCurrentPage(1);
                             }}
                             className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg py-1 px-2.5 pr-6 text-xs text-slate-800 dark:text-zinc-200 font-bold cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                         >
                             <option value={5}>5</option>
                             <option value={10}>10</option>
                             <option value={20}>20</option>
                         </select>
                     </div>
                 </div>

                 <div className="flex items-center gap-1">
                     <button
                         onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                         disabled={currentPage === 1}
                         className={`p-2 border border-slate-200 dark:border-zinc-700 rounded-xl transition-colors flex items-center justify-center ${
                             currentPage === 1 
                                 ? 'opacity-40 cursor-not-allowed bg-slate-50 dark:bg-zinc-800/50' 
                                 : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200'
                         }`}
                         title={t('previousPage')}
                     >
                         <ChevronLeftIcon className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                     </button>

                     <div className="flex items-center gap-1 px-1">
                         {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(page => (
                             <button
                                 key={page}
                                 onClick={() => setCurrentPage(page)}
                                 className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black transition-all ${
                                     currentPage === page
                                         ? 'bg-blue-600 text-white shadow-xs'
                                         : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300'
                                 }`}
                             >
                                 {page}
                             </button>
                         ))}
                     </div>

                     <button
                         onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                         disabled={currentPage === totalPages}
                         className={`p-2 border border-slate-200 dark:border-zinc-700 rounded-xl transition-colors flex items-center justify-center ${
                             currentPage === totalPages 
                                 ? 'opacity-40 cursor-not-allowed bg-slate-50 dark:bg-zinc-800/50' 
                                 : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200'
                         }`}
                         title={t('nextPage')}
                     >
                         <ChevronRightIcon className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                     </button>
                 </div>
             </div>

             {pdfExportAnalysis && (
                 <PdfReportModal
                     isOpen={Boolean(pdfExportAnalysis)}
                     onClose={() => setPdfExportAnalysis(null)}
                     analysisName={pdfExportAnalysis.name}
                     storeName={pdfExportAnalysis.store?.name || 'Maloobchod'}
                     storeAddress={pdfExportAnalysis.store?.address || pdfExportAnalysis.store?.city}
                     analysisDate={pdfExportAnalysis.createdAt}
                     images={pdfExportAnalysis.images || []}
                     brandClassifications={pdfExportAnalysis.brandClassifications}
                 />
             )}
        </div>
    );
};
