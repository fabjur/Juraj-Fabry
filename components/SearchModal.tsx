


import React, { useState, useEffect } from 'react';
import { useTranslation } from '../i18n/index.tsx';
import type { SearchResult } from '../types.ts';
// FIX: Re-importing icons to ensure all exports are recognized. The issue appears to be with module resolution, not the import path or component names themselves.
import { CloseIcon, MagnifyingGlassIcon, SpinnerIcon, FolderOpenIcon } from './Icons.tsx';
import { searchAnalyses } from '../db.ts';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadAnalysis: (id: string) => void;
}

const Highlighted: React.FC<{ text: string, highlight: string }> = ({ text, highlight }) => {
    if (!highlight.trim()) {
        return <span>{text}</span>;
    }
    const regex = new RegExp(`(${highlight.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <strong key={i} className="font-bold text-gray-800 bg-lime-200">{part}</strong>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </span>
    );
};

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onLoadAnalysis }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setResults([]);
      return;
    }

    const handler = setTimeout(async () => {
      if (searchTerm.trim().length > 1) {
        setIsLoading(true);
        const searchResults = await searchAnalyses(searchTerm.trim());
        setResults(searchResults);
        setIsLoading(false);
      } else {
        setResults([]);
      }
    }, 300); // Debounce search

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-start justify-center z-50 p-4 pt-20" role="dialog" aria-modal="true">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl transform transition-all flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('searchInArchivePlaceholder')}
              className="block w-full rounded-md border-0 bg-white py-2 pl-10 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-lime-500 sm:text-sm sm:leading-6"
              autoFocus
            />
             <button onClick={onClose} className="absolute inset-y-0 right-0 flex items-center pr-3" aria-label={t('close')}>
              <CloseIcon className="w-5 h-5 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
        </div>
        <div className="p-4 flex-grow overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <SpinnerIcon className="w-8 h-8 text-lime-500" />
            </div>
          ) : results.length > 0 ? (
            <ul className="space-y-3">
              {results.map(({ analysis, matches }) => (
                <li key={analysis.id} className="bg-gray-50 p-3 rounded-md hover:bg-gray-100 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900">{analysis.name}</p>
                      <p className="text-xs text-gray-500">
                        {t('createdAt')}: {new Date(analysis.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button onClick={() => onLoadAnalysis(analysis.id)} title={t('load')} className="p-2 text-gray-500 hover:text-lime-600 rounded-full hover:bg-lime-100 transition-colors flex-shrink-0">
                      <FolderOpenIcon className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="mt-2 pl-4 border-l-2 border-gray-200 space-y-1">
                    {matches.map((match, index) => {
                        let matchTypeKey = '';
                        switch (match.type) {
                            case 'analysis_name': matchTypeKey = 'foundInAnalysisName'; break;
                            case 'product_name': matchTypeKey = 'foundInProductName'; break;
                            case 'product_brand': matchTypeKey = 'foundInProductBrand'; break;
                            case 'store_name': matchTypeKey = 'foundInStoreName'; break;
                            case 'store_chain': matchTypeKey = 'foundInStoreChain'; break;
                            case 'product_alias': matchTypeKey = 'foundInProductAlias'; break;
                            case 'manufacturer': matchTypeKey = 'foundInManufacturer'; break;
                        }
                        return (
                            <div key={index} className="text-xs text-gray-600">
                                <span className="font-semibold">{t(matchTypeKey)}: </span>
                                <Highlighted text={match.context} highlight={searchTerm} />
                            </div>
                        )
                    })}
                  </div>
                </li>
              ))}
            </ul>
          ) : searchTerm.trim().length > 1 ? (
            <div className="text-center py-10 text-sm text-gray-500">{t('noResultsFound')}</div>
          ) : (
             <div className="text-center py-10 text-sm text-gray-500">{t('searchInArchivePlaceholder')}</div>
          )}
        </div>
      </div>
    </div>
  );
};