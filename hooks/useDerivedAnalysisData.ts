import { useMemo } from 'react';
import { ImageState } from './useImageAnalysis';
import { findBestMatch, getCategoryFromName, getBrandFromName } from '../utils/helpers';

export const useDerivedAnalysisData = (images: ImageState[], deferredSearchTerm: string, t: (key: string) => string) => {
  const productList = useMemo(() => {
    const completed = images.filter(img => img.status === 'success');
    if (!completed.length) return [];
    const map = new Map<string, { name: string; count: number; category: string }>();
    const knownNames: string[] = [];
    const exactMatchMap = new Map<string, string>(); // Optimization: cache findBestMatch result per raw product name
    
    completed.forEach(img => {
      img.analysisResult?.products.forEach(p => {
        if (!p?.name) return;
        
        let matched = exactMatchMap.get(p.name);
        if (matched === undefined) {
          matched = findBestMatch(p.name, knownNames) || p.name;
          if (!knownNames.includes(matched)) {
            knownNames.push(matched);
          }
          exactMatchMap.set(p.name, matched);
        }
        
        const entry = map.get(matched);
        if (entry) entry.count++;
        else map.set(matched, { name: matched, count: 1, category: getCategoryFromName(matched, t('unassignedCategory')) });
      });
    });
    const result = Array.from(map.values()).sort((a, b) => a.category.localeCompare(b.category) || b.count - a.count);
    return deferredSearchTerm ? result.filter(p => p.name.toLowerCase().includes(deferredSearchTerm.toLowerCase())) : result;
  }, [images, t, deferredSearchTerm]);

  const brandProductsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    images.forEach(img => {
      img.analysisResult?.products.forEach(p => {
        if (!p || !p.name) return;
        const b = p.brand || getBrandFromName(p.name);
        if (b) {
          if (!map[b]) map[b] = [];
          if (!map[b].includes(p.name)) map[b].push(p.name);
        }
      });
    });
    return map;
  }, [images]);

  return { productList, brandProductsMap };
};
