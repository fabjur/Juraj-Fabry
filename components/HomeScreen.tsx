import React, { useState, useRef } from 'react';
import { useTranslation } from '../i18n/index.tsx';
import { 
  LightBulbIcon, 
  ChevronRightIcon, 
  SalesappVisionBrand, 
  RocketLaunchIcon, 
  CheckCircleIcon, 
  ShieldCheckIcon
} from './Icons.tsx';
import { 
  BookOpen, 
  Cpu, 
  Layers, 
  Scan, 
  BarChart3, 
  Tag, 
  Sparkles, 
  Zap, 
  Boxes,
  Maximize2,
  Scale,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Terminal,
  Coins,
  Sliders
} from 'lucide-react';

interface HomeScreenProps {
  onStartAnalysis: () => void;
}

const ValueCard: React.FC<{ 
  icon: React.ElementType; 
  title: string; 
  badge?: string; 
  children: React.ReactNode; 
}> = ({ icon: Icon, title, badge, children }) => (
  <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-zinc-150 dark:border-zinc-800 shadow-xs hover:shadow-xl hover:border-lime-300 dark:hover:border-lime-500/50 transition-all duration-300 transform hover:-translate-y-1 flex flex-col justify-between group relative overflow-hidden">
    <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-50 dark:bg-zinc-800/40 rounded-bl-full -z-0 group-hover:scale-110 transition-transform"></div>
    <div className="relative z-10 space-y-4">
      <div className="flex justify-between items-start">
        <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-700/60 group-hover:bg-zinc-900 dark:group-hover:bg-lime-500 group-hover:text-white dark:group-hover:text-zinc-950 transition-colors shadow-2xs">
          <Icon className="w-7 h-7 text-zinc-700 dark:text-zinc-300 group-hover:text-white dark:group-hover:text-zinc-950 transition-colors" />
        </div>
        {badge && (
          <span className="text-[10px] font-bold tracking-wide text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
            {badge}
          </span>
        )}
      </div>
      <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight leading-snug">{title}</h3>
      <p className="text-zinc-500 dark:text-zinc-400 text-xs leading-relaxed font-semibold">{children}</p>
    </div>
  </div>
);

export const HomeScreen: React.FC<HomeScreenProps> = ({ onStartAnalysis }) => {
  const { t } = useTranslation();
  const [activeWikiTab, setActiveWikiTab] = useState<'vision' | 'models' | 'pipeline' | 'modules' | 'swot' | 'prompts'>('vision');
  const wikiSectionRef = useRef<HTMLDivElement>(null);

  const scrollToWiki = () => {
    wikiSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-16 pb-20 animate-fade-in px-4">
      
      {/* HERO SECTION */}
      <section className="text-center pt-8 pb-4 relative">
        <div className="inline-flex items-center gap-2 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 px-4 py-1.5 rounded-full text-[11px] font-bold border border-zinc-200 dark:border-zinc-800 mb-6 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-zinc-400 dark:text-lime-400 animate-pulse" />
          {t('homeBadge')}
        </div>

        <div className="flex justify-center mb-6">
          <SalesappVisionBrand className="h-24 scale-110 transform hover:scale-115 transition-transform duration-500" hideText />
        </div>

        <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-zinc-900 dark:text-white leading-tight mb-4">
          {t('homeTitle')}
        </h1>

        <h2 className="text-lg md:text-xl font-semibold text-zinc-500 dark:text-zinc-400 mb-6 tracking-wide max-w-3xl mx-auto">
          {t('homeSubtitle')}
        </h2>

        <p className="text-sm md:text-base text-zinc-600 dark:text-zinc-300 max-w-3xl mx-auto leading-relaxed font-medium bg-zinc-50/80 dark:bg-zinc-900/80 p-6 rounded-3xl border border-zinc-150 dark:border-zinc-800 shadow-3xs">
          {t('homeIntro')}
        </p>

        {/* HERO ACTIONS */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
          <button 
            onClick={onStartAnalysis} 
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 text-sm font-bold tracking-wide text-white transition-all duration-300 bg-zinc-900 dark:bg-lime-500 hover:bg-zinc-800 dark:hover:bg-lime-400 text-white dark:text-zinc-950 rounded-full shadow-md hover:-translate-y-0.5 border border-transparent cursor-pointer"
          >
            <RocketLaunchIcon className="w-5 h-5 text-white dark:text-zinc-950 group-hover:animate-bounce" />
            <span className="text-white dark:text-zinc-950 font-semibold">{t('startAnalysisButton')}</span>
            <ChevronRightIcon className="w-4 h-4 text-white dark:text-zinc-950 group-hover:translate-x-1 transition-transform" />
          </button>

          <button 
            onClick={scrollToWiki}
            className="inline-flex items-center justify-center gap-2 px-6 py-4 text-sm font-bold tracking-wide text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-2xl transition-all shadow-3xs hover:shadow-xs cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-zinc-400 dark:text-zinc-400" />
            <span>{t('exploreWikiButton')}</span>
          </button>
        </div>
      </section>

      {/* VALUE PROPOSITIONS (PREČO SALESAPP VISION) */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-md border border-zinc-200 dark:border-zinc-700">
            {t('valuePropHeaderTitle')}
          </span>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">{t('valuePropHeaderSubtitle')}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ValueCard icon={ShieldCheckIcon} title={t('valueProp1Title')} badge={t('badgeObjectivity')}>
            {t('valueProp1Desc')}
          </ValueCard>

          <ValueCard icon={Zap} title={t('valueProp2Title')} badge={t('badgeLightningCollection')}>
            {t('valueProp2Desc')}
          </ValueCard>

          <ValueCard icon={BarChart3} title={t('valueProp3Title')} badge={t('badgeBusinessGrowth')}>
            {t('valueProp3Desc')}
          </ValueCard>
        </div>
      </section>

      {/* WIKI & TECHNOLOGICAL FOUNDATION SECTION */}
      <section ref={wikiSectionRef} className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl space-y-8 relative overflow-hidden border border-zinc-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-zinc-900/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* WIKI HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800 pb-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-zinc-800 text-zinc-300 px-3.5 py-1 rounded-full text-[10px] font-bold border border-lime-500/30 mb-2">
              <BookOpen className="w-3.5 h-3.5 text-lime-400" />
              {t('wikiKnowledgeBaseBadge')}
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">{t('wikiHeaderTitle')}</h2>
            <p className="text-xs md:text-sm text-zinc-400 font-medium mt-1">{t('wikiHeaderSubtitle')}</p>
          </div>
        </div>

        {/* WIKI TABS */}
        <div className="flex flex-wrap gap-2 border-b border-zinc-800/80 pb-3 relative z-10">
          <button
            onClick={() => setActiveWikiTab('vision')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all flex items-center gap-2 ${
              activeWikiTab === 'vision'
                ? 'bg-zinc-800 text-white shadow-md'
                : 'bg-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Scan className="w-4 h-4" />
            {t('wikiTabVision')}
          </button>

          <button
            onClick={() => setActiveWikiTab('models')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all flex items-center gap-2 ${
              activeWikiTab === 'models'
                ? 'bg-zinc-800 text-white shadow-md'
                : 'bg-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Cpu className="w-4 h-4" />
            {t('wikiTabModels')}
          </button>

          <button
            onClick={() => setActiveWikiTab('pipeline')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all flex items-center gap-2 ${
              activeWikiTab === 'pipeline'
                ? 'bg-zinc-800 text-white shadow-md'
                : 'bg-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            {t('wikiTabPipeline')}
          </button>

          <button
            onClick={() => setActiveWikiTab('modules')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all flex items-center gap-2 ${
              activeWikiTab === 'modules'
                ? 'bg-zinc-800 text-white shadow-md'
                : 'bg-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            {t('wikiTabModules')}
          </button>

          <button
            onClick={() => setActiveWikiTab('swot')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all flex items-center gap-2 ${
              activeWikiTab === 'swot'
                ? 'bg-zinc-800 text-white shadow-md'
                : 'bg-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Scale className="w-4 h-4" />
            {t('wikiTabSwot')}
          </button>

          <button
            onClick={() => setActiveWikiTab('prompts')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all flex items-center gap-2 ${
              activeWikiTab === 'prompts'
                ? 'bg-zinc-800 text-white shadow-md'
                : 'bg-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <Terminal className="w-4 h-4" />
            {t('wikiTabPrompts')}
          </button>
        </div>

        {/* WIKI TAB CONTENTS */}
        <div className="relative z-10 pt-2">
          {/* TAB 1: COMPUTER VISION & OCR */}
          {activeWikiTab === 'vision' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
              <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700/60 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-800 text-zinc-300 flex items-center justify-center font-bold">
                  <Boxes className="w-5 h-5" />
                </div>
                <h4 className="font-extrabold text-white text-base tracking-tight">{t('cvFeature1Title')}</h4>
                <p className="text-zinc-300 text-xs leading-relaxed font-medium">{t('cvFeature1Desc')}</p>
              </div>

              <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700/60 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Tag className="w-5 h-5" />
                </div>
                <h4 className="font-extrabold text-white text-base tracking-tight">{t('cvFeature2Title')}</h4>
                <p className="text-zinc-300 text-xs leading-relaxed font-medium">{t('cvFeature2Desc')}</p>
              </div>

              <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700/60 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                  <Maximize2 className="w-5 h-5" />
                </div>
                <h4 className="font-extrabold text-white text-base tracking-tight">{t('cvFeature3Title')}</h4>
                <p className="text-zinc-300 text-xs leading-relaxed font-medium">{t('cvFeature3Desc')}</p>
              </div>
            </div>
          )}

          {/* TAB 2: AI MODELY & ARCHITEKTÚRA */}
          {activeWikiTab === 'models' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
              <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700/60 space-y-3">
                <span className="text-[9px] font-bold uppercase text-zinc-300 bg-zinc-800 border-zinc-700 px-2 py-0.5 rounded-md">
                  {t('tagSpeedThroughput')}
                </span>
                <h4 className="font-extrabold text-white text-base tracking-tight">{t('modelFlashTitle')}</h4>
                <p className="text-zinc-300 text-xs leading-relaxed font-medium">{t('modelFlashDesc')}</p>
              </div>

              <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700/60 space-y-3">
                <span className="text-[9px] font-bold uppercase text-emerald-400 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-md">
                  {t('tagHighPrecisionDetails')}
                </span>
                <h4 className="font-extrabold text-white text-base tracking-tight">{t('modelProTitle')}</h4>
                <p className="text-zinc-300 text-xs leading-relaxed font-medium">{t('modelProDesc')}</p>
              </div>

              <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700/60 space-y-3">
                <span className="text-[9px] font-bold uppercase text-purple-400 bg-purple-950/80 border border-purple-800 px-2 py-0.5 rounded-md">
                  {t('tagZeroExternalDependency')}
                </span>
                <h4 className="font-extrabold text-white text-base tracking-tight">{t('architectureTitle')}</h4>
                <p className="text-zinc-300 text-xs leading-relaxed font-medium">{t('architectureDesc')}</p>
              </div>
            </div>
          )}

          {/* TAB 3: DÁTOVÝ PIPELINE */}
          {activeWikiTab === 'pipeline' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
              <div className="bg-zinc-800/50 p-5 rounded-2xl border border-zinc-700/60 space-y-2 relative">
                <span className="w-6 h-6 rounded-full bg-zinc-900 text-white font-semibold text-xs flex items-center justify-center">1</span>
                <h5 className="font-extrabold text-white text-sm">{t('pipelineStep1Title')}</h5>
                <p className="text-zinc-300 text-xs leading-relaxed font-medium">{t('pipelineStep1Desc')}</p>
              </div>

              <div className="bg-zinc-800/50 p-5 rounded-2xl border border-zinc-700/60 space-y-2 relative">
                <span className="w-6 h-6 rounded-full bg-zinc-900 text-white font-semibold text-xs flex items-center justify-center">2</span>
                <h5 className="font-extrabold text-white text-sm">{t('pipelineStep2Title')}</h5>
                <p className="text-zinc-300 text-xs leading-relaxed font-medium">{t('pipelineStep2Desc')}</p>
              </div>

              <div className="bg-zinc-800/50 p-5 rounded-2xl border border-zinc-700/60 space-y-2 relative">
                <span className="w-6 h-6 rounded-full bg-zinc-900 text-white font-semibold text-xs flex items-center justify-center">3</span>
                <h5 className="font-extrabold text-white text-sm">{t('pipelineStep3Title')}</h5>
                <p className="text-zinc-300 text-xs leading-relaxed font-medium">{t('pipelineStep3Desc')}</p>
              </div>

              <div className="bg-zinc-800/50 p-5 rounded-2xl border border-zinc-700/60 space-y-2 relative">
                <span className="w-6 h-6 rounded-full bg-zinc-900 text-white font-semibold text-xs flex items-center justify-center">4</span>
                <h5 className="font-extrabold text-white text-sm">{t('pipelineStep4Title')}</h5>
                <p className="text-zinc-300 text-xs leading-relaxed font-medium">{t('pipelineStep4Desc')}</p>
              </div>
            </div>
          )}

          {/* TAB 4: RETAIL MODULY & POJMY */}
          {activeWikiTab === 'modules' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
              <div className="bg-zinc-800/50 p-5 rounded-2xl border border-zinc-700/60 space-y-1.5">
                <h5 className="font-bold text-lime-400 text-sm">{t('moduleOspTitle')}</h5>
                <p className="text-zinc-300 text-xs leading-relaxed font-medium">{t('moduleOspDesc')}</p>
              </div>

              <div className="bg-zinc-800/50 p-5 rounded-2xl border border-zinc-700/60 space-y-1.5">
                <h5 className="font-bold text-emerald-400 text-sm">{t('moduleSosTitle')}</h5>
                <p className="text-zinc-300 text-xs leading-relaxed font-medium">{t('moduleSosDesc')}</p>
              </div>

              <div className="bg-zinc-800/50 p-5 rounded-2xl border border-zinc-700/60 space-y-1.5">
                <h5 className="font-bold text-blue-400 text-sm">{t('moduleQcTitle')}</h5>
                <p className="text-zinc-300 text-xs leading-relaxed font-medium">{t('moduleQcDesc')}</p>
              </div>

              <div className="bg-zinc-800/50 p-5 rounded-2xl border border-zinc-700/60 space-y-1.5">
                <h5 className="font-bold text-rose-400 text-sm">{t('moduleOsaTitle')}</h5>
                <p className="text-zinc-300 text-xs leading-relaxed font-medium">{t('moduleOsaDesc')}</p>
              </div>

              <div className="bg-zinc-800/50 p-5 rounded-2xl border border-zinc-700/60 space-y-1.5 md:col-span-2">
                <h5 className="font-bold text-purple-400 text-sm">{t('modulePosTitle')}</h5>
                <p className="text-zinc-300 text-xs leading-relaxed font-medium">{t('modulePosDesc')}</p>
              </div>
            </div>
          )}

          {/* TAB 5: SWOT ANALÝZA (GEMINI VS TRADIČNÉ CV MODELY) */}
          {activeWikiTab === 'swot' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-zinc-800/40 p-5 rounded-2xl border border-zinc-700/60">
                <h4 className="text-base font-bold text-lime-400 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-lime-400" />
                  {t('swotTitle')}
                </h4>
                <p className="text-xs text-zinc-300 mt-1 font-medium leading-relaxed">
                  {t('swotSubtitle')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* STRENGTHS */}
                <div className="bg-emerald-950/30 p-6 rounded-2xl border border-emerald-500/30 space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                    <h5 className="font-bold text-sm tracking-wide">{t('swotStrengthsTitle')}</h5>
                  </div>
                  <ul className="space-y-2.5 text-xs text-zinc-200 font-medium">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{t('swotStrengths1')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{t('swotStrengths2')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{t('swotStrengths3')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{t('swotStrengths4')}</span>
                    </li>
                  </ul>
                </div>

                {/* WEAKNESSES */}
                <div className="bg-amber-950/30 p-6 rounded-2xl border border-amber-500/30 space-y-4">
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertTriangle className="w-5 h-5" />
                    <h5 className="font-bold text-sm tracking-wide">{t('swotWeaknessesTitle')}</h5>
                  </div>
                  <ul className="space-y-2.5 text-xs text-zinc-200 font-medium">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>{t('swotWeaknesses1')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>{t('swotWeaknesses2')}</span>
                    </li>
                  </ul>
                </div>

                {/* OPPORTUNITIES */}
                <div className="bg-blue-950/30 p-6 rounded-2xl border border-blue-500/30 space-y-4">
                  <div className="flex items-center gap-2 text-blue-400">
                    <TrendingUp className="w-5 h-5" />
                    <h5 className="font-bold text-sm tracking-wide">{t('swotOpportunitiesTitle')}</h5>
                  </div>
                  <ul className="space-y-2.5 text-xs text-zinc-200 font-medium">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">•</span>
                      <span>{t('swotOpportunities1')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">•</span>
                      <span>{t('swotOpportunities2')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">•</span>
                      <span>{t('swotOpportunities3')}</span>
                    </li>
                  </ul>
                </div>

                {/* THREATS / RISKS OF TRADITIONAL CV */}
                <div className="bg-rose-950/30 p-6 rounded-2xl border border-rose-500/30 space-y-4">
                  <div className="flex items-center gap-2 text-rose-400">
                    <XCircle className="w-5 h-5" />
                    <h5 className="font-bold text-sm tracking-wide">{t('swotThreatsTitle')}</h5>
                  </div>
                  <ul className="space-y-2.5 text-xs text-zinc-200 font-medium">
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>{t('swotThreats1')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>{t('swotThreats2')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-rose-400 font-bold">•</span>
                      <span>{t('swotThreats3')}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: PROMPTY & TOKENOVÁ EFEKTIVITA */}
          {activeWikiTab === 'prompts' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-zinc-800/40 p-5 rounded-2xl border border-zinc-700/60">
                <h4 className="text-base font-bold text-lime-400 flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-lime-400" />
                  {t('promptTitle')}
                </h4>
                <p className="text-xs text-zinc-300 mt-1 font-medium leading-relaxed">
                  {t('promptSubtitle')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700/60 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800 text-zinc-300 flex items-center justify-center font-bold">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <h4 className="font-extrabold text-white text-base tracking-tight">{t('promptRoleTitle')}</h4>
                  <p className="text-zinc-300 text-xs leading-relaxed font-medium">{t('promptRoleDesc')}</p>
                </div>

                <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700/60 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <h4 className="font-extrabold text-white text-base tracking-tight">{t('promptRefinementTitle')}</h4>
                  <p className="text-zinc-300 text-xs leading-relaxed font-medium">{t('promptRefinementDesc')}</p>
                </div>

                <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700/60 space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    <Coins className="w-5 h-5" />
                  </div>
                  <h4 className="font-extrabold text-white text-base tracking-tight">{t('promptTokensTitle')}</h4>
                  <p className="text-zinc-300 text-xs leading-relaxed font-medium">{t('promptTokensDesc')}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* HOW IT WORKS PROCESS STEPS */}
      <section className="space-y-8">
        <div className="flex items-center justify-center gap-2">
          <LightBulbIcon className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">{t('howItWorksTitle')}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-zinc-150 dark:border-zinc-800 shadow-xs text-center space-y-3">
            <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-2xl flex items-center justify-center mx-auto font-bold text-lg">
              1
            </div>
            <h3 className="font-bold text-zinc-900 dark:text-white text-lg">{t('howItWorksStep1Title')}</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs font-medium leading-relaxed">{t('howItWorksStep1Desc')}</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-zinc-150 dark:border-zinc-800 shadow-xs text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto font-bold text-lg border border-emerald-100 dark:border-emerald-900/50">
              2
            </div>
            <h3 className="font-bold text-zinc-900 dark:text-white text-lg">{t('howItWorksStep2Title')}</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs font-medium leading-relaxed">{t('howItWorksStep2Desc')}</p>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] border border-zinc-150 dark:border-zinc-800 shadow-xs text-center space-y-3">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 rounded-2xl flex items-center justify-center mx-auto font-bold text-lg border border-blue-100 dark:border-blue-900/50">
              3
            </div>
            <h3 className="font-bold text-zinc-900 dark:text-white text-lg">{t('howItWorksStep3Title')}</h3>
            <p className="text-zinc-500 dark:text-zinc-400 text-xs font-medium leading-relaxed">{t('howItWorksStep3Desc')}</p>
          </div>
        </div>
      </section>

      {/* FINAL CALL TO ACTION */}
      <section className="text-center space-y-8 bg-gradient-to-b from-slate-50 to-white dark:from-zinc-900 dark:to-zinc-950 p-10 rounded-[3rem] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
        <div className="space-y-3 relative z-10">
          <h2 className="text-2xl md:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">{t('resultTitle')}</h2>
          <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto font-medium leading-relaxed">{t('resultDesc')}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-8 py-2 relative z-10">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wide">
            <CheckCircleIcon className="w-4 h-4 text-zinc-400 dark:text-lime-400" /> {t('featureSpeed')}
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wide">
            <CheckCircleIcon className="w-4 h-4 text-zinc-400 dark:text-lime-400" /> {t('featureAccuracy')}
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wide">
            <CheckCircleIcon className="w-4 h-4 text-zinc-400 dark:text-lime-400" /> {t('featureObjectivity')}
          </div>
        </div>

        <button 
          onClick={onStartAnalysis} 
          className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 text-sm font-bold tracking-wide text-white transition-all duration-300 bg-zinc-900 dark:bg-lime-500 hover:bg-zinc-800 dark:hover:bg-lime-400 text-white dark:text-zinc-950 rounded-full shadow-md hover:-translate-y-0.5 overflow-hidden z-10 border border-transparent cursor-pointer"
        >
          <RocketLaunchIcon className="w-5 h-5 text-white dark:text-zinc-950 group-hover:animate-bounce" />
          <span className="text-white dark:text-zinc-950 font-semibold">{t('startAnalysisButton')}</span>
          <ChevronRightIcon className="w-4 h-4 text-white dark:text-zinc-950 group-hover:translate-x-1 transition-transform" />
        </button>
      </section>
    </div>
  );
};
