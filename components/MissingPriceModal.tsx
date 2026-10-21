

import React, { useState } from 'react';
import { useTranslation } from '../i18n/index.tsx';
import { CloseIcon, SaveIcon, TagIcon } from './Icons.tsx';
import type { PriceInfo } from '../types.ts';
import { parsePrice } from '../utils/priceIntegrity.ts';

export interface MissingPriceItem {
    imageId: string;
    productId: string;
    name: string;
    imageUrl: string;
    cropUrl?: string; // Potential future enhancement for cropping product box
}

interface MissingPriceModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: MissingPriceItem[];
    onSave: (updates: { imageId: string; productId: string; prices: PriceInfo[] }[]) => void;
}

export const MissingPriceModal: React.FC<MissingPriceModalProps> = ({ isOpen, onClose, items, onSave }) => {
    const { t } = useTranslation();
    // State to store inputs: key = `${imageId}-${productId}`, value = { regular: string, promo: string }
    const [inputs, setInputs] = useState<Record<string, { regular: string, promo: string }>>({});
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleInputChange = (key: string, field: 'regular' | 'promo', value: string) => {
        setInputs(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value
            }
        }));
    };

    const handleSave = () => {
        const updates: { imageId: string; productId: string; prices: PriceInfo[] }[] = [];

        items.forEach(item => {
            const key = `${item.imageId}-${item.productId}`;
            const input = inputs[key];

            if (input && (input.regular || input.promo)) {
                const prices: PriceInfo[] = [];
                
                if (input.regular) {
                    const regNum = parsePrice(input.regular);
                    if (regNum !== null && regNum > 0) {
                        prices.push({
                            value: `${regNum.toFixed(2)} €`,
                            type: 'REGULAR'
                        });
                    }
                }
                
                if (input.promo) {
                    const promoNum = parsePrice(input.promo);
                    if (promoNum !== null && promoNum > 0) {
                        prices.push({
                            value: `${promoNum.toFixed(2)} €`,
                            type: 'PROMO'
                        });
                    }
                }

                if (prices.length > 0) {
                    updates.push({
                        imageId: item.imageId,
                        productId: item.productId,
                        prices: prices
                    });
                }
            }
        });

        onSave(updates);
        onClose();
        setInputs({}); // Clear state
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-100 dark:border-zinc-800">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-start bg-slate-50/50 dark:bg-zinc-900/60">
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                            <TagIcon className="w-5 h-5 text-orange-500" />
                            {t('missingPricesTitle') || "Doplniť chýbajúce ceny"}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-1">
                            {t('missingPricesSubtitle', { count: items.length }) || `Bolo nájdených ${items.length} produktov bez priradenej ceny. Doplnením cien zaistíte presné štatistiky.`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-500 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
                        <CloseIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-grow custom-scrollbar">
                    <div className="space-y-3">
                        {items.map((item) => {
                            const key = `${item.imageId}-${item.productId}`;
                            const currentInput = inputs[key] || { regular: '', promo: '' };

                            return (
                                <div key={key} className="flex flex-col sm:flex-row gap-4 p-4 border border-slate-100 dark:border-zinc-800 rounded-2xl hover:bg-slate-50/50 transition-colors items-center">
                                    {/* Thumbnail with Click to Zoom */}
                                    <div 
                                        onClick={() => setZoomedImage(item.imageUrl)}
                                        className="w-14 h-14 flex-shrink-0 bg-slate-150 rounded-xl overflow-hidden shadow-xs border border-slate-100 dark:border-zinc-800 cursor-zoom-in relative group transition-all duration-250 hover:border-lime-400"
                                        title="Zväčšiť náhľad"
                                    >
                                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" referrerPolicy="no-referrer" />
                                        <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold">
                                            🔍
                                        </div>
                                    </div>

                                    {/* Product Name */}
                                    <div className="flex-grow text-left min-w-0">
                                        <p className="font-extrabold text-slate-800 dark:text-zinc-200 text-sm truncate">{item.name}</p>
                                        <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold uppercase tracking-wider truncate mt-0.5">ID: {item.productId}</p>
                                    </div>

                                    {/* Inputs */}
                                    <div className="flex gap-3 flex-shrink-0">
                                        <div className="flex flex-col">
                                            <label className="text-[9px] text-slate-400 dark:text-zinc-500 uppercase font-black tracking-widest mb-1.5">{t('regularPrice')}</label>
                                            <input 
                                                type="text" 
                                                className="w-24 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-800 dark:text-zinc-200 px-3 py-2 focus:ring-1 focus:ring-lime-500 focus:border-transparent transition-all shadow-inner"
                                                placeholder="0.00"
                                                value={currentInput.regular}
                                                onChange={(e) => handleInputChange(key, 'regular', e.target.value)}
                                            />
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-[9px] text-red-500 uppercase font-black tracking-widest mb-1.5">{t('promoPrice')}</label>
                                            <input 
                                                type="text" 
                                                className="w-24 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-bold text-red-700 px-3 py-2 bg-red-50/20 focus:ring-1 focus:ring-red-500 focus:border-transparent transition-all shadow-inner"
                                                placeholder="0.00"
                                                value={currentInput.promo}
                                                onChange={(e) => handleInputChange(key, 'promo', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 flex justify-end gap-3">
                    <button 
                        onClick={onClose} 
                        className="px-5 py-2.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-600 dark:text-zinc-400 hover:text-slate-800 hover:bg-slate-50 dark:hover:bg-zinc-800/60 text-xs font-black uppercase tracking-wider transition-colors active:scale-95"
                    >
                        {t('cancelButton')}
                    </button>
                    <button 
                        onClick={handleSave} 
                        className="px-5 py-2.5 bg-lime-600 text-white rounded-xl hover:bg-lime-700 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md shadow-lime-200/50 active:scale-95 hover:-translate-y-0.5"
                    >
                        <SaveIcon className="w-3.5 h-3.5" />
                        {t('save')}
                    </button>
                </div>
            </div>

            {/* Zoombable Preview Overlay */}
            {zoomedImage && (
                <div 
                    className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
                    onClick={() => setZoomedImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden border border-white/20 shadow-2xl bg-white dark:bg-zinc-900 select-none">
                        <img 
                            src={zoomedImage} 
                            alt="Zoomed Product" 
                            className="max-w-full max-h-[80vh] object-contain cursor-zoom-out" 
                            referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-4 right-4 bg-slate-900/60 backdrop-blur-md text-white px-3 py-1 text-[10px] font-black tracking-wider uppercase rounded-full">
                            Kliknutím zatvorte
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
