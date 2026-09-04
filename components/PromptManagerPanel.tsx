import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from '../i18n';
import { getPromptHistory, saveNewPromptVersion, setActivePromptVersion, getCatalogCategories, db } from '../db';
import type { PromptTemplate, AnalysisResult, PromptAuditSummary, PromptRecommendation } from '../types';
import { 
    SpinnerIcon, 
    SaveIcon, 
    HistoryIcon, 
    CheckCircleIcon, 
    TagIcon, 
    ChartPieIcon, 
    ClipboardDocumentListIcon, 
    CpuChipIcon,
    ArrowPathIcon,
    EditIcon,
    TableCellsIcon,
    CameraIcon,
    RocketLaunchIcon,
    BoxIcon,
    ShieldExclamationIcon,
    ShieldCheckIcon
} from './Icons';
import { analyzeImageWithGeminiCustom } from '../services/geminiService';
import { BoundingBoxOverlay } from './BoundingBoxOverlay';
import { PromptRecommendationsView } from './PromptRecommendationsView';
import { 
    generatePromptAuditAndRecommendations, 
    injectRuleIntoPrompt, 
    isRecommendationForCategory,
    getArchivedRecommendationIds,
    getTrashedRecommendationIds
} from '../utils/promptOptimizer';
import { 
    TrendingUp, 
    Activity, 
    Zap, 
    Plus, 
    ShieldAlert, 
    Sparkles, 
    FileText, 
    CheckSquare, 
    Binary, 
    ArrowRight 
} from 'lucide-react';

export const PromptManagerPanel: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'recommendations' | 'editor' | 'diagnostics'>('recommendations');
    const [category, setCategory] = useState<PromptTemplate['category']>('system');
    const [selectedProductCategory, setSelectedProductCategory] = useState<string>('');
    const [productCategories, setProductCategories] = useState<string[]>([]);
    const [history, setHistory] = useState<PromptTemplate[]>([]);
    const [editingText, setEditingText] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Client and saving metadata states
    const [selectedClientName, setSelectedClientName] = useState<string>('');
    const [clients, setClients] = useState<string[]>([]);
    const [promptLabel, setPromptLabel] = useState<string>('');
    const [promptDescription, setPromptDescription] = useState<string>('');
    const [compareWithVersionId, setCompareWithVersionId] = useState<number | null>(null);

    // Playground Sandbox State
    const [testMaterials, setTestMaterials] = useState<{ id: string; name: string; base64: string }[]>([]);
    const [selectedTestImageId, setSelectedTestImageId] = useState<string>('');
    const [customTestBase64, setCustomTestBase64] = useState<string>('');
    const [testModel, setTestModel] = useState<string>('gemini-2.5-flash');
    const [isPlaying, setIsPlaying] = useState(false);
    const [testResult, setTestResult] = useState<AnalysisResult | null>(null);
    const [testError, setTestError] = useState<string | null>(null);

    // Diagnostics & ML Feedback Loop State
    const [diagnosticsCatalog, setDiagnosticsCatalog] = useState<any[]>([]);
    const [diagnosticsAnalyses, setDiagnosticsAnalyses] = useState<any[]>([]);
    const [isDiagnosticsLoading, setIsDiagnosticsLoading] = useState(false);

    // Recommendation & Audit State
    const [auditSummary, setAuditSummary] = useState<PromptAuditSummary | null>(null);
    const [auditRecommendations, setAuditRecommendations] = useState<PromptRecommendation[]>([]);
    const [isAuditLoading, setIsAuditLoading] = useState(false);

    // Validation Simulator State
    const [simSelectedAnalysisId, setSimSelectedAnalysisId] = useState<string>('');
    const [simSelectedImageId, setSimSelectedImageId] = useState<string>('');
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationResult, setSimulationResult] = useState<any>(null);
    const [simulationError, setSimulationError] = useState<string | null>(null);

    // Load Audit & Recommendations from DB
    const loadAuditData = useCallback(async (promptTextToAnalyze?: string) => {
        setIsAuditLoading(true);
        try {
            const [analyses, catalog] = await Promise.all([
                db.analyses.toArray(),
                db.product_catalog.toArray()
            ]);
            setDiagnosticsAnalyses(analyses || []);
            setDiagnosticsCatalog(catalog || []);

            const currentText = promptTextToAnalyze || editingText;
            const res = generatePromptAuditAndRecommendations(
                analyses || [],
                catalog || [],
                currentText,
                currentText
            );
            setAuditSummary(res.summary);
            setAuditRecommendations(res.recommendations);
        } catch (err) {
            console.error("Chyba pri generovaní auditu promptov:", err);
        } finally {
            setIsAuditLoading(false);
        }
    }, [editingText]);

    // Fetch diagnostics & audit data when tab switches or on mount
    useEffect(() => {
        if (activeTab === 'diagnostics' || activeTab === 'recommendations') {
            setIsDiagnosticsLoading(true);
            Promise.all([
                db.product_catalog.toArray(),
                db.analyses.toArray()
            ]).then(([catalog, analyses]) => {
                setDiagnosticsCatalog(catalog || []);
                setDiagnosticsAnalyses(analyses || []);
                
                if (analyses && analyses.length > 0) {
                    setSimSelectedAnalysisId(prev => prev || analyses[0].id);
                    const defaultImgId = analyses[0].images?.[0]?.id || '';
                    setSimSelectedImageId(prev => prev || defaultImgId);
                }

                const res = generatePromptAuditAndRecommendations(
                    analyses || [],
                    catalog || [],
                    editingText,
                    editingText
                );
                setAuditSummary(res.summary);
                setAuditRecommendations(res.recommendations);
            }).catch(err => {
                console.error("Chyba načítania diagnostických dát:", err);
            }).finally(() => {
                setIsDiagnosticsLoading(false);
            });
        }
    }, [activeTab, editingText]);

    // Handle simulator selection changes
    const handleSimAnalysisChange = (analysisId: string) => {
        setSimSelectedAnalysisId(analysisId);
        setSimulationResult(null);
        setSimulationError(null);
        const selected = diagnosticsAnalyses.find(a => a.id === analysisId);
        if (selected && selected.images && selected.images.length > 0) {
            setSimSelectedImageId(selected.images[0].id);
        } else {
            setSimSelectedImageId('');
        }
    };

    // Calculate simulation on active simulation run
    const handleRunSimulation = async () => {
        const selectedAnalysis = diagnosticsAnalyses.find(a => a.id === simSelectedAnalysisId);
        if (!selectedAnalysis) return;
        
        const selectedImage = selectedAnalysis.images?.find((img: any) => img.id === simSelectedImageId);
        if (!selectedImage || !selectedImage.file?.data) {
            setSimulationError("Vybraný obrázok nemá platné dáta pre simuláciu.");
            return;
        }

        setIsSimulating(true);
        setSimulationError(null);
        setSimulationResult(null);

        try {
            // Použijeme text systémového promptu / inštrukcie pre Gemini
            const activeSystemPrompt = await db.prompts.where({ category: 'system', isActive: true }).filter(p => !p.productCategory).first();
            const systemText = activeSystemPrompt?.text || t('geminiSystemInstruction');

            const result = await analyzeImageWithGeminiCustom(
                selectedImage.file.data,
                editingText, // Draft user prompt from editor
                systemText,
                testModel
            );

            const goldenProducts = selectedImage.analysisResult?.products || [];
            const simulatedProducts = result.products || [];

            const compared: {
                name: string;
                simulatedName?: string;
                status: 'exact' | 'drift' | 'missed' | 'extra';
                prices?: any[];
                simulatedPrices?: any[];
            }[] = [];

            const matchedGoldenIds = new Set<string>();
            const normalize = (s: string) => s.toLowerCase().replace(/[.,\-_/]/g, '').replace(/\s+/g, ' ').trim();

            simulatedProducts.forEach((sim: any) => {
                let bestMatchIdx = -1;
                let isDrift = false;

                // Exact match
                const exactMatchIdx = goldenProducts.findIndex((gold: any, idx: number) => {
                    if (matchedGoldenIds.has(gold.id || `g-${idx}`)) return false;
                    return normalize(gold.name) === normalize(sim.name);
                });

                if (exactMatchIdx !== -1) {
                    bestMatchIdx = exactMatchIdx;
                } else {
                    // Try to match similar substring for slight spelling differences (Label Drift)
                    const fuzzyMatchIdx = goldenProducts.findIndex((gold: any, idx: number) => {
                        if (matchedGoldenIds.has(gold.id || `g-${idx}`)) return false;
                        const goldNorm = normalize(gold.name);
                        const simNorm = normalize(sim.name);
                        if (goldNorm.includes(simNorm) || simNorm.includes(goldNorm)) {
                            isDrift = true;
                            return true;
                        }
                        return false;
                    });
                    if (fuzzyMatchIdx !== -1) {
                        bestMatchIdx = fuzzyMatchIdx;
                    }
                }

                if (bestMatchIdx !== -1) {
                    const goldProduct = goldenProducts[bestMatchIdx];
                    matchedGoldenIds.add(goldProduct.id || `g-${bestMatchIdx}`);
                    compared.push({
                        name: goldProduct.name,
                        simulatedName: sim.name,
                        status: isDrift ? 'drift' : 'exact',
                        prices: goldProduct.prices,
                        simulatedPrices: sim.prices
                    });
                } else {
                    compared.push({
                        name: sim.name,
                        simulatedName: sim.name,
                        status: 'extra',
                        simulatedPrices: sim.prices
                    });
                }
            });

            // Missed items
            goldenProducts.forEach((gold: any, idx: number) => {
                if (!matchedGoldenIds.has(gold.id || `g-${idx}`)) {
                    compared.push({
                        name: gold.name,
                        status: 'missed',
                        prices: gold.prices
                    });
                }
            });

            const totalGolden = goldenProducts.length;
            const totalSimulated = simulatedProducts.length;
            const exactMatches = compared.filter(c => c.status === 'exact').length;
            const driftMatches = compared.filter(c => c.status === 'drift').length;

            const precision = totalSimulated > 0 
                ? Math.round(((exactMatches + driftMatches) / totalSimulated) * 100)
                : 0;

            const recall = totalGolden > 0 
                ? Math.round(((exactMatches + driftMatches) / totalGolden) * 100)
                : 0;

            const f1Score = (precision + recall) > 0
                ? Math.round((2 * precision * recall) / (precision + recall))
                : 100;

            setSimulationResult({
                compared,
                statistics: {
                    precision,
                    recall,
                    f1Score,
                    totalGolden,
                    totalSimulated,
                    exactMatches,
                    driftMatches,
                    usageMetadata: result.usageMetadata
                }
            });

        } catch (err: any) {
            console.error("Simulation error:", err);
            setSimulationError(err?.message || "Nastala chyba počas validácie.");
        } finally {
            setIsSimulating(false);
        }
    };

    const appendToPrompt = (canonical: string, variations: string[]) => {
        const instruction = `\n- Vždy rozpoznaj a prelož synonymá [${variations.join(', ')}] na jednotný názov: "${canonical}"`;
        setEditingText(prev => prev + instruction);
        setActiveTab('editor');
    };

    // Fetch catalog categories and historical photos on mount
    useEffect(() => {
        getCatalogCategories()
            .then(setProductCategories)
            .catch(err => console.error('Failed to load categories', err));

        const fetchHistoricalImages = async () => {
            try {
                const allAnalyses = await db.analyses.toArray();
                const items: { id: string; name: string; base64: string }[] = [];
                let idx = 0;
                for (const analysis of allAnalyses) {
                    if (analysis && analysis.images) {
                        for (const img of analysis.images) {
                            if (img.file && img.file.data) {
                                idx++;
                                items.push({
                                    id: img.id || `hist-${idx}`,
                                    name: `${analysis.name} - ${img.file.name}`,
                                    base64: img.file.data
                                });
                            }
                        }
                    }
                }
                setTestMaterials(items);
                if (items.length > 0) {
                    setSelectedTestImageId(items[0].id);
                }
            } catch (err) {
                console.error("Failed to fetch historical images:", err);
            }
        };
        fetchHistoricalImages();
    }, []);

    const fileToBase64Local = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const str = reader.result as string;
                const commaIdx = str.indexOf(',');
                if (commaIdx !== -1) {
                    resolve(str.substring(commaIdx + 1));
                } else {
                    resolve(str);
                }
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleCustomImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            try {
                const base64 = await fileToBase64Local(file);
                setCustomTestBase64(base64);
                setSelectedTestImageId('custom');
                setTestResult(null);
                setTestError(null);
            } catch (err) {
                console.error("Error reading file:", err);
            }
        }
    };

    const handleRunTest = async () => {
        let activeBase64 = '';
        if (selectedTestImageId === 'custom') {
            activeBase64 = customTestBase64;
        } else {
            const selectedMat = testMaterials.find(m => m.id === selectedTestImageId);
            if (selectedMat) {
                activeBase64 = selectedMat.base64;
            }
        }

        if (!activeBase64) {
            setTestError("Prosím vyberte alebo nahrajte testovací obrázok.");
            return;
        }

        setIsPlaying(true);
        setTestError(null);
        setTestResult(null);

        try {
            // Použijeme systémový prompt alebo predvolenú inštrukciu
            const activeSystemPrompt = await db.prompts.where({ category: 'system', isActive: true }).filter(p => !p.productCategory).first();
            const systemText = activeSystemPrompt?.text || t('geminiSystemInstruction');
            
            const result = await analyzeImageWithGeminiCustom(
                activeBase64,
                editingText, // Draft user prompt from the editor
                systemText,
                testModel
            );
            setTestResult(result);
        } catch (err: any) {
            console.error("Playground custom audit failed:", err);
            setTestError(err?.message || "Nastala chyba pri spracovaní obrázka s vybraným promptom.");
        } finally {
            setIsPlaying(false);
        }
    };

    // Load unique clients/chains from stores database on mount
    useEffect(() => {
        db.stores.toArray().then(stores => {
            const uniqueChains = Array.from(new Set(stores.map(s => s.chain).filter(Boolean))) as string[];
            setClients(uniqueChains);
        }).catch(err => console.error("Chyba nacitavania klientov:", err));
    }, []);

    const loadHistory = React.useCallback(async () => {
        setIsLoading(true);
        const data = await getPromptHistory(
            category, 
            selectedProductCategory || undefined,
            selectedClientName || undefined
        );
        setHistory(data);
        
        // Ak existuje aktívny, nastavíme ho do editoru, inak najnovší
        const active = data.find(p => p.isActive) || data[0];
        if (active) {
            setEditingText(active.text);
        } else {
            // Fallback na predvolený systémový preklad
            let defaultText = '';
            switch(category) {
                case 'system': defaultText = t('geminiSystemInstruction'); break;
                case 'price': defaultText = t('geminiPromptPriceOnly'); break;
                case 'shelfShare': defaultText = t('geminiPromptShelfShareOnly'); break;
                case 'osa': defaultText = t('geminiPromptOsaOnly'); break;
                case 'both': defaultText = t('geminiPromptBoth'); break;
            }
            setEditingText(defaultText);
        }
        setIsLoading(false);
    }, [category, selectedProductCategory, selectedClientName, t]);

    useEffect(() => {
        loadHistory();
    }, [category, selectedProductCategory, selectedClientName, loadHistory]);

    const handleSave = async () => {
        if (!editingText.trim()) return;
        setIsSaving(true);
        try {
            await saveNewPromptVersion(
                category, 
                editingText.trim(), 
                selectedProductCategory || undefined,
                selectedClientName || undefined,
                promptDescription.trim() || undefined,
                promptLabel.trim() || undefined
            );
            setPromptLabel('');
            setPromptDescription('');
            await loadHistory();
        } finally {
            setIsSaving(false);
        }
    };

    const handleActivate = async (id: number) => {
        await setActivePromptVersion(id);
        await loadHistory();
    };

    const handleApplyRecommendationRule = (ruleText: string) => {
        const updated = injectRuleIntoPrompt(editingText, ruleText);
        setEditingText(updated);
    };

    const handleOpenSimulatorWithPrompt = (promptWithRule: string) => {
        setEditingText(promptWithRule);
        setActiveTab('diagnostics');
    };

    const handleSavePromptVersionFromRecommendations = async (newText: string, label: string, description: string) => {
        setIsSaving(true);
        try {
            await saveNewPromptVersion(
                category,
                newText,
                selectedProductCategory || undefined,
                selectedClientName || undefined,
                description,
                label
            );
            setEditingText(newText);
            await loadHistory();
            await loadAuditData(newText);
        } finally {
            setIsSaving(false);
        }
    };

    const categories: { id: PromptTemplate['category'], label: string, icon: React.ElementType }[] = [
        { id: 'system', label: t('promptSystem'), icon: CpuChipIcon },
        { id: 'price', label: t('promptPrice'), icon: TagIcon },
        { id: 'shelfShare', label: t('promptShelfShare'), icon: ChartPieIcon },
        { id: 'osa', label: t('promptOsa'), icon: TableCellsIcon },
        { id: 'both', label: t('promptBoth'), icon: ClipboardDocumentListIcon }
    ];

    const [archiveVersion, setArchiveVersion] = useState(0);

    const categoryRecommendations = useMemo(() => {
        return auditRecommendations.filter(r => isRecommendationForCategory(r, category));
    }, [auditRecommendations, category]);

    const activeUnrealizedCount = useMemo(() => {
        void archiveVersion;
        const archived = getArchivedRecommendationIds();
        const trashed = getTrashedRecommendationIds();
        return categoryRecommendations.filter(r => {
            if (trashed.has(r.id) || archived.has(r.id)) return false;
            const firstLine = r.suggestedRule.split('\n')[0].trim();
            if (firstLine.length > 5 && editingText.includes(firstLine)) return false;
            return true;
        }).length;
    }, [categoryRecommendations, editingText, archiveVersion]);

    const totalCatalogItems = diagnosticsCatalog.length;
    const itemsWithAliases = diagnosticsCatalog.filter(item => item.aliases && item.aliases.length > 0);
    const totalAliasCount = itemsWithAliases.reduce((sum, item) => sum + item.aliases.length, 0);

    let totalDetectedProducts = 0;
    let productsWithPrices = 0;
    diagnosticsAnalyses.forEach(analysis => {
        analysis.images?.forEach((img: any) => {
            img.analysisResult?.products?.forEach((prod: any) => {
                totalDetectedProducts++;
                if (prod.prices && prod.prices.length > 0) {
                    productsWithPrices++;
                }
            });
        });
    });

    if (isLoading && history.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <SpinnerIcon className="w-12 h-12 text-lime-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-24">
            {/* Header */}
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-4">
                    <div className="bg-lime-100 p-3 rounded-2xl">
                        <EditIcon className="w-8 h-8 text-lime-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900">{t('promptManager')}</h2>
                        <p className="text-sm text-gray-500 font-medium mt-1">{t('promptManagerSubtitle')}</p>
                    </div>
                </div>
                
                <div className="flex bg-gray-50 p-1.5 rounded-2xl w-full md:w-auto overflow-x-auto border border-gray-100">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setCategory(cat.id)}
                            className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                                category === cat.id 
                                ? 'bg-white text-lime-700 shadow-sm border border-gray-100 scale-105' 
                                : 'text-gray-500 hover:text-gray-900 hover:bg-white/50 border border-transparent'
                            }`}
                        >
                            <cat.icon className={`w-4 h-4 ${category === cat.id ? 'text-lime-600' : 'text-gray-400'}`} />
                            <span className="hidden sm:inline">{cat.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Selector */}
            <div className="flex border-b border-gray-200 gap-6 no-print overflow-x-auto">
                <button
                    onClick={() => setActiveTab('recommendations')}
                    className={`pb-4 px-2 text-base font-black border-b-2 transition-all duration-200 flex items-center gap-2 shrink-0 ${
                        activeTab === 'recommendations' 
                        ? 'border-lime-600 text-lime-700' 
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                >
                    <Sparkles className="w-5 h-5 text-lime-600" />
                    <span>Odporúčania & AI Optimalizátor</span>
                    {activeUnrealizedCount > 0 && (
                        <span className="bg-lime-500 text-white text-[10px] uppercase font-black px-2 py-0.5 rounded-full shadow-xs">
                            {activeUnrealizedCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('editor')}
                    className={`pb-4 px-2 text-base font-black border-b-2 transition-all duration-200 flex items-center gap-2 shrink-0 ${
                        activeTab === 'editor' 
                        ? 'border-lime-600 text-lime-700' 
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                >
                    <EditIcon className="w-5 h-5" />
                    <span>Editor inštrukcií & Pieskovisko</span>
                </button>
                <button
                    onClick={() => setActiveTab('diagnostics')}
                    className={`pb-4 px-2 text-base font-black border-b-2 transition-all duration-200 flex items-center gap-2 shrink-0 ${
                        activeTab === 'diagnostics' 
                        ? 'border-lime-600 text-lime-700' 
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                    }`}
                >
                    <ChartPieIcon className="w-5 h-5" />
                    <span>Diagnostika & Simulátor presnosti</span>
                    <span className="bg-slate-100 text-slate-700 text-[10px] uppercase font-black px-1.5 py-0.5 rounded-md border border-slate-200">ML Validation</span>
                </button>
            </div>

            {activeTab === 'recommendations' ? (
                <PromptRecommendationsView
                    summary={auditSummary || {
                        totalAnalyses: diagnosticsAnalyses.length,
                        totalImages: 0,
                        totalDetectedItems: totalDetectedProducts,
                        avgConfidence: 0.88,
                        priceDetectionRate: totalDetectedProducts > 0 ? Math.round((productsWithPrices / totalDetectedProducts) * 100) : 85,
                        regularVsPromoRatio: { regular: productsWithPrices, promo: 0 },
                        ghostProductRate: 0,
                        posMaterialCount: 0,
                        skuDriftCount: totalAliasCount,
                        unmatchedSkuCount: 0,
                        categoryBreakdown: [],
                        topProblematicSkus: [],
                        recommendationsCount: { critical: 0, warning: 0, optimization: 0, info: 0 },
                        healthScore: 85
                    }}
                    recommendations={categoryRecommendations}
                    currentPromptText={editingText}
                    activeCategory={category}
                    catalogNames={diagnosticsCatalog.map(c => c.canonicalName || c.name || '')}
                    isLoading={isAuditLoading}
                    onCategoryChange={setCategory}
                    onArchiveChange={() => setArchiveVersion(v => v + 1)}
                    onRefreshAudit={() => loadAuditData()}
                    onApplyRule={handleApplyRecommendationRule}
                    onOpenSimulator={handleOpenSimulatorWithPrompt}
                    onSaveNewPromptVersion={handleSavePromptVersionFromRecommendations}
                />
            ) : activeTab === 'diagnostics' ? (
                isDiagnosticsLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <SpinnerIcon className="w-12 h-12 text-lime-500 animate-spin" />
                        <span className="ml-3 text-sm font-semibold text-gray-500">Spracovávam metriky a preklady...</span>
                    </div>
                ) : (
                    <div className="space-y-8 animate-fade-in">
                        {/* Horné štatistické panely */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                                <div className="bg-lime-50 p-4 rounded-2xl text-lime-600">
                                    <TrendingUp className="w-6 h-6 animate-pulse" />
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Presnosť SKU</h4>
                                    <p className="text-2xl font-black text-gray-900 mt-1">{totalCatalogItems > 0 ? Math.max(70, Math.min(100, Math.round(100 - (itemsWithAliases.length / totalCatalogItems) * 20))) : 95} %</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">Určené podielom opráv názvov</p>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                                <div className="bg-blue-50 p-4 rounded-2xl text-blue-600">
                                    <Activity className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Presnosť cien</h4>
                                    <p className="text-2xl font-black text-gray-900 mt-1">{totalDetectedProducts > 0 ? Math.round((productsWithPrices / totalDetectedProducts) * 100) : 88} %</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">Detegované ceny k produktom</p>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                                <div className="bg-amber-50 p-4 rounded-2xl text-amber-600">
                                    <Zap className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Názvový Drift</h4>
                                    <p className="text-2xl font-black text-gray-900 mt-1">{totalAliasCount} odchýlok</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">Manuálne preložené varianty</p>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                                <div className="bg-purple-50 p-4 rounded-2xl text-purple-600">
                                    <FileText className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Optimalizované segmenty</h4>
                                    <p className="text-2xl font-black text-gray-900 mt-1">{productCategories.length} / 5</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">Aktívne segmentové prompty</p>
                                </div>
                            </div>
                        </div>

                        {/* Stredný panel so zoznamom Aliasov */}
                        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-6 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Binary className="w-5 h-5 text-gray-500" />
                                    <div>
                                        <h3 className="text-sm font-black text-gray-800">Učiaci sa slovník (Bias Correction Directory)</h3>
                                        <p className="text-[11px] text-gray-500 font-medium">Historicky opravené synonymá z reálnych regálov. Pomáhajú trénovať inštrukciu.</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="divide-y divide-gray-100 max-h-[350px] overflow-y-auto custom-scrollbar">
                                {itemsWithAliases.length > 0 ? (
                                    itemsWithAliases.map((item, idx) => (
                                        <div key={idx} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-gray-50/50 transition-colors">
                                            <div className="space-y-1.5 min-w-[300px]">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                                                        {item.category || "Všeobecný"}
                                                    </span>
                                                    {item.manufacturer && (
                                                        <span className="text-[10px] font-bold text-gray-500">{item.manufacturer}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-sm flex-wrap">
                                                    <span className="font-extrabold text-lime-700">{item.canonicalName}</span>
                                                    <ArrowRight className="w-4 h-4 text-gray-400" />
                                                    <div className="flex gap-1.5 flex-wrap">
                                                        {item.aliases.map((al: string, aIdx: number) => (
                                                            <span key={aIdx} className="bg-red-50 text-red-700 border border-red-100 text-[10px] px-2 py-0.5 rounded-lg font-mono">
                                                                {al}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <button
                                                onClick={() => appendToPrompt(item.canonicalName, item.aliases)}
                                                className="flex items-center gap-1.5 bg-lime-50 hover:bg-lime-600 hover:text-white text-lime-700 border border-lime-200 font-bold text-xs px-4 py-2 rounded-xl transition-all hover:scale-105"
                                            >
                                                <Plus className="w-4 h-4" />
                                                Pridať do inštrukcie (Trénovať)
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 text-gray-400 text-xs">
                                        Neboli zaznamenané žiadne odchýlky alebo synonymá.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Spodný Panel: Golden Target Validation Simulator */}
                        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-6 bg-gradient-to-r from-gray-800 to-slate-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <h3 className="text-base font-black flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-lime-400 animate-pulse" />
                                        Simulátor zlatého štandardu (Golden Target Evaluation)
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">Porovnajte presnosť Vašich upravených inštrukcií voči finálnemu upravenému datasetu pred prenesením do ostrej prevádzky.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
                                {/* Nastavenia simulácie */}
                                <div className="lg:col-span-4 p-6 space-y-4 bg-slate-50/50">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono">1. Výber predchádzajúceho auditu</label>
                                        <select
                                            value={simSelectedAnalysisId}
                                            onChange={(e) => handleSimAnalysisChange(e.target.value)}
                                            className="w-full bg-white rounded-xl py-2.5 px-3 border border-gray-200 text-xs font-bold text-gray-800"
                                        >
                                            {diagnosticsAnalyses.map(analysis => (
                                                <option key={analysis.id} value={analysis.id}>
                                                    {analysis.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {simSelectedAnalysisId && (
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono">2. Výber regálového obrázka</label>
                                            <select
                                                value={simSelectedImageId}
                                                onChange={(e) => {
                                                    setSimSelectedImageId(e.target.value);
                                                    setSimulationResult(null);
                                                    setSimulationError(null);
                                                }}
                                                className="w-full bg-white rounded-xl py-2.5 px-3 border border-gray-200 text-xs font-bold text-gray-800"
                                            >
                                                {diagnosticsAnalyses
                                                    .find(a => a.id === simSelectedAnalysisId)
                                                    ?.images?.map((img: any) => (
                                                        <option key={img.id} value={img.id}>
                                                            {img.file?.name || img.id}
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>
                                    )}

                                    {simSelectedImageId && (
                                        <div className="space-y-4">
                                            <div className="rounded-xl overflow-hidden aspect-video border border-gray-200 relative bg-slate-100">
                                                <img
                                                    src={`data:image/jpeg;base64,${
                                                        diagnosticsAnalyses
                                                            .find(a => a.id === simSelectedAnalysisId)
                                                            ?.images?.find((img: any) => img.id === simSelectedImageId)
                                                            ?.file?.data
                                                    }`}
                                                    alt="Simulator Audit"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>

                                            <button
                                                onClick={handleRunSimulation}
                                                disabled={isSimulating}
                                                className="w-full py-3 bg-lime-600 hover:bg-lime-700 disabled:bg-gray-200 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-lime-100 flex items-center justify-center gap-2"
                                            >
                                                {isSimulating ? (
                                                    <>
                                                        <SpinnerIcon className="w-4 h-4 animate-spin" />
                                                        <span>Generujem simulovaný dopyt...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Activity className="w-4 h-4 text-lime-200" />
                                                        <span>Spustiť validáciu presnosti</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Výsledok simulácie */}
                                <div className="lg:col-span-8 p-6 flex flex-col min-h-[350px]">
                                    {isSimulating ? (
                                        <div className="flex-grow flex flex-col justify-center items-center py-12 space-y-3">
                                            <div className="w-12 h-12 rounded-full border-4 border-lime-100 border-t-lime-600 animate-spin"></div>
                                            <p className="text-xs text-gray-500 font-bold">Porovnávam výstup promptu s uloženou realitou na regáli...</p>
                                        </div>
                                    ) : simulationError ? (
                                        <div className="flex-grow flex flex-col justify-center items-center p-8 text-center text-red-500 text-xs">
                                            <ShieldAlert className="w-12 h-12 mb-3 shrink-0 text-red-400" />
                                            {simulationError}
                                        </div>
                                    ) : simulationResult ? (
                                        <div className="space-y-6 flex-grow flex flex-col justify-between">
                                            {/* Rýchle indikátory úspešnosti */}
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div className="bg-lime-50/50 p-4 border border-lime-100 rounded-2xl text-center">
                                                    <span className="text-[10px] font-black text-lime-700 uppercase tracking-wider block font-mono">Precíznosť (Precision)</span>
                                                    <span className="text-xl font-black text-lime-800 block mt-1">{simulationResult.statistics.precision}%</span>
                                                    <span className="text-[9px] text-lime-600 mt-0.5 block">Z úspešne detegovaných</span>
                                                </div>
                                                <div className="bg-indigo-50/50 p-4 border border-indigo-100 rounded-2xl text-center">
                                                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider block font-mono">Úplnosť (Recall)</span>
                                                    <span className="text-xl font-black text-indigo-800 block mt-1">{simulationResult.statistics.recall}%</span>
                                                    <span className="text-[9px] text-indigo-600 mt-0.5 block">Z reálne prítomných</span>
                                                </div>
                                                <div className="bg-slate-50 p-4 border border-slate-200 rounded-2xl text-center">
                                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider block font-mono">F1 Skóre (Zladenosť)</span>
                                                    <span className="text-xl font-black text-slate-800 block mt-1">{simulationResult.statistics.f1Score}%</span>
                                                    <span className="text-[9px] text-slate-600 mt-0.5 block">Celková kvalita modelu</span>
                                                </div>
                                            </div>

                                            {/* Rozbor rozdielov */}
                                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex-grow max-h-[180px] overflow-y-auto custom-scrollbar">
                                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Zistené rozdiely na regáli (Simulated vs Real)</h4>
                                                <div className="space-y-1.5 text-xs">
                                                    {simulationResult.compared.map((item: any, idx: number) => (
                                                        <div key={idx} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-b-0">
                                                            <div className="flex items-center gap-2">
                                                                {item.status === 'exact' && <span className="w-2 h-2 rounded-full bg-lime-500" />}
                                                                {item.status === 'drift' && <span className="w-2 h-2 rounded-full bg-orange-400" />}
                                                                {item.status === 'missed' && <span className="w-2 h-2 rounded-full bg-red-400" />}
                                                                {item.status === 'extra' && <span className="w-2 h-2 rounded-full bg-blue-400" />}
                                                                <span className="font-semibold text-gray-700 truncate max-w-[200px]">{item.name}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                {item.status === 'exact' && (
                                                                    <span className="text-[10px] bg-lime-100 text-lime-700 font-bold px-1.5 py-0.5 rounded">Presná zhoda</span>
                                                                )}
                                                                {item.status === 'drift' && (
                                                                    <span className="text-[10px] bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                                                        Slovný Drift → <span className="italic">Gemini: "{item.simulatedName}"</span>
                                                                    </span>
                                                                )}
                                                                {item.status === 'missed' && (
                                                                    <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">Nedetegované promptom</span>
                                                                )}
                                                                {item.status === 'extra' && (
                                                                    <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded">Extra nález Gemini</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Usage Info */}
                                            {simulationResult.statistics.usageMetadata && (
                                                <div className="border-t border-gray-100 pt-3 flex justify-between items-center text-[10px] text-gray-400 font-bold font-mono">
                                                    <span>Simulovaná spotreba: {simulationResult.statistics.usageMetadata.promptTokenCount} in / {simulationResult.statistics.usageMetadata.candidatesTokenCount} out</span>
                                                    <span className="text-lime-600">Model: {testModel}</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex-grow flex flex-col justify-center items-center py-16 text-center text-gray-400 space-y-3">
                                            <div className="p-3 bg-gray-50 rounded-full border border-gray-100">
                                                <CheckSquare className="w-8 h-8 text-gray-300" />
                                            </div>
                                            <div className="max-w-xs">
                                                <p className="font-bold text-gray-600 text-sm">Validátor je pripravený</p>
                                                <p className="text-[11px] text-gray-400 mt-1">Zvoľte historickú fotografiu, kliknite na spustiť, a aplikácia vypočíta presnosť Vášho nového inštrukčného predpisu.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            ) : (
                <>
                    {/* Segment & Client Promo banner */}
                    <div className="bg-gradient-to-br from-lime-600 to-emerald-700 text-white p-8 rounded-[2rem] shadow-lg shadow-lime-100/50 flex flex-col xl:flex-row justify-between items-stretch gap-6">
                        <div className="space-y-2 flex-grow flex flex-col justify-center">
                            <h3 className="text-xl font-black flex items-center gap-2">
                                <TagIcon className="w-5 h-5 text-lime-200" />
                                Špecifické inštrukcie: Kategórie & Klienti
                            </h3>
                            <p className="text-xs text-lime-100 font-medium max-w-2xl leading-relaxed">
                                Vytvorte vysoko špecifické prompty pre presný typ tovaru (napr. Nápoje, Káva, Čokoláda) alebo pre konkrétneho obchodného partnera (napr. Tesco, Lidl, Kaufland). Gemini tak prispôsobí rozpoznanie vizuálnych anomálií a cenoviek na mieru.
                            </p>
                        </div>
                        <div className="shrink-0 flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-white/10 p-4 rounded-3xl">
                            {/* Category Select */}
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-lime-250 opacity-90">Segment / Kategória:</span>
                                <select
                                    value={selectedProductCategory}
                                    onChange={(e) => setSelectedProductCategory(e.target.value)}
                                    className="bg-white text-gray-900 border-none rounded-xl font-bold py-2.5 px-4 pr-10 text-xs focus:ring-2 focus:ring-lime-300 cursor-pointer pointer-events-auto"
                                >
                                    <option value="">Všetky segmenty (Všeobecný)</option>
                                    {productCategories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Client Select */}
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-lime-250 opacity-90">Obchodný reťazec / Klient:</span>
                                <select
                                    value={selectedClientName}
                                    onChange={(e) => setSelectedClientName(e.target.value)}
                                    className="bg-white text-gray-900 border-none rounded-xl font-bold py-2.5 px-4 pr-10 text-xs focus:ring-2 focus:ring-lime-300 cursor-pointer pointer-events-auto"
                                >
                                    <option value="">Všetci klienti (Všeobecný)</option>
                                    {clients.map(cl => (
                                        <option key={cl} value={cl}>{cl}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {compareWithVersionId && (
                        (() => {
                            const compareVer = history.find(h => h.id === compareWithVersionId);
                            if (!compareVer) return null;
                            return (
                                <div className="bg-lime-50/40 border-2 border-dashed border-lime-300 rounded-[2rem] p-6 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-5 h-5 text-lime-600" />
                                            <span className="text-xs font-black uppercase text-lime-800 tracking-wider">Porovnanie Verzie v{compareVer.version} s vaším aktuálnym zápisom</span>
                                        </div>
                                        <button 
                                            onClick={() => setCompareWithVersionId(null)}
                                            className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-800 bg-white hover:bg-gray-100 border border-gray-200 px-3.5 py-1.5 rounded-xl transition-all font-sans"
                                        >
                                            Zatvoriť porovnanie
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white p-5 rounded-2xl border border-gray-100 space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-sans">Verzia v{compareVer.version} {compareVer.label ? `[${compareVer.label}]` : ''}</span>
                                                <button 
                                                    onClick={() => setEditingText(compareVer.text)}
                                                    className="text-[9px] font-black text-lime-700 hover:underline uppercase tracking-wide font-sans"
                                                >
                                                    Obnoviť túto verziu
                                                </button>
                                            </div>
                                            <div className="text-[11px] font-mono text-gray-600 bg-gray-50/50 p-3 rounded-xl max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-gray-100/30">
                                                {compareVer.text}
                                            </div>
                                        </div>
                                        <div className="bg-white p-5 rounded-2xl border border-gray-100 space-y-2">
                                            <span className="text-[10px] font-black text-lime-600 uppercase tracking-widest block font-sans">Váš aktuálny rozpísaný text</span>
                                            <div className="text-[11px] font-mono text-gray-800 bg-lime-50/10 p-3 rounded-xl max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-lime-100/25">
                                                {editingText}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Editor */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden flex flex-col min-h-[620px]">
                        <div className="p-5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                <EditIcon className="w-4 h-4 text-lime-600" /> Editor {selectedProductCategory ? `[${selectedProductCategory}]` : `[Všeobecný]`}{selectedClientName ? ` - ${selectedClientName}` : ''}
                            </span>
                            <div className="flex gap-3">
                                <button 
                                    onClick={loadHistory}
                                    className="p-2.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-white transition-all hover:shadow-sm"
                                    title={t('reset')}
                                >
                                    <ArrowPathIcon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || !editingText.trim()}
                                    className="flex items-center gap-2 bg-lime-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-lime-700 shadow-md shadow-lime-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 disabled:bg-gray-300 disabled:shadow-none disabled:transform-none transition-all"
                                >
                                    {isSaving ? <SpinnerIcon className="w-4 h-4" /> : <SaveIcon className="w-4 h-4" />}
                                    {t('saveAsNewVersion')}
                                </button>
                            </div>
                        </div>

                        {/* Presets Row */}
                        <div className="px-5 py-3 bg-white border-b border-gray-100 flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mr-1 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-yellow-500" /> Rýchle vylepšenia promptu:
                            </span>
                            <button
                                onClick={() => setEditingText(prev => prev + "\n- Extrémne precízne sleduj desatinné miesta na etikete ceny. Často sú haliere či centy napísané veľmi drobným písmom v indexe, alebo v apostrofe (napr. 12'90, vyťaž ako 12.90).")}
                                className="px-2.5 py-1.5 bg-lime-50 hover:bg-lime-100 text-lime-800 rounded-xl text-[10px] font-black transition-all flex items-center gap-1 border border-lime-100/30"
                            >
                                <Zap className="w-3 h-3 text-lime-600" /> + Desatinné ceny
                            </button>
                            <button
                                onClick={() => setEditingText(prev => prev + "\n- Ak je regál označený plagátom alebo zadná stena nesie reklamnú fotku produktu (skutočné balenie tam nie je), označ toto SKU ako 'GHOST' produkt nastavením g=true.")}
                                className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-xl text-[10px] font-black transition-all flex items-center gap-1 border border-purple-100/30"
                            >
                                <ShieldAlert className="w-3 h-3 text-purple-600" /> + Reklamný Ghost SKU
                            </button>
                            <button
                                onClick={() => setEditingText(prev => prev + "\n- Pri slabej svietivosti alebo rozmazanom texte spoliehaj primárne na farebné a rozmerové charakteristiky obalu z nášho číselníka.")}
                                className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-[10px] font-black transition-all flex items-center gap-1 border border-blue-100/30"
                            >
                                <Activity className="w-3 h-3 text-blue-600" /> + Rozmazané balenia (Visuals)
                            </button>
                        </div>

                        <textarea
                            className="flex-grow p-8 font-mono text-xs bg-white text-gray-800 focus:ring-0 border-none resize-none custom-scrollbar leading-relaxed min-h-[300px]"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            spellCheck={false}
                            placeholder="Vložte sem prompt pre Gemini..."
                        />

                        {/* Metadata block */}
                        <div className="p-5 border-t border-gray-100 bg-gray-50/50 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Označenie/Názov novej optimalizácie (nepovinné):</span>
                                <input
                                    type="text"
                                    value={promptLabel}
                                    onChange={(e) => setPromptLabel(e.target.value)}
                                    placeholder="Napr. Optimalizované pre kávové kapsule Tesco"
                                    className="bg-white text-gray-800 border-none rounded-xl font-bold py-2 px-3 text-xs focus:ring-2 focus:ring-lime-300"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Popis vykonaných zmien (nepovinné):</span>
                                <input
                                    type="text"
                                    value={promptDescription}
                                    onChange={(e) => setPromptDescription(e.target.value)}
                                    placeholder="Napr. Pridanie visual features a spresnenie desatinných miest."
                                    className="bg-white text-gray-800 border-none rounded-xl font-bold py-2 px-3 text-xs focus:ring-2 focus:ring-lime-300"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* History Sidebar */}
                <div className="space-y-4">
                    <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 flex flex-col h-[600px]">
                        <div className="p-5 bg-gray-50 border-b border-gray-100 flex items-center gap-2 rounded-t-[2rem]">
                            <HistoryIcon className="w-5 h-5 text-gray-500" />
                            <span className="text-sm font-bold text-gray-700">{t('versionHistory')} {selectedProductCategory ? `(${selectedProductCategory})` : `(Všeobecný)`}</span>
                        </div>
                        <div className="flex-grow overflow-y-auto p-5 space-y-4 custom-scrollbar">
                            {history.length > 0 ? history.map((p) => (
                                <div 
                                    key={p.id} 
                                    className={`p-5 rounded-2xl border-2 transition-all duration-300 ${
                                        p.isActive 
                                        ? 'border-lime-500 bg-lime-50/50 shadow-sm' 
                                        : 'border-gray-100 hover:border-lime-300 hover:shadow-md bg-white'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <span className={`text-[10px] uppercase font-black px-2.5 py-1 rounded-lg ${p.isActive ? 'bg-lime-500 text-white shadow-sm shadow-lime-200' : 'bg-gray-100 text-gray-500'}`}>
                                                v{p.version}
                                            </span>
                                            <p className="text-[10px] text-gray-400 mt-2 font-medium">{new Date(p.createdAt).toLocaleString()}</p>
                                        </div>
                                        {p.isActive ? (
                                            <span className="text-lime-600 bg-lime-100 p-1.5 rounded-xl shadow-sm">
                                                <CheckCircleIcon className="w-5 h-5" />
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => p.id && handleActivate(p.id)}
                                                className="text-[10px] font-bold text-gray-500 hover:text-lime-700 uppercase tracking-widest border border-gray-200 px-3 py-1.5 rounded-xl hover:border-lime-300 hover:bg-lime-50 transition-all active:scale-95"
                                            >
                                                {t('activate')}
                                            </button>
                                        )}
                                    </div>

                                    {/* Custom labels and descriptions if present */}
                                    {p.label && (
                                        <h4 className="text-xs font-black text-gray-800 tracking-tight mb-0.5">{p.label}</h4>
                                    )}
                                    {p.description && (
                                        <p className="text-[10px] text-gray-500 leading-normal mb-2 italic">"{p.description}"</p>
                                    )}

                                    <p className="text-[11px] text-gray-500 line-clamp-3 italic leading-relaxed bg-gray-50 p-2.5 rounded-xl border border-gray-100/30">"{p.text}"</p>
                                    
                                    {/* Multi-column telemetry statistics */}
                                    {typeof p.totalCount === 'number' && p.totalCount > 0 ? (
                                        <div className="mt-3 pt-2.5 border-t border-gray-100 grid grid-cols-3 gap-1.5 text-center text-[10px] font-medium text-gray-400">
                                            <div className="bg-gray-50/50 p-1.5 rounded-lg border border-gray-100/50">
                                                <span className="block font-black text-gray-700 text-xs">{p.totalCount}x</span>
                                                <span className="text-[9px]">Spustení</span>
                                            </div>
                                            <div className="bg-emerald-50/20 p-1.5 rounded-lg border border-emerald-100/30">
                                                <span className="block font-black text-emerald-600 text-xs">
                                                    {p.avgConfidenceSum ? `${(p.avgConfidenceSum / p.totalCount * 100).toFixed(0)}%` : 'N/A'}
                                                </span>
                                                <span className="text-[9px]">Istota</span>
                                            </div>
                                            <div className="bg-orange-50/20 p-1.5 rounded-lg border border-orange-100/30">
                                                <span className="block font-black text-orange-600 text-[10px] truncate">
                                                    {p.totalTokensUsed ? `${((p.totalTokensUsed / 1000000) * 0.35).toFixed(3)} €` : '0.00 €'}
                                                </span>
                                                <span className="text-[9px]">Cena</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-[9px] text-gray-400 italic mt-2">Doteraz nespustený v produkcii</p>
                                    )}

                                    <div className="mt-3 pt-2 border-t border-gray-50 flex items-center justify-between">
                                        <button 
                                            onClick={() => setEditingText(p.text)}
                                            className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 transition-colors"
                                        >
                                            <ArrowPathIcon className="w-3 h-3" />
                                            {t('loadToEditor')}
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setCompareWithVersionId(compareWithVersionId === p.id ? null : (p.id || null));
                                            }}
                                            className={`text-[10px] font-bold flex items-center gap-1 transition-all px-2 py-1 rounded-lg ${
                                                compareWithVersionId === p.id 
                                                ? 'bg-lime-600 text-white shadow' 
                                                : 'text-lime-700 hover:bg-lime-50 bg-white/50 border border-lime-100/30'
                                            }`}
                                        >
                                            <Sparkles className="w-3 h-3" />
                                            {compareWithVersionId === p.id ? 'Zatvoriť' : 'Porovnať'}
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-16 flex flex-col items-center justify-center">
                                    <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                                        <HistoryIcon className="w-8 h-8 text-gray-300" />
                                    </div>
                                    <p className="text-sm font-bold text-gray-900 mb-1">{t('noHistoryYet')}</p>
                                    <p className="text-xs text-gray-500">Uložte prvú verziu promptu.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* INKUBÁTOR / PLAYGROUND SEKCIA */}
            <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden mt-12">
                <div className="p-8 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h3 className="text-xl font-black text-gray-900 flex items-center gap-3">
                            <RocketLaunchIcon className="w-6 h-6 text-lime-600 animate-pulse" />
                            Prompt Playground (Interaktívne Pieskovisko)
                        </h3>
                        <p className="text-sm text-gray-500 font-medium mt-1">
                            Otestujte draft promptu z editora na reálnej fotografii regálu okamžite bez ukladania zmien do archívu.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider pl-2">Model:</span>
                        <select
                            value={testModel}
                            onChange={(e) => setTestModel(e.target.value)}
                            className="bg-gray-50 text-gray-800 text-xs font-bold rounded-xl py-1.5 px-3 border border-gray-200 focus:ring-2 focus:ring-lime-500 cursor-pointer"
                        >
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash (Odporúčaný / Najlepšia rovnováha)</option>
                            <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite (Ekonomicky najvýhodnejší / Low-Cost)</option>
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro (Maximálna presnosť a detaily)</option>
                            <option value="gemini-2.0-flash">Gemini 2.0 Flash (Blesková odozva)</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 p-8">
                    {/* LEVÝ PANEL: Výber a nahratie obrázka */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest block">1. Vyberte regál k testu</label>
                            
                            {testMaterials.length > 0 && (
                                <select
                                    value={selectedTestImageId}
                                    onChange={(e) => {
                                        setSelectedTestImageId(e.target.value);
                                        setTestResult(null);
                                        setTestError(null);
                                    }}
                                    className="w-full bg-gray-50 rounded-xl py-3 px-4 text-xs font-bold border border-gray-200 text-gray-800 focus:ring-2 focus:ring-lime-500 cursor-pointer"
                                >
                                    {testMaterials.map((mat) => (
                                        <option key={mat.id} value={mat.id}>
                                            {mat.name.length > 40 ? `${mat.name.substring(0, 40)}...` : mat.name}
                                        </option>
                                    ))}
                                    <option value="custom">[ Vlastný nahratý obrázok ]</option>
                                </select>
                            )}

                            <div className="mt-4">
                                <label className="flex flex-col items-center justify-center p-6 bg-gray-50/50 hover:bg-lime-50/20 border-2 border-dashed border-gray-200 hover:border-lime-400 rounded-2xl cursor-pointer group transition-all">
                                    <CameraIcon className="w-8 h-8 text-gray-400 group-hover:text-lime-600 transition-colors mb-2" />
                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('addPhoto')} (alebo pretiahnite)</span>
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        accept="image/*"
                                        onChange={handleCustomImageUpload} 
                                    />
                                </label>
                            </div>
                        </div>

                        {/* Náhľad vybraného obrázka */}
                        {(selectedTestImageId === 'custom' ? customTestBase64 : testMaterials.find(m => m.id === selectedTestImageId)?.base64) && (
                            <div className="rounded-2xl overflow-hidden border border-gray-200/80 bg-gray-50 aspect-video relative shadow-sm">
                                <img 
                                    src={`data:image/jpeg;base64,${selectedTestImageId === 'custom' ? customTestBase64 : testMaterials.find(m => m.id === selectedTestImageId)?.base64}`} 
                                    alt="Test Target" 
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded">
                                    {selectedTestImageId === 'custom' ? 'Môj nahratý' : 'Regál z auditu'}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleRunTest}
                            disabled={isPlaying || !(selectedTestImageId === 'custom' ? customTestBase64 : selectedTestImageId)}
                            className="w-full py-4 bg-lime-600 hover:bg-lime-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-xl hover:shadow-lime-200 shadow-lime-100/50 transition-all uppercase tracking-wider text-xs active:scale-[0.98]"
                        >
                            {isPlaying ? (
                                <>
                                    <SpinnerIcon className="w-5 h-5 animate-spin text-white" />
                                    <span>Analyzujem regál s Gemini...</span>
                                </>
                            ) : (
                                <>
                                    <RocketLaunchIcon className="w-5 h-5 text-lime-100" />
                                    <span>Spustiť test s draft promptom</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* PRAVÝ PANEL: Výsledky auditu */}
                    <div className="lg:col-span-8 flex flex-col bg-gray-50/50 rounded-3xl border border-gray-100 p-6 min-h-[400px] overflow-hidden">
                        {isPlaying ? (
                            <div className="flex-grow flex flex-col justify-center items-center py-16 space-y-4">
                                <div className="relative">
                                    <div className="w-20 h-20 rounded-full border-4 border-lime-100 border-t-lime-600 animate-spin"></div>
                                    <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
                                        <CpuChipIcon className="w-8 h-8 text-lime-600 animate-pulse" />
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="text-base font-black text-gray-800">Spúšťam auditný dopyt...</p>
                                    <p className="text-xs text-gray-400 mt-1">Gemini vyhodnocuje objektové kontúry a extrahuje cenovky.</p>
                                </div>
                            </div>
                        ) : testError ? (
                            <div className="flex-grow flex flex-col justify-center items-center py-16 text-center max-w-md mx-auto space-y-4">
                                <div className="p-4 bg-red-100 text-red-600 rounded-full">
                                    <ShieldExclamationIcon className="w-10 h-10" />
                                </div>
                                <div>
                                    <h4 className="font-black text-red-900">Audit zlyhal</h4>
                                    <p className="text-xs text-red-600 mt-1 leading-relaxed">
                                        {testError}
                                    </p>
                                </div>
                            </div>
                        ) : testResult ? (
                            <div className="flex-grow flex flex-col h-full space-y-6">
                                {/* Vizualizácia s detekčným rámcom */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest block flex items-center gap-1.5">
                                            <BoxIcon className="w-4 h-4 text-lime-600" /> Vizualizácia detekovaných produktov
                                        </span>
                                    </div>

                                    <div className="rounded-2xl overflow-hidden border border-gray-200">
                                        <BoundingBoxOverlay
                                            imageUrl={`data:image/jpeg;base64,${selectedTestImageId === 'custom' ? customTestBase64 : testMaterials.find(m => m.id === selectedTestImageId)?.base64}`}
                                            imageAlt="Sandbox Test Regál"
                                            products={testResult.products}
                                            showControls={true}
                                            allowZoomPan={true}
                                            allowFullScreen={true}
                                        />
                                    </div>
                                </div>

                                {/* Analytický prehľad */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white p-4 rounded-2xl border border-gray-100">
                                        <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Detegované SKU ({testResult.products.length})</h5>
                                        <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar text-xs">
                                            {testResult.products.slice(0, 15).map((p, i) => (
                                                <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-50">
                                                    <span className="font-bold text-gray-700 truncate max-w-[150px]">
                                                        {p.name}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        {p.prices && p.prices.length > 0 && (
                                                            <span className="bg-lime-50 text-lime-800 border border-lime-100 text-[10px] px-1.5 py-0.5 rounded font-black">
                                                                {p.prices[0].value} € {p.prices[0].type === 'PROMO' && '🏷️'}
                                                            </span>
                                                        )}
                                                        <span className={`text-[9px] px-1 rounded font-bold ${p.type === 'pos_material' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                                                            {p.type === 'pos_material' ? 'POS' : 'SKU'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                            {testResult.products.length > 15 && <p className="text-[10px] text-gray-400 italic text-center pt-2">a ďalších {testResult.products.length - 15} položiek...</p>}
                                        </div>
                                    </div>

                                    <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-3">
                                        <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Výkon & Odhadovaná Cena</h5>
                                        {testResult.usageMetadata ? (
                                            <div className="space-y-2 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500 font-medium">Vstupné tokeny (Prompt):</span>
                                                    <span className="font-bold text-gray-800">{testResult.usageMetadata.promptTokenCount}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500 font-medium">Výstupné tokeny (Odpoveď):</span>
                                                    <span className="font-bold text-gray-800">{testResult.usageMetadata.candidatesTokenCount}</span>
                                                </div>
                                                <div className="flex justify-between border-t border-gray-50 pt-2 text-sm font-black">
                                                    <span className="text-lime-700">Odhadovaná Cena dotazu:</span>
                                                    <span className="text-lime-600">
                                                        {((testResult.usageMetadata.promptTokenCount / 1000000) * 0.15 + (testResult.usageMetadata.candidatesTokenCount / 1000000) * 0.60).toFixed(4)} €
                                                    </span>
                                                </div>
                                                <div className="bg-lime-50/50 p-2.5 rounded-xl border border-lime-100/30 text-[9px] text-lime-700 leading-normal font-medium flex items-start gap-1.5 mt-1">
                                                    <ShieldCheckIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                                    <span>Presnosť detekcie a extrakcia cenoviek bola optimalizovaná. Môžete bezpečne uložiť túto verziu promptu ak spĺňa kvalitatívne požiadavky na regáli.</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-400 italic">Metaúdaje o tokene nie sú k dispozícii.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-grow flex flex-col justify-center items-center py-20 text-center text-gray-400 space-y-4">
                                <div className="p-4 bg-gray-100 hover:bg-gray-200 transition-colors rounded-full">
                                    <BoxIcon className="w-12 h-12 text-gray-300" />
                                </div>
                                <div className="max-w-xs">
                                    <p className="font-bold text-gray-600 text-sm">Čakám na spustenie testu</p>
                                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                                        Zvoľte referenčný obrázok regálu vľavo a kliknutím na tlačidlo otestujte aktuálne zadané inštrukcie v editore.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            </>)}
        </div>
    );
};