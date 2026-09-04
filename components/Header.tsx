import React from 'react';
import { useTranslation } from '../i18n/index.tsx';
import { LanguageSwitcher } from './LanguageSwitcher.tsx';
import { MagnifyingGlassIcon, CalendarDaysIcon, SalesappVisionBrand, Bars3Icon } from './Icons.tsx';

interface HeaderProps {
    onNewAnalysis: () => void;
    onOpenSearch: () => void;
    isSidebarOpen: boolean;
    onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onNewAnalysis, onOpenSearch, isSidebarOpen, onToggleSidebar }) => {
    const { t } = useTranslation();
    
    return (
        <header className="h-14 flex-shrink-0 bg-white border-b border-slate-100 flex items-center justify-between px-6 no-print shadow-xs z-20 relative">
            <div className="flex items-center gap-3">
                 <button 
                     onClick={onToggleSidebar}
                     className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50/60 transition-all active:scale-95 duration-200"
                     title={isSidebarOpen ? "Skryť navigáciu" : "Zobraziť navigáciu"}
                     aria-label="Toggle Sidebar"
                 >
                     <Bars3Icon className="w-5 h-5" />
                 </button>
                 <SalesappVisionBrand className="h-7" />
                 <button 
                    onClick={onNewAnalysis} 
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-200 bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-200/50 hover:-translate-y-0.5 active:scale-95"
                >
                    <CalendarDaysIcon className="w-4 h-4" />
                    {t('newAnalysis')}
                </button>
            </div>

            {/* Quick Search Trigger Input (Command Palette style) */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onOpenSearch}
                    className="hidden md:flex items-center gap-3 px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100/80 text-slate-400 hover:text-slate-600 rounded-xl border border-slate-200/60 text-xs font-medium transition-all shadow-3xs group cursor-pointer"
                    title={t('searchInArchive')}
                >
                    <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    <span className="text-slate-500 font-medium">{t('searchInArchive') || 'Hľadať v archíve...'}</span>
                    <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold text-slate-500 bg-white rounded border border-slate-200 shadow-3xs">
                        ⌘K
                    </kbd>
                </button>

                <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-2xl border border-slate-200/60 shadow-3xs">
                    <LanguageSwitcher />
                    <div className="w-px h-4 bg-slate-200 mx-0.5"></div>
                    <button 
                        onClick={onOpenSearch} 
                        className="p-1.5 rounded-xl text-slate-500 hover:bg-white hover:text-blue-600 hover:shadow-2xs transition-all duration-200 active:scale-95 md:hidden" 
                        title={t('searchInArchive')}
                        aria-label="Search"
                    >
                        <MagnifyingGlassIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </header>
    );
};