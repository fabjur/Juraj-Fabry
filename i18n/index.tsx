


import React, { createContext, useState, useContext, useCallback } from 'react';

import sk from './locales/sk.json';
import cs from './locales/cs.json';
import en from './locales/en.json';
import hu from './locales/hu.json';
import hr from './locales/hr.json';
import de from './locales/de.json';

// Define available languages
export const LANGUAGES: Record<string, { nativeName: string }> = {
  sk: { nativeName: 'Slovenčina' },
  cs: { nativeName: 'Čeština' },
  en: { nativeName: 'English' },
  hu: { nativeName: 'Magyar' },
  hr: { nativeName: 'Hrvatski' },
  de: { nativeName: 'Deutsch' },
};

type LanguageCode = keyof typeof LANGUAGES;

type AllTranslations = Record<LanguageCode, Record<string, string>>;

const translationsData: AllTranslations = {
  sk: sk as Record<string, string>,
  cs: cs as Record<string, string>,
  en: en as Record<string, string>,
  hu: hu as Record<string, string>,
  hr: hr as Record<string, string>,
  de: de as Record<string, string>,
};

// Define the shape of the context
interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// Create the context
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Define the provider component
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>('sk');

  const setLanguage = (lang: LanguageCode) => {
    if (LANGUAGES[lang]) {
      setLanguageState(lang);
    }
  };
  
  const translations = React.useMemo(() => translationsData[language] || translationsData.sk, [language]);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
      let translation = translations[key] || translationsData.sk[key] || key;
      if (params) {
          if ('count' in params && typeof params.count === 'number') {
              const pluralKey = `${key}_plural`;
              if (params.count !== 1 && translations[pluralKey]) {
                  translation = translations[pluralKey];
              }
          }
          Object.keys(params).forEach(paramKey => {
              translation = translation.replace(`{{${paramKey}}}`, String(params[paramKey]));
          });
      }
      return translation;
  }, [translations]);

  const value = { language, setLanguage, t };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// Custom hook for using the translation context
export const useTranslation = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};