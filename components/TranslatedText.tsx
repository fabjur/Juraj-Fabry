import React, { useState, useEffect } from 'react';
import { translateAnalysisText } from '../services/geminiService';

interface TranslatedTextProps {
  text: string;
  targetLanguage: string;
  className?: string;
  showOriginalToggle?: boolean;
}

export const TranslatedText: React.FC<TranslatedTextProps> = ({
  text,
  targetLanguage,
  className = '',
  showOriginalToggle = true
}) => {
  const [translatedText, setTranslatedText] = useState<string>(text);
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [showOriginal, setShowOriginal] = useState<boolean>(false);

  useEffect(() => {
    if (!text || !text.trim()) {
      setTranslatedText(text);
      return;
    }

    let isMounted = true;
    setIsTranslating(true);

    translateAnalysisText(text, targetLanguage)
      .then((res) => {
        if (isMounted) {
          setTranslatedText(res);
          setIsTranslating(false);
        }
      })
      .catch((err) => {
        console.error('Translation failed', err);
        if (isMounted) {
          setTranslatedText(text);
          setIsTranslating(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [text, targetLanguage]);

  const displayedText = showOriginal ? text : (translatedText || text);

  return (
    <div className="relative inline-block w-full">
      <span className={className}>
        {displayedText}
      </span>
      {isTranslating && (
        <span className="inline-block ml-2 text-[10px] text-lime-600 animate-pulse font-normal">
          🌐 (Prekladá sa... / Translating...)
        </span>
      )}
      {showOriginalToggle && text && translatedText && translatedText !== text && !isTranslating && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowOriginal(!showOriginal);
          }}
          className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-lime-600 hover:text-lime-800 underline transition-colors cursor-pointer select-none no-print"
          title={showOriginal ? 'Zobraziť preklad' : 'Zobraziť originál'}
        >
          🌐 {showOriginal ? 'Preklad' : 'Originál'}
        </button>
      )}
    </div>
  );
};
