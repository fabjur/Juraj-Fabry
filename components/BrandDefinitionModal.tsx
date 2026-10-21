import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../i18n/index.tsx';
import type { BrandClassifications } from '../types.ts';
import { CloseIcon, CheckCircleIcon, SearchIcon, UserCircleIcon, UsersIcon } from './Icons.tsx';
import { getBrandMemory, saveBrandClassification } from '../db.ts';

interface BrandDefinitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (classifications: BrandClassifications) => void;
  allBrands: string[];
  brandProductsMap: Record<string, string[]>; // Mapovanie značky na zoznam nájdených produktov
}

export const BrandDefinitionModal: React.FC<BrandDefinitionModalProps> = ({ isOpen, onClose, onConfirm, allBrands, brandProductsMap = {} }) => {
  const { t } = useTranslation();
  const [selectedOurBrands, setSelectedOurBrands] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
        const initialize = async () => {
            const memory = await getBrandMemory();
            const knownOur = memory
                .filter(m => m.classification === 'our')
                .map(m => m.brand);
            
            const initialOur = new Set<string>();
            allBrands.forEach(brand => {
                if (knownOur.includes(brand)) {
                    initialOur.add(brand);
                }
            });
            
            setSelectedOurBrands(initialOur);
        };
        initialize();
    }
  }, [isOpen, allBrands]);

  const filteredBrands = useMemo(() => {
    return allBrands
        .filter(b => b.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => a.localeCompare(b));
  }, [allBrands, searchTerm]);

  const toggleBrand = (brand: string) => {
    setSelectedOurBrands(prev => {
        const next = new Set(prev);
        if (next.has(brand)) next.delete(brand);
        else next.add(brand);
        return next;
    });
  };

  const handleConfirm = async () => {
    const ourBrandsList = Array.from(selectedOurBrands);
    const competitorBrandsList = allBrands.filter(b => !selectedOurBrands.has(b));

    // Uložiť do trvalej pamäte pre budúce analýzy
    for (const brand of allBrands) {
        const classification = selectedOurBrands.has(brand) ? 'our' : 'competitor';
        await saveBrandClassification(brand, classification);
    }

    onConfirm({ ourBrands: ourBrandsList, competitorBrands: competitorBrandsList });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fade-in" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-4xl transform transition-all max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 dark:border-zinc-800">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-start bg-gray-50 dark:bg-zinc-800/60">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 flex items-center gap-3">
                <div className="p-2 bg-lime-100 rounded-xl">
                    <UsersIcon className="w-6 h-6 text-lime-700" />
                </div>
                {t('defineBrandsTitle')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mt-2 font-medium">
                Označte značky, ktoré patria vám. Ostatné budú automaticky vyhodnotené ako konkurencia.
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-400 dark:text-zinc-500 transition-colors">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-gray-50 bg-white dark:bg-zinc-900">
            <div className="relative">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-zinc-500" />
                <input 
                    type="text"
                    placeholder={t('searchBrand')}
                    className="w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-zinc-800 border-none rounded-2xl text-base focus:ring-2 focus:ring-lime-500 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                />
            </div>
        </div>

        {/* Brand Grid */}
        <div className="p-6 flex-grow overflow-y-auto bg-gray-50/30">
            {filteredBrands.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredBrands.map(brand => {
                        const isOur = selectedOurBrands.has(brand);
                        const products = (brandProductsMap && brandProductsMap[brand]) || [];
                        return (
                            <button
                                key={brand}
                                onClick={() => toggleBrand(brand)}
                                className={`group relative p-5 rounded-2xl border-2 transition-all duration-300 text-left flex flex-col h-full min-h-[120px] ${
                                    isOur 
                                    ? 'border-lime-500 bg-lime-50 shadow-lg shadow-lime-100 ring-1 ring-lime-500' 
                                    : 'border-white bg-white hover:border-gray-300 shadow-sm'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className={`p-2 rounded-xl transition-colors ${isOur ? 'bg-lime-500 text-white' : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'}`}>
                                        <UserCircleIcon className="w-5 h-5" />
                                    </div>
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isOur ? 'bg-lime-600 border-lime-600 text-white' : 'border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'}`}>
                                        {isOur && <CheckCircleIcon className="w-4 h-4" />}
                                    </div>
                                </div>
                                
                                <span className={`text-base font-bold truncate ${isOur ? 'text-lime-900' : 'text-gray-800'}`}>
                                    {brand}
                                </span>
                                
                                {/* Product Snippet */}
                                <div className="mt-2 flex-grow overflow-hidden">
                                    <p className={`text-[11px] leading-tight line-clamp-2 ${isOur ? 'text-lime-700/70' : 'text-gray-400'}`}>
                                        {products.length > 0 ? products.join(', ') : 'Žiadne produkty'}
                                    </p>
                                </div>

                                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800 w-full">
                                    <span className={`text-[10px] uppercase tracking-widest font-black ${isOur ? 'text-lime-600' : 'text-gray-400'}`}>
                                        {isOur ? 'NAŠA ZNAČKA' : 'KONKURENCIA'}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-20 flex flex-col items-center">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                        <SearchIcon className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-500 dark:text-zinc-400 font-medium">{t('noResultsFound')}</p>
                </div>
            )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
              <div className="bg-lime-50 px-4 py-2 rounded-2xl border border-lime-100">
                  <span className="text-sm font-bold text-lime-700">
                    {t('selectedItems', { count: selectedOurBrands.size })} naše značky
                  </span>
              </div>
              <button
                onClick={() => setSelectedOurBrands(new Set())}
                className="text-sm font-bold text-gray-400 dark:text-zinc-500 hover:text-red-500 transition-colors uppercase tracking-widest"
              >
                Zrušiť výber
              </button>
          </div>
          
          <button
              onClick={handleConfirm}
              className="w-full sm:w-auto px-12 py-4 bg-lime-600 text-white font-black rounded-2xl hover:bg-lime-500 shadow-xl shadow-lime-200 transition-all active:scale-95 text-base uppercase tracking-wider"
          >
              {t('confirmBrands')}
          </button>
        </div>
      </div>
    </div>
  );
};