
import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from '../i18n/index.tsx';
import { 
    ClipboardDocumentListIcon, 
    UploadIcon, 
    TrashIcon, 
    SpinnerIcon, 
    CameraIcon, 
    LightBulbIcon, 
    CloseIcon,
    TagIcon,
    ShieldCheckIcon,
    ArrowPathIcon,
    PlusIcon
} from './Icons.tsx';
import { addCatalogEntry, updateCatalogEntry, deleteCatalogEntry, getCatalogEntries } from '../db.ts';
import { ProductCatalogEntry } from '../types.ts';
import { fileToBase64, resizeAndCompressImage } from '../utils/helpers.ts';
import { createVisualFingerprint } from '../services/geminiService.ts';

export const ListingPanel: React.FC = () => {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isTraining, setIsTraining] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Form State
    const [currentId, setCurrentId] = useState<number | undefined>(undefined);
    const [formData, setFormData] = useState({
        manufacturer: '',
        productName: '',
        sku: '',
        category: '',
    });
    const [aliases, setAliases] = useState<string[]>([]);
    const [currentAliasInput, setCurrentAliasInput] = useState('');
    const [uploadedImages, setUploadedImages] = useState<string[]>([]); // Base64 strings

    const rawEntries = useLiveQuery(() => getCatalogEntries());
    const entries = rawEntries ? [...rawEntries].sort((a, b) => a.canonicalName.localeCompare(b.canonicalName)) : [];

    useEffect(() => {
        if (rawEntries !== undefined) {
            setIsLoading(false);
        }
    }, [rawEntries]);

    const resetForm = () => {
        setFormData({ manufacturer: '', productName: '', sku: '', category: '' });
        setAliases([]);
        setCurrentAliasInput('');
        setUploadedImages([]);
        setCurrentId(undefined);
        setIsEditing(false);
    };

    const handleEdit = (entry: ProductCatalogEntry) => {
        setFormData({
            manufacturer: entry.manufacturer || '',
            productName: entry.canonicalName,
            sku: entry.sku || '',
            category: entry.category || '',
        });
        setAliases(entry.aliases || []);
        setUploadedImages(entry.referenceImages || []);
        setCurrentId(entry.id);
        setIsEditing(true);
    };

    const handleDelete = async (id: number) => {
        if (window.confirm(t('deleteProductConfirm'))) {
            await deleteCatalogEntry(id);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            setIsLoading(true);
            const newImages: string[] = [];
            for (let i = 0; i < files.length; i++) {
                try {
                    const compressedFile = await resizeAndCompressImage(files[i]);
                    const base64 = await fileToBase64(compressedFile);
                    newImages.push(base64);
                } catch (err) {
                    console.error("Error processing image:", err);
                }
            }
            setUploadedImages(prev => [...prev, ...newImages]);
            setIsLoading(false);
        }
        e.target.value = '';
    };

    const removeImage = (index: number) => {
        setUploadedImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddAlias = () => {
        const trimmed = currentAliasInput.trim();
        if (trimmed && !aliases.includes(trimmed)) {
            setAliases([...aliases, trimmed]);
            setCurrentAliasInput('');
        }
    };

    const removeAlias = (aliasToRemove: string) => {
        setAliases(aliases.filter(a => a !== aliasToRemove));
    };

    const handleSave = async () => {
        if (!formData.productName.trim()) {
            alert(t('productNameRequired'));
            return;
        }

        setIsTraining(true);
        let visualFeatures = '';

        if (uploadedImages.length > 0) {
            try {
                visualFeatures = await createVisualFingerprint(formData.productName, uploadedImages);
            } catch (error) {
                console.error("Failed to generate visual fingerprint:", error);
            }
        }

        const entryData: ProductCatalogEntry = {
            id: currentId,
            canonicalName: formData.productName,
            manufacturer: formData.manufacturer,
            sku: formData.sku,
            category: formData.category,
            aliases: aliases,
            visualFeatures: visualFeatures || (entries.find(e => e.id === currentId)?.visualFeatures),
            referenceImages: uploadedImages
        };

        if (currentId) {
            await updateCatalogEntry(currentId, entryData);
        } else {
            await addCatalogEntry(entryData);
        }

        setIsTraining(false);
        resetForm();
    };

    const filteredEntries = entries.filter(e => 
        e.canonicalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto flex flex-col h-full animate-fade-in pb-10">
            {/* Page Header */}
            <div className="flex justify-between items-end mb-8 bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-lime-100 to-emerald-100 rounded-2xl shadow-sm">
                            <ClipboardDocumentListIcon className="w-8 h-8 text-lime-600" />
                        </div>
                        {t('listing')}
                    </h2>
                    <p className="text-gray-500 text-base mt-2 font-medium">Správa kmeňových dát a vizuálny tréning AI modelov.</p>
                </div>
                {!isEditing && (
                    <button onClick={() => setIsEditing(true)} className="bg-lime-600 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-lime-700 transition-all flex items-center gap-3 shadow-xl shadow-lime-200 active:scale-95">
                        <UploadIcon className="w-6 h-6" /> {t('addProduct')}
                    </button>
                )}
            </div>

            <div className="flex flex-col lg:flex-row gap-8 flex-grow overflow-hidden min-h-[600px]">
                {/* Left: Product List Side */}
                <div className={`w-full lg:w-2/5 flex flex-col gap-6 ${isEditing ? 'hidden lg:flex' : 'flex'}`}>
                    <div className="relative">
                        <input 
                            type="text"
                            placeholder="Vyhľadať v listingu..."
                            className="w-full bg-white border-none rounded-[2rem] py-4 pl-14 pr-6 shadow-sm text-sm font-bold focus:ring-2 focus:ring-lime-500 transition-shadow"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400">
                            <ArrowPathIcon className="w-5 h-5" />
                        </div>
                    </div>

                    <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden flex-grow flex flex-col">
                        <div className="p-5 bg-gray-50/50 border-b border-gray-100 flex justify-between items-center">
                            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Zoznam SKU (Total: {entries.length})</span>
                        </div>
                        
                        <div className="overflow-y-auto flex-grow custom-scrollbar">
                            {isLoading ? (
                                <div className="flex justify-center p-20"><SpinnerIcon className="w-12 h-12 text-lime-500 animate-spin" /></div>
                            ) : filteredEntries.length === 0 ? (
                                <div className="p-20 text-center flex flex-col items-center gap-5">
                                    <div className="p-6 bg-gray-50 rounded-full">
                                        <TagIcon className="w-14 h-14 text-gray-300" />
                                    </div>
                                    <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">{t('noProductsInListing')}</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {filteredEntries.map(entry => (
                                        <div 
                                            key={entry.id} 
                                            className="p-5 hover:bg-lime-50/60 transition-colors cursor-pointer flex justify-between items-start group" 
                                            onClick={() => handleEdit(entry)}
                                        >
                                            <div className="min-w-0 flex-grow">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <p className="font-bold text-gray-900 truncate text-base group-hover:text-lime-700 transition-colors">{entry.canonicalName}</p>
                                                    {entry.visualFeatures && (
                                                        <div className="bg-gradient-to-br from-lime-400 to-emerald-500 rounded-full p-1 shadow-sm" title="AI Trained">
                                                            <ShieldCheckIcon className="w-3.5 h-3.5 text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{entry.manufacturer || 'Neznámy výrobca'}</span>
                                                    {entry.sku && (
                                                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg leading-none uppercase border border-blue-100">SKU: {entry.sku}</span>
                                                    )}
                                                    {entry.category && (
                                                        <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg leading-none uppercase border border-gray-200">{entry.category}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDelete(entry.id!); }}
                                                className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Detailed Editor / Empty State */}
                <div className={`w-full lg:w-3/5 ${!isEditing ? 'hidden lg:flex items-center justify-center bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-200' : 'flex flex-col'}`}>
                    {!isEditing ? (
                        <div className="text-center p-10 flex flex-col items-center gap-5">
                            <div className="bg-white p-8 rounded-full shadow-sm">
                                <PlusIcon className="w-16 h-16 text-gray-300" />
                            </div>
                            <div>
                                <p className="text-gray-500 font-black text-xl tracking-tight">{t('selectProductToEdit')}</p>
                                <p className="text-gray-400 text-sm mt-2 font-medium">Kliknite na produkt vľavo pre úpravu alebo vytvorte nový.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 flex flex-col h-full overflow-hidden">
                            {/* Editor Header */}
                            <div className="p-8 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">
                                        {currentId ? 'Úprava produktu' : 'Nový produkt'}
                                    </h3>
                                    {currentId && <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest mt-1 block">ID: #{currentId}</span>}
                                </div>
                                <button onClick={resetForm} className="p-3 hover:bg-gray-200 rounded-2xl text-gray-400 transition-colors">
                                    <CloseIcon className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="flex-grow overflow-y-auto p-8 space-y-10 custom-scrollbar">
                                {/* Basic Info Section */}
                                <div className="space-y-5">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="h-5 w-1.5 bg-lime-500 rounded-full"></div>
                                        <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest">Základné údaje</h4>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-2">{t('productName')} *</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold shadow-inner focus:ring-2 focus:ring-lime-500 transition-shadow" 
                                                value={formData.productName}
                                                onChange={e => setFormData({...formData, productName: e.target.value})}
                                                placeholder="napr. Kofola Original 2L"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-2">{t('manufacturer')}</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold shadow-inner focus:ring-2 focus:ring-lime-500 transition-shadow" 
                                                value={formData.manufacturer}
                                                onChange={e => setFormData({...formData, manufacturer: e.target.value})}
                                                placeholder="napr. Kofola a.s."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-2">{t('skuCode')}</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold shadow-inner focus:ring-2 focus:ring-lime-500 transition-shadow" 
                                                value={formData.sku}
                                                onChange={e => setFormData({...formData, sku: e.target.value})}
                                                placeholder="napr. 858400123456"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-2">{t('category')}</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold shadow-inner focus:ring-2 focus:ring-lime-500 transition-shadow" 
                                                value={formData.category}
                                                onChange={e => setFormData({...formData, category: e.target.value})}
                                                placeholder="napr. Sýtené nápoje"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Aliases Section */}
                                <div className="space-y-5">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="h-5 w-1.5 bg-lime-500 rounded-full"></div>
                                        <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest">{t('aliases')}</h4>
                                    </div>
                                    <div className="flex gap-3">
                                        <input 
                                            type="text" 
                                            className="flex-grow bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold shadow-inner focus:ring-2 focus:ring-lime-500 transition-shadow" 
                                            value={currentAliasInput}
                                            onChange={e => setCurrentAliasInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddAlias())}
                                            placeholder={t('aliasPlaceholder')}
                                        />
                                        <button 
                                            onClick={handleAddAlias}
                                            className="px-6 bg-gray-100 text-gray-600 rounded-2xl hover:bg-gray-200 transition-all active:scale-95 shadow-sm"
                                        >
                                            <PlusIcon className="w-6 h-6" />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {aliases.map((alias, index) => (
                                            <div key={index} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-lime-50 text-lime-700 border border-lime-100 shadow-sm">
                                                {alias}
                                                <button onClick={() => removeAlias(alias)} className="text-lime-400 hover:text-red-500 transition-colors p-1 hover:bg-lime-100 rounded-lg">
                                                    <CloseIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Visual Training Section */}
                                <div className="space-y-5">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="h-5 w-1.5 bg-purple-500 rounded-full"></div>
                                        <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest">{t('visualReferences')}</h4>
                                    </div>
                                    <div className="bg-gradient-to-br from-purple-50/80 to-fuchsia-50/80 p-8 rounded-[2rem] border border-purple-100/50 shadow-inner">
                                        <p className="text-sm text-purple-700 mb-6 font-medium leading-relaxed">{t('visualReferencesHint')}</p>
                                        
                                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                                            {uploadedImages.map((img, index) => (
                                                <div key={index} className="relative group aspect-square rounded-2xl overflow-hidden border-2 border-white shadow-md">
                                                    <img src={`data:image/jpeg;base64,${img}`} alt="Reference" className="w-full h-full object-cover" />
                                                    <button 
                                                        onClick={() => removeImage(index)}
                                                        className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm"
                                                    >
                                                        <TrashIcon className="w-8 h-8" />
                                                    </button>
                                                </div>
                                            ))}
                                            <label 
                                                className="flex flex-col items-center justify-center aspect-square bg-white/50 border-2 border-dashed border-purple-200 rounded-2xl hover:border-purple-400 hover:bg-white transition-all text-purple-400 hover:text-purple-600 group shadow-sm cursor-pointer"
                                            >
                                                <CameraIcon className="w-10 h-10 mb-3 group-hover:scale-110 transition-transform" />
                                                <span className="text-[11px] font-black uppercase tracking-widest">{t('addPhoto')}</span>
                                                <input 
                                                    type="file" 
                                                    className="hidden" 
                                                    multiple 
                                                    accept="image/*"
                                                    onChange={handleImageUpload} 
                                                />
                                            </label>
                                        </div>

                                        {currentId && entries.find(e => e.id === currentId)?.visualFeatures && (
                                            <div className="mt-8 p-6 bg-white/80 backdrop-blur-sm rounded-2xl border border-purple-100 shadow-sm">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="p-1.5 bg-purple-100 rounded-lg">
                                                        <LightBulbIcon className="w-5 h-5 text-purple-600" />
                                                    </div>
                                                    <span className="text-xs font-black text-purple-700 uppercase tracking-widest">AI Fingerprint</span>
                                                </div>
                                                <p className="text-sm text-gray-600 italic leading-relaxed">"{entries.find(e => e.id === currentId)?.visualFeatures}"</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-4">
                                <button onClick={resetForm} className="px-8 py-4 text-gray-500 font-bold uppercase tracking-widest text-xs hover:text-gray-900 transition-colors hover:bg-gray-200 rounded-2xl">
                                    {t('cancelButton')}
                                </button>
                                <button 
                                    onClick={handleSave} 
                                    disabled={isTraining || !formData.productName.trim()}
                                    className="px-10 py-4 bg-lime-600 text-white font-black rounded-2xl hover:bg-lime-700 disabled:bg-gray-300 transition-all flex items-center gap-3 shadow-xl shadow-lime-200 active:scale-95 uppercase tracking-widest text-xs"
                                >
                                    {isTraining ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <ShieldCheckIcon className="w-5 h-5" />}
                                    {isTraining ? t('trainingModel') : t('saveAndTrain')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
