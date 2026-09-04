
import Dexie, { type Table } from 'dexie';
import type { Analysis, ProductCatalogEntry, BrandMemoryEntry, Store, AnalysisResult, SearchResult, SearchMatch, SearchIndexEntry, DistributionReport, PromptTemplate, QualityCheck } from './types';
import { normalizeProductName, findBestMatch, calculateStringSimilarity, getBrandFromName, base64ToFile, invalidateHelperCache } from './utils/helpers';
import { ProductHistoryPoint } from './types';

// Short-lived in-memory cache pre zoznam produktov v katalógu na urýchlenie batch operácií
let catalogCache: ProductCatalogEntry[] | null = null;
let catalogCacheTime = 0;

// Cache map for alias resolution
const aliasResolveCache = new Map<string, ProductCatalogEntry | undefined>();

export const getCachedCatalog = async (): Promise<ProductCatalogEntry[]> => {
    const now = Date.now();
    if (!catalogCache || now - catalogCacheTime > 2000) {
        catalogCache = await db.product_catalog.toArray();
        catalogCacheTime = now;
    }
    return catalogCache;
};

export const invalidateCatalogCache = (): void => {
    catalogCache = null;
    catalogCacheTime = 0;
    aliasResolveCache.clear();
    invalidateHelperCache();
};

// Short-lived in-memory cache for stores list
let storesCache: Store[] | null = null;
let storesCacheTime = 0;

export const getCachedStores = async (): Promise<Store[]> => {
    const now = Date.now();
    if (!storesCache || now - storesCacheTime > 2000) {
        storesCache = await db.stores.toArray();
        storesCacheTime = now;
    }
    return storesCache;
};

export const invalidateStoresCache = (): void => {
    storesCache = null;
    storesCacheTime = 0;
};


const tokenize = (text: string): string[] => {
    if (!text) return [];
    return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
};

const createIndexEntriesForAnalysis = (analysis: Analysis, catalog: ProductCatalogEntry[]): SearchIndexEntry[] => {
    const entries: SearchIndexEntry[] = [];
    const analysisId = analysis.id;

    const addEntry = (type: SearchMatch['type'], content: string | undefined | null) => {
        if (!content || !content.trim()) return;
        const context = content.trim();
        entries.push({
            analysisId,
            type,
            contentTokens: tokenize(context),
            context,
        });
    };

    addEntry('analysis_name', analysis.name);

    if (analysis.store) {
        addEntry('store_name', analysis.store.name);
        addEntry('store_chain', analysis.store.chain);
    }

    const uniqueProductNames = new Set<string>();
    analysis.images.forEach(img => {
        if (img.analysisResult?.products && Array.isArray(img.analysisResult.products)) {
            img.analysisResult.products.forEach(p => {
                if(p && p.name) uniqueProductNames.add(p.name);
            });
        }
    });

    for (const productName of uniqueProductNames) {
        addEntry('product_name', productName);
        const brand = getBrandFromName(productName);
        addEntry('product_brand', brand);
        
        const catalogEntry = catalog.find(e => 
            normalizeProductName(e.canonicalName) === normalizeProductName(productName) || 
            e.aliases.some(alias => normalizeProductName(alias) === normalizeProductName(productName))
        );

        if (catalogEntry) {
            addEntry('manufacturer', catalogEntry.manufacturer);
            catalogEntry.aliases.forEach(alias => addEntry('product_alias', alias));
        }
    }
    
    return entries;
};

export class SaiDatabase extends Dexie {
  visits!: Table<Analysis, string>;
  analyses!: Table<Analysis, string>;
  product_catalog!: Table<ProductCatalogEntry, number>;
  brand_memory!: Table<BrandMemoryEntry, string>;
  stores!: Table<Store, number>;
  search_index!: Table<SearchIndexEntry, number>;
  distribution_reports!: Table<DistributionReport, number>;
  settings!: Table<{ key: string, value: any }, string>; 
  prompts!: Table<PromptTemplate, number>;
  quality_checks!: Table<QualityCheck, string>;

  constructor() {
    super('sai-database');
    
    (this as any).version(15).stores({ analyses: 'id, name, createdAt, store.name, *images.analysisResult.products.name', product_catalog: '++id, canonicalName, sku, category, *aliases', brand_memory: '&brand', stores: '++id, &name, chain, city', search_index: '++id, analysisId, type, *contentTokens', distribution_reports: '++id, name, createdAt' });

    (this as any).version(16).stores({
        analyses: 'id, name, createdAt, store.name, storeId, *images.analysisResult.products.name',
        product_catalog: '++id, canonicalName, sku, category, *aliases',
        brand_memory: '&brand',
        stores: '++id, &name, chain, city',
        search_index: '++id, analysisId, type, *contentTokens',
        distribution_reports: '++id, name, createdAt'
    });

    (this as any).version(17).stores({
        analyses: 'id, name, createdAt, store.name, storeId, *images.analysisResult.products.name',
        product_catalog: '++id, canonicalName, sku, category, *aliases',
        brand_memory: '&brand',
        stores: '++id, code, &name, chain, city', 
        search_index: '++id, analysisId, type, *contentTokens',
        distribution_reports: '++id, name, createdAt'
    });

    (this as any).version(19).stores({
        analyses: 'id, name, createdAt, store.name, storeId, *images.analysisResult.products.name',
        product_catalog: '++id, canonicalName, sku, category, *aliases',
        brand_memory: '&brand',
        stores: '++id, code, &name, chain, city', 
        search_index: '++id, analysisId, type, *contentTokens',
        distribution_reports: '++id, name, createdAt'
    });

    (this as any).version(23).stores({
        analyses: 'id, name, createdAt, storeId, *images.analysisResult.products.name', 
        product_catalog: '++id, canonicalName, sku, category, *aliases',
        brand_memory: '&brand',
        stores: '++id, code, &name, chain, city',
        search_index: '++id, analysisId, type, *contentTokens',
        distribution_reports: '++id, name, createdAt'
    });

    (this as any).version(24).stores({
        analyses: 'id, name, createdAt, storeId, *images.analysisResult.products.name', 
        product_catalog: '++id, canonicalName, sku, category, *aliases',
        brand_memory: '&brand',
        stores: '++id, code, &name, chain, city',
        search_index: '++id, analysisId, type, *contentTokens',
        distribution_reports: '++id, name, createdAt',
        settings: 'key',
        prompts: '++id, category, isActive'
    });

    (this as any).version(25).stores({
        analyses: 'id, name, createdAt, storeId, *images.analysisResult.products.name', 
        product_catalog: '++id, canonicalName, sku, category, *aliases',
        brand_memory: '&brand',
        stores: '++id, code, &name, chain, city',
        search_index: '++id, analysisId, type, *contentTokens',
        distribution_reports: '++id, name, createdAt',
        settings: 'key',
        prompts: '++id, category, isActive',
        quality_checks: 'id, name, createdAt'
    });
  }
}

export const db = new SaiDatabase();

const normalizeStoreData = (store: Store | { name: string, chain?: string, address?: string, city?: string, code?: string }): Store | (Omit<Store, 'id'> & { id?: number }) => {
    const newStore: Store | (Omit<Store, 'id'> & { id?: number }) = { ...store };
    if (newStore.code === '' || newStore.code === null) {
        delete newStore.code;
    }
    return newStore;
};

export const getAnalyses = (): Promise<Analysis[]> => db.analyses.orderBy('createdAt').reverse().toArray();
export const saveAnalysis = async (analysis: Analysis): Promise<string> => {
    const catalog = await getCachedCatalog();
    return (db as any).transaction('rw', db.analyses, db.search_index, async () => {
        await db.search_index.where('analysisId').equals(analysis.id).delete();
        const entries = createIndexEntriesForAnalysis(analysis, catalog);
        if (entries.length > 0) {
            const chunkSize = 50;
            for (let i = 0; i < entries.length; i += chunkSize) {
                const chunk = entries.slice(i, i + chunkSize);
                await db.search_index.bulkAdd(chunk);
            }
        }
        return db.analyses.put(analysis);
    });
};
export const loadAnalysis = (id: string): Promise<Analysis | undefined> => db.analyses.get(id);
export const deleteAnalysis = (id: string): Promise<void> => {
    return (db as any).transaction('rw', db.analyses, db.search_index, async () => {
        await db.analyses.delete(id);
        await db.search_index.where('analysisId').equals(id).delete();
    });
};
export const renameAnalysis = (id: string, newName: string): Promise<number> => {
    return (db as any).transaction('rw', db.analyses, db.search_index, async () => {
        const updateCount = await db.analyses.update(id, { name: newName });
        if (updateCount > 0) {
            const existingEntry = await db.search_index.where({ analysisId: id, type: 'analysis_name' }).first();
            if (existingEntry) {
                 await db.search_index.update(existingEntry.id!, { contentTokens: tokenize(newName), context: newName });
            } else {
                 const newEntry: SearchIndexEntry = { analysisId: id, type: 'analysis_name', contentTokens: tokenize(newName), context: newName };
                 await db.search_index.add(newEntry);
            }
        }
        return updateCount;
    });
};

export const getStores = async (): Promise<Store[]> => {
    const list = await getCachedStores();
    // Return a sorted copy to match previous behavior
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
};

export const addStore = async (store: Store): Promise<number> => {
    const preparedStore = normalizeStoreData(store) as Store;
    const result = await db.stores.add(preparedStore);
    invalidateStoresCache();
    return result;
};

export const updateStore = async (store: Store): Promise<number> => {
    const preparedStore = normalizeStoreData(store) as Store;
    const result = await db.stores.put(preparedStore);
    invalidateStoresCache();
    return result;
};

export const deleteStore = async (id: number): Promise<void> => {
    await db.stores.delete(id);
    invalidateStoresCache();
};

export const findStoreFuzzy = async (nameToCheck: string): Promise<Store | undefined> => {
    if (!nameToCheck) return undefined;
    const normalize = (s: string) => s.toLowerCase().replace(/[.,\-_/]/g, '').replace(/\s+/g, '');
    const normalizedTarget = normalize(nameToCheck);
    const allStores = await getCachedStores();
    return allStores.find(store => {
        const normalizedStoreName = normalize(store.name);
        if (normalizedStoreName === normalizedTarget) return true;
        if (normalizedStoreName.includes(normalizedTarget) || normalizedTarget.includes(normalizedStoreName)) return true;
        return false;
    });
};

export const findOrCreateStore = async (storeData: { name: string, chain?: string, address?: string, city?: string, code?: string }): Promise<Store> => {
    const preparedStoreData = normalizeStoreData(storeData); 
    const effectiveCode = (preparedStoreData as Store).code;

    if (effectiveCode !== undefined && effectiveCode.trim() !== '') { 
        const existingByCode = await db.stores.where('code').equals(effectiveCode).first();
        if (existingByCode) {
            return existingByCode;
        }
    }

    const existingByName = await findStoreFuzzy(storeData.name);
    if (existingByName && existingByName.id) {
        return existingByName;
    }

    const id = await db.stores.add(preparedStoreData as Omit<Store, 'id'>);
    invalidateStoresCache();
    return { ...(preparedStoreData as Omit<Store, 'id'>), id };
};

export const getDistributionReports = (): Promise<DistributionReport[]> => db.distribution_reports.orderBy('createdAt').reverse().toArray();
export const saveDistributionReport = (report: DistributionReport): Promise<number> => db.distribution_reports.put(report);
export const deleteDistributionReport = (id: number): Promise<void> => db.distribution_reports.delete(id);
export const searchAnalyses = async (term: string): Promise<SearchResult[]> => {
    if (!term || term.trim().length < 2) return [];
    
    const lowerTerm = term.trim().toLowerCase();
    const searchTokens = tokenize(lowerTerm);
    if (searchTokens.length === 0) return [];

    const candidateKeys = await db.search_index
        .where('contentTokens').startsWithAnyOf(searchTokens)
        .uniqueKeys();

    const uniqueEntries = await db.search_index.bulkGet(candidateKeys as number[]);

    const SIMILARITY_THRESHOLD = 70;
    const fuzzyFilteredEntries = uniqueEntries.filter((entry): entry is SearchIndexEntry => {
        if (!entry) return false;
        const content = entry.context.toLowerCase();
        if (content.includes(lowerTerm)) return true;
        return calculateStringSimilarity(content, lowerTerm) >= SIMILARITY_THRESHOLD;
    });

    if (fuzzyFilteredEntries.length === 0) return [];

    const resultsByAnalysisId = new Map<string, { analysis?: Analysis, matches: SearchMatch[] }>();

    for (const entry of fuzzyFilteredEntries) {
        if (!resultsByAnalysisId.has(entry.analysisId)) {
            resultsByAnalysisId.set(entry.analysisId, { matches: [] });
        }
        const result = resultsByAnalysisId.get(entry.analysisId)!;
        
        const key = `${entry.type}:${entry.context}`;
        if (!result.matches.some(m => `${m.type}:${m.context}` === key)) {
            result.matches.push({
                type: entry.type,
                context: entry.context,
            });
        }
    }

    const analysisIds = Array.from(resultsByAnalysisId.keys());
    const analyses = await db.analyses.bulkGet(analysisIds);

    analyses.forEach(analysis => {
        if (analysis) {
            const result = resultsByAnalysisId.get(analysis.id);
            if (result) {
                result.analysis = analysis;
            }
        }
    });

    return Array.from(resultsByAnalysisId.values())
        .filter((result): result is SearchResult => !!result.analysis)
        .sort((a, b) => new Date(b.analysis.createdAt).getTime() - new Date(a.analysis.createdAt).getTime());
};

const parsePrice = (priceValue: string): number | null => {
  const cleaned = priceValue.replace(',', '.').replace(/[^\d.]/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
};

export const getCatalogProductNames = async (): Promise<string[]> => {
    const catalogEntries = await getCachedCatalog();
    return catalogEntries.map(entry => entry.canonicalName);
};

export const getCatalogEntries = async (): Promise<ProductCatalogEntry[]> => {
    return await getCachedCatalog();
};

export const addCatalogEntry = async (entry: ProductCatalogEntry): Promise<number> => {
    const result = await db.product_catalog.add(entry);
    invalidateCatalogCache();
    return result;
};

export const updateCatalogEntry = async (id: number, entry: Partial<ProductCatalogEntry>): Promise<number> => {
    const result = await db.product_catalog.update(id, entry);
    invalidateCatalogCache();
    return result;
};

export const deleteCatalogEntry = async (id: number): Promise<void> => {
    await db.product_catalog.delete(id);
    invalidateCatalogCache();
};

export const bulkUpdateCatalogEntries = async (ids: number[], changes: Partial<ProductCatalogEntry>): Promise<number> => {
    return await (db as any).transaction('rw', db.product_catalog, async () => {
        let updatedCount = 0;
        for (const id of ids) {
            const result = await db.product_catalog.update(id, changes);
            updatedCount += result;
        }
        invalidateCatalogCache();
        return updatedCount;
    });
};

export const bulkDeleteCatalogEntries = async (ids: number[]): Promise<void> => {
    await db.product_catalog.bulkDelete(ids);
    invalidateCatalogCache();
};

export const mergeCatalogEntries = async (targetId: number, sourceIds: number[]): Promise<void> => {
    return await (db as any).transaction('rw', db.product_catalog, async () => {
        const targetEntry = await db.product_catalog.get(targetId);
        const sourceEntries = await db.product_catalog.bulkGet(sourceIds);
        
        if (!targetEntry) throw new Error("Target entry not found");

        const newAliases = new Set(targetEntry.aliases || []);
        const newImages = new Set(targetEntry.referenceImages || []);
        let updatedManufacturer = targetEntry.manufacturer;
        let updatedCategory = targetEntry.category;
        let updatedSku = targetEntry.sku;

        sourceEntries.forEach(source => {
            if (!source) return;
            if (source.canonicalName !== targetEntry.canonicalName) {
                newAliases.add(source.canonicalName);
            }
            if (source.aliases) {
                source.aliases.forEach(a => newAliases.add(a));
            }
            if (source.referenceImages) {
                source.referenceImages.forEach(img => newImages.add(img));
            }
            if (!updatedManufacturer && source.manufacturer) updatedManufacturer = source.manufacturer;
            if (!updatedCategory && source.category) updatedCategory = source.category;
            if (!updatedSku && source.sku) updatedSku = source.sku;
        });

        await db.product_catalog.update(targetId, {
            aliases: Array.from(newAliases),
            referenceImages: Array.from(newImages),
            manufacturer: updatedManufacturer,
            category: updatedCategory,
            sku: updatedSku
        });

        await db.product_catalog.bulkDelete(sourceIds);
        invalidateCatalogCache();
    });
};

export const getProductHistory = async (canonicalName: string): Promise<ProductHistoryPoint[]> => {
    const history: ProductHistoryPoint[] = [];
    const catalogEntry = await db.product_catalog.where('canonicalName').equalsIgnoreCase(canonicalName).first();
    if (!catalogEntry) return [];

    const nameVariations = new Set([normalizeProductName(catalogEntry.canonicalName), ...catalogEntry.aliases.map(normalizeProductName)]);
    const allAnalyses = await db.analyses.toArray();

    for (const analysis of allAnalyses) {
        if (!analysis.images) continue;
        const storeNameForHistory = analysis.store?.name || "Neznáma predajňa";

        for (const image of analysis.images) {
            if (!image.analysisResult?.products) continue;
            for (const product of image.analysisResult.products) {
                if (nameVariations.has(normalizeProductName(product.name))) {
                    if (product.prices && Array.isArray(product.prices)) {
                        for (const price of product.prices) {
                            const numericPrice = parsePrice(price.value);
                            if (numericPrice !== null && (price.type === 'REGULAR' || price.type === 'PROMO')) {
                                history.push({ 
                                    date: image.uploadDate, 
                                    price: numericPrice, 
                                    type: price.type, 
                                    storeName: storeNameForHistory,
                                    analysisId: analysis.id,
                                    imageId: image.id,
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    return history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export const getImageUrlFromIds = async (analysisId: string, imageId: string): Promise<string | null> => {
    const analysis = await db.analyses.get(analysisId);
    if (!analysis) return null;
    
    const imageState = analysis.images.find(img => img.id === imageId);
    if (!imageState) return null;

    const file = base64ToFile(
        imageState.file.data,
        imageState.file.name,
        imageState.file.type,
        imageState.file.lastModified
    );
    return URL.createObjectURL(file);
};

export const findProductByAlias = async (alias: string): Promise<ProductCatalogEntry | undefined> => {
    if (!alias) return undefined;
    const cacheKey = alias.trim().toLowerCase();
    if (aliasResolveCache.has(cacheKey)) {
        return aliasResolveCache.get(cacheKey);
    }

    const allEntries = await getCachedCatalog();
    const candidates = allEntries.flatMap(entry => {
        const list = [{ name: entry.canonicalName, visualFeatures: entry.visualFeatures, isAlias: false }];
        if (entry.aliases) {
            entry.aliases.forEach(a => list.push({ name: a, visualFeatures: entry.visualFeatures, isAlias: true }));
        }
        return list;
    });

    const bestMatchName = findBestMatch(alias, candidates);
    let result: ProductCatalogEntry | undefined = undefined;

    if (bestMatchName) {
        result = allEntries.find(entry => 
            entry.canonicalName === bestMatchName || (entry.aliases && entry.aliases.includes(bestMatchName))
        );
    }
    
    aliasResolveCache.set(cacheKey, result);
    return result;
};

export const addOrUpdateProductCorrection = async (originalName: string, newName: string): Promise<void> => {
    const normalizedNew = normalizeProductName(newName);
    const normalizedOriginal = normalizeProductName(originalName);
    if (normalizedNew === normalizedOriginal || !normalizedNew) return;

    await (db as any).transaction('rw', db.product_catalog, db.search_index, async () => {
        const targetEntry = await findProductByAlias(newName);
        const originalEntry = await findProductByAlias(originalName);

        if (targetEntry && originalEntry && targetEntry.id === originalEntry.id) {
             if (normalizeProductName(targetEntry.canonicalName) !== normalizedNew) {
                targetEntry.canonicalName = newName;
                await db.product_catalog.put(targetEntry);
             }
             return;
         }

        if (targetEntry) {
            if (originalEntry) {
                const aliasesToAdd = new Set([...targetEntry.aliases, originalEntry.canonicalName, ...originalEntry.aliases]);
                aliasesToAdd.delete(targetEntry.canonicalName);
                targetEntry.aliases = Array.from(aliasesToAdd);
                if (originalEntry.manufacturer && !targetEntry.manufacturer) targetEntry.manufacturer = originalEntry.manufacturer;
                await db.product_catalog.put(targetEntry);
                await db.product_catalog.delete(originalEntry.id!);
            } else {
                if (!targetEntry.aliases.includes(originalName) && targetEntry.canonicalName !== originalName) {
                    targetEntry.aliases.push(originalName);
                    await db.product_catalog.put(targetEntry);
                }
            }
        } else if (originalEntry) {
            const newAliases = new Set([...originalEntry.aliases, originalName]);
            newAliases.delete(newName);
            originalEntry.canonicalName = newName;
            originalEntry.aliases = Array.from(newAliases);
            await db.product_catalog.put(originalEntry);
        } else {
            await db.product_catalog.add({ canonicalName: newName, aliases: [originalName], manufacturer: '' });
        }
    });
    
    invalidateCatalogCache();
};

export const populateCatalogFromAnalysis = async (analysis: { images: { analysisResult: AnalysisResult | null }[] }): Promise<void> => {
    const allProducts = analysis.images.flatMap(img => img.analysisResult?.products || []);
    if (allProducts.length === 0) return;

    // Načítame katalóg jednorazovo mimo transakcie na zníženie počtu dopytov do databázy
    const allEntries = await getCachedCatalog();
    const existingNames = new Set<string>();
    
    allEntries.forEach(entry => {
        existingNames.add(normalizeProductName(entry.canonicalName));
        if (entry.aliases) {
            entry.aliases.forEach(alias => existingNames.add(normalizeProductName(alias)));
        }
    });

    const entriesToAdd: ProductCatalogEntry[] = [];
    const addedInThisBatch = new Set<string>();

    for (const product of allProducts) {
        if (!product || !product.name) continue;
        const normalized = normalizeProductName(product.name);
        if (!existingNames.has(normalized) && !addedInThisBatch.has(normalized)) {
            entriesToAdd.push({
                canonicalName: product.name,
                manufacturer: product.brand || '',
                aliases: []
            });
            addedInThisBatch.add(normalized);
        }
    }

    if (entriesToAdd.length > 0) {
        // Vykonáme rýchly bulk zápis po menších blokoch (chunks)
        await (db as any).transaction('rw', db.product_catalog, async () => {
            const chunkSize = 50;
            for (let i = 0; i < entriesToAdd.length; i += chunkSize) {
                const chunk = entriesToAdd.slice(i, i + chunkSize);
                await db.product_catalog.bulkAdd(chunk);
            }
        });
        invalidateCatalogCache();
    }
};

export const getBrandMemory = (): Promise<BrandMemoryEntry[]> => db.brand_memory.toArray();
export const saveBrandClassification = (brand: string, classification: 'our' | 'competitor'): Promise<string> => db.brand_memory.put({ brand, classification });

export const MODEL_PRICING_TABLE: Record<string, { input: number; output: number }> = {
    'gemini-3.6-flash': { input: 0.75, output: 3.75 },
    'gemini-3.6-pro': { input: 2.00, output: 12.00 },
    'gemini-3.7-flash': { input: 0.75, output: 3.75 },
    'gemini-3.5-flash': { input: 1.50, output: 9.00 },
    'gemini-3.5-flash-lite': { input: 0.30, output: 2.50 },
    'gemini-3.1-pro-preview': { input: 2.00, output: 12.00 },
    'gemini-3.1-flash-lite': { input: 0.10, output: 0.40 },
    'gemini-2.5-flash': { input: 0.30, output: 2.50 },
    'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
    'gemini-2.5-pro': { input: 1.25, output: 10.00 },
    'gemini-3-flash-preview': { input: 0.75, output: 3.75 },
    'gemini-3-pro-preview': { input: 2.00, output: 12.00 },
};

export const getSetting = async (key: string, defaultValue: any): Promise<any> => {
    const item = await db.settings.get(key);
    return item ? item.value : defaultValue;
};

export const setSetting = async (key: string, value: any): Promise<string> => {
    return db.settings.put({ key, value });
};

export const recalculateAllCosts = async (inputRateOverride?: number, outputRateOverride?: number): Promise<void> => {
    // Načítame analýzy mimo zápisovej transakcie na zamedzenie zbytočného držania zámku
    const analyses = await db.analyses.toArray();
    
    const updates = analyses.map(analysis => {
        let totalInput = 0;
        let totalOutput = 0;
        let totalCost = 0;
        let usedModel = 'gemini-3.6-flash';

        analysis.images.forEach(img => {
            if (img.analysisResult?.usageMetadata) {
                const meta = img.analysisResult.usageMetadata;
                totalInput += meta.promptTokenCount || 0;
                totalOutput += meta.candidatesTokenCount || 0;
                
                const model = img.analysisResult.modelName || 'gemini-3.6-flash';
                usedModel = model;
                const pricing = MODEL_PRICING_TABLE[model] || MODEL_PRICING_TABLE['gemini-3.6-flash'];
                
                const inRate = inputRateOverride !== undefined ? inputRateOverride : pricing.input;
                const outRate = outputRateOverride !== undefined ? outputRateOverride : pricing.output;
                
                totalCost += (meta.promptTokenCount / 1000000) * inRate;
                totalCost += (meta.candidatesTokenCount / 1000000) * outRate;
            }
        });

        return {
            id: analysis.id,
            costInfo: {
                inputTokens: totalInput,
                outputTokens: totalOutput,
                cost: totalCost,
                modelName: usedModel
            }
        };
    });

    // Uložíme zmeny po menších blokoch (chunks), aby sme predišli veľkým zámkom na tabuľke
    const chunkSize = 20;
    for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize);
        await (db as any).transaction('rw', db.analyses, async () => {
            for (const upd of chunk) {
                await db.analyses.update(upd.id, { costInfo: upd.costInfo });
            }
        });
    }
};

export const getPromptHistory = async (category: PromptTemplate['category'], productCategory?: string, clientName?: string): Promise<PromptTemplate[]> => {
    const all = await db.prompts.where('category').equals(category).toArray();
    return all.filter(p => p.productCategory === productCategory && p.clientName === clientName);
};

export const saveNewPromptVersion = async (
    category: PromptTemplate['category'], 
    text: string, 
    productCategory?: string,
    clientName?: string,
    description?: string,
    label?: string
): Promise<number> => {
    return (db as any).transaction('rw', db.prompts, async () => {
        const history = await db.prompts.where('category').equals(category).toArray();
        const filteredHistory = history.filter(p => p.productCategory === productCategory && p.clientName === clientName);
        const maxVersion = filteredHistory.reduce((max, p) => Math.max(max, p.version), 0);
        
        // Deactivate others with matching productCategory and clientName
        const sameSpecActive = history.filter(p => p.productCategory === productCategory && p.clientName === clientName && p.isActive);
        for (const p of sameSpecActive) {
            if (p.id) {
                await db.prompts.update(p.id, { isActive: false });
            }
        }
        
        return db.prompts.add({
            category,
            text,
            productCategory,
            clientName,
            description,
            label,
            version: maxVersion + 1,
            isActive: true,
            createdAt: new Date().toISOString()
        });
    });
};

export const setActivePromptVersion = async (id: number): Promise<void> => {
    return (db as any).transaction('rw', db.prompts, async () => {
        const prompt = await db.prompts.get(id);
        if (!prompt) return;
        
        const existing = await db.prompts.where('category').equals(prompt.category).toArray();
        const sameSpecActive = existing.filter(p => p.productCategory === prompt.productCategory && p.clientName === prompt.clientName && p.isActive);
        for (const p of sameSpecActive) {
            if (p.id) {
                await db.prompts.update(p.id, { isActive: false });
            }
        }
        await db.prompts.update(id, { isActive: true });
    });
};

export const getActivePrompt = async (
    category: PromptTemplate['category'], 
    productCategory?: string,
    clientName?: string
): Promise<PromptTemplate | undefined> => {
    const activePrompts = await db.prompts.where({ category, isActive: true }).toArray();
    
    // 1. Specific client AND specific productCategory match
    if (clientName && productCategory) {
        const matched = activePrompts.find(p => p.clientName === clientName && p.productCategory === productCategory);
        if (matched) return matched;
    }
    
    // 2. Specific client match
    if (clientName) {
        const matched = activePrompts.find(p => p.clientName === clientName && !p.productCategory);
        if (matched) return matched;
    }
    
    // 3. Specific productCategory match
    if (productCategory) {
        const matched = activePrompts.find(p => p.productCategory === productCategory && !p.clientName);
        if (matched) return matched;
    }
    
    // 4. Fallback to general active prompt
    return activePrompts.find(p => !p.clientName && !p.productCategory);
};

export const logPromptUsage = async (
    promptId: number, 
    tokens: number, 
    confidenceScores: number[]
): Promise<void> => {
    return (db as any).transaction('rw', db.prompts, async () => {
        const prompt = await db.prompts.get(promptId);
        if (!prompt) return;
        
        prompt.totalCount = (prompt.totalCount || 0) + 1;
        prompt.totalTokensUsed = (prompt.totalTokensUsed || 0) + tokens;
        
        if (confidenceScores.length > 0) {
            const avg = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
            prompt.avgConfidenceSum = (prompt.avgConfidenceSum || 0) + avg;
            prompt.successCount = (prompt.successCount || 0) + 1;
        }
        
        await db.prompts.put(prompt);
    });
};

export const getCatalogCategories = async (): Promise<string[]> => {
    const entries = await getCachedCatalog();
    const categoriesSet = new Set<string>();
    entries.forEach(e => {
        if (e.category && e.category.trim()) {
            categoriesSet.add(e.category.trim());
        }
    });
    // Add default common categories for field marketing if database is empty/sparse
    const defaults = ["Káva/Čaj", "Napoje", "Čokolády/Sladkosti", "Kozmetika", "Pracie prostriedky"];
    defaults.forEach(d => categoriesSet.add(d));
    return Array.from(categoriesSet).sort();
};

/**
 * Seeds default prompts from the application logic into the database.
 */
export const seedDefaultPrompts = async (t: (key: string) => string) => {
    const categories: PromptTemplate['category'][] = ['system', 'price', 'shelfShare', 'osa', 'both'];
    
    for (const cat of categories) {
        const existing = await db.prompts.where('category').equals(cat).toArray();
        // Seed general templates (productCategory is undefined)
        const generalExisting = existing.find(p => !p.productCategory);
        
        let text = '';
        switch(cat) {
            case 'system': text = t('geminiSystemInstruction'); break;
            case 'price': text = t('geminiPromptPriceOnly'); break;
            case 'shelfShare': text = t('geminiPromptShelfShareOnly'); break;
            case 'osa': text = t('geminiPromptOsaOnly'); break;
            case 'both': text = t('geminiPromptBoth'); break;
        }

        if (!text || text === cat) continue;

        if (!generalExisting) {
            await db.prompts.add({
                category: cat,
                text,
                version: 1,
                isActive: true,
                createdAt: new Date().toISOString()
            });
        } else {
            // Upgrade check: if it is an older template that lacks the new promo/pricing/frame details, update it automatically
            const lacksPromoFocus = !generalExisting.text.includes("RED FRAMES") && !generalExisting.text.includes("ČERVENÉ RÁMČEKY") && !generalExisting.text.includes("PROMOTIONAL PRODUCTS");
            const isOldSystem = cat === 'system' && (lacksPromoFocus || !generalExisting.text.includes("decimal"));
            const isOldBothOrPrice = (cat === 'both' || cat === 'price') && (lacksPromoFocus || !generalExisting.text.includes("halier"));

            if (isOldSystem || isOldBothOrPrice) {
                await db.prompts.update(generalExisting.id!, { text });
            }
        }
    }
};

export const verifyAndFixAllAnalysesPrices = async (): Promise<{ updatedCount: number; fixedProductsCount: number }> => {
    const list = await db.analyses.toArray();
    let updatedCount = 0;
    let fixedProductsCount = 0;

    const parseNum = (priceValue: string) => {
        const cleaned = priceValue.replace(',', '.').replace(/[^\d.]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    };

    const updates: Analysis[] = [];

    for (const analysis of list) {
        let isModified = false;
        if (!analysis.images || !Array.isArray(analysis.images)) continue;

        // Create a deepish clone of images so we do not mutate in-place if restricted
        const updatedImages = analysis.images.map(image => {
            if (!image.analysisResult?.products || !Array.isArray(image.analysisResult.products)) return image;

            let imageModified = false;
            const updatedProducts = image.analysisResult.products.map(product => {
                if (!product.prices || !Array.isArray(product.prices)) return product;

                // Find pricing elements
                const regularPriceEntry = product.prices.find(p => p.type === 'REGULAR');
                const promoPriceEntry = product.prices.find(p => p.type === 'PROMO');

                if (regularPriceEntry && promoPriceEntry) {
                    const rNum = parseNum(regularPriceEntry.value);
                    const pNum = parseNum(promoPriceEntry.value);

                    // If promo price is greater than regular price, swap them
                    if (rNum !== null && pNum !== null && pNum > rNum) {
                        const oldRegularVal = regularPriceEntry.value;
                        regularPriceEntry.value = promoPriceEntry.value;
                        promoPriceEntry.value = oldRegularVal;
                        imageModified = true;
                        fixedProductsCount++;
                    }
                }
                return product;
            });

            if (imageModified) {
                isModified = true;
                return {
                    ...image,
                    analysisResult: {
                        ...image.analysisResult,
                        products: updatedProducts
                    }
                };
            }
            return image;
        });

        if (isModified) {
            updates.push({
                ...analysis,
                images: updatedImages
            });
            updatedCount++;
        }
    }

    if (updates.length > 0) {
        await (db as any).transaction('rw', db.analyses, async () => {
            for (const upd of updates) {
                await db.analyses.put(upd);
            }
        });
    }

    return { updatedCount, fixedProductsCount };
};

