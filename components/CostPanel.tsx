import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n/index.tsx';
import { getSetting, setSetting, recalculateAllCosts, getAnalyses, db, MODEL_PRICING_TABLE } from '../db.ts';
import type { Analysis } from '../types.ts';
import { 
    CalculatorIcon, 
    ArrowPathIcon, 
    SpinnerIcon, 
    SaveIcon,
    EditIcon,
    CloseIcon,
    HistoryIcon
} from './Icons.tsx';

export const CostPanel: React.FC = () => {
    const { t } = useTranslation();

    const getImagesUnit = (count: number) => {
        if (count === 1) return t('imagesUnitOne');
        if (count >= 2 && count <= 4) return t('imagesUnitFew');
        return t('imagesUnitMany');
    };

    const [inputRate, setInputRate] = useState(0.75); 
    const [outputRate, setOutputRate] = useState(3.75); 
    const [defaultAnalysisPrice, setDefaultAnalysisPrice] = useState(5.00);
    const [defaultImagePrice, setDefaultImagePrice] = useState(1.00);

    const [analyses, setAnalyses] = useState<Analysis[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    // Editing states for manual inline pricing
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingVal, setEditingVal] = useState<string>('');

    useEffect(() => {
        const fetchData = async () => {
            const savedInput = await getSetting('inputTokenRate', 0.75);
            const savedOutput = await getSetting('outputTokenRate', 3.75);
            setInputRate(savedInput);
            setOutputRate(savedOutput);

            const savedDefAnalysisPrice = await getSetting('defaultAnalysisPrice', 5.00);
            const savedDefImagePrice = await getSetting('defaultImagePrice', 1.00);
            setDefaultAnalysisPrice(savedDefAnalysisPrice);
            setDefaultImagePrice(savedDefImagePrice);

            const allAnalyses = await getAnalyses();
            setAnalyses(allAnalyses);
            setIsLoading(false);
        };
        fetchData();
    }, []);

    const handleSaveAndRecalculate = async () => {
        setIsUpdating(true);
        await setSetting('inputTokenRate', inputRate);
        await setSetting('outputTokenRate', outputRate);
        await setSetting('defaultAnalysisPrice', defaultAnalysisPrice);
        await setSetting('defaultImagePrice', defaultImagePrice);
        await recalculateAllCosts(inputRate, outputRate);
        const updatedAnalyses = await getAnalyses();
        setAnalyses(updatedAnalyses);
        setIsUpdating(false);
    };

    const handleResetToStandard = async () => {
        setIsUpdating(true);
        await setSetting('inputTokenRate', undefined);
        await setSetting('outputTokenRate', undefined);
        await setSetting('defaultAnalysisPrice', 5.00);
        await setSetting('defaultImagePrice', 1.00);
        
        setInputRate(0.75);
        setOutputRate(3.75);
        setDefaultAnalysisPrice(5.00);
        setDefaultImagePrice(1.00);
        
        await recalculateAllCosts(); 
        const updatedAnalyses = await getAnalyses();
        setAnalyses(updatedAnalyses);
        setIsUpdating(false);
    };

    const startEditing = (id: string, currentVal: number) => {
        setEditingId(id);
        setEditingVal(currentVal.toFixed(2));
    };

    const saveInlinePrice = async (id: string) => {
        if (editingVal.trim() === '') {
            await resetToAutoPrice(id);
            return;
        }
        const num = parseFloat(editingVal);
        if (!isNaN(num) && num >= 0) {
            await db.analyses.update(id, { manualPrice: num });
            const updated = await getAnalyses();
            setAnalyses(updated);
        }
        setEditingId(null);
    };

    const resetToAutoPrice = async (id: string) => {
        await db.analyses.update(id, { manualPrice: undefined });
        const updated = await getAnalyses();
        setAnalyses(updated);
        setEditingId(null);
    };

    const formatTokens = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num.toString();
    };

    const getModelLabel = (modelId: string | undefined) => {
        if (!modelId) return 'Gemini 3.6 Flash';
        
        const mapping: Record<string, string> = {
            'gemini-3.8-flash': 'Gemini 3.6 Flash',
            'gemini-3.6-pro': 'Gemini 3.6 Pro',
            'gemini-3.7-flash': 'Gemini 3.7 Flash',
            'gemini-3.5-flash': 'Gemini 3.5 Flash',
            'gemini-3.5-flash-lite': 'Gemini 3.5 Flash-Lite',
            'gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
            'gemini-3.1-flash-lite': 'Gemini 3.1 Flash-Lite',
            'gemini-2.5-flash': 'Gemini 2.5 Flash',
            'gemini-2.5-flash-lite': 'Gemini 2.5 Flash-Lite',
            'gemini-2.5-pro': 'Gemini 2.5 Pro',
            'gemini-3-flash-preview': 'Gemini 3.0 Flash',
            'gemini-3-pro-preview': 'Gemini 3.0 Pro'
        };
        
        return mapping[modelId] || modelId;
    };

    const calculatedTotals = React.useMemo(() => {
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let totalInputCost = 0;
        let totalOutputCost = 0;
        let totalImages = 0;
        let totalProducts = 0;
        let totalStandardCost = 0;
        let totalCalculatedPrice = 0;
        let totalFinalPrice = 0;

        analyses.forEach(analysis => {
            let analysisInput = 0;
            let analysisOutput = 0;
            let standardCost = 0;
            let inputCost = 0;
            let outputCost = 0;

            const imagesCount = analysis.images?.length || 0;
            totalImages += imagesCount;

            analysis.images?.forEach(img => {
                totalProducts += img.analysisResult?.products?.length || 0;

                if (img.analysisResult?.usageMetadata) {
                    const meta = img.analysisResult.usageMetadata;
                    const inTokens = meta.promptTokenCount || 0;
                    const outTokens = meta.candidatesTokenCount || 0;
                    analysisInput += inTokens;
                    analysisOutput += outTokens;

                    const model = img.analysisResult.modelName || 'gemini-3.8-flash';
                    const pricing = MODEL_PRICING_TABLE[model] || MODEL_PRICING_TABLE['gemini-3.8-flash'];
                    standardCost += (inTokens / 1000000) * pricing.input;
                    standardCost += (outTokens / 1000000) * pricing.output;

                    const inRate = inputRate !== undefined ? inputRate : pricing.input;
                    const outRate = outputRate !== undefined ? outputRate : pricing.output;
                    inputCost += (inTokens / 1000000) * inRate;
                    outputCost += (outTokens / 1000000) * outRate;
                }
            });

            // Fallback for standard cost / tokens if metadata is missing in oldest visits
            if (analysisInput === 0 && analysis.costInfo?.inputTokens) {
                analysisInput = analysis.costInfo.inputTokens;
            }
            if (analysisOutput === 0 && analysis.costInfo?.outputTokens) {
                analysisOutput = analysis.costInfo.outputTokens;
            }

            if (inputCost === 0 && outputCost === 0 && (analysisInput > 0 || analysisOutput > 0)) {
                const model = analysis.costInfo?.modelName || 'gemini-3.8-flash';
                const pricing = MODEL_PRICING_TABLE[model] || MODEL_PRICING_TABLE['gemini-3.8-flash'];
                const inRate = inputRate !== undefined ? inputRate : pricing.input;
                const outRate = outputRate !== undefined ? outputRate : pricing.output;
                inputCost = (analysisInput / 1000000) * inRate;
                outputCost = (analysisOutput / 1000000) * outRate;
                if (standardCost === 0) {
                    standardCost = (analysisInput / 1000000) * pricing.input + (analysisOutput / 1000000) * pricing.output;
                }
            }

            if (standardCost === 0 && analysis.costInfo?.cost) {
                standardCost = analysis.costInfo.cost;
            }

            totalInputTokens += analysisInput;
            totalOutputTokens += analysisOutput;
            totalInputCost += inputCost;
            totalOutputCost += outputCost;
            totalStandardCost += standardCost;

            const analysisPrice = defaultAnalysisPrice;
            const imagesPrice = imagesCount * defaultImagePrice;
            const calculatedPrice = inputCost + outputCost + analysisPrice + imagesPrice;
            totalCalculatedPrice += calculatedPrice;

            const finalPrice = analysis.manualPrice !== undefined
                ? analysis.manualPrice
                : calculatedPrice;
            totalFinalPrice += finalPrice;
        });

        const totalTokensCost = totalInputCost + totalOutputCost;
        const totalAnalysisPrice = analyses.length * defaultAnalysisPrice;
        const totalImagesPrice = totalImages * defaultImagePrice;

        return {
            input: totalInputTokens,
            output: totalOutputTokens,
            inputCost: totalInputCost,
            outputCost: totalOutputCost,
            tokensCost: totalTokensCost,
            analysisPrice: totalAnalysisPrice,
            imagesPrice: totalImagesPrice,
            images: totalImages,
            products: totalProducts,
            standardCost: totalStandardCost,
            calculatedPrice: totalCalculatedPrice,
            manualPrice: totalFinalPrice,
            totalPrice: totalFinalPrice
        };
    }, [analyses, defaultAnalysisPrice, defaultImagePrice, inputRate, outputRate]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <SpinnerIcon className="w-12 h-12 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-20 animate-fade-in">
            {/* Top configuration and standard model pricing split section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Custom Token & Billing Configuration */}
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-8 rounded-[2rem] shadow-3xs border border-slate-150 dark:border-zinc-800 flex flex-col justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-zinc-100 flex items-center gap-3 mb-4 tracking-tight">
                            <div className="p-2.5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-sm border border-blue-100">
                                <CalculatorIcon className="w-6 h-6 text-blue-600" />
                            </div>
                            {t('analysisCosts')}
                        </h2>
                        
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-semibold leading-relaxed mb-6">
                            {t('costsDescription')}
                        </p>
                        
                        <div className="space-y-6">
                            {/* Billing rules configuration block */}
                            <div>
                                <h3 className="text-xs font-black uppercase text-slate-700 dark:text-zinc-300 tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                    {t('billingSettings')}
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 dark:bg-zinc-900/60 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5">
                                            {t('defaultProjectPrice')} ($)
                                        </label>
                                        <input 
                                            type="number" 
                                            step="0.10"
                                            className="block w-full rounded-xl border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-3 font-bold transition-all"
                                            value={defaultAnalysisPrice}
                                            onChange={e => setDefaultAnalysisPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5">
                                            {t('defaultImagePrice')} ($)
                                        </label>
                                        <input 
                                            type="number" 
                                            step="0.10"
                                            className="block w-full rounded-xl border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-3 font-bold transition-all"
                                            value={defaultImagePrice}
                                            onChange={e => setDefaultImagePrice(Math.max(0, parseFloat(e.target.value) || 0))}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Token custom weights override */}
                            <div>
                                <h3 className="text-xs font-black uppercase text-slate-700 dark:text-zinc-300 tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                    {t('manualTokenRates')}
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/50 dark:bg-zinc-900/60 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800 animate-fade-in">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">
                                            {t('inputTokenRate')} ($ / 1M)
                                        </label>
                                        <input 
                                            type="number" 
                                            step="0.001"
                                            className="block w-full rounded-xl border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-3 font-bold transition-all"
                                            value={inputRate}
                                            onChange={e => setInputRate(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">
                                            {t('outputTokenRate')} ($ / 1M)
                                        </label>
                                        <input 
                                            type="number" 
                                            step="0.001"
                                            className="block w-full rounded-xl border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-xs p-3 font-bold transition-all"
                                            value={outputRate}
                                            onChange={e => setOutputRate(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-slate-100 dark:border-zinc-800">
                        <button 
                            onClick={handleSaveAndRecalculate}
                            disabled={isUpdating}
                            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 font-black uppercase tracking-widest text-xs transition-all shadow-md shadow-blue-100 hover:shadow-lg hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
                        >
                            {isUpdating ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <SaveIcon className="w-5 h-5" />}
                            {t('saveAndRecalculate') || 'Uložiť a prepočítať'}
                        </button>
                        <button 
                            onClick={handleResetToStandard}
                            disabled={isUpdating}
                            className="flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded-2xl hover:bg-slate-200 font-black uppercase tracking-widest text-xs transition-all hover:text-slate-900 active:scale-95 disabled:opacity-50"
                        >
                            <ArrowPathIcon className="w-5 h-5" />
                            {t('reset')}
                        </button>
                    </div>
                </div>

                {/* AI Model Pricing Panel */}
                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] shadow-3xs border border-slate-150 dark:border-zinc-800">
                    <h3 className="text-sm font-black text-slate-900 dark:text-zinc-100 uppercase tracking-widest mb-4 flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse shadow-sm"></span>
                        {t('geminiPricingTitle')}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-semibold mb-6 leading-relaxed">
                        {t('geminiPricingDesc')}
                    </p>
                    
                    <div className="space-y-3">
                        {[
                            { name: 'Gemini 3.6 Flash', tag: t('tagDefaultBalanced') || 'Odporúčaný štandard', input: 0.75, output: 3.75, batchInput: 0.375, batchOutput: 1.875, tagBg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                            { name: 'Gemini 3.6 Pro (≤200k)', tag: t('tagExtraDetails') || 'Vysoká Presnosť', input: 2.00, output: 12.00, batchInput: 1.00, batchOutput: 6.00, tagBg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                            { name: 'Gemini 2.5 Flash', tag: t('tagLegacyVerified') || 'Ekonomický audit', input: 0.30, output: 2.50, batchInput: 0.15, batchOutput: 1.25, tagBg: 'bg-blue-50 text-blue-700 border-blue-200' },
                            { name: 'Gemini 2.5 / 3.1 Flash-Lite', tag: t('tagEfficientAudit') || 'Ultra Low-Cost', input: 0.10, output: 0.40, batchInput: 0.05, batchOutput: 0.20, tagBg: 'bg-amber-50 text-amber-700 border-amber-200' },
                            { name: 'Gemini 2.5 Pro (≤200k)', tag: 'Pro Analytika', input: 1.25, output: 10.00, batchInput: 0.625, batchOutput: 5.00, tagBg: 'bg-purple-50 text-purple-700 border-purple-200' },
                        ].map((model) => (
                            <div key={model.name} className="flex flex-col p-3.5 bg-slate-50/50 dark:bg-zinc-900/60 hover:bg-slate-50 dark:hover:bg-zinc-800/60 rounded-2xl border border-slate-150/70 transition-all select-none">
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-black text-slate-900 dark:text-zinc-100">{model.name}</span>
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${model.tagBg}`}>
                                        {model.tag}
                                    </span>
                                </div>
                                <div className="space-y-1 text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600 dark:text-zinc-400 font-extrabold">Standard:</span>
                                        <span>{t('input')}: <strong className="text-blue-600">${model.input.toFixed(2)}</strong> | {t('output')}: <strong className="text-indigo-600">${model.output.toFixed(2)}</strong></span>
                                    </div>
                                    <div className="flex justify-between items-center text-[9px] text-slate-400 dark:text-zinc-500">
                                        <span className="font-extrabold">Batch (50% Off):</span>
                                        <span>In: <strong>${model.batchInput.toFixed(3)}</strong> | Out: <strong>${model.batchOutput.toFixed(2)}</strong></span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-medium mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                        <span>* Sadzby za 1M tokenov podľa Google AI API (ai.google.dev/pricing)</span>
                        <span className="text-emerald-600 font-bold">Batch API: -50%</span>
                    </p>
                </div>
            </div>

            {/* Total KPI statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-zinc-900 p-7 rounded-[2rem] shadow-3xs border border-slate-150 dark:border-zinc-800 text-center hover:shadow-xs transition-all flex flex-col justify-center">
                    <p className="text-3xl font-black text-slate-900 dark:text-zinc-100 mb-1">{analyses.length}</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-black tracking-widest">{t('projectsToday')}</p>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold mt-1">({calculatedTotals.images} {getImagesUnit(calculatedTotals.images)})</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-7 rounded-[2rem] shadow-3xs border border-slate-150 dark:border-zinc-800 text-center hover:shadow-xs transition-all flex flex-col justify-center">
                    <p className="text-2xl font-black text-blue-600 mb-1">{formatTokens(calculatedTotals.input + calculatedTotals.output)}</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-black tracking-widest">{t('aiTokenConsumption')}</p>
                    <p className="text-[9px] text-slate-500 dark:text-zinc-400 font-bold mt-1">{t('input')}: {formatTokens(calculatedTotals.input)} | {t('output')}: {formatTokens(calculatedTotals.output)}</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-7 rounded-[2rem] shadow-3xs border border-slate-150 dark:border-zinc-800 text-center hover:shadow-xs transition-all flex flex-col justify-center">
                    <p className="text-2xl font-black text-slate-650 mb-1">${calculatedTotals.standardCost.toFixed(4)}</p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-black tracking-widest">{t('totalGeminiCost')}</p>
                    <p className="text-[9px] text-slate-500 dark:text-zinc-400 mt-1">{t('byStandardPricing')}</p>
                </div>
                
                {/* Zvýraznená položka: Fakturovaná hodnota celkom / celkem */}
                <div className="relative overflow-hidden bg-gradient-to-b from-indigo-50/90 via-indigo-50/40 to-white p-7 rounded-[2rem] shadow-md shadow-indigo-100/60 border-2 border-indigo-600 text-center transform hover:-translate-y-0.5 transition-all flex flex-col justify-center ring-4 ring-indigo-500/10">
                    <div className="flex justify-center mb-1">
                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-100/90 border border-indigo-200/80 px-2.5 py-0.5 rounded-full shadow-2xs">
                            ★ {t('totalClientRevenue')}
                        </span>
                    </div>
                    <p className="text-3xl font-black text-indigo-900 tracking-tight my-1" id="kpi-fakturovana-hodnota">
                        ${calculatedTotals.totalPrice.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-indigo-600/90 font-black mt-0.5 uppercase tracking-wider">
                        {t('manualAndFlat')}
                    </p>
                </div>
            </div>

            {/* Historical list section */}
            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-3xs border border-slate-150 dark:border-zinc-800 overflow-hidden">
                <div className="p-6 bg-slate-50/50 dark:bg-zinc-900/60 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 dark:text-zinc-100 uppercase tracking-widest flex items-center gap-2">
                        <HistoryIcon className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                        {t('detailedCostBreakdown')}
                    </h3>
                    <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800 px-3 py-1 rounded-xl">
                        {t('totalQueries')}: {analyses.length}
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 dark:divide-zinc-800">
                        <thead className="bg-slate-50/75">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{t('date')}</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{t('analysisName')}</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{t('model')}</th>
                                <th className="px-6 py-4 text-center text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{t('imagesAndConsumption')}</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{t('standardGeminiCost')}</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{t('salesContractual')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-zinc-900 divide-y divide-slate-100 dark:divide-zinc-800">
                            {analyses.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-12 text-center text-sm font-bold text-slate-400 dark:text-zinc-500">
                                        {t('noAnalysisCosts')}
                                    </td>
                                </tr>
                            ) : (
                                analyses.map(analysis => {
                                    // 1. Calculate token costs, image costs, analysis price & total price
                                    let analysisInput = 0;
                                    let analysisOutput = 0;
                                    let standardCost = 0;
                                    let inputCost = 0;
                                    let outputCost = 0;
                                    const imagesCount = analysis.images?.length || 0;

                                    analysis.images?.forEach(img => {
                                        if (img.analysisResult?.usageMetadata) {
                                            const meta = img.analysisResult.usageMetadata;
                                            const inTokens = meta.promptTokenCount || 0;
                                            const outTokens = meta.candidatesTokenCount || 0;
                                            analysisInput += inTokens;
                                            analysisOutput += outTokens;

                                            const model = img.analysisResult.modelName || 'gemini-3.8-flash';
                                            const pricing = MODEL_PRICING_TABLE[model] || MODEL_PRICING_TABLE['gemini-3.8-flash'];
                                            standardCost += (inTokens / 1000000) * pricing.input;
                                            standardCost += (outTokens / 1000000) * pricing.output;

                                            const inRate = inputRate !== undefined ? inputRate : pricing.input;
                                            const outRate = outputRate !== undefined ? outputRate : pricing.output;
                                            inputCost += (inTokens / 1000000) * inRate;
                                            outputCost += (outTokens / 1000000) * outRate;
                                        }
                                    });

                                    // Fallback if metadata was on analysis.costInfo
                                    if (analysisInput === 0 && analysis.costInfo?.inputTokens) {
                                        analysisInput = analysis.costInfo.inputTokens;
                                    }
                                    if (analysisOutput === 0 && analysis.costInfo?.outputTokens) {
                                        analysisOutput = analysis.costInfo.outputTokens;
                                    }

                                    if (inputCost === 0 && outputCost === 0 && (analysisInput > 0 || analysisOutput > 0)) {
                                        const model = analysis.costInfo?.modelName || 'gemini-3.8-flash';
                                        const pricing = MODEL_PRICING_TABLE[model] || MODEL_PRICING_TABLE['gemini-3.8-flash'];
                                        const inRate = inputRate !== undefined ? inputRate : pricing.input;
                                        const outRate = outputRate !== undefined ? outputRate : pricing.output;
                                        inputCost = (analysisInput / 1000000) * inRate;
                                        outputCost = (analysisOutput / 1000000) * outRate;
                                        if (standardCost === 0) {
                                            standardCost = (analysisInput / 1000000) * pricing.input + (analysisOutput / 1000000) * pricing.output;
                                        }
                                    }

                                    if (standardCost === 0 && analysis.costInfo?.cost) {
                                        standardCost = analysis.costInfo.cost;
                                    }

                                    // Vypocet podla pravidla: vstupne tokeny + vystupne tokeny + predvolena cena za analyzu + predvolena cena za snimku
                                    const analysisPrice = defaultAnalysisPrice;
                                    const imagesPrice = imagesCount * defaultImagePrice;
                                    const tokensCost = inputCost + outputCost;
                                    const calculatedPrice = tokensCost + analysisPrice + imagesPrice;

                                    const finalPrice = analysis.manualPrice !== undefined
                                        ? analysis.manualPrice
                                        : calculatedPrice;

                                    return (
                                        <tr key={analysis.id} className="hover:bg-slate-50/50 transition-colors group">
                                            {/* Date */}
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 dark:text-zinc-400 font-semibold">
                                                {new Date(analysis.createdAt).toLocaleDateString()}
                                            </td>
                                            
                                            {/* Name */}
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 dark:text-zinc-100 group-hover:text-blue-700 transition-colors">
                                                {analysis.name}
                                            </td>

                                            {/* AI Model used */}
                                            <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-slate-600 dark:text-zinc-400">
                                                <span className="inline-flex items-center gap-1.5 bg-slate-150/55 text-slate-700 dark:text-zinc-300 px-2.5 py-1 rounded-xl border border-slate-200/50 font-bold">
                                                    {getModelLabel(analysis.costInfo?.modelName)}
                                                </span>
                                            </td>

                                            {/* Images & prompt token sum */}
                                            <td className="px-6 py-4 whitespace-nowrap text-center text-xs text-slate-500 dark:text-zinc-400 font-bold">
                                                <div className="flex flex-col items-center">
                                                    <span>{imagesCount} {getImagesUnit(imagesCount)}</span>
                                                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                                                        ({formatTokens(analysis.costInfo?.inputTokens || analysisInput)} {t('input').toLowerCase()} / {formatTokens(analysis.costInfo?.outputTokens || analysisOutput)} {t('output').toLowerCase()})
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Standard baseline cost */}
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold block-tabular text-slate-600 dark:text-zinc-400">
                                                ${standardCost.toFixed(4)}
                                            </td>

                                            {/* Celková cena a zobrazenie rozpadu súčtu */}
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                {editingId === analysis.id ? (
                                                    <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                                                        <span className="text-xs text-slate-400 dark:text-zinc-500 font-bold">$</span>
                                                        <input 
                                                            type="number" 
                                                            step="0.01"
                                                            className="w-20 rounded-lg border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/60 text-slate-900 dark:text-zinc-100 focus:border-blue-500 focus:ring-blue-500 text-xs py-1 px-1.5 font-bold"
                                                            value={editingVal}
                                                            placeholder={calculatedPrice.toFixed(2)}
                                                            onChange={e => setEditingVal(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') saveInlinePrice(analysis.id);
                                                                if (e.key === 'Escape') setEditingId(null);
                                                            }}
                                                            autoFocus
                                                        />
                                                        <button 
                                                            onClick={() => saveInlinePrice(analysis.id)}
                                                            title={t('save') || 'Uložiť'}
                                                            className="text-emerald-600 hover:text-emerald-750 p-1 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-100"
                                                        >
                                                            <SaveIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                        {analysis.manualPrice !== undefined && (
                                                            <button 
                                                                onClick={() => resetToAutoPrice(analysis.id)}
                                                                title={t('resetToAuto') || 'Obnoviť automatický výpočet'}
                                                                className="text-amber-600 hover:text-amber-750 p-1 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-100"
                                                            >
                                                                <ArrowPathIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => setEditingId(null)}
                                                            className="text-rose-600 hover:text-rose-750 p-1 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-100"
                                                        >
                                                            <CloseIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-1.5 group/cell select-none">
                                                        <span 
                                                            className={`inline-flex items-center text-xs px-2.5 py-1 rounded-xl transition-all border select-none ${
                                                                analysis.manualPrice !== undefined
                                                                    ? 'bg-amber-50 text-amber-800 border-amber-200 shadow-3xs font-extrabold'
                                                                    : 'bg-indigo-50/80 text-indigo-900 border-indigo-200/80 shadow-3xs font-black'
                                                            }`}
                                                        >
                                                            ${finalPrice.toFixed(2)}
                                                        </span>
                                                        <button 
                                                            onClick={() => startEditing(analysis.id, finalPrice)}
                                                            className="opacity-0 group-hover:opacity-100 group-hover/cell:opacity-100 p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-opacity"
                                                            title={t('editManualPrice') || 'Upraviť manuálnu cenu'}
                                                        >
                                                            <EditIcon className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 hover:text-blue-500" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
