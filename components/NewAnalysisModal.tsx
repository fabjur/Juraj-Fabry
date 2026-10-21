import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '../i18n/index';
import { 
    CloseIcon, TagIcon, ChartPieIcon, ClipboardDocumentListIcon, 
    UploadIcon, TrashIcon, RocketLaunchIcon, TableCellsIcon, 
    SparklesIcon, ShieldCheckIcon,
    BuildingStorefrontIcon, CameraIcon
} from './Icons';
import type { AnalysisType } from '../hooks/useImageAnalysis';
import type { Store } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { extractFramesFromVideo, isVideoFile } from '../utils/videoExtractor';
import { db, getCatalogCategories, getActivePrompt } from '../db';
import { analyzeImageWithGeminiCustom } from '../services/geminiService';
import { MapPin, SlidersHorizontal, Check, ChevronDown, ChevronUp } from 'lucide-react';

export interface NewAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    name: string,
    type: AnalysisType,
    model: string,
    files: File[],
    productCategory?: string,
    qualityCheckId?: string,
    clientName?: string,
    customPrompt?: string,
    isWideShelf?: boolean,
    isVideoMode?: boolean,
    selectedStore?: Store | null
  ) => void;
  initialFiles: File[];
}

const FileThumbnail: React.FC<{ file: File; onRemove: () => void }> = ({ file, onRemove }) => {
  const [url, setUrl] = useState<string>('');

  useEffect(() => {
    if (!file || !(file instanceof Blob)) return;
    let objectUrl = '';
    try {
      objectUrl = URL.createObjectURL(file);
      setUrl(objectUrl);
    } catch {
      // ignore object url creation errors
    }
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file]);

  if (!file) return null;

  return (
    <div className="relative group border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 shadow-sm hover:shadow-md transition-all bg-white dark:bg-zinc-800">
      <div className="h-16 w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden relative">
        {url ? (
          <img src={url} alt={file.name || 'image'} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-400">...</div>
        )}
      </div>
      <button 
        type="button"
        onClick={onRemove} 
        className="absolute -top-1.5 -right-1.5 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:text-rose-600 p-1 rounded-full shadow-md border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer"
        title="Remove photo"
      >
        <TrashIcon className="w-3 h-3" />
      </button>
    </div>
  );
};

export const NewAnalysisModal: React.FC<NewAnalysisModalProps> = ({ isOpen, onClose, onConfirm, initialFiles }) => {
  const { t } = useTranslation();
  
  // Quick vs Advanced mode
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  
  // Store selection
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [storeSearch, setStoreSearch] = useState('');
  const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);
  const [isGpsLoading, setIsGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Analysis metadata
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  const [selectedType, setSelectedType] = useState<AnalysisType>('both');
  const [selectedQualityCheckId, setSelectedQualityCheckId] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [fileErrorMessage, setFileErrorMessage] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  
  // Advanced Settings
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-lite');
  const [isWideShelf, setIsWideShelf] = useState(false);
  const [isVideoMode, setIsVideoMode] = useState(false);
  
  // Prompt Editor
  const [promptText, setPromptText] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Live queries
  const liveQualityChecks = useLiveQuery(() => db.quality_checks.orderBy('createdAt').reverse().toArray());
  const qualityChecks = useMemo(() => liveQualityChecks || [], [liveQualityChecks]);

  const liveStores = useLiveQuery(() => db.stores.orderBy('name').toArray());
  const stores = useMemo(() => liveStores || [], [liveStores]);

  const storeDropdownRef = useRef<HTMLDivElement>(null);

  // Filtered stores for dropdown
  const filteredStores = useMemo(() => {
    if (!storeSearch.trim()) return stores.slice(0, 15);
    const query = storeSearch.toLowerCase();
    return stores.filter(s => 
      s.name.toLowerCase().includes(query) || 
      (s.chain || '').toLowerCase().includes(query) || 
      (s.city || '').toLowerCase().includes(query) ||
      (s.address || '').toLowerCase().includes(query)
    ).slice(0, 15);
  }, [stores, storeSearch]);

  // Update name automatically based on store, category and date
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const formattedDate = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
      
      const storePart = selectedStore?.name 
        ? selectedStore.name.replace(/[^a-zA-Z0-9áäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]/g, '_')
        : client.trim() 
        ? client.trim().replace(/[^a-zA-Z0-9áäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ]/g, '_') 
        : 'Audit';
      
      const categoryPart = selectedCategory ? selectedCategory.replace(/\s+/g, '_') : 'All';
      setName(`${storePart}_${categoryPart}_${formattedDate}`);
    }
  }, [client, selectedStore, selectedCategory, isOpen]);

  // Handle outside click for store dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(e.target as Node)) {
        setIsStoreDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset modal state on open
  useEffect(() => {
    if (isOpen) {
      setSelectedStore(null);
      setStoreSearch('');
      setIsStoreDropdownOpen(false);
      setGpsError(null);
      setClient('');
      setSelectedCategory('');
      setSelectedType('both');
      setSelectedModel('gemini-3.1-flash-lite');
      setSelectedQualityCheckId('');
      setIsAdvancedOpen(false);
      setIsVideoMode(false);
      setPromptText('');
      setTestResult(null);
      setIsTesting(false);
      setFiles([]);
      
      const cleanFiles = Array.isArray(initialFiles) 
        ? initialFiles.filter((f): f is File => Boolean(f && typeof f === 'object' && typeof f.name === 'string'))
        : [];

      if (cleanFiles.length > 0) {
        let hasVideo = false;
        for (const file of cleanFiles) {
          if (isVideoFile(file)) hasVideo = true;
        }
        
        if (hasVideo) {
          setIsExtracting(true);
          setIsVideoMode(true);
          setIsAdvancedOpen(true);
          (async () => {
            try {
              const validFiles: File[] = [];
              for (const file of cleanFiles) {
                if (isVideoFile(file)) {
                  try {
                    const frames = await extractFramesFromVideo(file, 1);
                    if (frames && frames.length > 0) {
                      validFiles.push(...frames);
                    } else {
                      setFileErrorMessage(`Failed to extract frames from video ${file.name}.`);
                    }
                  } catch (vErr: any) {
                    console.warn("Frame extraction failed:", vErr);
                    setFileErrorMessage(`Video extraction error (${file.name}): ${vErr?.message || 'Unsupported format'}`);
                  }
                } else if (file) {
                  validFiles.push(file);
                }
              }
              setFiles(validFiles);
            } catch (err) {
              console.error("Initial video processing failed:", err);
            } finally {
              setIsExtracting(false);
            }
          })();
        } else {
          setFiles(cleanFiles);
        }
      }
      
      getCatalogCategories()
        .then(cats => setCategories(cats))
        .catch(err => console.error('Failed to load catalog categories', err));
    }
  }, [isOpen, initialFiles]);

  // Load default user prompt when type/category changes
  useEffect(() => {
    if (!isOpen) return;
    const fetchPrompt = async () => {
      const mappedType = selectedType === 'qualityCheck' ? 'osa' : selectedType;
      const p = await getActivePrompt(mappedType, selectedCategory || undefined, client || undefined);
      if (p) {
        setPromptText(p.text || '');
      } else {
        let defaultText = 'Analyze the image according to instructions.';
        switch(selectedType) {
          case 'price': defaultText = t('geminiPromptPriceOnly'); break;
          case 'shelfShare': defaultText = t('geminiPromptShelfShareOnly'); break;
          case 'osa': 
          case 'qualityCheck': defaultText = t('geminiPromptOsaOnly'); break;
          case 'both': defaultText = t('geminiPromptBoth'); break;
        }
        setPromptText(defaultText);
      }
    };
    fetchPrompt();
  }, [selectedType, selectedCategory, client, isOpen, t]);

  if (!isOpen) return null;

  // Process incoming images or videos
  const processIncomingFiles = async (incomingFiles: File[]) => {
    setFileErrorMessage(null);
    const safeFiles = Array.isArray(incomingFiles)
      ? incomingFiles.filter((f): f is File => Boolean(f && typeof f === 'object' && typeof f.name === 'string'))
      : [];
    if (safeFiles.length === 0) return;

    const validFiles: File[] = [];
    let hasVideo = false;

    for (const file of safeFiles) {
      if (isVideoFile(file)) {
        hasVideo = true;
      } else if (file.size > 15 * 1024 * 1024) {
        setFileErrorMessage(`File ${file.name} is too large. Maximum allowed size is 15MB.`);
        continue;
      }
    }

    if (hasVideo) {
      setIsExtracting(true);
      setIsVideoMode(true);
      setIsAdvancedOpen(true);
      try {
        for (const file of safeFiles) {
          if (isVideoFile(file)) {
            try {
              const frames = await extractFramesFromVideo(file, 1);
              if (frames && frames.length > 0) {
                validFiles.push(...frames);
              } else {
                setFileErrorMessage(`Failed to extract frames from video ${file.name}.`);
              }
            } catch (vErr: any) {
              console.warn("Incoming video frame extraction failed:", vErr);
              setFileErrorMessage(`Error processing video (${file.name}): ${vErr?.message || 'Unsupported format'}`);
            }
          } else if (file.size <= 15 * 1024 * 1024) {
            validFiles.push(file);
          }
        }
      } catch (e) {
        console.error("Video processing failed", e);
      } finally {
        setIsExtracting(false);
      }
    } else {
      validFiles.push(...safeFiles.filter(f => f.size <= 15 * 1024 * 1024));
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processIncomingFiles(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const raw = Array.from(e.dataTransfer.files);
      const droppedFiles = raw.filter(f => Boolean(f && typeof f.type === 'string' && (f.type.startsWith('image/') || f.type.startsWith('video/'))));
      if (droppedFiles.length > 0) {
        await processIncomingFiles(droppedFiles);
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setFiles([]);
  };

  // GPS Store Detection
  const handleDetectNearbyStore = () => {
    if (!navigator.geolocation) {
      setGpsError('Your browser does not support geolocation.');
      return;
    }

    setIsGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsGpsLoading(false);
        const { latitude, longitude } = position.coords;
        
        // Find store with coordinates closest to user
        let closestStore: Store | null = null;
        let minDistance = Infinity;

        stores.forEach(store => {
          if (store.gpsCoordinates) {
            const parts = store.gpsCoordinates.split(',').map(s => parseFloat(s.trim()));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
              const dLat = (parts[0] - latitude);
              const dLon = (parts[1] - longitude);
              const dist = Math.sqrt(dLat * dLat + dLon * dLon);
              if (dist < minDistance) {
                minDistance = dist;
                closestStore = store;
              }
            }
          }
        });

        // If no store has GPS coordinates, pick first store matching city or default
        if (!closestStore && stores.length > 0) {
          closestStore = stores[0];
        }

        if (closestStore) {
          setSelectedStore(closestStore);
          setClient(closestStore.chain || closestStore.name);
          setStoreSearch(closestStore.name);
          setIsStoreDropdownOpen(false);
        } else {
          setGpsError('No stores with GPS coordinates found in database.');
        }
      },
      (err) => {
        setIsGpsLoading(false);
        setGpsError('Unable to get location. Please select store manually.');
        console.warn('Geolocation error:', err);
      },
      { timeout: 8000 }
    );
  };

  const handleStart = () => {
    if (name.trim() && files.length > 0) {
      onConfirm(
        name.trim(), 
        selectedType, 
        selectedModel, 
        files, 
        selectedCategory || undefined, 
        selectedQualityCheckId || undefined,
        client.trim() || undefined,
        promptText,
        isWideShelf,
        isVideoMode,
        selectedStore
      );
    }
  };

  const handleTestPrompt = async () => {
    const testFile = files.find(f => Boolean(f && typeof f.type === 'string'));
    if (!testFile) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const res = await analyzeImageWithGeminiCustom(
            base64,
            promptText,
            t('geminiSystemInstruction'),
            selectedModel,
            testFile.type || 'image/jpeg'
          );
          setTestResult(`✓ Test successful: Found ${res.products?.length || 0} products.`);
        } catch (e) {
          setTestResult(`Error: ${(e as Error).message}`);
        } finally {
          setIsTesting(false);
        }
      };
      reader.readAsDataURL(testFile);
    } catch (error) {
      setTestResult(`Module error: ${(error as Error).message}`);
      setIsTesting(false);
    }
  };

  const types = [
    { id: 'both', icon: ClipboardDocumentListIcon, label: t('analysisTypeBothButton') || 'Complete Retail Audit (Recommended)', desc: t('analysisTypeBothDescription') || 'Simultaneously audits prices (OSP), share of shelf (SOS), and promotional tags.' },
    { id: 'price', icon: TagIcon, label: t('analysisTypePriceButton') || 'Prices & Facings (OSP)', desc: t('analysisTypePriceDescription') || 'Detects prices, facings, and stock availability.' },
    { id: 'shelfShare', icon: ChartPieIcon, label: t('analysisTypeShelfShareButton') || 'Share of Shelf (SOS)', desc: t('analysisTypeShelfShareDescription') || 'Calculates shelf space share and facing percentage.' },
    { id: 'osa', icon: TableCellsIcon, label: t('analysisTypeOsaButton') || 'On-Shelf Availability (OSA)', desc: t('analysisTypeOsaDescription') || 'Identifies out-of-stock items and gaps on shelf.' },
    { id: 'promo', icon: SparklesIcon, label: t('analysisTypePromoButton') || 'Promotions & POS', desc: t('analysisTypePromoDescription') || 'Detects secondary displays, discount tags, and POS materials.' },
    { id: 'qualityCheck', icon: ShieldCheckIcon, label: t('qualityCheck') || 'Planogram Quality Check', desc: t('qualityCheckDesc') || 'Verifies planogram adherence and display standards.' },
  ];

  const models = [
    { 
      id: 'gemini-3.1-flash-lite', 
      label: 'Gemini 3.1 Flash-Lite', 
      desc: t('defaultModelSummary') || 'High-speed, reliable model for shelf recognition and price extraction.', 
      speed: '⚡',
      badge: t('recommended') || 'Recommended'
    },
    { 
      id: 'gemini-3.8-flash', 
      label: 'Gemini 3.6 Flash', 
      desc: 'Standard multimodal model with automated fallback.', 
      speed: '🚀',
      badge: 'Standard'
    },
    { 
      id: 'gemini-3.1-pro-preview', 
      label: 'Gemini 3.6 Pro', 
      desc: 'Maximum analytical precision for dense shelves and complex lighting.', 
      speed: '🧠',
      badge: 'Pro Precision'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-zinc-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-150 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-lime-50 text-lime-700 rounded-2xl border border-lime-200 shadow-3xs">
              <CameraIcon className="w-5 h-5 text-lime-600" />
            </div>
            <div>
              <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
                <span>{t('newShelfAudit') || 'New Shelf Audit'}</span>
                <span className="text-[10px] font-black uppercase bg-lime-100 text-lime-800 px-2 py-0.5 rounded-full">
                  {t('quickStart') || 'Quick Start'}
                </span>
              </h2>
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5">
                <span className="truncate max-w-xs">{name}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-zinc-50/40 dark:bg-zinc-950/40 custom-scrollbar">
          
          {/* Section 1: Store & Category (Quick Field Start) */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Store Selector */}
              <div className="relative" ref={storeDropdownRef}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <BuildingStorefrontIcon className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{t('store') || 'Store'}</span>
                  </label>

                  {/* GPS Detect Button */}
                  <button
                    type="button"
                    onClick={handleDetectNearbyStore}
                    disabled={isGpsLoading}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors"
                    title={t('nearbyGps') || "Find nearest store via GPS"}
                  >
                    <MapPin className="w-3 h-3" />
                    <span>{isGpsLoading ? (t('locating') || 'Locating...') : (t('nearbyGps') || 'Nearby (GPS)')}</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={storeSearch || (selectedStore ? selectedStore.name : client)}
                    onChange={(e) => {
                      setStoreSearch(e.target.value);
                      setClient(e.target.value);
                      setSelectedStore(null);
                      setIsStoreDropdownOpen(true);
                    }}
                    onFocus={() => setIsStoreDropdownOpen(true)}
                    placeholder={t('selectStorePlaceholder') || "Select store (Tesco, Billa...)"}
                    className="w-full rounded-xl border border-zinc-300 shadow-2xs focus:border-lime-500 focus:ring-1 focus:ring-lime-500 text-xs sm:text-sm py-2.5 pl-3 pr-8 bg-white dark:bg-zinc-900 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setIsStoreDropdownOpen(prev => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {gpsError && (
                  <p className="text-[10px] text-amber-600 font-medium mt-1">{gpsError}</p>
                )}

                {/* Dropdown Options */}
                {isStoreDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar p-1">
                    {filteredStores.length === 0 ? (
                      <div className="p-3 text-xs text-zinc-400 text-center">
                        {t('storeNotFoundSaved') || 'Store not found. Entered name will be saved.'}
                      </div>
                    ) : (
                      filteredStores.map(store => (
                        <div
                          key={store.id || store.name}
                          onClick={() => {
                            setSelectedStore(store);
                            setClient(store.chain || store.name);
                            setStoreSearch(store.name);
                            setIsStoreDropdownOpen(false);
                          }}
                          className={`p-2 rounded-lg text-xs cursor-pointer flex items-center justify-between hover:bg-lime-50 transition-colors ${
                            selectedStore?.id === store.id ? 'bg-lime-50/80 font-bold text-lime-950' : 'text-zinc-700'
                          }`}
                        >
                          <div>
                            <div className="font-bold flex items-center gap-1.5">
                              {store.chain && (
                                <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.2 rounded font-black uppercase">
                                  {store.chain}
                                </span>
                              )}
                              <span>{store.name}</span>
                            </div>
                            {(store.city || store.address) && (
                              <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                                {[store.city, store.address].filter(Boolean).join(' • ')}
                              </div>
                            )}
                          </div>
                          {selectedStore?.id === store.id && (
                            <Check className="w-3.5 h-3.5 text-lime-600" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Category Selector */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <TagIcon className="w-3.5 h-3.5 text-zinc-400" /> {t('productCategory') || 'Product Category'}
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 shadow-2xs focus:border-lime-500 focus:ring-1 focus:ring-lime-500 text-xs sm:text-sm py-2.5 px-3 bg-white dark:bg-zinc-900 appearance-none cursor-pointer font-medium"
                >
                  <option value="">{t('allProductsCategory') || 'All categories (General audit)'}</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Camera & File Upload (One-Hand Ergonomic Field Upload) */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                  <CameraIcon className="w-3.5 h-3.5 text-lime-600" />
                  <span>{t('shelfPhotos') || 'Shelf photos'} ({files.length})</span>
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                  {t('takeOrUploadPhotosDesc') || 'Take shelf photos with your camera or upload existing images'}
                </p>
              </div>

              {files.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    {(files.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(1)} MB
                  </span>
                  <button 
                    type="button"
                    onClick={clearAllFiles} 
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                  >
                    {t('clearAll') || 'Clear all'}
                  </button>
                </div>
              )}
            </div>

            {/* Big Touch-Friendly Buttons for One-Hand Operation in Field */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Direct Camera Button (capture="environment") */}
              <label className="flex items-center justify-center gap-2.5 py-4 px-4 bg-lime-600 hover:bg-lime-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider cursor-pointer shadow-md shadow-lime-200 active:scale-98 transition-all">
                <CameraIcon className="w-5 h-5 text-white" />
                <span>{t('takePhotoCamera') || 'Take photo (Camera)'}</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  multiple 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
              </label>

              {/* Gallery / File Picker */}
              <label className="flex items-center justify-center gap-2.5 py-4 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 rounded-2xl font-bold text-xs uppercase tracking-wider cursor-pointer border border-zinc-250 active:scale-98 transition-all">
                <UploadIcon className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                <span>{t('chooseFromGallery') || 'Choose from gallery / files'}</span>
                <input 
                  type="file" 
                  multiple 
                  accept="image/*,video/mp4,video/quicktime" 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
              </label>
            </div>

            {/* Drag & Drop Zone and Thumbnails */}
            {files.length === 0 ? (
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`py-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all ${
                  isDragging ? 'border-lime-500 bg-lime-50/50' : 'border-zinc-200 bg-zinc-50/50'
                }`}
              >
                {isExtracting ? (
                  <div className="flex flex-col items-center justify-center text-lime-600">
                    <div className="w-8 h-8 border-3 border-lime-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <span className="font-bold text-xs">{t('extractingVideoFrames') || 'Extracting frames from video...'}</span>
                  </div>
                ) : (
                  <>
                    <UploadIcon className="w-6 h-6 text-zinc-400 mb-1" />
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">{t('dragDropShelfPhotos') || 'Drag and drop shelf photos here'}</span>
                    <span className="text-[10px] text-zinc-400 mt-0.5">{t('supportedFormatsNotice') || 'Supports JPG, PNG, WebP and short videos up to 15MB'}</span>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {fileErrorMessage && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center justify-between">
                    <span>{fileErrorMessage}</span>
                    <button type="button" onClick={() => setFileErrorMessage(null)} className="text-rose-500 font-bold ml-2">✕</button>
                  </div>
                )}
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 max-h-48 overflow-y-auto p-2 bg-zinc-50 dark:bg-zinc-800/60 rounded-2xl border border-zinc-200 dark:border-zinc-800 custom-scrollbar"
                >
                  {files.filter(Boolean).map((file, idx) => (
                    <FileThumbnail 
                      key={`${file?.name || 'file'}-${file?.lastModified || idx}-${idx}`} 
                      file={file} 
                      onRemove={() => removeFile(idx)} 
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Smart Default Audit Info Banner */}
          <div className="p-3.5 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white rounded-2xl flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="p-2 bg-lime-400 text-zinc-950 dark:text-zinc-100 rounded-xl font-black text-xs">
                AI
              </span>
              <div>
                <div className="text-xs font-black tracking-wide text-zinc-100 flex items-center gap-1.5">
                  <span>{t('completeShelfAudit') || 'Complete shelf audit'}</span>
                  <span className="text-[9px] bg-lime-400/20 text-lime-300 border border-lime-400/30 px-1.5 rounded uppercase">
                    OSP + SOS
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400">
                  {t('defaultModelSummary') || 'Model: Gemini 3.6 Flash • Price detection, facings count, and promotional frames'}
                </div>
              </div>
            </div>

            {/* Toggle Advanced Options */}
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(prev => !prev)}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-zinc-200 rounded-xl text-[11px] font-bold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{isAdvancedOpen ? (t('less') || 'Less') : (t('advanced') || 'Advanced')}</span>
              {isAdvancedOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {/* Collapsible Advanced Settings (Expert Mode) */}
          {isAdvancedOpen && (
            <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-5 animate-fade-in">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2.5">
                  {t('specificAnalysisMode') || 'Analysis Mode'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {types.map((type) => (
                    <button
                      type="button"
                      key={type.id}
                      onClick={() => setSelectedType(type.id as AnalysisType)}
                      className={`text-left p-3 rounded-xl border-2 transition-all ${
                        selectedType === type.id 
                          ? 'border-zinc-900 bg-zinc-900 text-white shadow-xs' 
                          : 'border-zinc-200 hover:border-zinc-300 bg-white text-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <type.icon className={`w-4 h-4 ${selectedType === type.id ? 'text-lime-400' : 'text-zinc-500'}`} />
                        <h4 className="font-bold text-xs leading-tight">{type.label}</h4>
                      </div>
                      <p className={`text-[10px] leading-snug line-clamp-2 ${selectedType === type.id ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        {type.desc}
                      </p>
                    </button>
                  ))}
                </div>

                {selectedType === 'qualityCheck' && (
                  <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase mb-1.5">
                      {t('selectStandardPattern') || 'Select Standard (Planogram/Standard)'}
                    </label>
                    <select
                      value={selectedQualityCheckId}
                      onChange={(e) => setSelectedQualityCheckId(e.target.value)}
                      className="w-full rounded-lg border-zinc-300 shadow-xs py-2 px-3 text-xs bg-white dark:bg-zinc-900 border font-medium"
                    >
                      <option value="">{t('selectStandardPlaceholder') || '-- Select standard --'}</option>
                      {qualityChecks.map(qc => (
                        <option key={qc.id} value={qc.id}>{qc.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Wide Shelf & Video Mode */}
              <div className="flex items-center gap-3 bg-indigo-50/60 dark:bg-indigo-950/30 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                <input 
                  type="checkbox" 
                  id="wideShelf" 
                  checked={isWideShelf}
                  onChange={(e) => setIsWideShelf(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="wideShelf" className="flex flex-col cursor-pointer flex-1 text-xs">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">{t('wideShelfPanoramic') || 'Wide shelf / Panoramic capture'}</span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{t('wideShelfPanoramicDesc') || 'Optimized left-to-right scanning with automatic stitching duplicate suppression.'}</span>
                </label>
              </div>

              {/* Model Selection */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  {t('selectAiModel') || 'Select AI Model'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {models.map(m => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        selectedModel === m.id
                          ? 'border-lime-500 bg-lime-50/60 text-zinc-900 shadow-xs ring-1 ring-lime-400'
                          : 'border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-black text-xs">{m.label}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {m.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-snug">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt Testing Sandbox */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                    {t('customAiPrompt') || 'Custom AI Instructions (Prompt)'}
                  </label>
                  {files.length > 0 && (
                    <button
                      type="button"
                      onClick={handleTestPrompt}
                      disabled={isTesting}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 disabled:opacity-50 cursor-pointer"
                    >
                      {isTesting ? (t('testing') || 'Testing...') : (t('testOnFirstPhoto') || 'Test on 1st photo')}
                    </button>
                  )}
                </div>
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  rows={3}
                  className="w-full text-xs font-mono bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 text-zinc-800 dark:text-zinc-200 focus:bg-white focus:ring-1 focus:ring-lime-500"
                  placeholder={t('modelPromptPlaceholder') || "Instructions for model..."}
                />
                {testResult && (
                  <p className="text-[11px] font-bold text-blue-700 mt-1">{testResult}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Ergonomic Start Button */}
        <div className="p-4 sm:p-5 border-t border-zinc-150 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium order-2 sm:order-1 text-center sm:text-left">
            {isExtracting ? (
              <span className="text-blue-600 font-bold flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                {t('extractingVideoFramesWait') || 'Extracting video frames... Please wait.'}
              </span>
            ) : files.length === 0 ? (
              <span>{t('uploadAtLeastOnePhotoToStart') || 'Take or upload at least 1 photo / video to start audit.'}</span>
            ) : (
              <span className="text-zinc-700 dark:text-zinc-300 font-bold">
                {files.length} {t('photosReady') || 'photos ready'} • {t('store') || 'Store'}: {selectedStore?.name || client || (t('unspecified') || 'Unspecified')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 rounded-xl transition-colors cursor-pointer"
            >
              {t('cancelButton') || 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleStart}
              disabled={files.length === 0 || !name.trim() || isExtracting}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-lime-600 hover:bg-lime-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-lime-200 disabled:shadow-none flex items-center justify-center gap-2 active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              {isExtracting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{t('processingVideo') || 'Processing video...'}</span>
                </>
              ) : (
                <>
                  <RocketLaunchIcon className="w-4 h-4" />
                  <span>{t('startAudit') || 'Start audit'} ({files.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
