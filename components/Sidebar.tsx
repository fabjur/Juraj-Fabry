import React from 'react';
import { useTranslation } from '../i18n/index.tsx';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db.ts';
import { 
  Home, 
  Image as ImageIcon, 
  TrendingUp, 
  PieChart, 
  Flame, 
  CheckSquare, 
  FileSpreadsheet, 
  Database,
  GraduationCap,
  Store,
  Archive,
  Calculator,
  Code2,
  LayoutDashboard
} from 'lucide-react'; 
import type { ActiveView } from '../types.ts';

interface SidebarProps {
  activeView: ActiveView;
  onNavClick: (view: ActiveView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavClick }) => {
  const { t } = useTranslation();

  const productsCount = useLiveQuery(() => db.product_catalog.count()) ?? null;
  const storesCount = useLiveQuery(() => db.stores.count()) ?? null;
  const analysesCount = useLiveQuery(() => db.analyses.count()) ?? null;
  const qualityChecksCount = useLiveQuery(() => db.quality_checks.count()) ?? null;

  const sections = [
    {
      title: t('sidebarAuditPanel'),
      items: [
        { id: 'home', label: t('home'), icon: Home },
        { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
        { id: 'gallery', label: t('gallery'), icon: ImageIcon },
      ]
    },
    {
      title: t('sidebarAuditModules'),
      items: [
        { id: 'priceMonitoring', label: t('priceMonitoring'), icon: TrendingUp },
        { id: 'shelfShare', label: t('shelfShare'), icon: PieChart },
        { id: 'promoAlert', label: t('promoAlert'), icon: Flame },
        { id: 'qualityCheck', label: t('qualityCheck'), icon: CheckSquare, count: qualityChecksCount },
        { id: 'distribution', label: t('distribution'), icon: FileSpreadsheet },
      ]
    },
    {
      title: t('sidebarDatabasesAndArchive'),
      items: [
        { id: 'productCatalog', label: t('productCatalog'), icon: Database, count: productsCount },
        { id: 'listing', label: t('listing'), icon: GraduationCap },
        { id: 'stores', label: t('stores'), icon: Store, count: storesCount },
        { id: 'analyses', label: t('analyses'), icon: Archive, count: analysesCount },
      ]
    },
    {
      title: t('sidebarSystemParameters'),
      items: [
        { id: 'costs', label: t('costs'), icon: Calculator },
        { id: 'prompts', label: t('promptManager'), icon: Code2 },
      ]
    }
  ];

  return (
    <nav className="w-64 flex-shrink-0 bg-white border-r border-slate-100 p-5 flex flex-col no-print overflow-y-auto custom-scrollbar select-none">
      <div className="space-y-6">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1.5">
            <h4 className="text-[9px] font-black tracking-widest text-blue-600 uppercase px-4 mb-2">
              {section.title}
            </h4>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = activeView === item.id;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => onNavClick(item.id as ActiveView)}
                      className={`flex items-center justify-between w-full px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 group relative ${
                        isActive 
                          ? 'bg-gradient-to-r from-blue-50/80 to-indigo-50/40 text-blue-800 shadow-xs border border-blue-200/50 pl-5' 
                          : 'text-slate-500 hover:bg-blue-50/30 hover:bg-opacity-80 hover:text-blue-700 border border-transparent hover:pl-[1.125rem]'
                      }`}
                    >
                      <div className="flex items-center min-w-0">
                        {isActive && (
                          <span className="absolute left-1.5 top-3 bottom-3 w-1 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full animate-pulse" />
                        )}
                        <Icon className={`w-4 h-4 mr-3 transition-colors duration-200 shrink-0 ${
                          isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-600'
                        }`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {typeof item.count === 'number' && item.count > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-colors ${
                          isActive 
                            ? 'bg-blue-100/70 text-blue-800' 
                            : 'bg-slate-100 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600'
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
        ))}
      </div>
    </nav>
  );
};

export default Sidebar;