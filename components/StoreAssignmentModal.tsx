import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from '../i18n';
import type { Store } from '../types';
import { BuildingStorefrontIcon, CloseIcon, TagIcon } from './Icons';
import { getStores, addStore } from '../db';

interface StoreAssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAssign: (store: Store) => void;
    imagesCount: number;
}

export const StoreAssignmentModal: React.FC<StoreAssignmentModalProps> = ({ isOpen, onClose, onAssign, imagesCount }) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    
    // New Store Form Data
    const [newStoreData, setNewStoreData] = useState<Store>({ name: '', chain: '', city: '', address: '', code: '' });

    const rawStores = useLiveQuery(() => getStores(), []);
    const stores = useMemo(() => {
        return rawStores ? [...rawStores].sort((a, b) => a.name.localeCompare(b.name)) : [];
    }, [rawStores]);

    useEffect(() => {
        if (isOpen) {
            // Reset state
            setSearchTerm('');
            setIsCreatingNew(false);
            setNewStoreData({ name: '', chain: '', city: '', address: '', code: '' });
        }
    }, [isOpen]);

    const filteredStores = useMemo(() => {
        if (!searchTerm) return stores;
        const lowerTerm = searchTerm.toLowerCase();
        return stores.filter(s => 
            s.name.toLowerCase().includes(lowerTerm) || 
            (s.code && s.code.toLowerCase().includes(lowerTerm))
        );
    }, [stores, searchTerm]);

    const handleCreateNew = async () => {
        if (!newStoreData.name.trim()) {
            alert(t('storeNameRequired'));
            return;
        }
        const id = await addStore(newStoreData);
        // Important: Return store with ID so we can link it
        onAssign({ ...newStoreData, id });
    };
    
    const handleSelect = (store: Store) => {
        onAssign(store);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg transform transition-all flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                    <div className="flex justify-between items-start">
                         <div>
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <BuildingStorefrontIcon className="w-6 h-6 text-lime-600" />
                                {t('assignStoreTitle')}
                            </h2>
                            <p className="text-sm text-gray-600 mt-1">{t('assignStoreSubtitle', { count: imagesCount })}</p>
                         </div>
                         <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <CloseIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-6 flex-grow overflow-y-auto">
                    {!isCreatingNew ? (
                        <>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('searchStore')}</label>
                                <input
                                    type="text"
                                    className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-lime-500 sm:text-sm sm:leading-6"
                                    placeholder={t('searchStorePlaceholder')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            
                            <div className="space-y-2 mb-4">
                                {filteredStores.length > 0 ? (
                                    <ul className="divide-y divide-gray-100 border border-gray-200 rounded-md max-h-60 overflow-y-auto">
                                        {filteredStores.map(store => (
                                            <li key={store.id} onClick={() => handleSelect(store)} className="p-3 hover:bg-lime-50 cursor-pointer transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <p className="font-semibold text-gray-800 text-sm">{store.name}</p>
                                                    {store.code && <span className="text-xs bg-gray-100 px-1.5 rounded border text-gray-600">#{store.code}</span>}
                                                </div>
                                                <p className="text-xs text-gray-500">{store.chain || '-'} | {store.city || '-'}</p>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-gray-500 italic text-center py-4">{t('noStoresFound')}</p>
                                )}
                            </div>

                            <button 
                                onClick={() => { setIsCreatingNew(true); setNewStoreData(prev => ({ ...prev, name: searchTerm })); }}
                                className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-lime-700 bg-lime-100 hover:bg-lime-200"
                            >
                                {t('createNewStore')}
                            </button>
                        </>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">{t('storeName')} *</label>
                                    <input type="text" value={newStoreData.name} onChange={e => setNewStoreData({...newStoreData, name: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-lime-500 focus:ring-lime-500 sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('storeCode')}</label>
                                    <div className="relative mt-1 rounded-md shadow-sm">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <TagIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
                                        </div>
                                        <input 
                                            type="text" 
                                            value={newStoreData.code || ''} 
                                            onChange={e => setNewStoreData({...newStoreData, code: e.target.value})} 
                                            className="block w-full rounded-md border-gray-300 pl-10 focus:border-lime-500 focus:ring-lime-500 sm:text-sm" 
                                            placeholder={t('storeCodePlaceholder')}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('chain')}</label>
                                    <input type="text" value={newStoreData.chain} onChange={e => setNewStoreData({...newStoreData, chain: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-lime-500 focus:ring-lime-500 sm:text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('city')}</label>
                                    <input type="text" value={newStoreData.city} onChange={e => setNewStoreData({...newStoreData, city: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-lime-500 focus:ring-lime-500 sm:text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('address')}</label>
                                <input type="text" value={newStoreData.address} onChange={e => setNewStoreData({...newStoreData, address: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-lime-500 focus:ring-lime-500 sm:text-sm" />
                            </div>
                            
                            <div className="flex justify-end gap-3 mt-4">
                                <button onClick={() => setIsCreatingNew(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">{t('back')}</button>
                                <button onClick={handleCreateNew} className="px-4 py-2 text-sm bg-lime-600 text-white hover:bg-lime-700 rounded-md font-semibold">{t('createAndAssign')}</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
