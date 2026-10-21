import React from 'react';
import { useTranslation } from '../i18n/index';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import { MagnifyingGlassIcon, CalendarDaysIcon, SalesappVisionBrand, Bars3Icon } from './Icons';

interface HeaderProps {
    onNewAnalysis?: () => void;
    onClearAnalysis?: () => void;
    activeView?: string;
    onNavigate?: (view: string) => void;
    activeAnalysis?: any;
    isSidebarOpen?: boolean;
    onToggleSidebar?: () => void;
    isImagesSidebarOpen?: boolean;
    onToggleImagesSidebar?: () => void;
    onOpenSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
    onNewAnalysis, 
    onClearAnalysis, 
    activeView,
    onNavigate,
    isSidebarOpen,
    onToggleSidebar,
    isImagesSidebarOpen, 
    onToggleImagesSidebar, 
    onOpenSearch 
}) => {
    const { t } = useTranslation();
    
    const handleToggle = onToggleSidebar || onToggleImagesSidebar;
    const isOpen = isSidebarOpen ?? isImagesSidebarOpen ?? false;
    
    return (
        <header className="h-13 flex-shrink-0 bg-white dark:bg-zinc-900 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between px-4 sm:px-5 no-print z-40 relative transition-colors duration-200">
            <div className="flex items-center gap-3">
                 <button 
                     onClick={handleToggle}
                     className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                         isOpen 
                             ? 'text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800' 
                             : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/60'
                     }`}
                     title={isOpen ? (t('hideNavigation') || "Hide navigation") : (t('showNavigation') || "Show navigation")}
                     aria-label="Toggle Sidebar"
                 >
                     <Bars3Icon className="w-4 h-4" />
                 </button>
                 <SalesappVisionBrand className="h-5" />
                 <button
                     onClick={onNewAnalysis || onClearAnalysis}
                     className="hidden sm:flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg transition-colors bg-zinc-900 dark:bg-lime-500 text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-lime-400 shadow-2xs active:scale-98 cursor-pointer ml-2"
                >
                    <CalendarDaysIcon className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-900" />
                    <span>{t('newAnalysis') || 'New Analysis'}</span>
                </button>
            </div>
            
            {/* Quick Search Trigger Input (Command Palette style) */}
            <div className="flex items-center gap-2 sm:gap-2.5">
                <div 
                    className="hidden lg:flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-medium"
                    title={t('offlineReadyTooltip') || "All audits, shelf photos, and catalog are safely stored in IndexedDB (Offline-Ready)."}
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Offline-Ready</span>
                </div>

                <button
                    onClick={() => onNavigate?.('chat')}
                    className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                        activeView === 'chat'
                            ? 'bg-zinc-900 dark:bg-lime-500 text-white dark:text-zinc-950 border-zinc-900 dark:border-lime-500 shadow-2xs'
                            : 'bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                    }`}
                    title={t('geminiChat') || "Gemini AI Assistant"}
                >
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-500" />
                    <span>Gemini AI</span>
                </button>

                <button
                    onClick={onOpenSearch}
                    className="hidden md:flex items-center gap-2 h-8 px-3 bg-zinc-50 dark:bg-zinc-800/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg border border-zinc-200/80 dark:border-zinc-700 text-xs transition-colors group cursor-pointer"
                    title={t('searchInArchive') || 'Search in archive...'}
                >
                    <MagnifyingGlassIcon className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" />
                    <span className="truncate max-w-[120px] lg:max-w-none">{t('searchInArchive') || 'Search in archive...'}</span>
                    <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.2 text-[10px] font-mono text-zinc-400 dark:text-zinc-400 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-700">
                        ⌘K
                    </kbd>
                </button>

                {/* Theme Switcher & Language Switcher Group */}
                <div className="flex items-center gap-1 bg-white dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors">
                    <ThemeSwitcher />
                    <div className="w-px h-3.5 bg-zinc-200 dark:bg-zinc-700 mx-0.5"></div>
                    <LanguageSwitcher />
                    <button 
                         onClick={onOpenSearch} 
                         className="p-1.5 rounded-md text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors md:hidden" 
                         title={t('searchInArchive')}
                        aria-label="Search"
                    >
                        <MagnifyingGlassIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </header>
    );
};
