import React, { useReducer, useState, useEffect, useCallback, useRef } from 'react';
import { AnalysisResult, Store, BrandClassifications, PriceInfo } from '../types';
import { parseDateFromFileName, extractStoreFromFilename, compressImageWithWorker, fileToBase64, getBrandFromName, deepFreeze } from '../utils/helpers';
import { findOrCreateStore, getCatalogEntries, findProductByAlias, populateCatalogFromAnalysis, getBrandMemory, db } from '../db';
import { analyzeImageWithGemini } from '../services/geminiService';
import { useTranslation } from '../i18n/index';

export type AnalysisType = 'price' | 'shelfShare' | 'both' | 'osa' | 'qualityCheck';

export interface ImageState {
  id: string;
  file: File;
  imageUrl: string;
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
}

type ImageAction = 
  | { type: 'ADD_IMAGES'; payload: ImageState[] }
  | { type: 'SET_ANALYZING'; payload: string }
  | { type: 'SET_PENDING'; payload: string }
  | { type: 'SET_SUCCESS'; payload: { id: string; result: AnalysisResult; store?: Store; storeId?: number } }
  | { type: 'SET_ERROR'; payload: { id: string; error: string; needsAuthReset?: boolean } }
  | { type: 'UPDATE_PRICES'; payload: { imageId: string; productId: string; prices: PriceInfo[] }[] }
  | { type: 'RENAME_PRODUCT'; payload: { imageId: string; productId: string; newName: string } }
  | { type: 'CORRECT_PRODUCT'; payload: { imageId: string; name: string; newName: string; prices: PriceInfo[]; count: number } }
  | { type: 'CLEAR_ALL' };

function imageReducer(state: ImageState[], action: ImageAction): ImageState[] {
  switch (action.type) {
    case 'ADD_IMAGES': return [...action.payload, ...state];
    case 'SET_ANALYZING': return state.map(img => img.id === action.payload ? { ...img, status: 'analyzing' } : img);
    case 'SET_PENDING': return state.map(img => img.id === action.payload ? { ...img, status: 'pending', error: null } : img);
    case 'SET_SUCCESS': return state.map(img => img.id === action.payload.id ? { 
        ...img, status: 'success', analysisResult: deepFreeze(action.payload.result),
        assignedStore: action.payload.store || img.assignedStore, assignedStoreId: action.payload.storeId || img.assignedStoreId
    } : img);
    case 'SET_ERROR': return state.map(img => img.id === action.payload.id ? { ...img, status: 'error', error: action.payload.error } : img);
    case 'UPDATE_PRICES': {
        return state.map(img => {
            const updates = action.payload.filter(u => u.imageId === img.id);
            if (!updates.length || !img.analysisResult) return img;
            const updatedProducts = img.analysisResult.products.map(p => {
                const update = updates.find(u => u.productId === p.id);
                return update ? { ...p, prices: update.prices } : p;
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
                    isCorrected: true,
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
    case 'CLEAR_ALL': return [];
    default: return state;
  }
}

export function useImageAnalysis(
    brandClassifications: BrandClassifications, 
    setBrandClassifications: React.Dispatch<React.SetStateAction<BrandClassifications>>,
    setBrandsForClassification: React.Dispatch<React.SetStateAction<string[]>>,
    setIsBrandModalOpen: React.Dispatch<React.SetStateAction<boolean>>,
    setHasApiKey: React.Dispatch<React.SetStateAction<boolean>>
) {
    const [images, dispatch] = useReducer(imageReducer, []);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const { t, language } = useTranslation();
    const isCurrentlyProcessingRef = useRef(false);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleStartAnalysis = useCallback(async (type: AnalysisType, model: string, filesToProcess: File[], productCategory?: string, qualityCheckId?: string) => {
        const tempImages: ImageState[] = await Promise.all(filesToProcess.map(async (file) => {
            const storeName = extractStoreFromFilename(file.name);
            let store: Store | null = null;
            if (storeName) {
                 try { store = await findOrCreateStore({ name: storeName, chain: storeName.split(',')[0].trim(), city: '', address: '', code: '' }); } catch { /* ignore */ }
            }
            return {
                id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                file, imageUrl: URL.createObjectURL(file), analysisResult: null, status: 'pending', error: null,
                uploadDate: parseDateFromFileName(file.name) || new Date(file.lastModified),
                analysisType: type, model, retryCount: 0, assignedStore: store, assignedStoreId: store?.id,
                productCategory,
                qualityCheckId
            };
        }));
        dispatch({ type: 'ADD_IMAGES', payload: tempImages });
    }, []);

    useEffect(() => {
        if (isCurrentlyProcessingRef.current) return;
        
        const BATCH_SIZE = 3;
        const nextBatch = images.filter(img => img.status === 'pending').slice(0, BATCH_SIZE);
        if (nextBatch.length === 0) return;
    
        const process = async () => {
            isCurrentlyProcessingRef.current = true;
            nextBatch.forEach(img => dispatch({ type: 'SET_ANALYZING', payload: img.id }));
    
            const allCorrectedProducts: any[] = [];
            let authErrorOccurred = false;
 
            await Promise.all(nextBatch.map(async (next) => {
                try {
                    const compressedFile = await compressImageWithWorker(next.file);
                    const base64 = await fileToBase64(compressedFile);

                    if (next.analysisType === 'qualityCheck') {
                        let template = null;
                        if (next.qualityCheckId) {
                            template = await db.quality_checks.get(next.qualityCheckId);
                        }
                        if (!template) {
                            const templates = await db.quality_checks.orderBy('createdAt').reverse().toArray();
                            if (templates && templates.length > 0) {
                                template = templates[0];
                            }
                        }

                        if (!template) {
                            throw new Error('Nenašiel sa žiadny vzorový planogram pre porovnanie. Vytvorte si ho prosím v sekcii "Planogram Quality Check".');
                        }

                        const { analyzeQualityCheck } = await import('../services/geminiService');
                        const qResult = await analyzeQualityCheck(
                            template.referenceImages,
                            template.description,
                            base64,
                            next.model,
                            language
                        );

                        const successResult: AnalysisResult = {
                            products: [],
                            modelName: next.model,
                            complianceScore: qResult.complianceScore,
                            reason: qResult.reason,
                            storeInfo: {}
                        };

                        dispatch({ type: 'SET_SUCCESS', payload: { id: next.id, result: successResult } });
                    } else {
                        const catalog = await getCatalogEntries();
                        
                        // Filter down catalog to only selected productCategory if available to maximize Gemini segment focus
                        const filteredCatalog = (next.productCategory && catalog.some(e => e.category === next.productCategory))
                            ? catalog.filter(e => e.category === next.productCategory)
                            : catalog;

                        const known = filteredCatalog.map(e => e.visualFeatures ? `${e.canonicalName} (Visuals: ${e.visualFeatures})` : e.canonicalName).join(', ');
                        const prompt = t(next.analysisType === 'price' ? 'geminiPromptPriceOnly' : next.analysisType === 'shelfShare' ? 'geminiPromptShelfShareOnly' : 'geminiPromptBoth').replace('{{knownProducts}}', known);
                        
                        const clientName = next.assignedStore?.chain || next.assignedStore?.name;
                        const result = await analyzeImageWithGemini(base64, prompt, t('geminiSystemInstruction'), next.analysisType as any, next.model, next.productCategory, clientName);
                        
                        const corrected = await Promise.all((result.products || []).map(async p => {
                            const entry = await findProductByAlias(p.name);
                            return { ...p, name: entry ? entry.canonicalName : p.name, isCorrected: !!entry, catalogProductId: entry?.id, id: `${next.id}-${Math.random()}` };
                        }));
            
                        allCorrectedProducts.push(...corrected);

                        // AUTO-FILL CATALOG: Ensure found products are in the master database
                        const successResult = { ...result, products: corrected };
                        await populateCatalogFromAnalysis({ images: [{ analysisResult: successResult }] });
            
                        dispatch({ type: 'SET_SUCCESS', payload: { id: next.id, result: successResult } });
                    }
                } catch (e: any) {
                    const isAuth = e?.message?.includes('entity was not found');
                    if (isAuth) authErrorOccurred = true;
                    dispatch({ type: 'SET_ERROR', payload: { id: next.id, error: isAuth ? t('apiKeyError') : (e?.message || t('failedToAnalyze')) } });
                }
            }));

            if (authErrorOccurred) {
                setHasApiKey(false);
            }

            if (allCorrectedProducts.length > 0) {
                const memory = await getBrandMemory();
                const memoryMap = new Map(memory.map(m => [m.brand, m.classification]));
                
                const newBrandsSet = new Set<string>();
                const updatedOur = new Set(brandClassifications.ourBrands);
                const updatedComp = new Set(brandClassifications.competitorBrands);
    
                allCorrectedProducts.forEach(p => {
                    const b = getBrandFromName(p.name);
                    if (!b) return;
                    const remembered = memoryMap.get(b);
                    if (remembered === 'our') updatedOur.add(b);
                    else if (remembered === 'competitor') updatedComp.add(b);
                    else if (!updatedOur.has(b) && !updatedComp.has(b)) newBrandsSet.add(b);
                });
    
                setBrandClassifications({ ourBrands: Array.from(updatedOur), competitorBrands: Array.from(updatedComp) });
    
                if (newBrandsSet.size > 0) {
                    setBrandsForClassification(prev => Array.from(new Set([...prev, ...newBrandsSet])).sort());
                    setIsBrandModalOpen(true);
                }
            }

            isCurrentlyProcessingRef.current = false;
        };
    
        process();
    }, [images, isOnline, t, language, brandClassifications, setBrandClassifications, setBrandsForClassification, setIsBrandModalOpen, setHasApiKey]);

    return {
        images,
        dispatch,
        handleStartAnalysis
    };
}
