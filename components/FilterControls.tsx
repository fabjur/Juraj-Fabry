import React from 'react';
import { SearchIcon, ShieldExclamationIcon } from './Icons.tsx';
import { useTranslation } from '../i18n/index.tsx';
import type { PosType } from '../types.ts';

export interface Filters {
  searchTerm: string;
  minPrice: number | '';
  maxPrice: number | '';
  confidence: number;
  category: string;
  chain: string;
  // Nové filtre
  posFilter?: 'all' | 'products_only' | 'pos_only' | PosType;
  hideGhosts?: boolean;
}

interface FilterControlsProps {
  filters: Filters;
  onFilterChange: (filters: Filters) => void;
  searchPlaceholder: string;
  categories?: string[];
  chains?: string[];
}

export const FilterControls: React.FC<FilterControlsProps> = ({ filters, onFilterChange, searchPlaceholder, categories, chains }) => {
  const { t } = useTranslation();
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    onFilterChange({ ...filters, [name]: val });
  };
  
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onFilterChange({ ...filters, [name]: value === '' ? '' : parseFloat(value) });
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ ...filters, confidence: parseInt(e.target.value, 10) });
  };

  return (
    <div className="bg-slate-50/60 dark:bg-zinc-900/70 p-2.5 rounded-xl mb-3 space-y-2 shadow-sm border border-gray-205 dark:border-zinc-800 backdrop-blur-xs">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
        {/* Search Input */}
        <div className="relative group">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <SearchIcon className="h-4 w-4 text-gray-400 dark:text-zinc-500 group-focus-within:text-lime-500 transition-colors" />
          </span>
          <input
            type="text"
            id="searchTerm"
            name="searchTerm"
            value={filters.searchTerm}
            onChange={handleInputChange}
            placeholder={searchPlaceholder}
            className="block w-full rounded-xl border-none bg-white dark:bg-zinc-800 py-1.5 pl-9 pr-3 text-gray-950 dark:text-zinc-100 ring-1 ring-inset ring-gray-200 dark:ring-zinc-700 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:ring-2 focus:ring-inset focus:ring-lime-500 text-xs font-bold shadow-xs transition-all"
          />
        </div>

        {/* POS Material Filter */}
        <div>
            <select
                id="posFilter"
                name="posFilter"
                value={filters.posFilter || 'all'}
                onChange={handleInputChange}
                className="block w-full rounded-xl border-none bg-white dark:bg-zinc-800 py-1.5 pl-3 pr-8 text-gray-950 dark:text-zinc-100 ring-1 ring-inset ring-gray-200 dark:ring-zinc-700 focus:ring-2 focus:ring-inset focus:ring-lime-500 text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
                <option value="all">{t('allObjects')}</option>
                <option value="products_only">{t('productsOnly')}</option>
                <option value="pos_only">{t('posOnly')}</option>
                <option value="wobbler">{t('posWobbler')}</option>
                <option value="stopper">{t('posStopper')}</option>
                <option value="stand">{t('posStand')}</option>
                <option value="pallet">{t('posPallet')}</option>
            </select>
        </div>

        {/* Category Filter */}
        {categories && categories.length > 0 && (
            <div>
                 <select
                    id="category"
                    name="category"
                    value={filters.category}
                    onChange={handleInputChange}
                    className="block w-full rounded-xl border-none bg-white dark:bg-zinc-800 py-1.5 pl-3 pr-8 text-gray-950 dark:text-zinc-100 ring-1 ring-inset ring-gray-200 dark:ring-zinc-700 focus:ring-2 focus:ring-inset focus:ring-lime-500 text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                    <option value="">{t('allCategories')}</option>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
            </div>
        )}

        {/* Chain Filter */}
        {chains && chains.length > 0 && (
            <div>
                <select
                    id="chain"
                    name="chain"
                    value={filters.chain}
                    onChange={handleInputChange}
                    className="block w-full rounded-xl border-none bg-white dark:bg-zinc-800 py-1.5 pl-3 pr-8 text-gray-950 dark:text-zinc-100 ring-1 ring-inset ring-gray-200 dark:ring-zinc-700 focus:ring-2 focus:ring-inset focus:ring-lime-500 text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                    <option value="">{t('allChains')}</option>
                    {chains.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
        )}
      </div>


      <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-0.5">
        {/* Ghost Toggle */}
        <label className="relative inline-flex items-center cursor-pointer group bg-white dark:bg-zinc-800 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 shadow-xs hover:border-lime-200 transition-colors">
            <input 
                type="checkbox" 
                name="hideGhosts" 
                checked={filters.hideGhosts} 
                onChange={handleInputChange} 
                className="sr-only peer" 
            />
            <div className="relative w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-200 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-lime-500"></div>
            <span className="ms-2 text-[10px] font-bold text-gray-600 dark:text-zinc-300 group-hover:text-gray-950 dark:group-hover:text-white flex items-center gap-1.5 whitespace-nowrap">
                {t('hideGhostProducts')}
                <ShieldExclamationIcon className="w-3 h-3 text-amber-500" />
            </span>
        </label>

        {/* Confidence Slider */}
        <div className="flex-grow flex items-center gap-2.5 bg-white dark:bg-zinc-800 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 shadow-xs w-full sm:w-auto">
          <label htmlFor="confidence" className="text-[9px] font-bold text-gray-400 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">
            {t('minConfidence', { confidence: filters.confidence })}
          </label>
          <input
            id="confidence"
            type="range"
            min="0"
            max="100"
            value={filters.confidence}
            onChange={handleSliderChange}
            className="w-full h-1 bg-gray-150 rounded-lg appearance-none cursor-pointer accent-lime-500 hover:accent-lime-600 transition-all"
          />
        </div>

        {/* Price Filter */}
        <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 shadow-xs">
          <input
            type="number"
            name="minPrice"
            value={filters.minPrice}
            onChange={handlePriceChange}
            placeholder="Min €"
            className="w-14 border-none p-0 text-center focus:ring-0 font-bold text-xs placeholder:text-gray-300 dark:placeholder:text-zinc-500 text-gray-950 dark:text-zinc-100 bg-transparent"
          />
          <span className="text-gray-300 font-bold text-xs">-</span>
          <input
            type="number"
            name="maxPrice"
            value={filters.maxPrice}
            onChange={handlePriceChange}
            placeholder="Max €"
            className="w-14 border-none p-0 text-center focus:ring-0 font-bold text-xs placeholder:text-gray-300 dark:placeholder:text-zinc-500 text-gray-950 dark:text-zinc-100 bg-transparent"
          />
        </div>
      </div>
    </div>
  );
};