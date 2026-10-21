import { GoogleGenAI, Type } from "@google/genai";
import type { AnalysisResult, DetectedProduct, PriceInfo, StoreInfo, ObjectType, PosType, PromptAuditSummary, PromptRecommendation, PromptOptimizationResult } from '../types';
import { getCatalogEntries, logPromptUsage } from '../db';
import { enforcePriceIntegrity } from '../utils/priceIntegrity';

const productSchema = {
  type: Type.OBJECT,
  properties: {
    products: {
      type: Type.ARRAY,
      description: 'List of identified objects (products or POS materials).',
      items: {
        type: Type.OBJECT,
        properties: {
          n: { type: Type.STRING, description: 'Product name or POS material label.' },
          t: { type: Type.STRING, enum: ['product', 'pos_material'], description: 'Type of object.' },
          pt: { type: Type.STRING, enum: ['wobbler', 'stopper', 'stand', 'pallet', 'secondary_display'], description: 'Sub-type for POS materials.' },
          g: { type: Type.BOOLEAN, description: 'Is this a "Ghost" product (image on backboard, not physical item)?' },
          p: { type: Type.STRING, description: 'Price string. For promo tags (red/yellow frame, AKCIA, Clubcard, etc.) mark promo price with P (e.g. "1.49 P" or "2.29 R; 1.49 P").' },
          b: { type: Type.STRING, description: "Packed integers 'y1,x1,y2,x2|y1,x1...'. Scale 0-999." },
        },
        required: ['n', 't', 'b'],
      },
    },
    info: {
      type: Type.OBJECT,
      properties: {
        chn: { type: Type.STRING },
        adr: { type: Type.STRING },
      },
    },
  },
  required: ['products'],
};

export function repairTruncatedJson(rawText: string): any {
  if (!rawText || typeof rawText !== 'string') {
    return { products: [], info: {} };
  }

  let clean = rawText.trim();
  const mdMatch = clean.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
  if (mdMatch && mdMatch[1]) {
    clean = mdMatch[1].trim();
  }

  const firstBrace = clean.indexOf('{');
  const firstBracket = clean.indexOf('[');
  let startIndex = -1;
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIndex = firstBrace;
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
  }

  if (startIndex === -1) {
    return { products: [], info: {} };
  }

  clean = clean.substring(startIndex);

  // 1. Direct parse attempt
  try {
    return JSON.parse(clean);
  } catch {
    // Continue
  }

  // 2. Balanced bracket scan
  let inString = false;
  let isEscaped = false;
  const stack: ('{' | '[')[] = [];
  let lastValidClosingIndex = -1;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (inString) {
      if (isEscaped) isEscaped = false;
      else if (char === '\\') isEscaped = true;
      else if (char === '"') inString = false;
    } else {
      if (char === '"') inString = true;
      else if (char === '{') stack.push('{');
      else if (char === '[') stack.push('[');
      else if (char === '}') {
        if (stack.length > 0 && stack[stack.length - 1] === '{') {
          stack.pop();
          if (stack.length === 0) lastValidClosingIndex = i;
        }
      } else if (char === ']') {
        if (stack.length > 0 && stack[stack.length - 1] === '[') {
          stack.pop();
          if (stack.length === 0) lastValidClosingIndex = i;
        }
      }
    }
  }

  if (lastValidClosingIndex !== -1) {
    try {
      return JSON.parse(clean.substring(0, lastValidClosingIndex + 1));
    } catch {
      // Continue
    }
  }

  // 3. Repair incomplete string and balance open brackets
  let repaired = clean;
  if (inString) {
    repaired += '"';
  }

  // Remove dangling commas and trailing incomplete keys
  repaired = repaired.replace(/,\s*"?[\w]*"?\s*:?\s*"?$/, '');
  repaired = repaired.replace(/,\s*$/, '');

  const openStackCopy = [...stack];
  while (openStackCopy.length > 0) {
    const open = openStackCopy.pop();
    if (open === '{') repaired += '}';
    else if (open === '[') repaired += ']';
  }

  try {
    return JSON.parse(repaired);
  } catch {
    // 4. Regex extraction of individual product objects as final safety net
    const products: any[] = [];
    const productRegex = /\{\s*"n"\s*:\s*"([^"]+)"\s*,\s*"t"\s*:\s*"([^"]+)"(?:\s*,\s*"pt"\s*:\s*"([^"]*)")?(?:\s*,\s*"g"\s*:\s*(true|false))?(?:\s*,\s*"p"\s*:\s*"([^"]*)")?(?:\s*,\s*"b"\s*:\s*"([^"]*)")?/g;
    let match;
    while ((match = productRegex.exec(clean)) !== null) {
      products.push({
        n: match[1],
        t: match[2] || 'product',
        pt: match[3] || undefined,
        g: match[4] === 'true',
        p: match[5] || '',
        b: match[6] || '450,450,550,550'
      });
    }

    if (products.length > 0) {
      return { products, info: {} };
    }
  }

  return { products: [], info: {} };
}

function extractFirstJson(text: string): string {
  try {
    const obj = repairTruncatedJson(text);
    return JSON.stringify(obj);
  } catch {
    return '{"products":[]}';
  }
}

function parseMinifiedPriceString(priceString: string | undefined): { prices: PriceInfo[]; integrityStatus: 'valid' | 'corrected' | 'warning' | 'missing' } {
  if (!priceString) return { prices: [], integrityStatus: 'missing' };
  const rawPrices: PriceInfo[] = [];
  const parts = priceString.split(';');
  parts.forEach(part => {
    const trimmedPart = part.trim();
    if (trimmedPart) {
      const match = trimmedPart.match(/([\d.,]+)\s*([RP€]?)/i);
      if (match) {
        const val = match[1];
        const suffix = match[2];
        const type = (suffix && suffix.toUpperCase() === 'P') ? 'PROMO' : 'REGULAR';
        rawPrices.push({ value: val, type });
      }
    }
  });

  // Apply full price data integrity engine (decimal recovery, Promo <= Regular, deduplication, format normalization)
  const integrityResult = enforcePriceIntegrity(rawPrices);
  return { prices: integrityResult.prices, integrityStatus: integrityResult.status };
}

function parseMinifiedResponse(minifiedResponse: any, usedModel: string): AnalysisResult {
  const products: DetectedProduct[] = [];
  const storeInfo: StoreInfo = {};

  const productList = Array.isArray(minifiedResponse?.products)
    ? minifiedResponse.products
    : Array.isArray(minifiedResponse)
    ? minifiedResponse
    : [];

  if (productList.length > 0) {
    productList.forEach((group: any) => {
      if (!group || typeof group !== 'object') return;
      const name = group.n || group.name || group.product || group.title || '';
      if (!name || typeof name !== 'string' || !name.trim()) return;

      const type = (group.t || group.type || 'product') as ObjectType;
      const posType = (group.pt || group.posType || undefined) as PosType;
      const isGhost = group.g === true || group.isGhost === true;
      const rawPrice = group.p ?? group.price ?? group.prices;
      const priceStr = typeof rawPrice === 'string' 
        ? rawPrice 
        : Array.isArray(rawPrice) 
        ? rawPrice.map(p => typeof p === 'object' ? `${p.value} ${p.type === 'PROMO' ? 'P' : 'R'}` : String(p)).join('; ')
        : String(rawPrice || '');

      const { prices, integrityStatus } = parseMinifiedPriceString(priceStr);

      // Parse bounding box(es) flexibly (strings, arrays, single/multiple)
      const parsedBoxes: { x: number; y: number; width: number; height: number }[] = [];
      const rawBox = group.b ?? group.box ?? group.boundingBox;

      if (typeof rawBox === 'string' && rawBox.trim()) {
        const boxStrings = rawBox.split('|');
        boxStrings.forEach((bStr: string) => {
          const coords = bStr.split(',').map(Number);
          if (coords.length === 4 && coords.every(c => !isNaN(c))) {
            parsedBoxes.push({
              x: coords[1] / 1000,
              y: coords[0] / 1000,
              width: Math.max(0.02, (coords[3] - coords[1]) / 1000),
              height: Math.max(0.02, (coords[2] - coords[0]) / 1000)
            });
          }
        });
      } else if (Array.isArray(rawBox)) {
        if (rawBox.length === 4 && rawBox.every(c => typeof c === 'number' && !isNaN(c))) {
          parsedBoxes.push({
            x: rawBox[1] / 1000,
            y: rawBox[0] / 1000,
            width: Math.max(0.02, (rawBox[3] - rawBox[1]) / 1000),
            height: Math.max(0.02, (rawBox[2] - rawBox[0]) / 1000)
          });
        } else {
          rawBox.forEach(item => {
            if (Array.isArray(item) && item.length === 4) {
              parsedBoxes.push({
                x: item[1] / 1000,
                y: item[0] / 1000,
                width: Math.max(0.02, (item[3] - item[1]) / 1000),
                height: Math.max(0.02, (item[2] - item[0]) / 1000)
              });
            } else if (typeof item === 'string') {
              const coords = item.split(',').map(Number);
              if (coords.length === 4 && coords.every(c => !isNaN(c))) {
                parsedBoxes.push({
                  x: coords[1] / 1000,
                  y: coords[0] / 1000,
                  width: Math.max(0.02, (coords[3] - coords[1]) / 1000),
                  height: Math.max(0.02, (coords[2] - coords[0]) / 1000)
                });
              }
            }
          });
        }
      } else if (rawBox && typeof rawBox === 'object' && 'x' in rawBox && 'y' in rawBox) {
        parsedBoxes.push({
          x: rawBox.x,
          y: rawBox.y,
          width: rawBox.width || 0.1,
          height: rawBox.height || 0.1
        });
      }

      // If no valid bounding box was parsed, NEVER discard the recognized product
      if (parsedBoxes.length === 0) {
        parsedBoxes.push({ x: 0.45, y: 0.45, width: 0.1, height: 0.1 });
      }

      parsedBoxes.forEach((box) => {
        products.push({
          id: `${name.trim()}-${Math.random().toString(36).substring(7)}`,
          name: name.trim(),
          brand: name.trim().split(' ')[0],
          prices,
          priceIntegrityStatus: integrityStatus,
          boundingBox: box,
          confidence: group.c || group.confidence || 0.9,
          type,
          posType,
          isGhost
        });
      });
    });
  }

  const rawInfo = minifiedResponse.info || minifiedResponse.storeInfo || {};
  if (rawInfo) {
    if (rawInfo.chn || rawInfo.chain) storeInfo.chain = rawInfo.chn || rawInfo.chain;
    if (rawInfo.adr || rawInfo.address) storeInfo.address = rawInfo.adr || rawInfo.address;
  }

  return { products, storeInfo, modelName: usedModel };
}

export function cleanBase64(b64: string): string {
  if (!b64) return '';
  if (b64.includes('base64,')) {
    return b64.split('base64,')[1].trim();
  }
  return b64.trim();
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({ apiKey });
}

export function normalizeModelName(model?: string): string {
  if (!model) return 'gemini-3.1-flash-lite';
  const m = model.trim().toLowerCase();
  if (m.includes('2.5-flash-lite') || m.includes('1.5-flash') || m.includes('2.0-flash-lite')) {
    return 'gemini-3.1-flash-lite';
  }
  if (m.includes('2.5-flash') || m.includes('2.0-flash') || m.includes('1.5-pro')) {
    return 'gemini-3.8-flash';
  }
  if (m.includes('2.5-pro') || m.includes('2.0-pro')) {
    return 'gemini-3.1-pro-preview';
  }
  return model;
}

export async function analyzeImageWithGemini(
  base64Image: string, 
  userPromptText: string, 
  systemInstructionText: string,
  modelName: string = 'gemini-3.1-flash-lite',
  userPromptId?: string,
  systemPromptId?: string,
  mimeType: string = 'image/jpeg'
): Promise<AnalysisResult> {

  const ai = getGeminiClient();
  const cleanedImage = cleanBase64(base64Image);
  const effectiveMime = (base64Image.startsWith('data:') && base64Image.match(/^data:([^;]+);base64,/)?.[1]) || mimeType || 'image/jpeg';

  const effectiveUserPrompt = (userPromptText && userPromptText.trim().length > 0)
    ? userPromptText
    : 'Identify all retail products on this shelf with exact names, bounding boxes, and prices.';
  const effectiveSystemPrompt = (systemInstructionText && systemInstructionText.trim().length > 0)
    ? systemInstructionText
    : 'You are an FMCG retail auditor analyzing a supermarket shelf photo. Output minified JSON according to schema.';

  const normModel = normalizeModelName(modelName);
  const modelCandidates = Array.from(new Set([
    normModel,
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3-flash-preview'
  ])).filter(Boolean);

  let response: any = null;
  let effectiveModel = modelCandidates[0];
  let lastError: any = null;

  for (const candidate of modelCandidates) {
    try {
      effectiveModel = candidate;
      response = await ai.models.generateContent({
        model: candidate,
        contents: { parts: [{ inlineData: { data: cleanedImage, mimeType: effectiveMime } }, { text: effectiveUserPrompt }] },
        config: {
          systemInstruction: effectiveSystemPrompt,
          responseMimeType: 'application/json',
          responseSchema: productSchema,
          temperature: 0.2,
          maxOutputTokens: 8192,
        },
      });
      if (response) {
        break;
      }
    } catch (err: any) {
      lastError = err;
      const isQuotaOrNotFound = err?.message?.includes('quota') || 
        err?.message?.includes('RESOURCE_EXHAUSTED') || 
        err?.message?.includes('429') || 
        err?.message?.includes('404') || 
        err?.message?.includes('not found') ||
        err?.message?.includes('no longer available');

      console.warn(`Model ${candidate} failed (${err?.message?.slice(0, 120)}), trying fallback...`);
      if (!isQuotaOrNotFound && candidate === modelCandidates[modelCandidates.length - 1]) {
        throw err;
      }
    }
  }

  if (!response) {
    throw lastError || new Error('All vision models exhausted.');
  }

  let rawText = '';
  try {
    rawText = response.text || '';
  } catch {
    // Fallback if getter throws on certain finish reasons
  }

  if (!rawText) {
    const candidate = response?.candidates?.[0];
    const parts = candidate?.content?.parts;
    if (parts && Array.isArray(parts)) {
      // Prioritize parts that have text and are not thoughts
      const nonThoughtPart = parts.find((p: any) => p && p.text && !p.thought);
      if (nonThoughtPart?.text) {
        rawText = nonThoughtPart.text;
      } else {
        const anyTextPart = parts.find((p: any) => p && p.text);
        if (anyTextPart?.text) rawText = anyTextPart.text;
      }
    }
  }

  const parsedJson = repairTruncatedJson(rawText);
  const result = parseMinifiedResponse(parsedJson, effectiveModel);
  
  if (response?.usageMetadata) {
      result.usageMetadata = {
          promptTokenCount: response.usageMetadata.promptTokenCount || 0,
          candidatesTokenCount: response.usageMetadata.candidatesTokenCount || 0,
          totalTokenCount: response.usageMetadata.totalTokenCount || 0,
      };
      
      const tokensCount = response.usageMetadata.totalTokenCount || 0;
      const confidenceScores = result.products?.map(p => p.confidence).filter((c): c is number => typeof c === 'number') || [];
      
      if (userPromptId) {
          await logPromptUsage(userPromptId, tokensCount, confidenceScores);
      }
      if (systemPromptId && systemPromptId !== userPromptId) {
          await logPromptUsage(systemPromptId, tokensCount, confidenceScores);
      }
  }
  return result;
}

export async function analyzeImageWithGeminiCustom(
  base64Image: string,
  userPromptText: string,
  systemInstructionText: string,
  modelName: string = 'gemini-3.1-flash-lite',
  mimeType: string = 'image/jpeg'
): Promise<AnalysisResult> {
  // Prepíšeme {{knownProducts}} aj v sandbox tréningovom prostredí Prompt Managera
  const catalog = await getCatalogEntries();
  const known = catalog.map(e => e.visualFeatures ? `${e.canonicalName} (Visuals: ${e.visualFeatures})` : e.canonicalName).join(', ');

  let systemWithContext = systemInstructionText.replace('{{knownProducts}}', known);
  if (!systemWithContext.includes("CRITICAL INSTRUCTIONS")) {
    systemWithContext += "\n\nCRITICAL INSTRUCTIONS:\n";
    systemWithContext += "1. FOCUS ON PROMOTIONAL PRODUCTS & PROMO PRICES: Retail chains highlight promotional items with distinctive colored tags and frames:\n";
    systemWithContext += "   - RED HIGHLIGHTS / RED FRAMES / RED LABELS (Kaufland Card, Lidl Super Cena, Coop Jednota, Billa, Tesco).\n";
    systemWithContext += "   - YELLOW HIGHLIGHTS / YELLOW FRAMES / YELLOW LABELS (Tesco Clubcard yellow frames, Billa Bonus yellow tags, Terno/Kraj).\n";
    systemWithContext += "   - PROMO KEYWORDS: 'AKCIA', 'ZĽAVA', 'SUPER CENA', 'CLUBCARD', 'LIDL PLUS', 'KAUFLAND CARD', 'BILLA BONUS', '%', '1+1', 'XXL'.\n";
    systemWithContext += "   - For promotional tags, mark promo price with 'P' (e.g. '1.49 P'). If crossed-out regular price is also shown, output 'VALUE_REGULAR R; VALUE_PROMO P' (e.g. '2.29 R; 1.49 P').\n";
    systemWithContext += "2. Distinguish between physical products and 'GHOST' products (printed product images on the back wall of the shelf/rack). If it is a printed image, set g=true.\n";
    systemWithContext += "3. Identify POS materials: wobblers, stoppers, floor stands, pallets. Set pt to the type of POS material.\n";
    systemWithContext += "4. Use the provided visual characteristics (color, shape, text) to accurately identify products, especially when text is blurry.\n";
    systemWithContext += "5. Be extremely precise with bounding boxes. Ensure they tightly wrap the visible product.\n";
    systemWithContext += "6. For prices, extract the exact complete price including decimal cents (haliere). Cents written in superscript or small font next to the integer must be included (e.g. large 12 and small 90 -> '12.90', never '12').";
  }

  const finalUserPromptText = userPromptText.replace('{{knownProducts}}', known);
  const ai = getGeminiClient();
  const cleanedImage = cleanBase64(base64Image);
  const effectiveMime = (base64Image.startsWith('data:') && base64Image.match(/^data:([^;]+);base64,/)?.[1]) || mimeType || 'image/jpeg';

  const normModel = normalizeModelName(modelName);
  const modelCandidates = Array.from(new Set([
    normModel,
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3-flash-preview'
  ])).filter(Boolean);

  let response: any = null;
  let effectiveModel = modelCandidates[0];
  let lastError: any = null;

  for (const candidate of modelCandidates) {
    try {
      effectiveModel = candidate;
      response = await ai.models.generateContent({
        model: candidate,
        contents: { parts: [{ inlineData: { data: cleanedImage, mimeType: effectiveMime } }, { text: finalUserPromptText }] },
        config: {
          systemInstruction: systemWithContext,
          responseMimeType: 'application/json',
          responseSchema: productSchema,
          temperature: 0.1, // slightly lower for playground testing to make it deterministic
          maxOutputTokens: 8192,
        },
      });
      if (response) break;
    } catch (err: any) {
      lastError = err;
      console.warn(`Model ${candidate} failed in custom test, trying fallback...`, err?.message);
    }
  }

  if (!response) {
    throw lastError || new Error('All vision models exhausted.');
  }

  let rawText = '';
  try {
    rawText = response.text || '';
  } catch {
    const candidate = response?.candidates?.[0];
    const parts = candidate?.content?.parts;
    if (parts && parts.length > 0 && parts[0].text) {
      rawText = parts[0].text;
    }
  }

  const parsedJson = repairTruncatedJson(rawText);
  const result = parseMinifiedResponse(parsedJson, effectiveModel);
  if (response.usageMetadata) {
      result.usageMetadata = {
          promptTokenCount: response.usageMetadata.promptTokenCount || 0,
          candidatesTokenCount: response.usageMetadata.candidatesTokenCount || 0,
          totalTokenCount: response.usageMetadata.totalTokenCount || 0,
      };
  }
  return result;
}

export async function createVisualFingerprint(productName: string, base64Images: string[]): Promise<string> {
    const ai = getGeminiClient();
    const imageParts = base64Images.map(img => ({ inlineData: { data: cleanBase64(img), mimeType: 'image/jpeg' } }));
    const prompt = `Analyze images of "${productName}". Create a concise "Visual Fingerprint" to help identification.`;
    const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts: [...imageParts, { text: prompt }] },
        config: { temperature: 0.1, maxOutputTokens: 100 }
    });
    return response.text?.trim() || "";
}

const qualityCheckSchema = {
  type: Type.OBJECT,
  properties: {
    complianceScore: {
      type: Type.INTEGER,
      description: 'An integer from 0 to 100 representing the similarity score / compliance percentage.'
    },
    reason: {
      type: Type.STRING,
      description: 'Slovak explanation of differences or compliance comments.'
    }
  },
  required: ['complianceScore', 'reason']
};

export interface QualityCheckAnalysisResult {
  complianceScore: number;
  reason: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
  sk: 'Slovak (Slovenčina)',
  cs: 'Czech (Čeština)',
  en: 'English',
  hu: 'Hungarian (Magyar)',
  hr: 'Croatian (Hrvatski)',
  de: 'German (Deutsch)'
};

export async function analyzeQualityCheck(
  referenceImages: string[],
  verbalManual: string,
  storeImage: string,
  modelName: string = 'gemini-3.1-flash-lite',
  language: string = 'sk'
): Promise<QualityCheckAnalysisResult> {
  const ai = getGeminiClient();
  const targetLangName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES['sk'];

  const refParts = referenceImages.map(img => ({
    inlineData: {
      data: cleanBase64(img),
      mimeType: 'image/jpeg'
    }
  }));

  const targetPart = {
    inlineData: {
      data: cleanBase64(storeImage),
      mimeType: 'image/jpeg'
    }
  };

  const systemInstruction = `Si Senior Auditér kvality a tvojou úlohou je porovnať fotografiu z predajne s referenčnými obrázkami planogramu a priloženým slovným manuálom.
Vyhodnoť mieru súladu (zhodu v %) s referenciou na stupnici od 0 do 100, kde:
- 100% znamená dokonalý súlad so všetkými detailmi planogramu a pokynmi.
- 0% znamená úplne odlišný regál bez akejkoľvek spojitosti so vzorom.

PRÍSNA POŽIADAVKA NA JAZYK VÝSTUPU:
Bez ohľadu na to, v akom jazyku je napísaný zadaný manuál alebo inštrukcie k planogramu, VŠETKY textové vysvetlenia a dôvody nezhody/zhody (pole "reason") MUSÍŠ VŽDY napísať výhradne v jazyku: ${targetLangName}.

Buď konštruktívny a presne popíš, čo chýba, čo je nesprávne umiestnené, alebo aké odchýlky sa na fotke z predajne vyskytujú.`;

  const prompt = `ÚLOHA:
Porovnaj cieľovú fotku z predajne (posledný priložený obrázok) s referenčným vzorom / planogramom (predchádzajúce priložené obrázky) a dodržiavaním pravidiel z tohto textového manuálu:
"${verbalManual || 'Žiadne textové pokyny neboli pridané.'}"

PRILOŽENÉ OBRÁZKY:
- Referenčné obrázky (vzorový príklad správneho vystavenia): ${refParts.length} ks
- Cieľová fotografia z predajne na analýzu: 1 ks

DÔLEŽITÉ UPOZORNENIE PRE JAZYK VÝSTUPU:
Textové hodnotenie a zdôvodnenie ("reason") vo výstupnom JSON vygeneruj VÝHRADNE v jazyku: ${targetLangName}, aj keby bol textový manuál vyššie v inom jazyku.

Formátuj výstup ako JSON podľa schémy.`;

  const parts = [
    ...refParts,
    targetPart,
    { text: prompt }
  ];

  const normQcModel = normalizeModelName(modelName);
  const modelCandidates = Array.from(new Set([
    normQcModel,
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3-flash-preview'
  ])).filter(Boolean);

  let response: any = null;
  let lastError: any = null;

  for (const candidate of modelCandidates) {
    try {
      response = await ai.models.generateContent({
        model: candidate,
        contents: { parts },
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: qualityCheckSchema,
          temperature: 0.1,
        }
      });
      if (response) break;
    } catch (err: any) {
      lastError = err;
      console.warn(`Quality check model ${candidate} failed, falling back...`, err?.message);
    }
  }

  if (!response) {
    throw lastError || new Error('Quality check failed.');
  }

  let qcRawText = '';
  try {
    qcRawText = response.text || '';
  } catch {
    const candidate = response?.candidates?.[0];
    const parts = candidate?.content?.parts;
    if (parts && parts.length > 0 && parts[0].text) {
      qcRawText = parts[0].text;
    }
  }

  let parsedJson: any;
  try {
    parsedJson = JSON.parse(extractFirstJson(qcRawText));
  } catch {
    parsedJson = { complianceScore: 75, reason: qcRawText || 'Analýza súladu dokončená.' };
  }

  return {
    complianceScore: typeof parsedJson.complianceScore === 'number' ? parsedJson.complianceScore : Number(parsedJson.complianceScore || 0),
    reason: parsedJson.reason || ''
  };
}

const translationCache = new Map<string, string>();

export async function translateAnalysisText(
  text: string,
  targetLanguage: string = 'sk'
): Promise<string> {
  if (!text || !text.trim()) return text;
  
  const cacheKey = `${targetLanguage}:${text.trim()}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  if (targetLanguage === 'sk') {
    return text;
  }

  const targetLangName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

  try {
    const ai = getGeminiClient();
    const prompt = `You are a professional retail auditor & translator. Translate the following store audit analysis/quality check explanation accurately into ${targetLangName}. Keep store names, product names, numbers, and technical layout terms intact. Do NOT add preamble or quote marks - return ONLY the translated text:\n\n${text}`;

    const modelCandidates = ['gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let response: any = null;

    for (const m of modelCandidates) {
      try {
        response = await ai.models.generateContent({
          model: m,
          contents: prompt,
          config: {
            temperature: 0.1,
          }
        });
        if (response?.text) break;
      } catch {
        // try next
      }
    }

    const translated = response?.text ? response.text.trim() : text;
    translationCache.set(cacheKey, translated);
    return translated;
  } catch (err) {
    console.error('Error translating analysis text:', err);
    return text;
  }
}

const promptOptimizationSchema = {
  type: Type.OBJECT,
  properties: {
    optimizedPrompt: {
      type: Type.STRING,
      description: 'The complete, fully revised and enhanced prompt text with crisp markdown headers and instructions.'
    },
    changesSummary: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'List of specific improvements and fixes made to the prompt.'
    },
    expectedImprovements: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'List of expected accuracy and performance gains.'
    },
    estimatedAccuracyGain: {
      type: Type.STRING,
      description: 'Estimated accuracy percentage gain string, e.g. "+16% k presnosti SKU a detekcii cenoviek".'
    }
  },
  required: ['optimizedPrompt', 'changesSummary', 'expectedImprovements', 'estimatedAccuracyGain']
};

export async function optimizePromptWithGemini(
  currentPrompt: string,
  promptCategory: string,
  auditSummary: PromptAuditSummary,
  recommendations: PromptRecommendation[],
  catalogSample: string[] = []
): Promise<PromptOptimizationResult> {
  const ai = getGeminiClient();

  const categoryLabels: Record<string, string> = {
    price: 'OSP (Pricing - sledovanie a OCR čítanie cien, promo akcií a cenoviek)',
    shelfShare: 'SOS (Shelf Share - podiel kategórií na regále, počet kusov a facingov, POS materiály a regálová štruktúra)',
    osa: 'OSA (On-Shelf Availability - dostupnosť tovaru, prázdne miesta a výpadky tovaru Out of Stock)',
    system: 'Systémová inštrukcia (globálne Computer Vision pravidlá, JSON schéma a formátovanie)',
    both: 'Kompletná analýza (kombinovaná OSP cenová analýza a SOS podiel na regále)'
  };
  const categoryContext = categoryLabels[promptCategory] || promptCategory;

  const recommendationsText = recommendations.length > 0 
    ? recommendations.map((r, i) => `
[Odporúčanie ${i + 1} - ${r.title}] (${r.severity.toUpperCase()})
- Problém: ${r.description}
- Dôkazy z auditu: ${r.evidence.metric} = ${r.evidence.value} (${r.evidence.detail})
- Navrhované pravidlo pre ${promptCategory}:
${r.suggestedRule}
`).join('\n')
    : `(Žiadne kritické odchýlky neboli zistené - zameraj sa na celkové sprehľadnenie a tokenovú optimalizáciu inštrukcií pre ${categoryContext})`;

  const systemInstruction = `Si elitný AI Prompt Engineer a Computer Vision špecialista pre retailový audit a rozpoznávanie tovaru na regáloch (Shelf Vision).
Tvojou úlohou je analyzovať existujúci prompt výhradne pre typ analýzy "${categoryContext}", skombinovať ho so zistenými chybami z reálnych auditov pre tento typ analýzy a vygenerovať novú, vysoko optimalizovanú verziu promptu.

PRAVIDLÁ OPTIMALIZÁCIE PRE TYP ANALÝZY "${promptCategory.toUpperCase()}":
1. Zachovaj štruktúru schémy (minified JSON výstup) a základný formát.
2. Integruj konkrétne pravidlá z priložených odporúčaní pre zvolený typ analýzy (${categoryContext}). Nepridávaj nesúvisiace pravidlá (napr. pri SOS nepridávaj pravidlá pre čítanie cenoviek, pri OSP nepridávaj nesúvisiace POS metriky).
3. Odstráň duplicitné, nejednoznačné alebo zbytočne zdĺhavé inštrukcie.
4. Použi jasné markdown nadpisy a bodové pravidlá pre maximálnu pozornosť modelu.
5. Vráť výstup striktne podľa zadanej JSON schémy v slovenskom jazyku.`;

  const userContent = `EXISTUJÚCI PROMPT PRE TYP ANALÝZY "${categoryContext}":
"""
${currentPrompt}
"""

ŠTATISTIKA REÁLNYCH AUDITOV:
- Celkovo analyzovaných fotografií regálov: ${auditSummary.totalImages} ks
- Celkovo detegovaných SKU: ${auditSummary.totalDetectedItems} ks
- Priemerná miera istoty AI (Confidence): ${Math.round(auditSummary.avgConfidence * 100)}%
- Pokrytie prečítaných cenoviek: ${auditSummary.priceDetectionRate}%
- Podiel Ghost produktov (potlač na zadnom paneli): ${auditSummary.ghostProductRate}%
- Zistených variácií SKU / Label Drift: ${auditSummary.skuDriftCount} prípadov
- Počet POS materiálov: ${auditSummary.posMaterialCount} ks

ZOZNAM ODPORÚČANÍ TÝKAJÚCICH SA TOHTO TYPU ANALÝZY (${promptCategory.toUpperCase()}):
${recommendationsText}

VZORKA OFICIÁLNYCH KANONICKÝCH NÁZVOV Z KATALÓGU:
${catalogSample.slice(0, 15).join(', ')}

Vygeneruj novú vylepšenú verziu promptu zameranú na "${categoryContext}" s implementovanými odporúčaniami a súhrnom vykonaných zmien.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: userContent,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: promptOptimizationSchema,
      temperature: 0.2,
    }
  });

  const parsed = JSON.parse(extractFirstJson(response.text));
  return {
    originalPrompt: currentPrompt,
    optimizedPrompt: parsed.optimizedPrompt || currentPrompt,
    changesSummary: Array.isArray(parsed.changesSummary) ? parsed.changesSummary : ['Vylepšená štruktúra a pravidlá'],
    expectedImprovements: Array.isArray(parsed.expectedImprovements) ? parsed.expectedImprovements : ['Zvýšenie presnosti a spoľahlivosti'],
    estimatedAccuracyGain: parsed.estimatedAccuracyGain || '+12% k presnosti detekcie'
  };
}

