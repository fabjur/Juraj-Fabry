import { GoogleGenAI, Type } from "@google/genai";
import type { AnalysisResult, DetectedProduct, PriceInfo, StoreInfo, ObjectType, PosType, PromptAuditSummary, PromptRecommendation, PromptOptimizationResult } from '../types';
import { getActivePrompt, getCatalogEntries, logPromptUsage } from '../db';
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

function extractFirstJson(text: string): string {
    const markdownMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    let cleanText = text;
    if (markdownMatch && markdownMatch[1]) {
        cleanText = markdownMatch[1].trim();
    }

    const firstBrace = cleanText.indexOf('{');
    const firstBracket = cleanText.indexOf('[');
    let startIndex: number;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        startIndex = firstBrace;
    } else if (firstBracket !== -1) {
        startIndex = firstBracket;
    } else {
        throw new Error("No JSON object or array found in the response text.");
    }
    
    const stack: string[] = [];
    let inString = false;
    let isEscaped = false;

    for (let i = startIndex; i < cleanText.length; i++) {
        const char = cleanText[i];
        if (inString) {
            if (isEscaped) isEscaped = false;
            else if (char === '\\') isEscaped = true;
            else if (char === '"') inString = false;
        } else {
            if (char === '"') inString = true;
            else if (char === '{' || char === '[') stack.push(char);
            else if (char === '}' || char === ']') stack.pop();
        }
        if (!inString && stack.length === 0) return cleanText.substring(startIndex, i + 1);
    }
    throw new Error("Truncated JSON.");
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

  if (minifiedResponse.products && Array.isArray(minifiedResponse.products)) {
    minifiedResponse.products.forEach((group: any) => {
      const name = group.n;
      const type = (group.t || 'product') as ObjectType;
      const posType = group.pt as PosType;
      const isGhost = group.g === true;
      const { prices, integrityStatus } = parseMinifiedPriceString(group.p);

      if (typeof group.b === 'string' && group.b) {
        const boxStrings = group.b.split('|');
        boxStrings.forEach((boxString: string) => {
          const coords = boxString.split(',').map(Number);
          if (coords.length === 4) {
            products.push({
              id: `${name}-${Math.random().toString(36).substring(7)}`,
              name,
              brand: name.split(' ')[0],
              prices,
              priceIntegrityStatus: integrityStatus,
              boundingBox: { x: coords[1]/1000, y: coords[0]/1000, width: (coords[3]-coords[1])/1000, height: (coords[2]-coords[0])/1000 },
              confidence: group.c || 0.9,
              type,
              posType,
              isGhost
            });
          }
        });
      }
    });
  }

  if (minifiedResponse.info) {
    if (minifiedResponse.info.chn) storeInfo.chain = minifiedResponse.info.chn;
    if (minifiedResponse.info.adr) storeInfo.address = minifiedResponse.info.adr;
  }

  return { products, storeInfo, modelName: usedModel };
}

export async function analyzeImageWithGemini(
  base64Image: string, 
  defaultPromptText: string, 
  defaultSystemInstruction: string,
  category: 'price' | 'shelfShare' | 'both' | 'osa' = 'both',
  modelName: string = 'gemini-2.5-flash',
  productCategory?: string,
  clientName?: string
): Promise<AnalysisResult> {
  const dynamicSystem = await getActivePrompt('system', productCategory, clientName);
  const dynamicUser = await getActivePrompt(category, productCategory, clientName);

  // Načítame katalóg pre podporu dynamických visual / name inštrukcií v kategóriách tovaru
  const catalog = await getCatalogEntries();
  const filteredCatalog = (productCategory && catalog.some(e => e.category === productCategory))
    ? catalog.filter(e => e.category === productCategory)
    : catalog;
  const known = filteredCatalog.map(e => e.visualFeatures ? `${e.canonicalName} (Visuals: ${e.visualFeatures})` : e.canonicalName).join(', ');

  let systemWithContext = (dynamicSystem?.text || defaultSystemInstruction).replace('{{knownProducts}}', known);
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

  const userPromptText = (dynamicUser?.text || defaultPromptText).replace('{{knownProducts}}', known);

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts: [{ inlineData: { data: base64Image, mimeType: 'image/jpeg' } }, { text: userPromptText }] },
    config: {
      systemInstruction: systemWithContext,
      responseMimeType: 'application/json',
      responseSchema: productSchema,
      temperature: 0.2,
    },
  });

  const parsedJson = JSON.parse(extractFirstJson(response.text));
  const result = parseMinifiedResponse(parsedJson, modelName);
  
  if (response.usageMetadata) {
      result.usageMetadata = {
          promptTokenCount: response.usageMetadata.promptTokenCount || 0,
          candidatesTokenCount: response.usageMetadata.candidatesTokenCount || 0,
          totalTokenCount: response.usageMetadata.totalTokenCount || 0,
      };
      
      const tokensCount = response.usageMetadata.totalTokenCount || 0;
      const confidenceScores = result.products?.map(p => p.confidence).filter((c): c is number => typeof c === 'number') || [];
      
      if (dynamicUser?.id) {
          await logPromptUsage(dynamicUser.id, tokensCount, confidenceScores);
      }
      if (dynamicSystem?.id && dynamicSystem.id !== dynamicUser?.id) {
          await logPromptUsage(dynamicSystem.id, tokensCount, confidenceScores);
      }
  }
  return result;
}

export async function analyzeImageWithGeminiCustom(
  base64Image: string,
  userPromptText: string,
  systemInstructionText: string,
  modelName: string = 'gemini-2.5-flash'
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

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts: [{ inlineData: { data: base64Image, mimeType: 'image/jpeg' } }, { text: finalUserPromptText }] },
    config: {
      systemInstruction: systemWithContext,
      responseMimeType: 'application/json',
      responseSchema: productSchema,
      temperature: 0.1, // slightly lower for playground testing to make it deterministic
    },
  });

  const parsedJson = JSON.parse(extractFirstJson(response.text));
  const result = parseMinifiedResponse(parsedJson, modelName);
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const imageParts = base64Images.map(img => ({ inlineData: { data: img, mimeType: 'image/jpeg' } }));
    const prompt = `Analyze images of "${productName}". Create a concise "Visual Fingerprint" to help identification.`;
    const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
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
  modelName: string = 'gemini-3.6-flash',
  language: string = 'sk'
): Promise<QualityCheckAnalysisResult> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const targetLangName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES['sk'];
  
  // Clean up base64 wrappers
  const cleanBase64 = (b64: string) => {
    if (b64.includes('base64,')) {
      return b64.split('base64,')[1];
    }
    return b64;
  };

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

  const response = await ai.models.generateContent({
    model: modelName,
    contents: { parts },
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: qualityCheckSchema,
      temperature: 0.1,
    }
  });

  const parsedJson = JSON.parse(extractFirstJson(response.text));
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

  // Ak je cieľový jazyk rovnaký ako predvolená slovenčina a text nevyžaduje preklad, vráť pôvodný
  if (targetLanguage === 'sk') {
    return text;
  }

  const targetLangName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `You are a professional retail auditor & translator. Translate the following store audit analysis/quality check explanation accurately into ${targetLangName}. Keep store names, product names, numbers, and technical layout terms intact. Do NOT add preamble or quote marks - return ONLY the translated text:\n\n${text}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        temperature: 0.1,
      }
    });

    const translated = response.text ? response.text.trim() : text;
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
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    model: 'gemini-3.6-flash',
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

