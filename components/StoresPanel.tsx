import React, { useState, useMemo } from 'react';

const EMPTY_ARRAY: any[] = [];
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from '../i18n';
import type { Store } from '../types';
import { 
  Building2, 
  Plus, 
  Edit2, 
  Trash2, 
  Search, 
  SlidersHorizontal, 
  MapPin, 
  User, 
  Target, 
  BarChart3, 
  Clock, 
  ArrowUpDown, 
  ChevronDown, 
  ChevronUp, 
  Navigation,
  CheckCircle2, 
  X, 
  Sparkles,
  List,
  LayoutGrid
} from 'lucide-react';
import { getStores, addStore, updateStore, deleteStore as deleteStoreFromDb, getAnalyses } from '../db';

export const StoresPanel: React.FC = () => {
    const { t, language } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    
    // Comprehensive default store object reflecting custom data extensions for retail audit completeness
    const defaultStore: Store = { 
        name: '', 
        chain: '', 
        city: '', 
        address: '', 
        code: '',
        storeTier: 'super',
        targetShelfShare: 30,
        gpsCoordinates: '',
        contactPerson: '',
        description: ''
    };
    
    const [editingStore, setEditingStore] = useState<Store>(defaultStore);

    // View mode: 'grid' or 'list' for compact 1-line representation
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

    // Filter, search & sorting states
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedChainFilter, setSelectedChainFilter] = useState('');
    const [selectedTierFilter, setSelectedTierFilter] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'code' | 'visits' | 'performance'>('name');
    
    // Expandable statistics card mapping (storeId -> boolean)
    const [expandedStores, setExpandedStores] = useState<Record<number, boolean>>({});

    // Dexie queries reactive to DB updates
    const rawStores = useLiveQuery(() => getStores()) ?? EMPTY_ARRAY;
    const analyses = useLiveQuery(() => getAnalyses()) ?? EMPTY_ARRAY;

    const toggleStoreExpand = (storeId: number) => {
        setExpandedStores(prev => ({ ...prev, [storeId]: !prev[storeId] }));
    };

    const formatDate = (dateStr: string) => {
        const locale = language === 'sk' ? 'sk-SK' : language === 'cs' ? 'cs-CZ' : language === 'de' ? 'de-DE' : language === 'hu' ? 'hu-HU' : language === 'hr' ? 'hr-HR' : 'en-US';
        const d = new Date(dateStr);
        return d.toLocaleDateString(locale);
    };

    const formatDateTime = (dateStr: string) => {
        const locale = language === 'sk' ? 'sk-SK' : language === 'cs' ? 'cs-CZ' : language === 'de' ? 'de-DE' : language === 'hu' ? 'hu-HU' : language === 'hr' ? 'hr-HR' : 'en-US';
        const d = new Date(dateStr);
        const datePart = d.toLocaleDateString(locale);
        const timePart = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        const separator = t('atTime') || (language === 'en' ? 'at' : 'v');
        return `${datePart} ${separator} ${timePart}`;
    };

    const handleSave = async () => {
        if (!editingStore.name) return;
        
        // Ensure values are formatted correctly before save
        const cleanStore: Store = {
            ...editingStore,
            name: editingStore.name.trim(),
            chain: editingStore.chain?.trim() || undefined,
            city: editingStore.city?.trim() || undefined,
            address: editingStore.address?.trim() || undefined,
            code: editingStore.code?.trim() || undefined,
            gpsCoordinates: editingStore.gpsCoordinates?.trim() || undefined,
            contactPerson: editingStore.contactPerson?.trim() || undefined,
            description: editingStore.description?.trim() || undefined,
            targetShelfShare: editingStore.targetShelfShare ? Number(editingStore.targetShelfShare) : undefined
        };

        if (cleanStore.id) {
            await updateStore(cleanStore);
        } else {
            await addStore(cleanStore);
        }
        setIsEditing(false);
        setEditingStore(defaultStore);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm(t('deleteStoreConfirm'))) {
            await deleteStoreFromDb(id);
        }
    };

    // Calculate real-time, deep store stats by cross-referencing completed audits
    const storesWithStats = useMemo(() => rawStores.map(store => {
        // Find all analyses referencing this store in our local DB
        const storeAnalyses = analyses.filter(an => {
            if (an.storeId === store.id) return true;
            if (an.images?.some(img => img.assignedStoreId === store.id)) return true;
            
            // Name matching fallback for integrity
            const storeNameLower = store.name.toLowerCase();
            if (an.store?.name?.toLowerCase() === storeNameLower) return true;
            if (an.images?.some(img => img.assignedStore?.name?.toLowerCase() === storeNameLower)) return true;
            
            return false;
        });

        // 1. Total Visits Counter
        const visitsCount = storeAnalyses.length;

        // 2. Timeline of visits
        const sortedAnalyses = [...storeAnalyses].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const lastAuditDate = sortedAnalyses[0]?.createdAt || null;

        // 3. Accumulate image data stats
        let totalCompliance = 0;
        let complianceCount = 0;
        let totalProducts = 0;
        let productsCount = 0;
        let totalPosMaterials = 0;
        let totalCost = 0;

        storeAnalyses.forEach(an => {
            if (an.costInfo?.cost) {
                totalCost += an.costInfo.cost;
            }
            an.images?.forEach(img => {
                if (img.analysisResult) {
                    if (img.analysisResult.complianceScore !== undefined) {
                        totalCompliance += img.analysisResult.complianceScore;
                        complianceCount++;
                    }
                    if (img.analysisResult.products) {
                        const productsOnly = img.analysisResult.products.filter(p => !p.type || p.type === 'product');
                        const posOnly = img.analysisResult.products.filter(p => p.type === 'pos_material');
                        totalProducts += productsOnly.length;
                        productsCount++;
                        totalPosMaterials += posOnly.length;
                    }
                }
            });
        });

        const avgCompliance = complianceCount > 0 ? Math.round(totalCompliance / complianceCount) : null;
        const avgProducts = productsCount > 0 ? Math.round(totalProducts / productsCount) : 0;

        return {
            ...store,
            visitsCount,
            lastAuditDate,
            avgCompliance,
            avgProducts,
            totalPosMaterials,
            totalCost,
            latestAnalyses: sortedAnalyses.slice(0, 3) // last 3 visits
        };
    }), [rawStores, analyses]);

    // Extract unique chains represented for filter UI
    const availableChains = useMemo(() => Array.from(new Set(rawStores.map(s => s.chain).filter(Boolean))) as string[], [rawStores]);

    // Available store format tiers
    const availableTiers = ['hyper', 'super', 'convenience', 'express'];

    // Tiers mapping label helper
    const getTierLabel = (tier?: string) => {
        switch (tier) {
            case 'hyper': return t('tierHypermarket');
            case 'super': return t('tierSupermarket');
            case 'convenience': return t('tierConvenience');
            case 'express': return t('tierExpress');
            default: return t('tierGeneral');
        }
    };

    const getChainBorderColor = (chain?: string) => {
        const c = (chain || '').toLowerCase();
        if (c.includes('tesco')) return 'border-l-4 border-l-blue-600';
        if (c.includes('lidl')) return 'border-l-4 border-l-amber-400';
        if (c.includes('billa')) return 'border-l-4 border-l-red-500';
        if (c.includes('kaufland')) return 'border-l-4 border-l-rose-600';
        if (c.includes('coop')) return 'border-l-4 border-l-orange-500';
        return 'border-l-4 border-l-emerald-500';
    };

    // Filter and Sort
    const filteredStores = useMemo(() => storesWithStats.filter(store => {
        const matchesSearch = 
            store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (store.chain || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (store.city || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (store.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (store.code || '').toLowerCase().includes(searchQuery.toLowerCase());
            
        const matchesChain = !selectedChainFilter || store.chain === selectedChainFilter;
        const matchesTier = !selectedTierFilter || store.storeTier === selectedTierFilter;

        return matchesSearch && matchesChain && matchesTier;
    }), [storesWithStats, searchQuery, selectedChainFilter, selectedTierFilter]);

    const sortedStores = useMemo(() => [...filteredStores].sort((a, b) => {
        if (sortBy === 'name') {
            return a.name.localeCompare(b.name);
        } else if (sortBy === 'code') {
            return (a.code || '').localeCompare(b.code || '');
        } else if (sortBy === 'visits') {
            return b.visitsCount - a.visitsCount;
        } else if (sortBy === 'performance') {
            return (b.avgCompliance || 0) - (a.avgCompliance || 0);
        }
        return 0;
    }), [filteredStores, sortBy]);

    // Global dashboard metrics for bento summary
    const totalStoresCount = rawStores.length;
    const uniqueChainsCount = availableChains.length;
    const totalAuditsCount = analyses.length;
    
    const complianceStoresList = useMemo(() => storesWithStats.filter(s => s.avgCompliance !== null), [storesWithStats]);
    const globalAvgCompliance = complianceStoresList.length > 0
        ? Math.round(complianceStoresList.reduce((acc, s) => acc + (s.avgCompliance || 0), 0) / complianceStoresList.length)
        : null;

    // Suggestions for adding
    const chainSuggestions = ['Tesco', 'Lidl', 'Kaufland', 'Billa', 'Coop Jednota', 'Shell', 'OMV', 'Metro'];
    const citySuggestions = ['Bratislava', 'Košice', 'Žilina', 'Prešov', 'Nitra', 'Banská Bystrica', 'Trnava', 'Trenčín'];

    return (
        <div className="bg-slate-50/50 dark:bg-zinc-950/50 p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100/50 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 min-h-full flex flex-col font-sans">
            
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2.5">
                        <Building2 className="w-8 h-8 text-emerald-600" />
                        {t('stores') || 'Stores'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-1">
                        {t('storesSubtitle')}
                    </p>
                </div>
                {!isEditing && (
                    <button 
                        onClick={() => { setEditingStore(defaultStore); setIsEditing(true); }} 
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-md shadow-emerald-200 flex items-center gap-2 active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        {t('addStore')}
                    </button>
                )}
            </div>

            {/* Main view vs Edit screen */}
            {isEditing ? (
                /* ADVANCED MINIMALIST FORM */
                <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 flex-grow max-w-4xl mx-auto w-full">
                    <div className="flex justify-between items-center pb-6 border-b border-slate-100 dark:border-zinc-800 mb-6">
                        <div className="flex items-center gap-2">
                            <span className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                                <Building2 className="w-5 h-5" />
                            </span>
                            <h3 className="font-black text-lg text-slate-900 dark:text-zinc-100">
                                {editingStore.id ? t('editStoreDetails') : t('newAuditLocation')}
                            </h3>
                        </div>
                        <button 
                            onClick={() => setIsEditing(false)} 
                            className="p-1.5 hover:bg-slate-50 dark:hover:bg-zinc-800/60 rounded-xl transition-all text-slate-400 dark:text-zinc-500 hover:text-slate-600"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* Section: Basic info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1.5">
                                    {t('storeNameLabel')}
                                </label>
                                <input 
                                    type="text" 
                                    placeholder={t('storeNamePlaceholder')}
                                    value={editingStore.name} 
                                    onChange={e => setEditingStore({...editingStore, name: e.target.value})} 
                                    className="block w-full rounded-xl border-slate-200/80 bg-slate-50/50 dark:bg-zinc-900/60 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-xs font-bold py-3 px-4 transition-colors placeholder:text-slate-300" 
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1.5">
                                    {t('internalStoreCode')}
                                </label>
                                <input 
                                    type="text" 
                                    placeholder={t('storeCodePlaceholder') || 'TS-BA-01'}
                                    value={editingStore.code || ''} 
                                    onChange={e => setEditingStore({...editingStore, code: e.target.value})} 
                                    className="block w-full rounded-xl border-slate-200/80 bg-slate-50/50 dark:bg-zinc-900/60 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-xs font-bold py-3 px-4 transition-colors placeholder:text-slate-300" 
                                />
                            </div>
                        </div>

                        {/* Suggestions row for Chain */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1.5">
                                    {t('retailChain')}
                                </label>
                                <input 
                                    type="text" 
                                    placeholder={t('retailChainPlaceholder')}
                                    value={editingStore.chain || ''} 
                                    onChange={e => setEditingStore({...editingStore, chain: e.target.value})} 
                                    className="block w-full rounded-xl border-slate-200/80 bg-slate-50/50 dark:bg-zinc-900/60 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-xs font-bold py-3 px-4 transition-colors placeholder:text-slate-300" 
                                />
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {chainSuggestions.map(ch => (
                                        <button 
                                            key={ch} 
                                            type="button" 
                                            onClick={() => setEditingStore({...editingStore, chain: ch})}
                                            className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg text-[9px] font-bold text-slate-500 dark:text-zinc-400 transition-colors"
                                        >
                                            {ch}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1.5">
                                    {t('storeTierFormat')}
                                </label>
                                <select 
                                    value={editingStore.storeTier || 'super'} 
                                    onChange={e => setEditingStore({...editingStore, storeTier: e.target.value})} 
                                    className="block w-full rounded-xl border-slate-200/80 bg-slate-50/50 dark:bg-zinc-900/60 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-xs font-bold py-3 px-4 transition-colors" 
                                >
                                    <option value="hyper">{t('tierHypermarketFull')}</option>
                                    <option value="super">{t('tierSupermarketFull')}</option>
                                    <option value="convenience">{t('tierConvenienceFull')}</option>
                                    <option value="express">{t('tierExpressFull')}</option>
                                </select>
                            </div>
                        </div>

                        {/* Address and City */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1.5">
                                    {t('city')}
                                </label>
                                <input 
                                    type="text" 
                                    placeholder={t('cityPlaceholder')}
                                    value={editingStore.city || ''} 
                                    onChange={e => setEditingStore({...editingStore, city: e.target.value})} 
                                    className="block w-full rounded-xl border-slate-200/80 bg-slate-50/50 dark:bg-zinc-900/60 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-xs font-bold py-3 px-4 transition-colors placeholder:text-slate-300" 
                                />
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {citySuggestions.map(ct => (
                                        <button 
                                            key={ct} 
                                            type="button" 
                                            onClick={() => setEditingStore({...editingStore, city: ct})}
                                            className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg text-[9px] font-bold text-slate-500 dark:text-zinc-400 transition-colors"
                                        >
                                            {ct}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1.5">
                                    {t('streetAddress')}
                                </label>
                                <input 
                                    type="text" 
                                    placeholder={t('streetAddressPlaceholder')}
                                    value={editingStore.address || ''} 
                                    onChange={e => setEditingStore({...editingStore, address: e.target.value})} 
                                    className="block w-full rounded-xl border-slate-200/80 bg-slate-50/50 dark:bg-zinc-900/60 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-xs font-bold py-3 px-4 transition-colors placeholder:text-slate-300" 
                                />
                            </div>
                        </div>

                        {/* PROPOSED DATA ENRICHMENT: GPS alignment, Target KPI and Contact person information */}
                        <div className="p-6 bg-slate-50/30 border border-slate-100/50 rounded-2xl space-y-4">
                            <h4 className="text-xs font-black text-slate-700 dark:text-zinc-300 flex items-center gap-1">
                                <Sparkles className="w-4 h-4 text-emerald-600" /> {t('metadataEnrichmentProposal')}
                            </h4>
                            <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">
                                {t('metadataEnrichmentDesc')}
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">
                                        {t('targetShelfShare')}
                                    </label>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        max="100" 
                                        placeholder="30"
                                        value={editingStore.targetShelfShare || ''} 
                                        onChange={e => setEditingStore({...editingStore, targetShelfShare: e.target.value ? Number(e.target.value) : undefined})} 
                                        className="block w-full rounded-xl border-slate-200/85 bg-white dark:bg-zinc-900 shadow-xs focus:border-emerald-500 focus:ring-emerald-500 text-xs font-bold px-3 py-2.5 transition-colors" 
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">
                                        {t('gpsCoordinates')}
                                    </label>
                                    <input 
                                        type="text" 
                                        placeholder="48.114704, 17.112165"
                                        value={editingStore.gpsCoordinates || ''} 
                                        onChange={e => setEditingStore({...editingStore, gpsCoordinates: e.target.value})} 
                                        className="block w-full rounded-xl border-slate-200/85 bg-white dark:bg-zinc-900 shadow-xs focus:border-emerald-500 focus:ring-emerald-500 text-xs font-bold px-3 py-2.5 transition-colors" 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">
                                        {t('storeManager')}
                                    </label>
                                    <input 
                                        type="text" 
                                        placeholder={t('storeManagerPlaceholder')}
                                        value={editingStore.contactPerson || ''} 
                                        onChange={e => setEditingStore({...editingStore, contactPerson: e.target.value})} 
                                        className="block w-full rounded-xl border-slate-200/85 bg-white dark:bg-zinc-900 shadow-xs focus:border-emerald-500 focus:ring-emerald-500 text-xs font-bold px-3 py-2.5 transition-colors" 
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">
                                        {t('internalAuditNotes')}
                                    </label>
                                    <input 
                                        type="text" 
                                        placeholder={t('storeInternalNotesPlaceholder')}
                                        value={editingStore.description || ''} 
                                        onChange={e => setEditingStore({...editingStore, description: e.target.value})} 
                                        className="block w-full rounded-xl border-slate-200/85 bg-white dark:bg-zinc-900 shadow-xs focus:border-emerald-500 focus:ring-emerald-500 text-xs font-bold px-3 py-2.5 transition-colors" 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Save Actions */}
                        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-zinc-800">
                            <button 
                                onClick={() => setIsEditing(false)} 
                                className="px-5 py-2.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors"
                            >
                                {t('cancelButton')}
                            </button>
                            <button 
                                onClick={handleSave} 
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-md shadow-emerald-200 transition-all active:scale-95"
                            >
                                {t('save')}
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* ADVANCED MINIMALIST STORE DASHBOARD */
                <div className="space-y-6 flex-grow flex flex-col">
                    
                    {/* BENTO STATS GRID */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        
                        {/* Summary Widget 1 */}
                        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-100/50 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                            <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl text-emerald-600">
                                <Building2 className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="block text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500">{t('stores')}</span>
                                <span className="text-xl font-black text-slate-900 dark:text-zinc-100">{totalStoresCount}</span>
                            </div>
                        </div>

                        {/* Summary Widget 2 */}
                        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-100/50 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                            <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl text-blue-600">
                                <SlidersHorizontal className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="block text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500">{t('chains')}</span>
                                <span className="text-xl font-black text-slate-900 dark:text-zinc-100">{uniqueChainsCount}</span>
                            </div>
                        </div>

                        {/* Summary Widget 3 */}
                        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-100/50 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                            <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl text-purple-600">
                                <BarChart3 className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="block text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500">{t('completedAudits')}</span>
                                <span className="text-xl font-black text-slate-900 dark:text-zinc-100">{totalAuditsCount}</span>
                            </div>
                        </div>

                        {/* Summary Widget 4 */}
                        <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-100/50 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                            <div className="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl text-amber-500">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="block text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500">{t('avgComplianceScore')}</span>
                                <span className="text-xl font-black text-slate-900 dark:text-zinc-100">
                                    {globalAvgCompliance ? `${globalAvgCompliance}%` : 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* SEARCH, FILTERS & SORTERS BAR */}
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-100/60 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                        
                        {/* Search input with magnify glass */}
                        <div className="relative flex-grow max-w-md">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <Search className="h-4 w-4 text-slate-400 dark:text-zinc-500" />
                            </div>
                            <input 
                                type="text"
                                placeholder={t('searchStorePlaceholderText')}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="block w-full rounded-xl border-slate-100/70 bg-slate-50/50 dark:bg-zinc-900/60 pl-10 focus:border-emerald-500 focus:ring-emerald-500 text-xs font-bold py-3 transition-colors placeholder:text-slate-400"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 dark:text-zinc-500 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Interactive Dropdown filters */}
                        <div className="flex flex-wrap items-center gap-3">
                            
                            {/* Chain filter */}
                            <select
                                value={selectedChainFilter}
                                onChange={e => setSelectedChainFilter(e.target.value)}
                                className="rounded-xl border-slate-100/70 bg-slate-50/50 dark:bg-zinc-900/60 text-xs font-bold py-2.5 px-3 text-slate-600 dark:text-zinc-400 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                            >
                                <option value="">{t('allChains')}</option>
                                {availableChains.map(ch => (
                                    <option key={ch} value={ch}>{ch}</option>
                                ))}
                            </select>

                            {/* Tier filter */}
                            <select
                                value={selectedTierFilter}
                                onChange={e => setSelectedTierFilter(e.target.value)}
                                className="rounded-xl border-slate-100/70 bg-slate-50/50 dark:bg-zinc-900/60 text-xs font-bold py-2.5 px-3 text-slate-600 dark:text-zinc-400 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                            >
                                <option value="">{t('allFormats')}</option>
                                {availableTiers.map(tr => (
                                    <option key={tr} value={tr}>{getTierLabel(tr)}</option>
                                ))}
                            </select>

                            {/* Sorting options selector */}
                            <div className="flex items-center gap-2 bg-slate-50/50 dark:bg-zinc-900/60 pl-3 pr-1.5 py-1.5 rounded-xl border border-slate-100/50 text-slate-600 dark:text-zinc-400">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                                    <ArrowUpDown className="w-3.5 h-3.5" /> {t('sortByLabel')}
                                </span>
                                <select
                                    value={sortBy}
                                    onChange={e => setSortBy(e.target.value as any)}
                                    className="border-none bg-transparent p-0 text-xs font-black text-slate-800 dark:text-zinc-200 focus:ring-0 cursor-pointer pr-5"
                                >
                                    <option value="name">{t('sortByName')}</option>
                                    <option value="code">{t('sortByCode')}</option>
                                    <option value="visits">{t('sortByVisits')}</option>
                                    <option value="performance">{t('sortByPerformance')}</option>
                                </select>
                            </div>

                            {/* View switcher: Grid / 1-Line list */}
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl border border-slate-200/50">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    title={t('gridViewCards')}
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    title={t('listViewCompact')}
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* STORES CARDS GRID OR COMPACT LIST */}
                    <div className="flex-grow overflow-y-auto pr-1">
                        {sortedStores.length > 0 ? (
                            viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                                    {sortedStores.map(store => {
                                        const isExpanded = !!expandedStores[store.id || 0];
                                        
                                        return (
                                            <div 
                                                key={store.id} 
                                                className={`bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100/60 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden ${getChainBorderColor(store.chain)}`}
                                            >
                                                
                                                {/* Store Card Header */}
                                                <div className="p-5 flex items-start justify-between gap-4">
                                                    <div className="space-y-1 bg-white dark:bg-zinc-900">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            {store.chain && (
                                                                <span className="bg-slate-50 dark:bg-zinc-800/60 text-[10px] uppercase font-black px-2.5 py-1 rounded-lg text-slate-500 dark:text-zinc-400 border border-slate-100/50">
                                                                    {store.chain}
                                                                </span>
                                                            )}
                                                            {store.code && (
                                                                <span className="bg-blue-50 text-[10px] font-mono font-black px-2.5 py-1 rounded-lg text-blue-700 border border-blue-100/30">
                                                                    #{store.code}
                                                                </span>
                                                            )}
                                                            {store.storeTier && (
                                                                <span className="bg-emerald-50 text-[9px] uppercase font-bold px-2 py-0.5 rounded-md text-emerald-700">
                                                                    {getTierLabel(store.storeTier)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h3 className="font-black text-base text-slate-900 dark:text-zinc-100 leading-tight pt-1">
                                                            {store.name}
                                                        </h3>
                                                        <p className="text-xs text-slate-400 dark:text-zinc-500 font-medium flex items-center gap-1 pt-0.5 max-w-sm truncate">
                                                            <MapPin className="w-3.5 h-3.5 text-slate-400/80 shrink-0" />
                                                            {[store.address, store.city].filter(Boolean).join(', ')}
                                                        </p>
                                                    </div>

                                                    {/* Action Panel and Google Maps coordinates helper */}
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {store.gpsCoordinates && (
                                                            <a 
                                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.gpsCoordinates)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                title={t('openOnMap')}
                                                                className="p-2 text-slate-400 dark:text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                                            >
                                                                <Navigation className="w-4 h-4" />
                                                            </a>
                                                        )}
                                                        <button 
                                                            onClick={() => { setEditingStore(store); setIsEditing(true); }} 
                                                            className="p-2 text-slate-400 dark:text-zinc-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                                            title={t('editStoreDetails')}
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => store.id && handleDelete(store.id)} 
                                                            className="p-2 text-slate-400 dark:text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                            title={t('deleteStoreTitle')}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* HIGH-LEVEL AUDIT TELEMETRY ON CARD */}
                                                <div className="mx-5 mb-5 p-4 bg-slate-50/50 dark:bg-zinc-900/60 rounded-2xl border border-slate-100/30 grid grid-cols-3 gap-3 text-center text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                                                    
                                                    {/* Metric 1 */}
                                                    <div>
                                                        <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-black block">{t('visits')}</span>
                                                        <span className="text-sm font-black text-slate-800 dark:text-zinc-200 mt-0.5 block">{store.visitsCount}x</span>
                                                    </div>

                                                    {/* Metric 2 */}
                                                    <div>
                                                        <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-black block">{t('complianceRate')}</span>
                                                        <span className={`text-sm font-black mt-0.5 block ${
                                                            store.avgCompliance === null ? 'text-slate-400' :
                                                            store.avgCompliance >= 80 ? 'text-emerald-600' : 'text-red-500'
                                                        }`}>
                                                            {store.avgCompliance !== null ? `${store.avgCompliance}%` : 'N/A'}
                                                        </span>
                                                    </div>

                                                    {/* Metric 3 */}
                                                    <div>
                                                        <span className="text-[9px] uppercase tracking-wider text-slate-400 dark:text-zinc-500 font-black block">{t('lastAudit')}</span>
                                                        <span className="text-[10px] font-semibold text-slate-700 dark:text-zinc-300 mt-1 block truncate">
                                                            {store.lastAuditDate 
                                                                ? formatDate(store.lastAuditDate) 
                                                                : t('noAuditsYet')
                                                            }
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* ENRICHED DETAIL ACCORDION (Click to view deep trends and specific notes) */}
                                                <div className="border-t border-slate-50">
                                                    <button 
                                                        onClick={() => toggleStoreExpand(store.id || 0)}
                                                        className="w-full py-3 px-5 text-[10px] font-bold text-slate-500 dark:text-zinc-400 hover:text-slate-700 bg-slate-50/20 hover:bg-slate-50/40 flex items-center justify-between transition-colors"
                                                    >
                                                        <span className="flex items-center gap-1.5 font-black uppercase tracking-wider">
                                                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                                            {isExpanded ? t('closeAuditSummary') : t('viewAuditSummary')}
                                                        </span>
                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </button>

                                                    {isExpanded && (
                                                        <div className="p-5 bg-slate-50/30 space-y-4 border-t border-slate-100/50 text-slate-600 dark:text-zinc-400">
                                                            
                                                            {/* Target vs Actual KPI benchmark info */}
                                                            {store.targetShelfShare ? (
                                                                <div className="space-y-1.5">
                                                                    <div className="flex justify-between items-center text-[10px]">
                                                                        <span className="font-bold flex items-center gap-1">
                                                                            <Target className="w-3.5 h-3.5 text-rose-500" /> {t('kpiTargetShelfShare')}
                                                                        </span>
                                                                        <span className="font-black text-slate-900 dark:text-zinc-100">{store.targetShelfShare}%</span>
                                                                    </div>
                                                                    <div className="w-full bg-slate-200/60 rounded-full h-2 overflow-hidden flex">
                                                                        <div 
                                                                            className={`h-full ${
                                                                                store.avgCompliance !== null && store.avgCompliance >= (store.targetShelfShare || 30)
                                                                                ? 'bg-emerald-500' : 'bg-red-500'
                                                                            }`}
                                                                            style={{ width: `${Math.min(100, store.avgCompliance || 0)}%` }}
                                                                        />
                                                                    </div>
                                                                    <div className="flex justify-between text-[8px] text-slate-450 font-semibold uppercase tracking-wider">
                                                                        <span>{t('actualShare', { share: store.avgCompliance || 0 })}</span>
                                                                        <span>{t('targetShare', { share: store.targetShelfShare })}</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p className="text-[9px] text-slate-400 dark:text-zinc-500 italic">{t('noKpiDefined')}</p>
                                                            )}

                                                            {/* Split specs */}
                                                            <div className="grid grid-cols-2 gap-4 text-xs">
                                                                
                                                                {/* Side 1: Logistics & Contact meta */}
                                                                <div className="space-y-2 bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800 flex flex-col justify-between">
                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 block pb-0.5 border-b border-slate-50">{t('logisticalParams')}</span>
                                                                    
                                                                    <p className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 mt-1.5">
                                                                        <User className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                                                                        <span className="truncate">{store.contactPerson || t('undefinedManager')}</span>
                                                                    </p>
                                                                    
                                                                    <p className="text-[9px] font-mono font-medium text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 mt-1">
                                                                        <Navigation className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                                                                        <span className="truncate">{store.gpsCoordinates || t('noGpsCoordinates')}</span>
                                                                    </p>

                                                                    {store.description && (
                                                                        <p className="text-[9px] italic text-slate-500 dark:text-zinc-400 mt-2 p-1.5 bg-slate-50 dark:bg-zinc-800/60 rounded border border-slate-100/50">
                                                                            "{store.description}"
                                                                        </p>
                                                                    )}
                                                                </div>

                                                                {/* Side 2: Audit specific summaries */}
                                                                <div className="space-y-1.5 bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800 text-[10px]">
                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 block pb-1 border-b border-slate-50 mb-1">{t('scanCounts')}</span>
                                                                    
                                                                    <div className="flex justify-between">
                                                                        <span>{t('avgProductDensity')}</span>
                                                                        <span className="font-extrabold text-slate-800 dark:text-zinc-200">{store.avgProducts} SKU</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span>{t('detectedPosMaterials')}</span>
                                                                        <span className="font-extrabold text-slate-800 dark:text-zinc-200">{store.totalPosMaterials} {t('piecesShort')}</span>
                                                                    </div>
                                                                    <div className="flex justify-between">
                                                                        <span>{t('totalApiCost')}</span>
                                                                        <span className="font-extrabold text-slate-800 dark:text-zinc-200 font-mono">
                                                                            {store.totalCost ? `${store.totalCost.toFixed(4)} ` : '0.00 '}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Last Visits Timeline */}
                                                            {store.latestAnalyses.length > 0 && (
                                                                <div className="space-y-2">
                                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 block">{t('recentVisits')}</span>
                                                                    <div className="space-y-1.5">
                                                                        {store.latestAnalyses.map((an, idx) => {
                                                                            const anyCompliance = an.images?.find(i => i.analysisResult?.complianceScore !== undefined)?.analysisResult?.complianceScore;
                                                                            
                                                                            return (
                                                                                <div key={an.id || idx} className="bg-white dark:bg-zinc-900 px-3 py-2 rounded-xl border border-slate-100 dark:border-zinc-800 flex items-center justify-between text-[11px]">
                                                                                    <span className="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                                                                                        <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                                                                                        {formatDateTime(an.createdAt)}
                                                                                    </span>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-medium font-mono">#{an.id.slice(0, 6)}</span>
                                                                                        {anyCompliance !== undefined && (
                                                                                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                                                                                                anyCompliance >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                                                                            }`}>
                                                                                                {t('complianceBadge', { percent: anyCompliance })}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}

                                                        </div>
                                                    )}
                                                </div>

                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {/* Desktop/tablet table header */}
                                    <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-zinc-500">
                                        <div className="col-span-3">{t('colStoreNameCode')}</div>
                                        <div className="col-span-2 text-center">{t('colChainFormat')}</div>
                                        <div className="col-span-3">{t('colLocationAddress')}</div>
                                        <div className="col-span-1 text-center">{t('colVisits')}</div>
                                        <div className="col-span-1 text-center">{t('colComplianceRate')}</div>
                                        <div className="col-span-1 text-center font-black">{t('colTargetKpi')}</div>
                                        <div className="col-span-1 text-right pr-2">{t('colActions')}</div>
                                    </div>
                                    {sortedStores.map(store => {
                                        const isExpanded = !!expandedStores[store.id || 0];
                                        
                                        return (
                                            <div 
                                                key={store.id} 
                                                className={`bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col overflow-hidden ${getChainBorderColor(store.chain)}`}
                                            >
                                                {/* Compact single row wrapper */}
                                                <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-4 py-3 px-6 text-xs text-slate-700 dark:text-zinc-300 font-semibold">
                                                    
                                                    {/* Store name and code */}
                                                    <div className="col-span-1 lg:col-span-3 flex items-center gap-2 min-w-0">
                                                        <span className="font-extrabold text-slate-900 dark:text-zinc-100 truncate" title={store.name}>
                                                            {store.name}
                                                        </span>
                                                        {store.code && (
                                                            <span className="bg-blue-50 text-[9px] font-mono font-black px-1.5 py-0.5 rounded-md text-blue-700 border border-blue-100/30 shrink-0">
                                                                #{store.code}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Chain and format tier */}
                                                    <div className="col-span-1 lg:col-span-2 flex items-center lg:justify-center gap-1.5 flex-wrap">
                                                        {store.chain && (
                                                            <span className="bg-slate-50 dark:bg-zinc-800/60 text-[9px] uppercase font-black px-2 py-0.5 rounded-md text-slate-500 dark:text-zinc-400 border border-slate-100 dark:border-zinc-800">
                                                                {store.chain}
                                                            </span>
                                                        )}
                                                        {store.storeTier && (
                                                            <span className="bg-emerald-50 text-[9px] uppercase font-bold px-2 py-0.5 rounded-md text-emerald-700">
                                                                {getTierLabel(store.storeTier)}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Address and City */}
                                                    <div className="col-span-1 lg:col-span-3 text-slate-400 dark:text-zinc-500 text-[11px] truncate flex items-center gap-1">
                                                        <MapPin className="w-3.5 h-3.5 text-slate-400/70 shrink-0" />
                                                        <span className="truncate" title={[store.address, store.city].filter(Boolean).join(', ')}>
                                                            {[store.address, store.city].filter(Boolean).join(', ')}
                                                        </span>
                                                    </div>

                                                    {/* Visit amount */}
                                                    <div className="col-span-1 lg:col-span-1 lg:text-center font-bold text-slate-800 dark:text-zinc-200">
                                                        <span className="lg:hidden text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 block mb-0.5">{t('colVisits')}: </span>
                                                        {store.visitsCount}x
                                                    </div>

                                                    {/* Compliance Score */}
                                                    <div className="col-span-1 lg:col-span-1 lg:text-center">
                                                        <span className="lg:hidden text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 block mb-0.5">{t('colComplianceRate')}: </span>
                                                        <span className={`font-black ${
                                                            store.avgCompliance === null ? 'text-slate-400' :
                                                            store.avgCompliance >= 80 ? 'text-emerald-600' : 'text-red-500'
                                                        }`}>
                                                            {store.avgCompliance !== null ? `${store.avgCompliance}%` : '—'}
                                                        </span>
                                                    </div>

                                                    {/* Target KPI Share */}
                                                    <div className="col-span-1 lg:col-span-1 lg:text-center font-semibold text-slate-650">
                                                        <span className="lg:hidden text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 block mb-0.5">{t('colTargetKpi')}: </span>
                                                        {store.targetShelfShare ? `${store.targetShelfShare}%` : '—'}
                                                    </div>

                                                    {/* Row and sub-action triggers */}
                                                    <div className="col-span-1 lg:col-span-1 flex items-center justify-end gap-1 shrink-0">
                                                        <button 
                                                            onClick={() => toggleStoreExpand(store.id || 0)}
                                                            className="p-1.5 text-slate-400 dark:text-zinc-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-zinc-800/60 rounded-lg transition-all"
                                                            title={isExpanded ? t('closeAuditSummary') : t('viewAuditSummary')}
                                                        >
                                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                        </button>
                                                        {store.gpsCoordinates && (
                                                            <a 
                                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.gpsCoordinates)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="p-1.5 text-slate-400 dark:text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                                title={t('openOnMap')}
                                                            >
                                                                <Navigation className="w-4 h-4" />
                                                            </a>
                                                        )}
                                                        <button 
                                                            onClick={() => { setEditingStore(store); setIsEditing(true); }} 
                                                            className="p-1.5 text-slate-400 dark:text-zinc-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                            title={t('editStoreDetails')}
                                                        >
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => store.id && handleDelete(store.id)} 
                                                            className="p-1.5 text-slate-400 dark:text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                            title={t('deleteStoreTitle')}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                </div>

                                                {/* IN-LINE EXPANDABLE SLATE ACCORDION */}
                                                {isExpanded && (
                                                    <div className="p-5 bg-slate-50/50 dark:bg-zinc-900/60 space-y-4 border-t border-slate-100 dark:border-zinc-800 text-slate-600 dark:text-zinc-400">
                                                        
                                                        {/* Target vs Actual KPI benchmark info */}
                                                        {store.targetShelfShare ? (
                                                            <div className="space-y-1.5">
                                                                <div className="flex justify-between items-center text-[10px]">
                                                                    <span className="font-bold flex items-center gap-1">
                                                                        <Target className="w-3.5 h-3.5 text-rose-500" /> {t('kpiTargetShelfShare')}
                                                                    </span>
                                                                    <span className="font-black text-slate-900 dark:text-zinc-100">{store.targetShelfShare}%</span>
                                                                </div>
                                                                <div className="w-full bg-slate-200/60 rounded-full h-2 overflow-hidden flex">
                                                                    <div 
                                                                        className={`h-full ${
                                                                            store.avgCompliance !== null && store.avgCompliance >= (store.targetShelfShare || 30)
                                                                            ? 'bg-emerald-500' : 'bg-red-500'
                                                                        }`}
                                                                        style={{ width: `${Math.min(100, store.avgCompliance || 0)}%` }}
                                                                    />
                                                                </div>
                                                                <div className="flex justify-between text-[8px] text-slate-450 font-semibold uppercase tracking-wider">
                                                                    <span>{t('actualShare', { share: store.avgCompliance || 0 })}</span>
                                                                    <span>{t('targetShare', { share: store.targetShelfShare })}</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <p className="text-[9px] text-slate-400 dark:text-zinc-500 italic">{t('noKpiDefined')}</p>
                                                        )}

                                                        {/* Split specs */}
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                                            
                                                            {/* Side 1: Logistics & Contact meta */}
                                                            <div className="space-y-2 bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800 flex flex-col justify-between">
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 block pb-0.5 border-b border-slate-50">{t('logisticalParams')}</span>
                                                                
                                                                <p className="text-[10px] font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5 mt-1.5">
                                                                    <User className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                                                                    <span className="truncate">{store.contactPerson || t('undefinedManager')}</span>
                                                                </p>
                                                                
                                                                <p className="text-[9px] font-mono font-medium text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 mt-1">
                                                                    <Navigation className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                                                                    <span className="truncate">{store.gpsCoordinates || t('noGpsCoordinates')}</span>
                                                                </p>

                                                                {store.description && (
                                                                    <p className="text-[9px] italic text-slate-500 dark:text-zinc-400 mt-2 p-1.5 bg-slate-50 dark:bg-zinc-800/60 rounded border border-slate-100/50">
                                                                        "{store.description}"
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {/* Side 2: Audit specific summaries */}
                                                            <div className="space-y-1.5 bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800 text-[10px]">
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 block pb-1 border-b border-slate-50 mb-1">{t('scanCounts')}</span>
                                                                
                                                                <div className="flex justify-between">
                                                                    <span>{t('avgProductDensity')}</span>
                                                                    <span className="font-extrabold text-slate-800 dark:text-zinc-200">{store.avgProducts} SKU</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>{t('detectedPosMaterials')}</span>
                                                                    <span className="font-extrabold text-slate-800 dark:text-zinc-200">{store.totalPosMaterials} {t('piecesShort')}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span>{t('totalApiCost')}</span>
                                                                    <span className="font-extrabold text-slate-800 dark:text-zinc-200 font-mono">
                                                                        {store.totalCost ? `${store.totalCost.toFixed(4)} ` : '0.00 '}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Last Visits Timeline */}
                                                        {store.latestAnalyses.length > 0 && (
                                                            <div className="space-y-2">
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 block">{t('recentVisits')}</span>
                                                                <div className="space-y-1.5">
                                                                    {store.latestAnalyses.map((an, idx) => {
                                                                        const anyCompliance = an.images?.find(i => i.analysisResult?.complianceScore !== undefined)?.analysisResult?.complianceScore;
                                                                        
                                                                        return (
                                                                            <div key={an.id || idx} className="bg-white dark:bg-zinc-900 px-3 py-2 rounded-xl border border-slate-100 dark:border-zinc-800 flex items-center justify-between text-[11px]">
                                                                                <span className="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                                                                                    <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                                                                                    {formatDateTime(an.createdAt)}
                                                                                </span>
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-medium font-mono">#{an.id.slice(0, 6)}</span>
                                                                                    {anyCompliance !== undefined && (
                                                                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                                                                                            anyCompliance >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                                                                                        }`}>
                                                                                            {t('complianceBadge', { percent: anyCompliance })}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        ) : (
                            <div className="text-center py-20 flex flex-col items-center justify-center bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800">
                                <div className="bg-slate-50 dark:bg-zinc-800/60 w-20 h-20 rounded-full flex items-center justify-center mb-6">
                                    <Building2 className="w-8 h-8 text-slate-300" />
                                </div>
                                <p className="text-base font-black text-slate-800 dark:text-zinc-200 mb-1">{t('noStoresFound')}</p>
                                <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-sm">{t('adjustFilterOrCreateStore')}</p>
                            </div>
                        )}
                    </div>

                </div>
            )}

        </div>
    );
};
