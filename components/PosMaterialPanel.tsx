import React from 'react';
import { TagIcon } from './Icons.tsx';

export const PosMaterialPanel: React.FC = () => {
    return (
        <div className="bg-white dark:bg-zinc-900 p-12 rounded-[2rem] shadow-sm border border-gray-100 dark:border-zinc-800 text-center flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
            <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 w-24 h-24 rounded-3xl flex items-center justify-center mb-8 shadow-sm border border-purple-100/50 relative">
                <div className="absolute inset-0 bg-purple-400/20 blur-xl rounded-full"></div>
                <TagIcon className="w-10 h-10 text-purple-600 relative z-10" />
            </div>
            <h2 className="text-3xl font-black text-gray-900 dark:text-zinc-100 mb-4 tracking-tight">POS Materiály</h2>
            <p className="text-gray-500 dark:text-zinc-400 max-w-md mx-auto text-lg leading-relaxed mb-12">
                Tento modul slúži na sledovanie a vyhodnocovanie doplnkových vystavení ako sú stojany, palety a wobblery.
            </p>
            <div className="w-full max-w-2xl p-12 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-3xl bg-gray-50/50 dark:bg-zinc-900/60 flex flex-col items-center justify-center group hover:border-purple-200 hover:bg-purple-50/30 transition-all duration-500">
                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mb-4 group-hover:bg-purple-100 transition-colors duration-500">
                    <span className="text-gray-400 dark:text-zinc-500 group-hover:text-purple-500 font-black text-xl">🚧</span>
                </div>
                <span className="text-gray-400 dark:text-zinc-500 group-hover:text-purple-600 font-black uppercase tracking-[0.2em] text-sm transition-colors duration-500">
                    Modul v príprave
                </span>
            </div>
        </div>
    );
};