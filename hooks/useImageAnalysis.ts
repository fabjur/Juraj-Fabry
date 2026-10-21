import React, { useReducer, useState, useEffect, useCallback, useRef } from 'react';
import { AnalysisResult, Store, BrandClassifications, PriceInfo, SerializableImageState } from '../types';
import { parseDateFromFileName, extractStoreFromFilename, compressImageWithWorker, fileToBase64, getBrandFromName, deepFreeze } from '../utils/helpers';
import { getCatalogEntries, findProductByAlias, populateCatalogFromAnalysis, getBrandMemory, autoSaveAnalysisImage, db, getActivePrompt } from '../db';
import { analyzeQualityCheck } from '../services/geminiService';
import { PipelineFactory } from '../services/pipelineStrategy';
import { useTranslation } from '../i18n/index';
import { extractFramesFromVideo, isVideoFile } from '../utils/videoExtractor';

export type AnalysisType = 'price' | 'shelfShare' | 'both' | 'osa' | 'qualityCheck' | 'promo';

export interface ImageState {
  id: string;
  file: File;
  imageUrl: string;
  compressedBase64?: string;
  analysisResult: AnalysisResult | null;
  status: 'pending' | 'analyzing' | 'success' | 'error';
  error: string | null;
  uploadDate: Date;
  analysisType: AnalysisType;
  model: string;
  retryCount: number;
  assignedStore?: Store | null;
  assignedStoreId?: number;
  productCategory?: string;
  qualityCheckId?: string;
  clientName?: string;
  customPrompt?: string;
  userPrompt?: string;
  systemPrompt?: string;
  isWideShelf?: boolean;
  isVideoMode?: boolean;
  targetAnalysisId?: string;
}

type ImageAction = 
  | { type: 'ADD_IMAGES'; payload: ImageState[] }
  | { type: 'SET_ANALYZING'; payload: string }
  | { type: 'SET_PENDING'; payload: string }
  | { type: 'SET_RETRYING'; payload: { id: string; retryCount: number; message?: string } }
  | { type: 'RETRY_FAILED' }
  | { type: 'RETRY_SINGLE'; payload: string }
  | { type: 'SET_SUCCESS'; payload: { id: string; result: AnalysisResult; store?: Store; storeId?: number; compressedBase64?: string } }
  | { type: 'SET_ERROR'; payload: { id: string; error: string; needsAuthReset?: boolean } }
  | { type: 'UPDATE_PRICES'; payload: { imageId: string; productId: string; prices: PriceInfo[] }[] }
  | { type: 'RENAME_PRODUCT'; payload: { imageId: string; productId: string; newName: string } }
  | { type: 'CORRECT_PRODUCT'; payload: { imageId: string; name: string; newName: string; prices: PriceInfo[]; count: number } }
  | { type: 'SYNC_ANALYSIS_IMAGES'; payload: SerializableImageState[] }
  | { type: 'CLEAR_ALL' };

function imageReducer(state: ImageState[], action: ImageAction): ImageState[] {
  switch (action.type) {
    case 'ADD_IMAGES': {
      const existingIds = new Set(state.map(img => img.id));
      const uniqueNewImages = action.payload.filter(img => {
        if (!img?.id || existingIds.has(img.id)) return false;
        existingIds.add(img.id);
        return true;
      });
      return [...uniqueNewImages, ...state];
    }
    case 'SET_ANALYZING': return state.map(img => img.id === action.payload ? { ...img, status: 'analyzing' } : img);
    case 'SET_PENDING': return state.map(img => img.id === action.payload ? { ...img, status: 'pending', error: null } : img);
    case 'SET_RETRYING': return state.map(img => img.id === action.payload.id ? { 
        ...img, 
        status: 'analyzing', 
        retryCount: action.payload.retryCount, 
        error: action.payload.message || null 
    } : img);
    case 'RETRY_FAILED': return state.map(img => img.status === 'error' ? { 
        ...img, 
        status: 'pending', 
        error: null, 
        retryCount: 0 
    } : img);
    case 'RETRY_SINGLE': return state.map(img => img.id === action.payload ? { 
        ...img, 
        status: 'pending', 
        error: null, 
        retryCount: 0 
    } : img);
    case 'SET_SUCCESS': return state.map(img => img.id === action.payload.id ? { 
        ...img, 
        status: 'success', 
        analysisResult: deepFreeze(action.payload.result),
        assignedStore: action.payload.store || img.assignedStore, 
        assignedStoreId: action.payload.storeId || img.assignedStoreId,
        compressedBase64: action.payload.compressedBase64 || img.compressedBase64,
        error: null
    } : img);
    case 'SET_ERROR': return state.map(img => img.id === action.payload.id ? { ...img, status: 'error', error: action.payload.error } : img);
    case 'UPDATE_PRICES': {
        return state.map(img => {
            const updates = action.payload.filter(u => u.imageId === img.id);
            if (!updates.length || !img.analysisResult) return img;
            const updatedProducts = img.analysisResult.products.map(p => {
                const update = updates.find(u => u.productId === p.id);
                if (!update) return p;
                let reg: number | null = null;
                let promo: number | null = null;
                let club: number | null = null;
                (update.prices || []).forEach(pr => {
                  const val = parseFloat(String(pr.value).replace(',', '.').replace(/[^\d.]/g, ''));
                  if (!isNaN(val) && val > 0) {
                    const t = (pr.type || '').toUpperCase();
                    if (t.includes('PROMO') || t.includes('AKCIA')) promo = val;
                    else if (t.includes('CLUB') || t.includes('KLUB')) club = val;
                    else reg = val;
                  }
                });
                return { 
                  ...p, 
                  prices: update.prices,
                  regularPrice: reg !== null ? reg : p.regularPrice,
                  promoPrice: promo !== null ? promo : p.promoPrice,
                  clubPrice: club !== null ? club : p.clubPrice,
                  isCorrected: true,
                  verificationStatus: 'human_verified',
                  priceReadabilityStatus: 'readable'
                };
            });
            return { ...img, analysisResult: { ...img.analysisResult, products: updatedProducts } };
        });
    }
    case 'RENAME_PRODUCT': return state.map(img => img.id === action.payload.imageId ? {
        ...img, 
        analysisResult: img.analysisResult ? { 
            ...img.analysisResult, 
            products: img.analysisResult.products.map(p => p.id === action.payload.productId ? { ...p, name: action.payload.newName } : p)
        } : null
    } : img);
    case 'CORRECT_PRODUCT': {
        const { imageId, name, newName, prices, count } = action.payload;
        return state.map(img => {
            if (img.id !== imageId || !img.analysisResult) return img;
            
            const products = img.analysisResult.products || [];
            const otherProducts = products.filter(p => !p || p.name !== name);
            const targetProducts = products.filter(p => p && p.name === name);
            const currentCount = targetProducts.length;

            let reg: number | null = null;
            let promo: number | null = null;
            let club: number | null = null;
            (prices || []).forEach(pr => {
              const val = parseFloat(String(pr.value).replace(',', '.').replace(/[^\d.]/g, ''));
              if (!isNaN(val) && val > 0) {
                const t = (pr.type || '').toUpperCase();
                if (t.includes('PROMO') || t.includes('AKCIA')) promo = val;
                else if (t.includes('CLUB') || t.includes('KLUB')) club = val;
                else reg = val;
              }
            });

            const finalTargetProducts = [];
            
            for (let i = 0; i < count; i++) {
                const base = targetProducts[i] || targetProducts[0] || {
                    id: `${imageId}-${newName}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    boundingBox: { x: 0.45, y: 0.45, width: 0.1, height: 0.1 },
                    confidence: 1.0,
                    type: 'product'
                };
                
                finalTargetProducts.push({
                    ...base,
                    name: newName,
                    prices: prices,
                    regularPrice: reg !== null ? reg : base.regularPrice ?? null,
                    promoPrice: promo !== null ? promo : base.promoPrice ?? null,
                    clubPrice: club !== null ? club : base.clubPrice ?? null,
                    isCorrected: true,
                    verificationStatus: 'human_verified',
                    priceReadabilityStatus: prices.length > 0 ? 'readable' : base.priceReadabilityStatus || 'missing',
                    id: i < currentCount ? base.id : `${imageId}-${newName}-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 5)}`
                });
            }

            return {
                ...img,
                analysisResult: {
                    ...img.analysisResult,
                    products: [...otherProducts, ...finalTargetProducts]
                }
            };
        });
    }
    case 'SYNC_ANALYSIS_IMAGES': {
      const updatedMap = new Map<string, SerializableImageState>();
      (action.payload || []).forEach(img => {
        if (img?.id) updatedMap.set(img.id, img);
      });
      return state.map(currentImg => {
        const matching = updatedMap.get(currentImg.id);
        if (!matching) return currentImg;
        return {
          ...currentImg,
          analysisResult: matching.analysisResult ? deepFreeze(matching.analysisResult) : currentImg.analysisResult,
          assignedStore: matching.assignedStore || currentImg.assignedStore,
          assignedStoreId: matching.assignedStoreId || currentImg.assignedStoreId
        };
      });
    }
    case 'CLEAR_ALL': return [];
    default: return state;
  }
}

const isRetryableError = (errorMsg: string): boolean => {
  const lower = (errorMsg || '').toLowerCase();
  return (
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('rate_limit') ||
    lower.includes('429') ||
    lower.includes('503') ||
    lower.includes('500') ||
    lower.includes('overloaded') ||
    lower.includes('temporarily unavailable') ||
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('econnreset') ||
    lower.includes('socket hang up')
  );
};

const getRetryDelayMs = (retryCount: number): number => {
  const base = 2500 * Math.pow(2, retryCount);
  const jitter = Math.floor(Math.random() * 1000);
  return Math.min(base + jitter, 25000);
};

export function useImageAnalysis(
    brandClassifications: BrandClassifications, 
    setBrandClassifications: React.Dispatch<React.SetStateAction<BrandClassifications>>,
    setBrandsForClassification: React.Dispatch<React.SetStateAction<string[]>>,
    setIsBrandModalOpen: React.Dispatch<React.SetStateAction<boolean>>,
    setHasApiKey?: React.Dispatch<React.SetStateAction<boolean>>,
    activeAnalysisId?: string | null
) {
    const [images, dispatch] = useReducer(imageReducer, []);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const { t, language } = useTranslation();
    const [queueVersion, setQueueVersion] = useState(0);

    const activeAnalysisIdRef = useRef<string | null>(activeAnalysisId || null);
    useEffect(() => {
        activeAnalysisIdRef.current = activeAnalysisId || null;
    }, [activeAnalysisId]);

    const activeProcessingIdsRef = useRef<Set<string>>(new Set());
    const lastRateLimitTimeRef = useRef<number>(0);
    const isStartingRef = useRef(false);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [t]);

    const handleStartAnalysis = useCallback(async (
        type: AnalysisType, 
        model: string, 
        filesToProcess: File[], 
        productCategory?: string, 
        qualityCheckId?: string, 
        clientName?: string, 
        customPrompt?: string, 
        isWideShelf?: boolean, 
        isVideoMode?: boolean,
        targetAnalysisId?: string,
        initialStore?: Store | null
    ) => {
        if (filesToProcess.length === 0) return;
        if (isStartingRef.current) return;
        isStartingRef.current = true;
        try {
            if (targetAnalysisId) {
                activeAnalysisIdRef.current = targetAnalysisId;
            }

            const resolvedTargetId = targetAnalysisId || activeAnalysisIdRef.current || undefined;
            const defaultSystem = t('geminiSystemInstruction');
            const defaultUser = t(type === 'price' ? 'geminiPromptPriceOnly' : type === 'shelfShare' ? 'geminiPromptShelfShareOnly' : (type === 'osa' || type === 'qualityCheck') ? 'geminiPromptOsaOnly' : 'geminiPromptBoth');

            // PRE-RESOLVE PROMPTS FOR THE ENTIRE BATCH FIRST
            const catalog = await getCatalogEntries();
            const filteredCatalog = (productCategory && catalog.some(e => e.category === productCategory))
                ? catalog.filter(e => e.category === productCategory)
                : catalog;
            const known = filteredCatalog.map(e => e.visualFeatures ? `${e.canonicalName} (Visuals: ${e.visualFeatures})` : e.canonicalName).join(', ');

            const dynamicSystem = await getActivePrompt('system', productCategory, clientName);
            let resolvedSystemPrompt = (dynamicSystem?.text || defaultSystem).replace('{{knownProducts}}', known);

            if (!resolvedSystemPrompt.includes("CRITICAL INSTRUCTIONS")) {
                resolvedSystemPrompt += "\n\nCRITICAL INSTRUCTIONS:\n";
                resolvedSystemPrompt += "1. FOCUS ON PROMOTIONAL PRODUCTS & PROMO PRICES: Retail chains highlight promotional items with distinctive colored tags and frames:\n";
                resolvedSystemPrompt += "   - RED HIGHLIGHTS / RED FRAMES / RED LABELS (Kaufland Card, Lidl Super Cena, Coop Jednota, Billa, Tesco).\n";
                resolvedSystemPrompt += "   - YELLOW HIGHLIGHTS / YELLOW FRAMES / YELLOW LABELS (Tesco Clubcard yellow frames, Billa Bonus yellow tags, Terno/Kraj).\n";
                resolvedSystemPrompt += "   - PROMO KEYWORDS: 'AKCIA', 'ZĽAVA', 'SUPER CENA', 'CLUBCARD', 'LIDL PLUS', 'KAUFLAND CARD', 'BILLA BONUS', '%', '1+1', 'XXL'.\n";
                resolvedSystemPrompt += "   - For promotional tags, mark promo price with 'P' (e.g. '1.49 P'). If crossed-out regular price is also shown, output 'VALUE_REGULAR R; VALUE_PROMO P' (e.g. '2.29 R; 1.49 P').\n";
                resolvedSystemPrompt += "2. Distinguish between physical products and 'GHOST' products (printed product images on the back wall of the shelf/rack). If it is a printed image, set g=true.\n";
                resolvedSystemPrompt += "3. Identify POS materials: wobblers, stoppers, floor stands, pallets. Set pt to the type of POS material.\n";
                resolvedSystemPrompt += "4. Use the provided visual characteristics (color, shape, text) to accurately identify products, especially when text is blurry.\n";
                resolvedSystemPrompt += "5. Be extremely precise with bounding boxes. Ensure they tightly wrap the visible product.\n";
                resolvedSystemPrompt += "6. For prices, extract the exact complete price including decimal cents (haliere). Cents written in superscript or small font next to the integer must be included (e.g. large 12 and small 90 -> '12.90', never '12').";
            }

            let resolvedUserPromptText = customPrompt;
            if (!resolvedUserPromptText) {
                const dynamicUser = await getActivePrompt(type === 'qualityCheck' ? 'osa' : type, productCategory, clientName);
                resolvedUserPromptText = (dynamicUser?.text || defaultUser);
            }
            const resolvedUserPrompt = resolvedUserPromptText.replace('{{knownProducts}}', known);

            // Dispatch pending images immediately with full resolved prompts
            const immediateImages: ImageState[] = filesToProcess.map((file) => {
                const storeName = extractStoreFromFilename(file.name);
                const store = initialStore || (storeName ? { name: storeName, chain: storeName.split(',')[0].trim(), city: '', address: '', code: '' } : null);
                return {
                    id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                    file, 
                    imageUrl: URL.createObjectURL(file), 
                    analysisResult: null, 
                    status: 'pending', 
                    error: null,
                    uploadDate: parseDateFromFileName(file.name) || new Date(file.lastModified),
                    analysisType: type, 
                    model, 
                    isWideShelf, 
                    isVideoMode: !!isVideoMode, 
                    retryCount: 0, 
                    assignedStore: store, 
                    assignedStoreId: store?.id,
                    productCategory,
                    clientName, 
                    customPrompt,
                    userPrompt: resolvedUserPrompt,
                    systemPrompt: resolvedSystemPrompt,
                    qualityCheckId,
                    targetAnalysisId: resolvedTargetId
                };
            });
            dispatch({ type: 'ADD_IMAGES', payload: immediateImages });
            setQueueVersion(v => v + 1);

            // Automatically unpack any video files into clean shelf image frames if necessary
            const resolvedFiles: { file: File; isVideoExtracted?: boolean }[] = [];
            let effectiveVideoMode = !!isVideoMode;

            for (const file of filesToProcess) {
                if (isVideoFile(file)) {
                    effectiveVideoMode = true;
                    try {
                        const frames = await extractFramesFromVideo(file, 1);
                        if (frames && frames.length > 0) {
                            frames.forEach(f => resolvedFiles.push({ file: f, isVideoExtracted: true }));
                        } else {
                            console.warn("Could not extract frames from video, file skipped to prevent API failure:", file.name);
                        }
                    } catch (vErr) {
                        console.warn("Video frame extraction failed:", vErr);
                    }
                } else if (file) {
                    resolvedFiles.push({ file });
                }
            }

            if (resolvedFiles.length === 0) {
                console.warn("No valid image frames available for analysis.");
                return;
            }

            // If video was extracted into multiple new frames, update queue
            if (resolvedFiles.some(f => f.isVideoExtracted)) {
                const videoImages: ImageState[] = resolvedFiles.map(({ file, isVideoExtracted }) => {
                    const storeName = extractStoreFromFilename(file.name);
                    const store = initialStore || (storeName ? { name: storeName, chain: storeName.split(',')[0].trim(), city: '', address: '', code: '' } : null);
                    return {
                        id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                        file, 
                        imageUrl: URL.createObjectURL(file), 
                        analysisResult: null, 
                        status: 'pending', 
                        error: null,
                        uploadDate: parseDateFromFileName(file.name) || new Date(file.lastModified),
                        analysisType: type, 
                        model, 
                        isWideShelf, 
                        isVideoMode: effectiveVideoMode || isVideoExtracted, 
                        retryCount: 0, 
                        assignedStore: store, 
                        assignedStoreId: store?.id,
                        productCategory,
                        clientName, 
                        customPrompt,
                        userPrompt: resolvedUserPrompt,
                        systemPrompt: resolvedSystemPrompt,
                        qualityCheckId,
                        targetAnalysisId: resolvedTargetId
                    };
                });
                dispatch({ type: 'ADD_IMAGES', payload: videoImages });
                setQueueVersion(v => v + 1);
            }
        } finally {
            isStartingRef.current = false;
        }
    }, [t]);

    useEffect(() => {
        if (!isOnline) return;

        // Adaptive throttling: if recent 429 quota error, reduce concurrency to 1, otherwise 2
        const isThrottled = Date.now() - lastRateLimitTimeRef.current < 25000;
        const TARGET_CONCURRENCY = isThrottled ? 1 : 2;

        const currentActiveCount = activeProcessingIdsRef.current.size;
        const availableSlots = TARGET_CONCURRENCY - currentActiveCount;
        if (availableSlots <= 0) return;

        const pendingImages = images.filter(img => img.status === 'pending' && !activeProcessingIdsRef.current.has(img.id));
        if (pendingImages.length === 0) return;

        const nextBatch = pendingImages.slice(0, availableSlots);

        nextBatch.forEach((nextItem, index) => {
            activeProcessingIdsRef.current.add(nextItem.id);
            dispatch({ type: 'SET_ANALYZING', payload: nextItem.id });

            (async () => {
                // Inter-slot pacing delay to prevent simultaneous network burst
                if (index > 0) {
                    await new Promise(r => setTimeout(r, index * 600));
                }

                const MAX_RETRIES = 3;
                let attempt = 0;
                let isComplete = false;

                try {
                    let base64 = nextItem.compressedBase64 || '';
                    if (!base64) {
                        if (nextItem.file instanceof Blob && nextItem.file.size > 0) {
                            try {
                                const compressedFile = await compressImageWithWorker(nextItem.file);
                                base64 = await fileToBase64(compressedFile);
                            } catch {
                                base64 = await fileToBase64(nextItem.file);
                            }
                        } else if (typeof (nextItem.file as any)?.data === 'string' && (nextItem.file as any).data.length > 0) {
                            base64 = (nextItem.file as any).data;
                        } else if (typeof nextItem.imageUrl === 'string' && nextItem.imageUrl.startsWith('data:')) {
                            base64 = nextItem.imageUrl.split(',')[1] || '';
                        } else if (typeof nextItem.imageUrl === 'string' && (nextItem.imageUrl.startsWith('blob:') || nextItem.imageUrl.startsWith('http'))) {
                            try {
                                const resp = await fetch(nextItem.imageUrl);
                                const blob = await resp.blob();
                                base64 = await fileToBase64(blob);
                            } catch { /* ignore */ }
                        }
                    }

                    if (!base64) {
                        throw new Error(t('invalidImageData') || 'Could not load photo content.');
                    }

                    const fileName = nextItem.file?.name || 'shelf_photo.jpg';
                    const fileType = nextItem.file?.type || 'image/jpeg';
                    const fileLastModified = nextItem.file?.lastModified || Date.now();
                    const uploadDateIso = nextItem.uploadDate instanceof Date
                        ? nextItem.uploadDate.toISOString()
                        : (typeof nextItem.uploadDate === 'string' ? nextItem.uploadDate : new Date().toISOString());

                    while (attempt <= MAX_RETRIES && !isComplete) {
                        try {
                            if (attempt > 0) {
                                const delayMs = getRetryDelayMs(attempt - 1);
                                dispatch({ 
                                    type: 'SET_RETRYING', 
                                    payload: { 
                                        id: nextItem.id, 
                                        retryCount: attempt, 
                                        message: `${t('rateLimitRetryMessage') || 'API limit / retrying'} ${attempt}/${MAX_RETRIES} in ${(delayMs / 1000).toFixed(1)}s...` 
                                    } 
                                });
                                await new Promise(r => setTimeout(r, delayMs));
                            }

                            if (nextItem.analysisType === 'qualityCheck') {
                                let template = null;
                                if (nextItem.qualityCheckId) {
                                    template = await db.quality_checks.get(nextItem.qualityCheckId);
                                }
                                if (!template) {
                                    const templates = await db.quality_checks.orderBy('createdAt').reverse().toArray();
                                    if (templates && templates.length > 0) {
                                        template = templates[0];
                                    }
                                }

                                if (!template) {
                                    throw new Error(t('noPlanogramTemplateError') || 'No planogram template found for comparison. Please create one in the "Planogram Quality Check" section.');
                                }

                                const qResult = await analyzeQualityCheck(
                                    template.referenceImages,
                                    template.description,
                                    base64,
                                    nextItem.model,
                                    language
                                );

                                const successResult: AnalysisResult = {
                                    products: [],
                                    modelName: nextItem.model,
                                    complianceScore: qResult.complianceScore,
                                    reason: qResult.reason,
                                    storeInfo: {}
                                };

                                dispatch({ type: 'SET_SUCCESS', payload: { id: nextItem.id, result: successResult, compressedBase64: base64 } });
                                isComplete = true;

                                const saveAnalysisId = nextItem.targetAnalysisId || activeAnalysisIdRef.current;
                                if (saveAnalysisId) {
                                    const serializable: SerializableImageState = {
                                        id: nextItem.id,
                                        file: {
                                            name: fileName,
                                            type: fileType,
                                            lastModified: fileLastModified,
                                            data: base64
                                        },
                                        imageUrl: '',
                                        analysisResult: successResult,
                                        status: 'success',
                                        error: null,
                                        uploadDate: uploadDateIso,
                                        analysisType: nextItem.analysisType,
                                        model: nextItem.model,
                                        retryCount: attempt,
                                        assignedStore: nextItem.assignedStore,
                                        assignedStoreId: nextItem.assignedStoreId,
                                        productCategory: nextItem.productCategory
                                    };
                                    await autoSaveAnalysisImage(saveAnalysisId, serializable);
                                }
                            } else {
                                const defaultSys = t('geminiSystemInstruction') || 'You are an expert FMCG retail auditor analyzing a supermarket shelf photo. Output minified JSON according to schema.';
                                const defaultUsr = t(nextItem.analysisType === 'price' ? 'geminiPromptPriceOnly' : nextItem.analysisType === 'shelfShare' ? 'geminiPromptShelfShareOnly' : 'geminiPromptBoth') || 'Identify all retail products on this shelf with exact names, bounding boxes, and prices.';
                                const effectiveUserPrompt = nextItem.userPrompt || defaultUsr;
                                const effectiveSystemPrompt = nextItem.systemPrompt || defaultSys;
                                const effectiveMime = fileType === 'video/quicktime' ? 'video/mp4' : (fileType || 'image/jpeg');

                                const pipeline = PipelineFactory.getPipeline(!!nextItem.isWideShelf, !!nextItem.isVideoMode);
                                const result = await pipeline.analyze(
                                    base64, 
                                    effectiveUserPrompt, 
                                    effectiveSystemPrompt, 
                                    nextItem.model,
                                    undefined,
                                    undefined,
                                    effectiveMime
                                );
                                
                                const corrected = await Promise.all((result.products || []).map(async p => {
                                    const entry = await findProductByAlias(p.name);
                                    return { ...p, name: entry ? entry.canonicalName : p.name, isCorrected: !!entry, catalogProductId: entry?.id, id: `${nextItem.id}-${Math.random()}` };
                                }));

                                const successResult = { ...result, products: corrected };
                                await populateCatalogFromAnalysis({ images: [{ analysisResult: successResult }] });
                    
                                dispatch({ type: 'SET_SUCCESS', payload: { id: nextItem.id, result: successResult, compressedBase64: base64 } });
                                isComplete = true;

                                const saveAnalysisId = nextItem.targetAnalysisId || activeAnalysisIdRef.current;
                                if (saveAnalysisId) {
                                    const serializable: SerializableImageState = {
                                        id: nextItem.id,
                                        file: {
                                            name: fileName,
                                            type: fileType,
                                            lastModified: fileLastModified,
                                            data: base64
                                        },
                                        imageUrl: '',
                                        analysisResult: successResult,
                                        status: 'success',
                                        error: null,
                                        uploadDate: uploadDateIso,
                                        analysisType: nextItem.analysisType,
                                        model: nextItem.model,
                                        retryCount: attempt,
                                        assignedStore: nextItem.assignedStore,
                                        assignedStoreId: nextItem.assignedStoreId,
                                        productCategory: nextItem.productCategory
                                    };
                                    await autoSaveAnalysisImage(
                                        saveAnalysisId,
                                        serializable,
                                        successResult.usageMetadata
                                    );
                                }

                                if (corrected.length > 0) {
                                    const memory = await getBrandMemory();
                                    const memoryMap = new Map(memory.map(m => [m.brand, m.classification]));
                                    const newBrandsSet = new Set<string>();

                                    setBrandClassifications(prev => {
                                        const updatedOur = new Set(prev.ourBrands);
                                        const updatedComp = new Set(prev.competitorBrands);

                                        corrected.forEach(p => {
                                            const b = getBrandFromName(p.name);
                                            if (!b) return;
                                            const remembered = memoryMap.get(b);
                                            if (remembered === 'our') updatedOur.add(b);
                                            else if (remembered === 'competitor') updatedComp.add(b);
                                            else if (!updatedOur.has(b) && !updatedComp.has(b)) newBrandsSet.add(b);
                                        });

                                        return { ourBrands: Array.from(updatedOur), competitorBrands: Array.from(updatedComp) };
                                    });

                                    if (newBrandsSet.size > 0) {
                                        setBrandsForClassification(prev => Array.from(new Set([...prev, ...newBrandsSet])).sort());
                                        setIsBrandModalOpen(true);
                                    }
                                }
                            }
                        } catch (err: any) {
                            const rawMsg = err?.message || '';
                            const isAuth = (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('API key not valid') || rawMsg.includes('unregistered callers') || (rawMsg.includes('API key') && !rawMsg.includes('quota'))) && !rawMsg.includes('not found') && !rawMsg.includes('no longer available');
                            if (isAuth) {
                                setHasApiKey?.(false);
                                const authMsg = t('apiKeyError') || 'API key error. Please check your Gemini API credentials.';
                                dispatch({ type: 'SET_ERROR', payload: { id: nextItem.id, error: authMsg } });
                                const saveAnalysisId = nextItem.targetAnalysisId || activeAnalysisIdRef.current;
                                if (saveAnalysisId) {
                                    try {
                                        await autoSaveAnalysisImage(saveAnalysisId, {
                                            id: nextItem.id,
                                            file: { name: fileName, type: fileType, lastModified: fileLastModified, data: base64 || '' },
                                            imageUrl: '', analysisResult: null, status: 'error', error: authMsg,
                                            uploadDate: uploadDateIso, analysisType: nextItem.analysisType, model: nextItem.model,
                                            retryCount: attempt, assignedStore: nextItem.assignedStore, assignedStoreId: nextItem.assignedStoreId,
                                            productCategory: nextItem.productCategory
                                        });
                                    } catch { /* ignore */ }
                                }
                                isComplete = true;
                                break;
                            }

                            const isRetryable = isRetryableError(err?.message || '');
                            if (isRetryable && attempt < MAX_RETRIES) {
                                if (err?.message?.includes('429') || err?.message?.includes('resource_exhausted') || err?.message?.includes('quota')) {
                                    lastRateLimitTimeRef.current = Date.now();
                                }
                                attempt++;
                            } else {
                                const errorMsg = isRetryable 
                                    ? `${t('rateLimitError') || 'Request limit exceeded'} (${err?.message || ''})` 
                                    : (err?.message || (t('failedToAnalyze') || 'Failed to analyze image'));
                                dispatch({ type: 'SET_ERROR', payload: { id: nextItem.id, error: errorMsg } });
                                const saveAnalysisId = nextItem.targetAnalysisId || activeAnalysisIdRef.current;
                                if (saveAnalysisId) {
                                    try {
                                        await autoSaveAnalysisImage(saveAnalysisId, {
                                            id: nextItem.id,
                                            file: { name: fileName, type: fileType, lastModified: fileLastModified, data: base64 || '' },
                                            imageUrl: '', analysisResult: null, status: 'error', error: errorMsg,
                                            uploadDate: uploadDateIso, analysisType: nextItem.analysisType, model: nextItem.model,
                                            retryCount: attempt, assignedStore: nextItem.assignedStore, assignedStoreId: nextItem.assignedStoreId,
                                            productCategory: nextItem.productCategory
                                        });
                                    } catch { /* ignore */ }
                                }
                                isComplete = true;
                                break;
                            }
                        }
                    }
                } catch (prepErr: any) {
                    const prepMsg = prepErr?.message || t('failedToAnalyze');
                    dispatch({ type: 'SET_ERROR', payload: { id: nextItem.id, error: prepMsg } });
                    const saveAnalysisId = nextItem.targetAnalysisId || activeAnalysisIdRef.current;
                    if (saveAnalysisId) {
                        try {
                            let fallbackData = '';
                            try {
                                fallbackData = await fileToBase64(nextItem.file);
                            } catch { /* ignore */ }
                            await autoSaveAnalysisImage(saveAnalysisId, {
                                id: nextItem.id,
                                file: { name: nextItem.file.name, type: nextItem.file.type, lastModified: nextItem.file.lastModified, data: fallbackData },
                                imageUrl: '', analysisResult: null, status: 'error', error: prepMsg,
                                uploadDate: nextItem.uploadDate.toISOString(), analysisType: nextItem.analysisType, model: nextItem.model,
                                retryCount: 0, assignedStore: nextItem.assignedStore, assignedStoreId: nextItem.assignedStoreId,
                                productCategory: nextItem.productCategory
                            });
                        } catch { /* ignore */ }
                    }
                } finally {
                    activeProcessingIdsRef.current.delete(nextItem.id);
                    const pacingDelay = isThrottled ? 1200 : 400;
                    setTimeout(() => {
                        setQueueVersion(v => v + 1);
                    }, pacingDelay);
                }
            })();
        });
    }, [images, isOnline, queueVersion, t, language, setBrandClassifications, setBrandsForClassification, setIsBrandModalOpen, setHasApiKey]);

    const retryFailedImages = useCallback(() => {
        dispatch({ type: 'RETRY_FAILED' });
        setQueueVersion(v => v + 1);
    }, []);

    const retrySingleImage = useCallback((id: string) => {
        dispatch({ type: 'RETRY_SINGLE', payload: id });
        setQueueVersion(v => v + 1);
    }, []);

    return {
        images,
        dispatch,
        handleStartAnalysis,
        retryFailedImages,
        retrySingleImage
    };
}
