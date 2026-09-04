


import React from 'react';
import { useTranslation, LANGUAGES } from '../i18n/index.tsx';

export const LanguageSwitcher: React.FC = () => {
    const { language, setLanguage } = useTranslation();

    return (
        <div className="relative group">
            <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as keyof typeof LANGUAGES)}
                className="block appearance-none w-full bg-transparent border-none text-gray-600 font-black uppercase tracking-widest py-2 pl-4 pr-10 rounded-2xl leading-tight focus:outline-none focus:ring-0 text-xs cursor-pointer hover:text-gray-900 transition-colors"
                aria-label="Select language"
            >
                {Object.entries(LANGUAGES).map(([code, { nativeName }]) => (
                    <option key={code} value={code} className="text-gray-900 font-bold uppercase tracking-widest">
                        {nativeName}
                    </option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 group-hover:text-gray-600 transition-colors">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
            </div>
        </div>
    );
};