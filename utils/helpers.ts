import type { DetectedProduct, MergeCandidate } from '../types';

// Zoznam kategórií, ktoré pozostávajú z viacerých slov.
const MULTI_WORD_CATEGORIES = ['Bon pari'];

/**
 * Kapitalizuje prvé písmeno reťazca a zvyšok prevedie na malé písmená.
 * @param s Vstupný reťazec.
 * @returns Reťazec s veľkým prvým písmenom.
 */
const capitalize = (s: string) => {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Získa kategóriu z názvu produktu.
 * Kategória je zvyčajne prvé slovo názvu.
 * Spracováva špeciálne prípady pre viacslovné kategórie.
 * @param name Názov produktu.
 * @param unassignedCategory Preložený reťazec pre nezaradenú kategóriu.
 * @returns Názov kategórie.
 */
export const getCategoryFromName = (name: string, unassignedCategory: string): string => {
  if (!name) return unassignedCategory;
  
  const lowerName = name.toLowerCase();
  
  // Skontrolujte, či názov nezačína viacslovnou kategóriou.
  for (const cat of MULTI_WORD_CATEGORIES) {
    if (lowerName.startsWith(cat.toLowerCase())) {
      return cat;
    }
  }
  
  // Ak sa nezhoduje žiadna viacslovná kategória, vezmite prvé slovo.
  const firstWord = name.split(' ')[0];
  return capitalize(firstWord) || unassignedCategory;
};

/**
 * Získa značku z názvu produktu.
 * Značka je zvyčajne prvé slovo názvu.
 * @param name Názov produktu.
 * @returns Názov značky.
 */
export const getBrandFromName = (name: string): string => {
  if (!name) return '';
  const parts = name.split(' ');
  return parts[0];
};

/**
 * Parses a date from a filename.
 * Supports DD.MM.YYYY (with . _ - separators), YYYY-MM-DD, and YYYYMMDD formats.
 * It checks for formats in that order, prioritizing DD.MM.YYYY as requested.
 * @param fileName The name of the file.
 * @returns A Date object if a date is found, otherwise null.
 */
export const parseDateFromFileName = (fileName: string): Date | null => {
    // Try DD.MM.YYYY, DD-MM-YYYY, DD_MM_YYYY formats first as requested
    let match = fileName.match(/(\d{1,2})[._-](\d{1,2})[._-](\d{4})/);
    if (match) {
        const [, day, month, year] = match;
        // Using noon UTC to avoid timezone issues where date might shift by a day
        const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00Z`);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }

    // Try YYYY-MM-DD format
    match = fileName.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const [, year, month, day] = match;
        const date = new Date(`${year}-${month}-${day}T12:00:00Z`);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }
    
    // Try YYYYMMDD format, which can be part of other numbers, so it's last.
    match = fileName.match(/(\d{4})(\d{2})(\d{2})/);
    if (match) {
        const [, year, month, day] = match;
        const date = new Date(`${year}-${month}-${day}T12:00:00Z`);
        if (!isNaN(date.getTime())) {
            return date;
        }
    }

    return null;
}

/**
 * Tries to extract a store name from a filename using robust logic.
 * It normalizes separators, looks for known chains, and then attempts to extract
 * location information following the chain name, filtering out noise.
 * @param filename The name of the file.
 * @returns The extracted store name (e.g., "Tesco, Bratislava") or null.
 */
export const extractStoreFromFilename = (filename: string): string | null => {
    const knownChains = [
        'Tesco', 'Billa', 'Lidl', 'Kaufland', 'Coop', 'Metro', 'Terno', 'Kraj', 
        'Moja Samoška', 'Fresh', 'CBA', 'Jednota', 'Albert', 'Globus', 'Penny', 
        'Norma', 'DM', 'Rossmann', 'Teta', '101 Drogerie', 'Sint', 'Koruna', 'Libex',
        'Potraviny', 'Market', 'Supermarket', 'Hypermarket', 'Večierka', 'Trafika'
    ];

    // 1. Remove file extension
    let cleanedName = filename.replace(/\.[^/.]+$/, "");

    // 2. Aggressively remove Date and Time patterns BEFORE processing text
    // Matches: 27.11.2025, 2025-11-27, 16:29, 16_29
    cleanedName = cleanedName.replace(/\d{1,2}[._-]\d{1,2}[._-]\d{4}/g, ' '); // DD.MM.YYYY
    cleanedName = cleanedName.replace(/\d{4}[._-]\d{1,2}[._-]\d{1,2}/g, ' '); // YYYY-MM-DD
    cleanedName = cleanedName.replace(/\d{1,2}:\d{2}(:\d{2})?/g, ' '); // HH:MM:SS

    // 3. Normalize separators: replace _, -, . with spaces/commas to treat as a sentence
    // Collapse multiple spaces
    const normalized = cleanedName.replace(/[_-]/g, ' ').replace(/\./g, ' ').replace(/\s+/g, ' ').trim();

    // Helper to check if a token is likely noise (date parts, camera codes, numbers, generic words)
    const isNoise = (s: string) => {
        if (!s) return true;
        const lower = s.toLowerCase();
        
        // Single characters (except maybe 'A' or 'B' block, but safely ignored for city names)
        if (s.length < 2 && !/\d/.test(s)) return true; 
        
        // Pure numbers that look like large IDs or dates (e.g. 2025, 112024)
        // BUT allow smaller numbers like "617" (house numbers)
        if (/^\d{5,}$/.test(s)) return true; 
        
        // Common camera file prefixes/suffixes
        if (/^(IMG|DSC|PXL|VID|MOV|FOTO|PHOTO|CAM|WA\d+|FB\d+|SNAP|WIN|Screenshot)/i.test(s)) return true;
        
        // Generic words
        const stopWords = new Set([
            'regal', 'polica', 'vystavka', 'promo', 'akcia', 'img', 'snimka', 
            'foto', 'photo', 'original', 'edited', 'copy', 'vystavenie', 
            'shelf', 'display', 'front', 'back', 'top', 'bottom', 'analyza', 'analysis',
            'obchod', 'predajna', 'prevadzka', 'store', 'shop', 'image', 'picture'
        ]);
        if (stopWords.has(lower)) return true;

        return false;
    };

    for (const chain of knownChains) {
        // Use regex with word boundary to find exact chain name match (case insensitive)
        const regex = new RegExp(`\\b${chain}\\b`, 'i');
        const match = normalized.match(regex);

        if (match) {
            // Get the string part *after* the chain name to look for location
            const startIndex = (match.index || 0) + match[0].length;
            const remainder = normalized.substring(startIndex).trim();

            // Split remainder into parts (tokens), respecting commas if present as separators
            // e.g. "Sklárska, 617, Poltár" -> ["Sklárska", "617", "Poltár"]
            const rawTokens = remainder.split(/[, ]+/);
            
            const validTokens: string[] = [];
            
            // Heuristic: Take tokens until we hit noise or reach limit
            for (const t of rawTokens) {
                if (isNoise(t)) continue;
                validTokens.push(t);
            }

            // Take up to 4 valid tokens to capture "Street Num City" patterns
            const locationParts = validTokens.slice(0, 4);

            if (locationParts.length > 0) {
                // Reconstruct: "Chain, Sklárska 617 Poltár"
                // We join the location parts with spaces.
                // If the input was comma separated, this flattens it to a readable string.
                const location = locationParts.map(capitalize).join(' ');
                return `${chain}, ${location}`;
            }

            // If no valid location found after the chain, check BEFORE the chain
            // e.g. "Bratislava Tesco"
            const beforeIndex = match.index || 0;
            const prefix = normalized.substring(0, beforeIndex).trim();
            const prefixTokens = prefix.split(/[, ]+/).filter(t => !isNoise(t));
            
            if (prefixTokens.length > 0) {
                 const location = prefixTokens.slice(-2).map(capitalize).join(' '); 
                 return `${chain}, ${location}`;
            }

            // If still nothing, just return the Chain
            return chain;
        }
    }
    
    return null;
};

/**
 * Calculates the Levenshtein distance between two strings.
 * Private helper function optimized for O(min(M, N)) space and minimal GC.
 */
const levenshteinDistance = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    let str1 = a;
    let str2 = b;
    if (str1.length > str2.length) {
        str1 = b;
        str2 = a;
    }

    const len1 = str1.length;
    const len2 = str2.length;

    let prevRow = new Int32Array(len1 + 1);
    let currRow = new Int32Array(len1 + 1);

    for (let i = 0; i <= len1; i++) {
        prevRow[i] = i;
    }

    for (let j = 1; j <= len2; j++) {
        currRow[0] = j;
        for (let i = 1; i <= len1; i++) {
            const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
            currRow[i] = Math.min(
                currRow[i - 1] + 1,        // insertion
                prevRow[i] + 1,            // deletion
                prevRow[i - 1] + indicator // substitution
            );
        }
        const temp = prevRow;
        prevRow = currRow;
        currRow = temp;
    }

    return prevRow[len1];
};

// Cache for pairwise similarities
const similarityCache = new Map<string, number>();

/**
 * Calculates the similarity percentage between two strings based on Levenshtein distance with pairwise caching.
 * @param a The first string.
 * @param b The second string.
 * @returns Similarity percentage (0-100).
 */
export const calculateStringSimilarity = (a: string, b: string): number => {
    if (!a || !b) return 0;
    
    // Symmetric cache key setup
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const cached = similarityCache.get(key);
    if (cached !== undefined) return cached;

    const distance = levenshteinDistance(a, b);
    const maxLength = Math.max(a.length, b.length);
    if (maxLength === 0) return 100;

    const similarity = (1 - distance / maxLength) * 100;
    similarityCache.set(key, similarity);
    return similarity;
};

/**
 * Calculates Jaccard Similarity for token sets (good for partial matches).
 * Splits string into words and calculates Intersection / Union.
 */
export const calculateJaccardSimilarity = (a: string, b: string): number => {
    const tokenize = (s: string) => new Set(s.toLowerCase().split(/[\s,.-]+/).filter(t => t.length > 1));
    const setA = tokenize(a);
    const setB = tokenize(b);
    
    if (setA.size === 0 && setB.size === 0) return 1.0;
    if (setA.size === 0 || setB.size === 0) return 0.0;

    let intersection = 0;
    setA.forEach(token => {
        if (setB.has(token)) intersection++;
    });

    const union = setA.size + setB.size - intersection;
    return intersection / union;
};

/**
 * Extracts numbers from a string and returns them as an array of numbers.
 * e.g., "Ariel 100 pods 2.5kg" -> [100, 2.5]
 * @param s The input string.
 * @returns An array of numbers.
 */
const extractNumbers = (s: string): number[] => {
    const numbers = s.match(/\d+(\.\d+)?/g) || [];
    return numbers.map(Number);
};


/**
 * Odstráni slovenskú, českú, maďarskú a ďalšiu európsku diakritiku z textu.
 */
export const removeDiacritics = (str: string): string => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

/**
 * Normalizes a product name for comparison by lowercasing, trimming, removing punctuation, collapsing whitespace and removing accents.
 * @param name The product name.
 * @returns A normalized string.
 */
export const normalizeProductName = (name: string): string => {
  if (!name) return '';
  const lowerWithAccents = name.toLowerCase().trim();
  return removeDiacritics(lowerWithAccents)
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "") 
    .replace(/\s+/g, ' ');
};

const isSubset = (setA: Set<number>, setB: Set<number>): boolean => {
    if (setA.size > setB.size) return false;
    for (const elem of setA) {
        if (!setB.has(elem)) {
            return false;
        }
    }
    return true;
};

interface Candidate {
    name: string;
    visualFeatures?: string;
    isAlias?: boolean;
}

// In-memory cache pre najlepšie zhody v rámci jedného behu batchu analýzy.
const matchCache = new Map<string, string | null>();

/**
 * Invalidate in-memory matching cache when catalog updates.
 */
export const invalidateHelperCache = (): void => {
    matchCache.clear();
    similarityCache.clear();
};

/**
 * Finds the best matching canonical name for a new product name from a list of existing names.
 * Supports partial text matching (Jaccard) and visual feature boosting.
 */
export const findBestMatch = (
    query: string, 
    candidates: (string | Candidate)[]
): string | null => {
    if (!query) return null;

    // Cache lookup
    const firstCandName = candidates.length > 0 
        ? (typeof candidates[0] === 'string' ? candidates[0] : (candidates[0] as Candidate).name) 
        : '';
    const cacheKey = `${query}:${candidates.length}:${firstCandName}`;
    if (matchCache.has(cacheKey)) {
        return matchCache.get(cacheKey)!;
    }
    
    const normalizedQuery = normalizeProductName(query);
    const queryText = normalizedQuery.replace(/[\d.,]+/g, ' ').replace(/\s+/g, ' ').trim();
    const queryNumbers = new Set(extractNumbers(normalizedQuery));

    let bestMatch: string | null = null;
    let highestScore = 0;

    for (const candidate of candidates) {
        const candidateName = typeof candidate === 'string' ? candidate : candidate.name;
        const visualFeatures = typeof candidate === 'string' ? undefined : candidate.visualFeatures;

        const normalizedCandidateName = normalizeProductName(candidateName);
        const candidateText = normalizedCandidateName.replace(/[\d.,]+/g, ' ').replace(/\s+/g, ' ').trim();
        const candidateNumbers = new Set(extractNumbers(normalizedCandidateName));

        // HEURISTICKÝ PRE-FILTER (O(n²)): Jaccard Index na tokeny je extrémne rýchly Set operátor.
        // Ak query a kandidát nezdieľajú absolútne ŽIADNE slovo a query má aspoň 1 slovo, je nemožné, 
        // aby Išlo o ten istý produkt. Levenshtein Distance Matrix O(M*N) by bol úplne zbytočný výpočet.
        const jaccardScore = calculateJaccardSimilarity(queryText, candidateText);

        const queryWords = queryText.split(' ').filter(w => w.length > 1);
        const candWords = candidateText.split(' ').filter(w => w.length > 1);

        if (jaccardScore === 0 && queryWords.length > 0 && candWords.length > 0) {
            // Bez zhodných slov a obe strany majú text -> prejdeme na ďalšieho kandidáta bez drahého Levenshteina.
            continue;
        }

        // Ak dĺžkový rozdiel je enormný a Jaccard je mizivý, preskočíme.
        const lengthDiff = Math.abs(queryText.length - candidateText.length);
        if (jaccardScore < 0.2 && lengthDiff > 12) {
            continue;
        }

        // 1. Text Similarity (Levenshtein) - Good for typos
        const textSimilarity = calculateStringSimilarity(queryText, candidateText);

        // 3. Visual Boost
        // If the query (from AI) contains words that describe the visual features of the candidate (from Catalog)
        let visualBoost = 0;
        if (visualFeatures && queryText.length > 3) {
            const normalizedVisuals = removeDiacritics(visualFeatures.toLowerCase());
            const queryTokens = queryText.split(' ');
            const matchedTokens = queryTokens.filter(t => t.length > 2 && normalizedVisuals.includes(t));
            
            // If significant visual words match (e.g. "Orange" in "Orange can"), boost score
            if (matchedTokens.length > 0) {
                visualBoost = 15; 
            }
        }

        // Composite Score Calculation
        // Levenshtein (0-100) * 0.4
        // Jaccard (0-1) * 100 * 0.4
        // Visual Boost (0-15) * 0.2
        let score = (textSimilarity * 0.4) + (jaccardScore * 100 * 0.4) + visualBoost;

        // Number Consistency Check - Heavy Penalty
        // If numbers are present in both but don't match, it's likely a different pack size
        const numbersAreCompatible = 
            (queryNumbers.size === 0 && candidateNumbers.size === 0) || 
            isSubset(queryNumbers, candidateNumbers) || 
            isSubset(candidateNumbers, queryNumbers);

        if (!numbersAreCompatible) {
            score -= 50; // Significant penalty
        }

        // Adjust threshold slightly lower because Jaccard pulls down score for very short strings
        // But keep it high enough to avoid false positives.
        if (score > highestScore && score > 60) { 
            highestScore = score;
            bestMatch = candidateName;
        }
    }

    matchCache.set(cacheKey, bestMatch);
    return bestMatch;
};


/**
 * Robustly removes date ranges, single dates, time patterns, empty parentheses, and extra separators from a store or file name.
 * e.g., "Tesco Poprad (01.01.2024 - 10.01.2024)" -> "Tesco Poprad"
 * e.g., "Billa_Bratislava_04_06_2026_16h29m" -> "Billa Bratislava"
 * @param name The input string.
 * @returns A cleaned string.
 */
export const removeDateFromStoreName = (name?: string): string => {
    if (!name) return '';
    let result = name;

    // 1. Remove parenthesized/bracketed date ranges, e.g. (01.01.2024 - 10.01.2024), [04-06-2026 - 05-06-2026]
    result = result.replace(/\s*\(\s*\d{1,2}[./-]\d{1,2}[./-]\d{4}\s*-\s*\d{1,2}[./-]\d{1,2}[./-]\d{4}\s*\)/gi, ' ');
    result = result.replace(/\s*\[\s*\d{1,2}[./-]\d{1,2}[./-]\d{4}\s*-\s*\d{1,2}[./-]\d{1,2}[./-]\d{4}\s*\]/gi, ' ');
    
    // 2. Remove parenthesized/bracketed single dates, e.g. (04.06.2026), [2026-06-04]
    result = result.replace(/\s*\(\s*\d{1,2}[./-]\d{1,2}[./-]\d{4}\s*\)/g, ' ');
    result = result.replace(/\s*\(\s*\d{4}[./-]\d{1,2}[./-]\d{1,2}\s*\)/g, ' ');
    result = result.replace(/\s*\[\s*\d{1,2}[./-]\d{1,2}[./-]\d{4}\s*\]/g, ' ');
    result = result.replace(/\s*\[\s*\d{4}[./-]\d{1,2}[./-]\d{1,2}\s*\]/g, ' ');

    // 3. Remove standard date formats (with boundary guards):
    // DD.MM.YYYY, DD-MM-YYYY, DD_MM_YYYY
    result = result.replace(/\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/g, ' ');
    // YYYY-MM-DD, YYYY_MM_DD, YYYY.MM.DD
    result = result.replace(/\b\d{4}[./-]\d{1,2}[./-]\d{1,2}\b/g, ' ');
    // YYYYMMDD (checks 202x/203x prefix to avoid matching other small numerical sequences)
    result = result.replace(/\b20[23]\d[01]\d[0-3]\d\b/g, ' ');

    // 4. Remove time patterns (HH:MM:SS, HH:MM, HH_MM, HHhMMm)
    result = result.replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ');
    result = result.replace(/\b\d{1,2}_\d{2}(_\d{2})?\b/g, ' ');
    result = result.replace(/\b\d{1,2}[hH]\s*\d{2}[mM]\b/g, ' ');

    // 5. Clean up residue empty brackets/parentheses and redundant delimiters
    result = result.replace(/\s*\(\s*\)/g, ' ');
    result = result.replace(/\s*\[\s*\]/g, ' ');
    result = result.replace(/[_-]/g, ' ');
    result = result.replace(/,\s*,/g, ',');
    
    // Collapse whitespace and trim
    result = result.replace(/\s+/g, ' ').trim();
    
    // Remove trailing and leading commas/hyphens/residuals
    result = result.replace(/^[,.\s-]+/, '').replace(/[,.\s-]+$/, '');
    
    return result;
};

/**
 * Resolves a clean and precise store name for an image. 
 * It systematically tries:
 * 1. Strongly linked assigned store name
 * 2. OCR watermark annotations from the shelf/photo metadata (chain and/or address)
 * 3. File name based parsing (e.g., Tesco, Bratislava)
 * All dates, time stamps, and file extensions are stripped out automatically.
 */
export const getImageStoreName = (
    img: {
        assignedStore?: { name: string } | null;
        analysisResult?: { storeInfo?: { chain?: string; address?: string } } | null;
        file?: { name: string } | null;
    },
    fallbackStoreName: string = 'Neznáma predajňa',
    analysisStoreName: string | null = null
): string => {
    // 1. Strong linked store relation
    if (img.assignedStore?.name) {
        return removeDateFromStoreName(img.assignedStore.name);
    }

    // 2. Fallback to analysis level store info
    if (analysisStoreName) {
        return removeDateFromStoreName(analysisStoreName);
    }

    // 3. Extract from image analysis shelf/bottom watermark
    const info = img.analysisResult?.storeInfo;
    if (info && (info.chain || info.address)) {
        const cleanedChain = removeDateFromStoreName(info.chain);
        const cleanedAddress = removeDateFromStoreName(info.address);
        if (cleanedChain && cleanedAddress) {
            // Keep it descriptive, no redundant join if chain and address is identical
            if (cleanedChain.toLowerCase() === cleanedAddress.toLowerCase()) {
                return cleanedChain;
            }
            if (cleanedAddress.toLowerCase().startsWith(cleanedChain.toLowerCase())) {
                return cleanedAddress;
            }
            return `${cleanedChain}, ${cleanedAddress}`;
        }
        if (cleanedChain) return cleanedChain;
        if (cleanedAddress) return cleanedAddress;
    }

    // 4. File name extraction fallback
    if (img.file?.name) {
        const fileStoreName = extractStoreFromFilename(img.file.name);
        if (fileStoreName) {
            return removeDateFromStoreName(fileStoreName);
        }
        // General text file split
        return removeDateFromStoreName(img.file.name.replace(/\.[^/.]+$/, ""));
    }

    return fallbackStoreName;
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

export const base64ToFile = async (dataOrBase64: string, name: string, type: string, lastModified: number): Promise<File> => {
  if (!dataOrBase64) {
    return new File([], name, { type: type || 'image/jpeg', lastModified });
  }

  // 1. If it's already a full data URI (e.g. data:image/svg+xml... or data:image/jpeg;base64,...)
  if (dataOrBase64.startsWith('data:')) {
    try {
      const res = await fetch(dataOrBase64);
      const blob = await res.blob();
      return new File([blob], name, { type: blob.type || type, lastModified });
    } catch {
      const commaIdx = dataOrBase64.indexOf(',');
      const meta = commaIdx !== -1 ? dataOrBase64.substring(0, commaIdx) : '';
      const rawData = commaIdx !== -1 ? dataOrBase64.substring(commaIdx + 1) : dataOrBase64;
      if (meta.includes(';base64')) {
        const binStr = atob(rawData);
        const bytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
        const blob = new Blob([bytes], { type: type || 'image/jpeg' });
        return new File([blob], name, { type: type || 'image/jpeg', lastModified });
      } else {
        const decoded = decodeURIComponent(rawData);
        const blob = new Blob([decoded], { type: type || 'image/svg+xml' });
        return new File([blob], name, { type: type || 'image/svg+xml', lastModified });
      }
    }
  }

  // 2. If it's a blob URL
  if (dataOrBase64.startsWith('blob:')) {
    try {
      const res = await fetch(dataOrBase64);
      const blob = await res.blob();
      return new File([blob], name, { type: blob.type || type, lastModified });
    } catch (e) {
      console.warn('Could not fetch blob url in base64ToFile', e);
    }
  }

  // 3. Raw base64 string
  try {
    const mime = type || 'image/jpeg';
    const res = await fetch(`data:${mime};base64,${dataOrBase64}`);
    const blob = await res.blob();
    return new File([blob], name, { type: mime, lastModified });
  } catch {
    const cleanB64 = dataOrBase64.includes(',') ? dataOrBase64.split(',')[1] : dataOrBase64;
    const byteCharacters = atob(cleanB64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: type || 'image/jpeg' });
    return new File([blob], name, { type: type || 'image/jpeg', lastModified });
  }
};

export const compressImageWithWorker = (file: File, maxWidth: number = 2560, quality: number = 0.85): Promise<File> => {
    if (file.type && !file.type.startsWith('image/')) {
        return Promise.resolve(file);
    }
    return new Promise((resolve) => {
        try {
            const worker = new Worker(new URL('../workers/imageWorker.ts', import.meta.url), { type: 'module' });
            const id = Math.random().toString(36).substring(7);
            
            worker.onmessage = (e) => {
                if (e.data.id === id) {
                    if (e.data.success) {
                        resolve(e.data.file);
                    } else {
                        console.error("Worker compression failed, falling back to original file", e.data.error);
                        resolve(file); // Fallback to original
                    }
                    worker.terminate();
                }
            };
            
            worker.onerror = (err) => {
                console.error("Worker error, falling back to original file", err);
                resolve(file); // Fallback to original
                worker.terminate();
            };
            
            worker.postMessage({ id, file, maxWidth, quality });
        } catch (err) {
            console.error("Failed to initialize worker, falling back to original file", err);
            resolve(file); // Fallback to original
        }
    });
};

/**
 * Resizes and compresses an image file to reduce storage usage.
 * @param file The original image file.
 * @param maxWidth The maximum width (or height) for the resized image.
 * @param quality The JPEG quality (0.0 to 1.0).
 * @returns A Promise resolving to the compressed File.
 */
export const resizeAndCompressImage = (file: File, maxWidth: number = 2560, quality: number = 0.85): Promise<File> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxWidth) {
                const ratio = width / height;
                if (width > height) {
                    width = maxWidth;
                    height = width / ratio;
                } else {
                    height = maxWidth;
                    width = height * ratio;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                URL.revokeObjectURL(img.src);
                reject(new Error("Could not get canvas context"));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob((blob) => {
                URL.revokeObjectURL(img.src);
                if (blob) {
                    const compressedFile = new File([blob], file.name, {
                        type: 'image/jpeg',
                        lastModified: file.lastModified
                    });
                    resolve(compressedFile);
                } else {
                    reject(new Error("Image compression failed"));
                }
            }, 'image/jpeg', quality);
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(img.src);
            reject(err);
        };
    });
};

/**
 * Extracts meaningful words from a product name.
 * Normalizes, replaces punctuation with spaces, and filters out very short words.
 */
const getSignificantTokens = (name: string): Set<string> => {
    // Replace punctuation with space to handle "min.voda" -> "min voda"
    const normalized = name.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, " ");
    // Split by whitespace and filter out tokens shorter than 2 chars (e.g. 'v', 'a')
    const tokens = normalized.split(/\s+/).filter(t => t.length >= 2);
    return new Set(tokens);
};

/**
 * Finds pairs of highly similar but not identical products to suggest a merge.
 * @param newProducts Products from the latest analysis batch.
 * @param allProducts All products in the current session (including new ones).
 * @returns An array of merge candidates.
 */
export const findMergeCandidates = (newProducts: DetectedProduct[], allProducts: DetectedProduct[]): MergeCandidate[] => {
    const SIMILARITY_THRESHOLD = 90; // Stricter threshold for suggesting a merge
    const candidates: MergeCandidate[] = [];
    const processedIds = new Set<string>();

    for (const newProduct of newProducts) {
        if (processedIds.has(newProduct.id)) continue;

        for (const existingProduct of allProducts) {
            if (newProduct.id === existingProduct.id || processedIds.has(existingProduct.id)) continue;
            
            const normNew = normalizeProductName(newProduct.name);
            const normExisting = normalizeProductName(existingProduct.name);

            if (normNew === normExisting) continue;

            // Method 1: Levenshtein Similarity
            const similarity = calculateStringSimilarity(normNew, normExisting);
            
            // Method 2: Shared Significant Words (at least 2)
            const tokensNew = getSignificantTokens(newProduct.name);
            const tokensExisting = getSignificantTokens(existingProduct.name);
            let intersectionCount = 0;
            tokensNew.forEach(token => {
                if (tokensExisting.has(token)) intersectionCount++;
            });
            
            const isWordMatch = intersectionCount >= 2;

            if (similarity >= SIMILARITY_THRESHOLD || isWordMatch) {
                // Heuristic to decide target: prefer the existing product, or the longer name as a fallback.
                const newIsTarget = !allProducts.some(p => p.id === existingProduct.id && p.id !== newProduct.id) && newProduct.name.length >= existingProduct.name.length;
                
                candidates.push({
                    target: newIsTarget ? newProduct : existingProduct,
                    source: newIsTarget ? existingProduct : newProduct,
                });
                
                processedIds.add(newProduct.id);
                processedIds.add(existingProduct.id);
                break; // Move to the next newProduct once a pair is found
            }
        }
    }
    return candidates;
};

/**
 * Deeply freezes an object to improve performance and reduce React heap memory pressure.
 */
export function deepFreeze<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Object.isFrozen(obj)) return obj;

    Object.freeze(obj);

    for (const key of Object.keys(obj)) {
        const value = (obj as any)[key];
        if (value !== null && typeof value === 'object') {
            deepFreeze(value);
        }
    }

    return obj;
}

