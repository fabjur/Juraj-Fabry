import React, { useState, useMemo } from 'react';
import type { 
  PromptAuditSummary, 
  PromptRecommendation, 
  PromptOptimizationResult, 
  PromptTemplate
} from '../types';
import { 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Zap, 
  Copy, 
  Check, 
  Play, 
  ArrowRight, 
  Plus, 
  BarChart3, 
  RefreshCw, 
  Tag, 
  DollarSign, 
  Ghost, 
  ShieldAlert, 
  TrendingUp,
  Boxes,
  Flame,
  LayoutGrid,
  Layers,
  Cpu,
  FolderArchive,
  Trash2,
  Undo2
} from 'lucide-react';
import { optimizePromptWithGemini } from '../services/geminiService';
import { 
  injectRuleIntoPrompt, 
  isRecommendationForCategory,
  getArchivedRecommendationIds,
  getTrashedRecommendationIds,
  archiveRecommendationId,
  trashRecommendationId,
  restoreRecommendationId,
  clearTrashedRecommendationIds
} from '../utils/promptOptimizer';

const CATEGORY_META: Record<PromptTemplate['category'], { title: string; subtitle: string; icon: any; color: string; badge: string }> = {
  price: {
    title: 'OSP (Pricing & Akcie)',
    subtitle: 'Optimalizácia čítania cien, detekcie zliav, červených/žltých promo rámčekov a malých centov.',
    icon: DollarSign,
    color: 'emerald',
    badge: 'Cenová integrita & OCR'
  },
  shelfShare: {
    title: 'SOS (Share of Shelf)',
    subtitle: 'Optimalizácia detekcie jednotlivých facingov, štruktúry regálu, delenia políc a POS materiálov.',
    icon: LayoutGrid,
    color: 'lime',
    badge: 'Podiel na regále & Facingy'
  },
  osa: {
    title: 'OSA (On-Shelf Availability)',
    subtitle: 'Optimalizácia detekcie výpadkov tovaru (Out of Stock), prázdnych medzier a dostupnosti.',
    icon: Layers,
    color: 'amber',
    badge: 'Dostupnosť & OOS medzery'
  },
  system: {
    title: 'Systémová inštrukcia',
    subtitle: 'Globálne pravidlá pre formátovanie JSON schémy, filtrovanie 2D fototapiet (Ghost) a stabilitu modelu.',
    icon: Cpu,
    color: 'purple',
    badge: 'Globálna logika & Formát'
  },
  both: {
    title: 'Kompletná analýza',
    subtitle: 'Kombinovaná optimalizácia pre všetky oblasti: ceny, podiel na regále, facingy a POS materiály.',
    icon: Sparkles,
    color: 'blue',
    badge: 'Všetky pravidlá'
  }
};

interface PromptRecommendationsViewProps {
  summary: PromptAuditSummary;
  recommendations: PromptRecommendation[];
  currentPromptText: string;
  activeCategory: PromptTemplate['category'];
  catalogNames: string[];
  isLoading: boolean;
  onCategoryChange?: (newCategory: PromptTemplate['category']) => void;
  onArchiveChange?: () => void;
  onRefreshAudit: () => void;
  onApplyRule: (ruleText: string, recommendationId: string) => void;
  onOpenSimulator: (promptWithRule: string) => void;
  onSaveNewPromptVersion: (newText: string, label: string, description: string) => Promise<void>;
}

export const PromptRecommendationsView: React.FC<PromptRecommendationsViewProps> = ({
  summary,
  recommendations,
  currentPromptText,
  activeCategory,
  catalogNames,
  isLoading,
  onCategoryChange,
  onArchiveChange,
  onRefreshAudit,
  onApplyRule,
  onOpenSimulator,
  onSaveNewPromptVersion
}) => {
  const [viewTab, setViewTab] = useState<'active' | 'archived' | 'trash'>('active');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => getArchivedRecommendationIds());
  const [trashedIds, setTrashedIds] = useState<Set<string>>(() => getTrashedRecommendationIds());
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' } | null>(null);
  
  // AI Auto-Enhance state
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementResult, setEnhancementResult] = useState<PromptOptimizationResult | null>(null);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);
  const [isEnhanceModalOpen, setIsEnhanceModalOpen] = useState(false);
  const [isSavingAutoVersion, setIsSavingAutoVersion] = useState(false);

  const showToast = (text: string, type: 'success' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(prev => prev?.text === text ? null : prev);
    }, 4000);
  };

  // 1. Zabezpečenie, že sa berú do úvahy LEN odporúčania pre vybraný typ analýzy (napr. SOS, Price, OSA, ...)
  const relevantRecommendations = useMemo(() => {
    return recommendations.filter(r => isRecommendationForCategory(r, activeCategory));
  }, [recommendations, activeCategory]);

  // Určenie stavu odporúčania: 'trash' (v koši), 'archived' (zapracované v archíve), 'active' (nerealizované)
  const getRecommendationStatus = React.useCallback((rec: PromptRecommendation): 'trash' | 'archived' | 'active' => {
    if (trashedIds.has(rec.id)) return 'trash';
    const firstLine = rec.suggestedRule.split('\n')[0].trim();
    const isAlreadyInPrompt = firstLine.length > 5 && currentPromptText.includes(firstLine);
    if (archivedIds.has(rec.id) || appliedIds.has(rec.id) || isAlreadyInPrompt) {
      return 'archived';
    }
    return 'active';
  }, [trashedIds, archivedIds, appliedIds, currentPromptText]);

  // Rozdelenie odporúčaní podľa stavu
  const activeRecommendations = useMemo(() => {
    return relevantRecommendations.filter(r => getRecommendationStatus(r) === 'active');
  }, [relevantRecommendations, getRecommendationStatus]);

  const archivedRecommendations = useMemo(() => {
    return relevantRecommendations.filter(r => getRecommendationStatus(r) === 'archived');
  }, [relevantRecommendations, getRecommendationStatus]);

  const trashedRecommendations = useMemo(() => {
    return relevantRecommendations.filter(r => getRecommendationStatus(r) === 'trash');
  }, [relevantRecommendations, getRecommendationStatus]);

  // Zoznam podľa aktívneho pohľadu (Nerealizované / Archív / Kôš)
  const currentViewRecommendations = useMemo(() => {
    switch (viewTab) {
      case 'archived': return archivedRecommendations;
      case 'trash': return trashedRecommendations;
      case 'active':
      default:
        return activeRecommendations;
    }
  }, [viewTab, activeRecommendations, archivedRecommendations, trashedRecommendations]);

  // 2. Filtrované odporúčania podľa vybranej podkategórie / závažnosti
  const filteredRecommendations = useMemo(() => {
    if (selectedCategoryFilter === 'all') return currentViewRecommendations;
    if (selectedCategoryFilter === 'critical') return currentViewRecommendations.filter(r => r.severity === 'critical');
    return currentViewRecommendations.filter(r => r.category === selectedCategoryFilter);
  }, [currentViewRecommendations, selectedCategoryFilter]);

  // 3. Zistenie prítomných podkategórií v aktuálnom zozname
  const availableSubCategories = useMemo(() => {
    return new Set(currentViewRecommendations.map(r => r.category));
  }, [currentViewRecommendations]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Realizácia odporúčania: vloží do promptu a presunie do archívu
  const handleApply = (rec: PromptRecommendation) => {
    onApplyRule(rec.suggestedRule, rec.id);
    const { archived, trashed } = archiveRecommendationId(rec.id);
    setArchivedIds(new Set(archived));
    setTrashedIds(new Set(trashed));
    setAppliedIds(prev => new Set(prev).add(rec.id));
    onArchiveChange?.();
    showToast(`Odporúčanie „${rec.title}“ bolo vložené do promptu a presunuté do Archívu.`);
  };

  // Odmietnutie odporúčania: presunie do koša
  const handleTrash = (rec: PromptRecommendation) => {
    const { archived, trashed } = trashRecommendationId(rec.id);
    setArchivedIds(new Set(archived));
    setTrashedIds(new Set(trashed));
    onArchiveChange?.();
    showToast(`Návrh „${rec.title}“ bol odmietnutý a presunutý do koša.`, 'info');
  };

  // Obnovenie odporúčania (z archívu alebo z koša späť do aktívnych nerealizovaných)
  const handleRestore = (rec: PromptRecommendation) => {
    const { archived, trashed } = restoreRecommendationId(rec.id);
    setArchivedIds(new Set(archived));
    setTrashedIds(new Set(trashed));
    setAppliedIds(prev => {
      const copy = new Set(prev);
      copy.delete(rec.id);
      return copy;
    });
    onArchiveChange?.();
    showToast(`Odporúčanie „${rec.title}“ bolo vrátené medzi nerealizované návrhy.`);
  };

  // Vyprázdnenie koša
  const handleEmptyTrash = () => {
    if (trashedRecommendations.length === 0) return;
    if (window.confirm('Naozaj si želáte natrvalo vyprázdniť kôš odmietnutých odporúčaní?')) {
      const empty = clearTrashedRecommendationIds();
      setTrashedIds(empty);
      onArchiveChange?.();
      showToast('Kôš odmietnutých odporúčaní bol úspešne vyprázdnený.');
    }
  };

  const handleRunAutoEnhance = async () => {
    setIsEnhancing(true);
    setEnhanceError(null);
    try {
      // Striktne posielame do AI optimalizátora len nerealizované odporúčania pre zvolený typ analýzy
      const recommendationsToEnhance = activeRecommendations.length > 0 ? activeRecommendations : relevantRecommendations.filter(r => !trashedIds.has(r.id));
      const result = await optimizePromptWithGemini(
        currentPromptText,
        activeCategory,
        summary,
        recommendationsToEnhance,
        catalogNames
      );
      setEnhancementResult(result);
      setIsEnhanceModalOpen(true);
    } catch (err: any) {
      console.error('Chyba pri AI optimalizácii promptu:', err);
      setEnhanceError(err?.message || 'Nastala neočakávaná chyba pri generovaní vylepšeného promptu.');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleAcceptEnhancedPrompt = async () => {
    if (!enhancementResult) return;
    setIsSavingAutoVersion(true);
    try {
      await onSaveNewPromptVersion(
        enhancementResult.optimizedPrompt,
        `AI Optimalizácia (${enhancementResult.estimatedAccuracyGain})`,
        `Automaticky vygenerovaná verzia na základe ${summary.totalImages} analyzovaných regálových fotiek. Implementované vylepšenia: ${enhancementResult.changesSummary.slice(0, 2).join('; ')}`
      );
      // Presunúť všetky relevantné nerealizované odporúčania do archívu
      relevantRecommendations.forEach(r => {
        if (!trashedIds.has(r.id)) {
          archiveRecommendationId(r.id);
        }
      });
      setArchivedIds(getArchivedRecommendationIds());
      onArchiveChange?.();
      setIsEnhanceModalOpen(false);
      setEnhancementResult(null);
      showToast('Optimalizovaný prompt bol uložený a odporúčania presunuté do Archívu.');
    } catch (err) {
      console.error('Chyba pri ukladaní optimalizovaného promptu:', err);
    } finally {
      setIsSavingAutoVersion(false);
    }
  };

  // Farba skóre zdravia promptu
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-lime-600 bg-lime-50 border-lime-200';
    if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  const getSeverityBadge = (severity: PromptRecommendation['severity']) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" /> Kritické
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> Odporúčané
          </span>
        );
      case 'optimization':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
            <Zap className="w-3 h-3 text-indigo-600" /> Optimalizácia
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            <Info className="w-3 h-3 text-slate-500" /> Informácia
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HLAVNÝ ANALYTICKÝ PANEL ZDRAVIA PROMPTOV */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-lime-100/50 via-emerald-50/20 to-transparent rounded-full pointer-events-none -mr-20 -mt-20 blur-2xl" />
        
        <div className="relative z-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-lime-500 text-white rounded-xl shadow-md shadow-lime-500/20">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    AI Optimalizátor a Odporúčania pre Prompt
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-widest">
                      Live Audit Feed
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Analýza výkonu promptov na základe {summary.totalAnalyses} auditov a {summary.totalImages} fotografií regálov ({summary.totalDetectedItems} detegovaných SKU).
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={onRefreshAudit}
                disabled={isLoading}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 border border-slate-200/80"
                title="Prepočítať metriky zo všetkých analýz v databáze"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Prepočítať audit</span>
              </button>

              <button
                onClick={handleRunAutoEnhance}
                disabled={isEnhancing || isLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-lime-600 to-emerald-600 hover:from-lime-500 hover:to-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-lime-600/25 transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {isEnhancing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generujem optimalizovaný prompt...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>1-Click AI Auto-Enhance</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Rýchle indikátory */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-6">
            {/* Skóre zdravia */}
            <div className={`p-4 rounded-2xl border text-center flex flex-col justify-between ${getHealthColor(summary.healthScore)}`}>
              <span className="text-[10px] font-black uppercase tracking-wider block font-mono">Index kvality</span>
              <span className="text-2xl font-black block my-1">{summary.healthScore}/100</span>
              <span className="text-[9px] font-bold block opacity-80">
                {summary.healthScore >= 80 ? 'Vysoká presnosť' : summary.healthScore >= 60 ? 'Stredná presnosť' : 'Vyžaduje revíziu'}
              </span>
            </div>

            {/* Priemerná istota */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 text-center flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block font-mono">Priemerná istota</span>
              <span className="text-2xl font-black text-slate-900 block my-1">{Math.round(summary.avgConfidence * 100)}%</span>
              <span className="text-[9px] text-slate-500 font-bold block">Model Confidence</span>
            </div>

            {/* Pokrytie cien & Akcie */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 text-center flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block font-mono">Ceny & Akcie</span>
              <span className="text-2xl font-black text-slate-900 block my-1">{summary.priceDetectionRate}%</span>
              <span className="text-[9px] text-amber-700 bg-amber-50 rounded px-1 py-0.5 font-bold block border border-amber-200 flex items-center justify-center gap-1">
                <Flame className="w-2.5 h-2.5 text-rose-500" />
                {summary.regularVsPromoRatio.promo} akčných cien
              </span>
            </div>

            {/* Label Drift */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 text-center flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block font-mono">Label Drift</span>
              <span className={`text-2xl font-black block my-1 ${summary.skuDriftCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                {summary.skuDriftCount}
              </span>
              <span className="text-[9px] text-slate-500 font-bold block">Variácií názvov SKU</span>
            </div>

            {/* Ghost položky */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 text-center flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block font-mono">Ghost Potlač</span>
              <span className={`text-2xl font-black block my-1 ${summary.ghostProductRate > 3 ? 'text-rose-600' : 'text-slate-900'}`}>
                {summary.ghostProductRate}%
              </span>
              <span className="text-[9px] text-slate-500 font-bold block">Falošné detekcie</span>
            </div>

            {/* POS Materiály */}
            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 text-center flex flex-col justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block font-mono">POS Materiály</span>
              <span className="text-2xl font-black text-slate-900 block my-1">{summary.posMaterialCount}</span>
              <span className="text-[9px] text-slate-500 font-bold block">Pútače a stojany</span>
            </div>
          </div>
        </div>
      </div>

      {enhanceError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{enhanceError}</span>
        </div>
      )}

      {/* 2. VYBRANÝ TYP ANALÝZY (FILTER PRE ODPORÚČANIA A AI OPTIMALIZÁTOR) */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-lime-100 text-lime-700 shadow-sm">
            {React.createElement(CATEGORY_META[activeCategory]?.icon || Sparkles, { className: 'w-6 h-6' })}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Vybraný typ analýzy:</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-lime-600 text-white shadow-xs">
                {CATEGORY_META[activeCategory]?.title || activeCategory}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                {CATEGORY_META[activeCategory]?.badge}
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              {CATEGORY_META[activeCategory]?.subtitle}
            </p>
          </div>
        </div>

        {onCategoryChange && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl shrink-0 overflow-x-auto border border-slate-200/60">
            {(['shelfShare', 'price', 'osa', 'system', 'both'] as PromptTemplate['category'][]).map(catId => {
              const meta = CATEGORY_META[catId];
              const isSelected = activeCategory === catId;
              const shortName = meta.title.split(' ')[0];
              return (
                <button
                  key={catId}
                  onClick={() => {
                    onCategoryChange(catId);
                    setSelectedCategoryFilter('all');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isSelected 
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 scale-105' 
                      : 'text-slate-500 hover:text-slate-900 hover:bg-white/50 border border-transparent'
                  }`}
                  title={meta.title}
                >
                  <span>{shortName}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* TOAST SPÄTNÁ VÄZBA PRE ARCHÍV A KÔŠ */}
      {toastMessage && (
        <div className={`p-4 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold transition-all shadow-sm ${
          toastMessage.type === 'info' 
            ? 'bg-slate-900 text-white' 
            : 'bg-lime-700 text-white'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-lime-300" />
            <span>{toastMessage.text}</span>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-white/70 hover:text-white px-2 py-0.5 text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. PREPÍNAČ MEDZI NEREALIZOVANÝMI NÁVRHMI, ARCHÍVOM A KOŠOM */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => { setViewTab('active'); setSelectedCategoryFilter('all'); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              viewTab === 'active'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 scale-[1.02]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50 border border-transparent'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-lime-600" />
            <span>Nerealizované návrhy</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              viewTab === 'active' ? 'bg-lime-600 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {activeRecommendations.length}
            </span>
          </button>

          <button
            onClick={() => { setViewTab('archived'); setSelectedCategoryFilter('all'); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              viewTab === 'archived'
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 scale-[1.02]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50 border border-transparent'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5 text-indigo-600" />
            <span>Archív (Realizované)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              viewTab === 'archived' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {archivedRecommendations.length}
            </span>
          </button>

          <button
            onClick={() => { setViewTab('trash'); setSelectedCategoryFilter('all'); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              viewTab === 'trash'
                ? 'bg-white text-rose-700 shadow-sm border border-slate-200/80 scale-[1.02]'
                : 'text-slate-600 hover:text-rose-700 hover:bg-white/50 border border-transparent'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>Kôš (Odmietnuté)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              viewTab === 'trash' ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {trashedRecommendations.length}
            </span>
          </button>
        </div>

        {viewTab === 'trash' && trashedRecommendations.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors flex items-center gap-1.5 self-end sm:self-auto shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Vysypať kôš</span>
          </button>
        )}
      </div>

      {/* 4. PODKATEGÓRIE ODPORÚČANÍ PRE VYBRANÝ ZITYP A POHĽAD */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedCategoryFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              selectedCategoryFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            Všetky ({currentViewRecommendations.length})
          </button>
          
          {currentViewRecommendations.filter(r => r.severity === 'critical').length > 0 && (
            <button
              onClick={() => setSelectedCategoryFilter('critical')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedCategoryFilter === 'critical'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Kritické ({currentViewRecommendations.filter(r => r.severity === 'critical').length})
            </button>
          )}

          {availableSubCategories.has('structure') && (
            <button
              onClick={() => setSelectedCategoryFilter('structure')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedCategoryFilter === 'structure'
                  ? 'bg-lime-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-lime-600" />
              Štruktúra & Facingy
            </button>
          )}

          {availableSubCategories.has('price_ocr') && (
            <button
              onClick={() => setSelectedCategoryFilter('price_ocr')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedCategoryFilter === 'price_ocr'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
              Čítanie cien & centov
            </button>
          )}

          {availableSubCategories.has('pos_materials') && (
            <button
              onClick={() => setSelectedCategoryFilter('pos_materials')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedCategoryFilter === 'pos_materials'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              POS Materiály
            </button>
          )}

          {availableSubCategories.has('normalization') && (
            <button
              onClick={() => setSelectedCategoryFilter('normalization')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedCategoryFilter === 'normalization'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Tag className="w-3.5 h-3.5 text-indigo-500" />
              Normalizácia SKU
            </button>
          )}

          {availableSubCategories.has('ghost_filtering') && (
            <button
              onClick={() => setSelectedCategoryFilter('ghost_filtering')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedCategoryFilter === 'ghost_filtering'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Ghost className="w-3.5 h-3.5 text-purple-500" />
              Ghost produkty
            </button>
          )}

          {availableSubCategories.has('category_rules') && (
            <button
              onClick={() => setSelectedCategoryFilter('category_rules')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedCategoryFilter === 'category_rules'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Boxes className="w-3.5 h-3.5 text-amber-500" />
              Kategórie & Varianty
            </button>
          )}
        </div>

        <span className="text-xs text-slate-400 font-bold">
          Zobrazených {filteredRecommendations.length} z {currentViewRecommendations.length} {viewTab === 'active' ? 'nerealizovaných' : viewTab === 'archived' ? 'v archíve' : 'v koši'} pre {CATEGORY_META[activeCategory]?.title.split(' ')[0]}
        </span>
      </div>

      {/* 5. ZOZNAM ODPORÚČANÍ NA ZLEPŠENIE PROMPTU */}
      <div className="space-y-4">
        {filteredRecommendations.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
              viewTab === 'trash' ? 'bg-rose-100 text-rose-600' : viewTab === 'archived' ? 'bg-indigo-100 text-indigo-600' : 'bg-lime-100 text-lime-600'
            }`}>
              {viewTab === 'trash' ? (
                <Trash2 className="w-6 h-6" />
              ) : viewTab === 'archived' ? (
                <FolderArchive className="w-6 h-6" />
              ) : (
                <CheckCircle2 className="w-6 h-6" />
              )}
            </div>
            <h4 className="text-base font-black text-slate-900">
              {viewTab === 'trash' ? (
                'Kôš je prázdny'
              ) : viewTab === 'archived' ? (
                'V archíve zatiaľ nie sú žiadne realizované odporúčania'
              ) : (
                `Všetky pravidlá pre ${CATEGORY_META[activeCategory]?.title} sú vyriešené`
              )}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              {viewTab === 'trash' ? (
                'Nenachádzajú sa tu žiadne odmietnuté odporúčania. Návrhy môžete odmietnuť kliknutím na tlačidlo «Odmietnuť».'
              ) : viewTab === 'archived' ? (
                'Akonáhle pri odporúčaní kliknete na «+ Vložiť do promptu», pravidlo sa vloží do editora a návrh sa automaticky presunie do tohto Archívu.'
              ) : (
                `Všetky identifikované odporúčania pre ${CATEGORY_META[activeCategory]?.title} boli zapracované do promptu (nájdete ich v záložke Archív) alebo odmietnuté do koša.`
              )}
            </p>
            {viewTab === 'active' && archivedRecommendations.length > 0 && (
              <div className="pt-2">
                <button
                  onClick={() => setViewTab('archived')}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5 border border-indigo-200"
                >
                  <FolderArchive className="w-3.5 h-3.5" />
                  <span>Zobraziť realizované v Archíve ({archivedRecommendations.length})</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredRecommendations.map((rec) => {
            const isCopied = copiedId === rec.id;

            return (
              <div 
                key={rec.id}
                className={`bg-white rounded-3xl p-6 border transition-all duration-200 shadow-sm hover:shadow-md ${
                  viewTab === 'trash'
                    ? 'border-slate-200 bg-slate-50/40 opacity-80'
                    : viewTab === 'archived'
                    ? 'border-indigo-100 bg-indigo-50/20'
                    : rec.severity === 'critical' 
                    ? 'border-rose-200 bg-rose-50/10' 
                    : rec.severity === 'warning' 
                    ? 'border-amber-200' 
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {getSeverityBadge(rec.severity)}
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                        {rec.impact}
                      </span>
                      {viewTab === 'archived' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200">
                          <FolderArchive className="w-3 h-3" /> V archíve (Zapracované)
                        </span>
                      )}
                      {viewTab === 'trash' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200">
                          <Trash2 className="w-3 h-3" /> Odmietnutý návrh
                        </span>
                      )}
                    </div>

                    <h4 className="text-base font-black text-slate-900 tracking-tight">
                      {rec.title}
                    </h4>

                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {rec.description}
                    </p>

                    {/* Dôkaz z auditu */}
                    <div className="inline-flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs mt-2">
                      <span className="font-black text-slate-500 text-[10px] uppercase tracking-wider">
                        {rec.evidence.metric}:
                      </span>
                      <span className="font-extrabold text-slate-900 bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-xs">
                        {rec.evidence.value}
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        ({rec.evidence.detail})
                      </span>
                    </div>

                    {/* Príklady nezhôd ak existujú */}
                    {rec.examples && rec.examples.length > 0 && (
                      <div className="pt-2 space-y-1.5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block font-mono">
                          Identifikované odchýlky na fotografiách regálu:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {rec.examples.map((ex, exIdx) => (
                            <div key={exIdx} className="p-2 bg-slate-100/70 rounded-xl text-xs flex items-center justify-between border border-slate-200/60">
                              <span className="text-rose-600 font-bold truncate max-w-[140px] sm:max-w-[180px]" title={ex.original}>
                                ✕ {ex.original}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-400 shrink-0 mx-1" />
                              <span className="text-lime-700 font-black truncate max-w-[140px] sm:max-w-[180px]" title={ex.canonical}>
                                ✓ {ex.canonical}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Akčné tlačidlá */}
                  <div className="flex flex-row lg:flex-col items-center lg:items-end gap-2 shrink-0 pt-2 lg:pt-0">
                    {viewTab === 'active' ? (
                      <>
                        <button
                          onClick={() => handleApply(rec)}
                          className="px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 bg-lime-600 hover:bg-lime-700 text-white shadow-md shadow-lime-600/20 hover:scale-[1.02] active:scale-[0.98]"
                          title="Vložiť do textu promptu a presunúť do Archívu"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Vložiť do promptu</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleTrash(rec)}
                            className="px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors flex items-center gap-1.5 border border-rose-200/80"
                            title="Odmietnuť tento návrh a presunúť do koša"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Odmietnuť</span>
                          </button>

                          <button
                            onClick={() => handleCopy(rec.suggestedRule, rec.id)}
                            className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 border border-slate-200/80"
                            title="Skopírovať znenie inštrukcie do schránky"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-lime-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{isCopied ? 'Skopírované' : 'Kopírovať'}</span>
                          </button>
                        </div>

                        <button
                          onClick={() => onOpenSimulator(injectRuleIntoPrompt(currentPromptText, rec.suggestedRule))}
                          className="px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center gap-1.5 border border-indigo-200"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Otestovať v simulátore</span>
                        </button>
                      </>
                    ) : viewTab === 'archived' ? (
                      <>
                        <button
                          onClick={() => handleRestore(rec)}
                          className="px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center gap-1.5 border border-indigo-200"
                          title="Vrátiť z archívu späť medzi nerealizované návrhy"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          <span>Vrátiť do nerealizovaných</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleTrash(rec)}
                            className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1.5 border border-rose-200/80"
                            title="Odmietnuť a presunúť do koša"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Presunúť do koša</span>
                          </button>

                          <button
                            onClick={() => handleCopy(rec.suggestedRule, rec.id)}
                            className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 border border-slate-200/80"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-lime-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{isCopied ? 'Skopírované' : 'Kopírovať'}</span>
                          </button>
                        </div>

                        <button
                          onClick={() => onOpenSimulator(injectRuleIntoPrompt(currentPromptText, rec.suggestedRule))}
                          className="px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center gap-1.5 border border-indigo-200"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Otestovať v simulátore</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRestore(rec)}
                          className="px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 bg-lime-600 hover:bg-lime-700 text-white shadow-md shadow-lime-600/20"
                          title="Obnoviť tento návrh z koša späť medzi nerealizované"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          <span>Obnoviť z koša</span>
                        </button>

                        <button
                          onClick={() => handleCopy(rec.suggestedRule, rec.id)}
                          className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 border border-slate-200/80"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-lime-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>Kopírovať pravidlo</span>
                        </button>

                        <button
                          onClick={() => onOpenSimulator(injectRuleIntoPrompt(currentPromptText, rec.suggestedRule))}
                          className="px-3 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center gap-1.5 border border-indigo-200"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Otestovať v simulátore</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Box s navrhovaným pravidlom */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="bg-slate-900 text-slate-200 p-3.5 rounded-2xl font-mono text-[11px] leading-relaxed relative group overflow-x-auto">
                    <div className="flex items-center justify-between text-slate-400 text-[10px] pb-1.5 mb-1.5 border-b border-slate-800">
                      <span>Navrhovaný text inštrukcie pre Gemini model:</span>
                      <span className="text-slate-500 uppercase">{rec.targetPromptCategory}</span>
                    </div>
                    <pre className="whitespace-pre-wrap">{rec.suggestedRule}</pre>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. ZOZNAM NAJVIAC PROBLEMATICKÝCH SKU V REÁLNYCH AUDITOCH */}
      {summary.topProblematicSkus.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-lime-600" />
                Problematické položky identifikované v auditoch
              </h4>
              <p className="text-xs text-slate-500">
                Položky s nízkou istotou rozpoznania alebo chýbajúcimi údajmi, ktoré vyžadujú spresnenie v prompte.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {summary.topProblematicSkus.slice(0, 6).map((item, idx) => (
              <div key={idx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 truncate max-w-[180px]" title={item.name}>
                    {item.name}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-xs">
                    {item.occurrences}x výskyt
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[11px] text-amber-700 font-bold">
                    {item.issue}
                  </span>
                  <span className="text-[10px] font-mono font-black text-slate-700">
                    {Math.round(item.avgConfidence * 100)}% istota
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. MODÁL S VÝSLEDKOM AI AUTO-ENHANCE OPTIMALIZÁCIE */}
      {isEnhanceModalOpen && enhancementResult && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-lime-500 text-slate-950 rounded-2xl shadow-lg shadow-lime-500/20 font-black">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">
                    AI Optimalizovaný Prompt: {CATEGORY_META[activeCategory]?.title}
                  </h3>
                  <p className="text-xs text-lime-400 font-bold">
                    Odhadované zlepšenie: {enhancementResult.estimatedAccuracyGain} • Cielené na {CATEGORY_META[activeCategory]?.badge}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEnhanceModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/80 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
              {/* Súhrn zmien */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-lime-600" />
                    Zoznam implementovaných vylepšení
                  </h5>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {enhancementResult.changesSummary.map((change, cIdx) => (
                      <li key={cIdx} className="flex items-start gap-2">
                        <span className="text-lime-600 font-bold">•</span>
                        <span>{change}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                  <h5 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    Očakávané prínosy
                  </h5>
                  <ul className="space-y-1.5 text-xs text-slate-600">
                    {enhancementResult.expectedImprovements.map((imp, iIdx) => (
                      <li key={iIdx} className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold">•</span>
                        <span>{imp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Náhľad nového promptu */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500 font-mono">
                    Náhľad optimalizovaného promptu
                  </label>
                  <button
                    onClick={() => handleCopy(enhancementResult.optimizedPrompt, 'modal-auto')}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                  >
                    {copiedId === 'modal-auto' ? <Check className="w-3.5 h-3.5 text-lime-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId === 'modal-auto' ? 'Skopírované' : 'Kopírovať celý text'}</span>
                  </button>
                </div>
                <div className="bg-slate-900 text-slate-200 p-4 rounded-2xl font-mono text-xs max-h-[300px] overflow-y-auto leading-relaxed border border-slate-800">
                  <pre className="whitespace-pre-wrap">{enhancementResult.optimizedPrompt}</pre>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 bg-white border-t border-slate-200 flex items-center justify-between gap-4">
              <button
                onClick={() => {
                  onApplyRule(enhancementResult.optimizedPrompt, 'full-auto-replace');
                  setIsEnhanceModalOpen(false);
                }}
                className="px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
              >
                Vložiť iba do editora (bez uloženia)
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEnhanceModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Zrušiť
                </button>
                <button
                  onClick={handleAcceptEnhancedPrompt}
                  disabled={isSavingAutoVersion}
                  className="px-5 py-2.5 bg-lime-600 hover:bg-lime-700 disabled:bg-slate-200 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-lime-600/20 transition-all flex items-center gap-2"
                >
                  {isSavingAutoVersion ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Ukladám novú verziu...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Prijať a uložiť novú verziu promptu</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
