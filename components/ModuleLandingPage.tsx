import React from 'react';
import { useTranslation } from '../i18n/index.tsx';
import { RocketLaunchIcon, HistoryIcon } from './Icons.tsx';

interface ModuleLandingPageProps {
    type: string;
    onStart: () => void;
    onLoad: () => void;
}

export const ModuleLandingPage: React.FC<ModuleLandingPageProps> = ({ type, onStart, onLoad }) => {
    const { t } = useTranslation();
    
    const getTitle = () => {
        if (type === 'priceMonitoring') return t('priceMonitoring');
        if (type === 'shelfShare') return t('shelfShare');
        if (type === 'promoAlert') return t('promoAlert');
        return t('newAnalysis');
    };

    return (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="bg-lime-100 p-6 rounded-full mb-8">
                <RocketLaunchIcon className="w-12 h-12 text-lime-600" />
            </div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-zinc-100 mb-4">{getTitle()}</h2>
            <p className="text-gray-500 dark:text-zinc-400 max-w-lg mb-10 leading-relaxed font-medium">
                {t('noActiveAnalysisDesc') || 'No active analysis loaded. You can start a new store visit or load an older record from archive for comparison.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
                <button 
                    onClick={onStart}
                    className="px-8 py-4 bg-lime-600 text-white font-black rounded-2xl hover:bg-lime-500 shadow-xl shadow-lime-100 transition-all active:scale-95 uppercase tracking-widest text-sm flex items-center gap-3"
                >
                    <RocketLaunchIcon className="w-5 h-5" />
                    {t('startNewAnalysis')}
                </button>
                <button 
                    onClick={onLoad}
                    className="px-8 py-4 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 font-black rounded-2xl hover:bg-gray-50 dark:hover:bg-zinc-800/60 border border-gray-200 dark:border-zinc-800 transition-all active:scale-95 uppercase tracking-widest text-sm flex items-center gap-3"
                >
                    <HistoryIcon className="w-5 h-5" />
                    {t('openFromArchive')}
                </button>
            </div>
        </div>
    );
};