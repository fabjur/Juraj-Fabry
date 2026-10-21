import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.ts';
import { useTranslation } from '../i18n/index.tsx';
import { ThemeSwitcher } from './ThemeSwitcher.tsx';
import { 
  Image as ImageIcon, 
  TrendingUp, 
  PieChart, 
  Flame, 
  CheckSquare, 
  Database,
  Store,
  Archive,
  Calculator,
  Code2,
  LayoutDashboard,
  FileDown,
  ArrowLeftRight,
  Bot,
  ShieldCheck,
  X
} from 'lucide-react'; 
import type { ActiveView } from '../types.ts';

interface SidebarProps {
  activeView: ActiveView;
  onNavClick: (view: ActiveView) => void;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavClick, onClose }) => {
  const { t } = useTranslation();

  const productsCount = useLiveQuery(() => db.product_catalog.count()) ?? null;
  const storesCount = useLiveQuery(() => db.stores.count()) ?? null;
  const analysesCount = useLiveQuery(() => db.analyses.count()) ?? null;

  const [showTechnicalTools, setShowTechnicalTools] = React.useState(false);

  // Main navigation directly aligned with requirements
  const mainItems = [
    { id: 'dashboard', label: t('menuDashboard') || 'Dashboard', icon: LayoutDashboard },
    { id: 'analyses', label: t('menuAnalyses') || 'Audits', icon: Archive, count: analysesCount },
    { id: 'verificationQueue', label: t('menuVerificationQueue') || 'For Review', icon: CheckSquare },
    { id: 'exportReports', label: t('menuExportReports') || 'Reports', icon: FileDown },
    { id: 'productCatalog', label: t('menuProductCatalog') || 'Catalog', icon: Database, count: productsCount },
  ];

  const auditModules = [
    { id: 'priceMonitoring', label: t('menuPriceMonitoring') || 'Prices & Facings', icon: TrendingUp },
    { id: 'shelfShare', label: t('menuShelfShare') || 'Shelf Share', icon: PieChart },
    { id: 'promoAlert', label: t('menuPromoAlert') || 'Promos & Alerts', icon: Flame },
    { id: 'competitorComparison', label: t('menuCompetitorComparison') || 'Competitor Prices', icon: ArrowLeftRight },
    { id: 'stores', label: t('menuStores') || 'Stores', icon: Store, count: storesCount },
    { id: 'gallery', label: t('menuGallery') || 'Photo Gallery', icon: ImageIcon },
  ];

  const technicalTools = [
    { id: 'systemTests', label: t('menuSystemTests') || 'System Tests', icon: ShieldCheck },
    { id: 'costs', label: t('menuCosts') || 'Tokens & Costs', icon: Calculator },
    { id: 'prompts', label: t('menuPrompts') || 'Model Settings', icon: Code2 },
    { id: 'chat', label: t('menuChat') || 'Gemini AI Assistant', icon: Bot },
  ];

  return (
    <nav className="w-60 flex-shrink-0 bg-white dark:bg-zinc-900 border-r border-zinc-200/80 dark:border-zinc-800 p-3.5 flex flex-col no-print overflow-y-auto custom-scrollbar select-none h-full shadow-lg md:shadow-none transition-colors duration-200">
      {onClose && (
        <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-zinc-150 dark:border-zinc-800 md:hidden">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">{t('menu') || 'Menu'}</span>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label={t('closeMenu') || 'Close menu'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Core Menu */}
      <div className="space-y-4 flex-1">
        <div>
          <h4 className="text-[10px] font-semibold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase px-3 mb-1.5">
            {t('mainMenu') || 'Main Menu'}
          </h4>
          <ul className="space-y-0.5">
            {mainItems.map(item => {
              const isActive = activeView === item.id;
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      onNavClick(item.id as ActiveView);
                      if (onClose && typeof window !== 'undefined' && window.innerWidth < 1024) {
                        onClose();
                      }
                    }}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs transition-colors group cursor-pointer ${
                      isActive 
                        ? 'bg-zinc-900 dark:bg-lime-500 text-white dark:text-zinc-950 font-bold shadow-xs' 
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white font-semibold'
                    }`}
                  >
                    <div className="flex items-center min-w-0">
                      <Icon className={`w-4 h-4 mr-2.5 transition-colors shrink-0 ${
                        isActive ? 'text-lime-400 dark:text-zinc-950' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300'
                      }`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded-md ${
                        isActive ? 'bg-zinc-800 dark:bg-lime-600/30 text-zinc-300 dark:text-zinc-900' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'
                      }`}>
                        {item.count}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Modules Section */}
        <div>
          <h4 className="text-[10px] font-semibold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase px-3 mb-1.5">
            {t('detailedViews') || 'Detailed Views'}
          </h4>
          <ul className="space-y-0.5">
            {auditModules.map(item => {
              const isActive = activeView === item.id;
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => {
                      onNavClick(item.id as ActiveView);
                      if (onClose && typeof window !== 'undefined' && window.innerWidth < 1024) {
                        onClose();
                      }
                    }}
                    className={`flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-xs transition-colors group cursor-pointer ${
                      isActive 
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold' 
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200 font-medium'
                    }`}
                  >
                    <div className="flex items-center min-w-0">
                      <Icon className={`w-3.5 h-3.5 mr-2.5 transition-colors shrink-0 ${
                        isActive ? 'text-zinc-900 dark:text-lime-400' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'
                      }`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span className="text-[10px] font-mono tabular-nums text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300">
                        {item.count}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Technical Tools Section with Toggle */}
        <div className="pt-2 border-t border-zinc-150 dark:border-zinc-800">
          <button
            onClick={() => setShowTechnicalTools(!showTechnicalTools)}
            className="w-full flex items-center justify-between px-3 py-1 text-[10px] font-semibold tracking-wider text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 uppercase cursor-pointer"
            title={showTechnicalTools ? (t('hideTechnicalTools') || 'Hide Technical Tools') : (t('showTechnicalTools') || 'Show Technical Tools')}
          >
            <span>{t('technicalTools') || 'Technical Tools'}</span>
            <span className="text-[9px] font-mono lowercase bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.2 rounded">
              {showTechnicalTools ? (t('hide') || 'hide') : (t('show') || 'show')}
            </span>
          </button>

          {showTechnicalTools && (
            <ul className="space-y-0.5 mt-1 animate-fade-in">
              {technicalTools.map(item => {
                const isActive = activeView === item.id;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => {
                        onNavClick(item.id as ActiveView);
                        if (onClose && typeof window !== 'undefined' && window.innerWidth < 1024) {
                          onClose();
                        }
                      }}
                      className={`flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-xs transition-colors group cursor-pointer ${
                        isActive 
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold' 
                          : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium'
                      }`}
                    >
                      <div className="flex items-center min-w-0">
                        <Icon className={`w-3.5 h-3.5 mr-2.5 transition-colors shrink-0 ${
                          isActive ? 'text-zinc-900 dark:text-lime-400' : 'text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'
                        }`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Sidebar Footer with Theme Toggle */}
      <div className="pt-3 mt-3 border-t border-zinc-150 dark:border-zinc-800 flex items-center justify-between px-2">
        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          {t('theme') || 'Appearance'}
        </span>
        <ThemeSwitcher showLabel={true} className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 px-2 py-1 rounded-md" />
      </div>
    </nav>
  );
};

export default Sidebar;