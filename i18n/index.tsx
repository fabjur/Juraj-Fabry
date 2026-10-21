


import React, { createContext, useState, useContext, useCallback } from 'react';

import sk from './locales/sk.json';
import cs from './locales/cs.json';
import en from './locales/en.json';
import hu from './locales/hu.json';
import hr from './locales/hr.json';
import de from './locales/de.json';

// Define available languages
export const LANGUAGES: Record<string, { nativeName: string }> = {
  en: { nativeName: 'English' },
  sk: { nativeName: 'Slovenčina' },
  cs: { nativeName: 'Čeština' },
  hu: { nativeName: 'Magyar' },
  hr: { nativeName: 'Hrvatski' },
  de: { nativeName: 'Deutsch' },
};

type LanguageCode = keyof typeof LANGUAGES;

type AllTranslations = Record<LanguageCode, Record<string, string>>;

const translationsData: AllTranslations = {
  en: en as Record<string, string>,
  sk: sk as Record<string, string>,
  cs: cs as Record<string, string>,
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
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    try {
      const migrated = typeof window !== 'undefined' ? localStorage.getItem('app_lang_en_default_applied') : null;
      if (!migrated) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('app_lang_en_default_applied', 'true');
          const explicit = localStorage.getItem('app_language_explicit') === 'true';
          const saved = localStorage.getItem('app_language');
          if (!explicit || saved === 'sk') {
            localStorage.setItem('app_language', 'en');
            localStorage.removeItem('app_language_explicit');
            return 'en';
          }
        }
      }

      const isExplicit = typeof window !== 'undefined' ? localStorage.getItem('app_language_explicit') === 'true' : false;
      const saved = typeof window !== 'undefined' ? localStorage.getItem('app_language') : null;
      if (isExplicit && saved && LANGUAGES[saved]) {
        return saved as LanguageCode;
      }
    } catch {
      // ignore storage access errors
    }
    return 'en';
  });

  const setLanguage = (lang: LanguageCode) => {
    if (LANGUAGES[lang]) {
      setLanguageState(lang);
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('app_language', lang);
          localStorage.setItem('app_language_explicit', 'true');
          document.documentElement.lang = lang;
        }
      } catch {
        // ignore storage access errors
      }
    }
  };

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);
  
  const translations = React.useMemo(() => {
    try {
      if (translationsData && language && translationsData[language]) {
        return translationsData[language];
      }
      if (translationsData && translationsData.en) {
        return translationsData.en;
      }
      if (translationsData && translationsData.sk) {
        return translationsData.sk;
      }
    } catch {
      // ignore
    }
    return {} as Record<string, string>;
  }, [language]);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    if (!key) return '';
    try {
      const activeDict = translations || {};
      const enDict = translationsData?.en || {};
      const skDict = translationsData?.sk || {};

      let translation = activeDict[key] || enDict[key] || skDict[key] || key;
      if (params && typeof translation === 'string') {
        if ('count' in params && typeof params.count === 'number') {
          const pluralKey = `${key}_plural`;
          if (params.count !== 1) {
            const pluralTrans = activeDict[pluralKey] || enDict[pluralKey] || skDict[pluralKey];
            if (pluralTrans) {
              translation = pluralTrans;
            }
          }
        }
        Object.keys(params).forEach(paramKey => {
          translation = translation.replace(`{{${paramKey}}}`, String(params[paramKey]));
        });
      }
      return translation || key;
    } catch {
      return key;
    }
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