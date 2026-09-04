import type { 
  Analysis, 
  ProductCatalogEntry, 
  PromptRecommendation, 
  PromptAuditSummary,
  PromptTemplate
} from '../types';

/**
 * Normalizuje text pre rýchle porovnávanie
 */
const cleanStr = (s: string): string => 
  s.toLowerCase().replace(/[.,\-_/]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Analyzuje všetky realizované audity a generuje hĺbkový súhrn kvality a konkrétne odporúčania na zlepšenie promptu
 */
export const generatePromptAuditAndRecommendations = (
  analyses: Analysis[],
  catalog: ProductCatalogEntry[],
  currentSystemPrompt: string = '',
  currentUserPrompt: string = ''
): { summary: PromptAuditSummary; recommendations: PromptRecommendation[] } => {
  let totalImages = 0;
  let totalDetectedItems = 0;
  let totalConfidenceSum = 0;
  let productsWithPriceCount = 0;
  let regularPricesCount = 0;
  let promoPricesCount = 0;
  let ghostCount = 0;
  let posCount = 0;

  const detectedNamesMap = new Map<string, { count: number; totalConf: number; noPriceCount: number; isGhostCount: number }>();
  const categoryStatsMap = new Map<string, { count: number; totalConf: number }>();
  const detectedVariationsMap = new Map<string, Set<string>>(); // canonical or root -> Set of observed strings

  // 1. Zber dát zo všetkých realizovaných analýz
  for (const analysis of analyses) {
    if (!analysis.images || !Array.isArray(analysis.images)) continue;

    for (const img of analysis.images) {
      totalImages++;
      const products = img.analysisResult?.products || [];

      for (const prod of products) {
        if (!prod || !prod.name) continue;
        totalDetectedItems++;
        const conf = typeof prod.confidence === 'number' ? prod.confidence : 0.85;
        totalConfidenceSum += conf;

        const isGhost = Boolean(prod.isGhost);
        if (isGhost) ghostCount++;

        const isPos = prod.type === 'pos_material';
        if (isPos) posCount++;

        // Ceny
        const hasPrices = Array.isArray(prod.prices) && prod.prices.length > 0;
        if (hasPrices) {
          productsWithPriceCount++;
          prod.prices!.forEach(p => {
            if (p.type === 'PROMO') promoPricesCount++;
            else regularPricesCount++;
          });
        }

        // Stats pre konkrétny názov
        const norm = prod.name.trim();
        const stat = detectedNamesMap.get(norm) || { count: 0, totalConf: 0, noPriceCount: 0, isGhostCount: 0 };
        stat.count++;
        stat.totalConf += conf;
        if (!hasPrices) stat.noPriceCount++;
        if (isGhost) stat.isGhostCount++;
        detectedNamesMap.set(norm, stat);

        // Kategória
        const cat = prod.category || analysis.productCategory || 'Nezaradené';
        const catStat = categoryStatsMap.get(cat) || { count: 0, totalConf: 0 };
        catStat.count++;
        catStat.totalConf += conf;
        categoryStatsMap.set(cat, catStat);

        // Skupinovanie variácií
        const firstTwoWords = norm.split(/\s+/).slice(0, 2).join(' ').toLowerCase();
        if (firstTwoWords.length > 3) {
          const varSet = detectedVariationsMap.get(firstTwoWords) || new Set<string>();
          varSet.add(norm);
          detectedVariationsMap.set(firstTwoWords, varSet);
        }
      }
    }
  }

  // 2. Výpočet kľúčových metrík kvality
  const avgConfidence = totalDetectedItems > 0 
    ? Math.round((totalConfidenceSum / totalDetectedItems) * 100) / 100 
    : 0.88;

  const priceDetectionRate = totalDetectedItems > 0 
    ? Math.round((productsWithPriceCount / totalDetectedItems) * 100) 
    : 0;

  const ghostProductRate = totalDetectedItems > 0 
    ? Math.round((ghostCount / totalDetectedItems) * 1000) / 10 
    : 0;

  const categoryBreakdown = Array.from(categoryStatsMap.entries()).map(([category, stat]) => ({
    category,
    count: stat.count,
    avgConfidence: stat.count > 0 ? Math.round((stat.totalConf / stat.count) * 100) / 100 : 0
  })).sort((a, b) => b.count - a.count);

  // Identifikácia problematických SKU (nízka istota, chýbajúce ceny, ghost)
  const topProblematicSkus: { name: string; occurrences: number; avgConfidence: number; issue: string }[] = [];
  
  detectedNamesMap.forEach((stat, name) => {
    const itemAvgConf = stat.count > 0 ? stat.totalConf / stat.count : 0;
    const noPriceRatio = stat.count > 0 ? stat.noPriceCount / stat.count : 0;
    
    let issue = '';
    if (stat.isGhostCount > 0 && stat.isGhostCount === stat.count) {
      issue = 'Vysoké riziko falošnej detekcie z potlače regálu (Ghost)';
    } else if (itemAvgConf < 0.72) {
      issue = `Nízka AI miera istoty (${Math.round(itemAvgConf * 100)}%)`;
    } else if (noPriceRatio > 0.6 && stat.count >= 2) {
      issue = `Väčšina výskytov (${Math.round(noPriceRatio * 100)}%) bez prečítanej ceny`;
    }

    if (issue && stat.count >= 2) {
      topProblematicSkus.push({
        name,
        occurrences: stat.count,
        avgConfidence: Math.round(itemAvgConf * 100) / 100,
        issue
      });
    }
  });

  topProblematicSkus.sort((a, b) => b.occurrences - a.occurrences);

  // 3. Detekcia nezhôd s katalógom a Label Drift
  let skuDriftCount = 0;
  let unmatchedSkuCount = 0;
  const driftExamples: { original: string; canonical: string; count: number }[] = [];

  detectedNamesMap.forEach((stat, rawName) => {
    const rawClean = cleanStr(rawName);
    let matchedCatalog: ProductCatalogEntry | undefined;

    // Presná zhoda
    matchedCatalog = catalog.find(c => cleanStr(c.canonicalName) === rawClean);
    
    // Alias zhoda
    if (!matchedCatalog) {
      matchedCatalog = catalog.find(c => 
        c.aliases && c.aliases.some(a => cleanStr(a) === rawClean)
      );
    }

    // Fuzzy / Substring zhoda (identifikácia driftu)
    if (!matchedCatalog) {
      matchedCatalog = catalog.find(c => {
        const catClean = cleanStr(c.canonicalName);
        return catClean.length > 5 && (rawClean.includes(catClean) || catClean.includes(rawClean));
      });

      if (matchedCatalog && cleanStr(matchedCatalog.canonicalName) !== rawClean) {
        skuDriftCount++;
        driftExamples.push({
          original: rawName,
          canonical: matchedCatalog.canonicalName,
          count: stat.count
        });
      } else {
        unmatchedSkuCount++;
      }
    }
  });

  // 4. Výpočet Health Score
  let healthScore = 100;
  if (avgConfidence < 0.8) healthScore -= 15;
  else if (avgConfidence < 0.9) healthScore -= 5;
  if (priceDetectionRate < 70) healthScore -= 20;
  else if (priceDetectionRate < 85) healthScore -= 10;
  if (ghostProductRate > 5) healthScore -= 10;
  if (skuDriftCount > 5) healthScore -= 15;
  if (healthScore < 20) healthScore = 20;

  // 5. GENERÁCIA ŠPECIFICKÝCH ODPORÚČANÍ NA ZLEPŠENIE PROMPTU
  const recommendations: PromptRecommendation[] = [];

  // A. Odporúčanie na detekciu akciových produktov v červených a žltých rámčekoch (Promotional Pricing & Chain Tags)
  const combinedPrompts = `${currentSystemPrompt} ${currentUserPrompt}`.toLowerCase();
  const lacksPromoFrameRule = !combinedPrompts.includes('červen') && !combinedPrompts.includes('žlt') && !combinedPrompts.includes('red frame') && !combinedPrompts.includes('yellow frame') && !combinedPrompts.includes('clubcard');
  const promoRatio = productsWithPriceCount > 0 ? (promoPricesCount / productsWithPriceCount) * 100 : 0;

  if (lacksPromoFrameRule || promoPricesCount === 0 || promoRatio < 20) {
    const promoRuleSnippet = `### PRAVIDLO PRE DETEKCIU AKCIOVÝCH PRODUKTOV A CIEN (ČERVENÉ & ŽLTÉ RÁMČEKY):
- V maloobchodných sieťach sú akciové produkty a ceny zvýraznené špecifickými farbami a štítkami:
  * ČERVENÉ RÁMČEKY / CENOVKY: Kaufland (Akcia/Card), Lidl (Super Cena/Akcia), Billa, Coop Jednota, Tesco (akciové výpredaje).
  * ŽLTÉ RÁMČEKY / CENOVKY: Tesco (Clubcard žlté rámy/štítky), Billa (Bonus žlté cenovky), Terno / Kraj (žlté akčné pásiky).
  * KĽÚČOVÉ TEXTY: "AKCIA", "ZĽAVA", "SUPER CENA", "CLUBCARD", "LIDL PLUS", "KAUFLAND CARD", "BILLA BONUS", "%", "1+1", "XXL", "VÝHODNÁ CENA".
- Pre každý produkt v červenom alebo žltom rámčeku VŽDY označ cenu ako akciovú s príznakom 'P' (napr. "1.69 P").
- Ak je na akciovej cenovke viditeľná aj pôvodná prečiarknutá cena (bežná cena), extrahuj obe hodnoty v tvare: 'VALUE_REGULAR R; VALUE_PROMO P' (napr. "2.49 R; 1.69 P").`;

    recommendations.push({
      id: 'rec-promo-pricing-tags',
      category: 'price_ocr',
      severity: lacksPromoFrameRule ? 'critical' : 'warning',
      title: 'Detekcia akciových cien a produktov v červených a žltých rámčekoch',
      description: `Akciové produkty na predajniach bývajú výrazne ohraničené červenými alebo žltými rámčekmi (Tesco Clubcard, Kaufland Card, Lidl Super Cena, Billa Bonus, Coop Jednota). Prompt vyžaduje explicitné vizuálne pravidlá pre ich záchyt.`,
      impact: '+35% Úspešnosť záchytu akciových cien a zliav',
      evidence: {
        metric: 'Podiel zachytených akciových cien',
        value: `${Math.round(promoRatio)}% (${promoPricesCount} ks z ${productsWithPriceCount})`,
        detail: lacksPromoFrameRule ? 'V texte promptu chýbajú inštrukcie pre červené/žlté rámčeky reťazcov.' : 'Nízky pomer akciových cien voči bežným cenám.'
      },
      suggestedRule: promoRuleSnippet,
      targetPromptCategory: 'price',
      targetCategories: ['price', 'both']
    });
  }

  // B. Odporúčanie na normalizáciu SKU a synonym (Label Drift)
  if (driftExamples.length > 0 || skuDriftCount > 0) {
    const topDrifts = driftExamples.slice(0, 4);
    const examplesFormatted = topDrifts.map(d => `- [${d.original}] ➔ "${d.canonical}"`).join('\n');
    const ruleSnippet = `### PRAVIDLO NORMALIZÁCIE SKU A KANONICKÝCH NÁZVOV:\n- Dôsledne mapuj neformálne alebo skrátené označenia na ich oficiálny kanonický tvar:\n${examplesFormatted}\n- Nikdy neuvádzaj vymyslené skratky, ak je na obale čitateľný oficiálny názov značky a gramáže.`;

    recommendations.push({
      id: 'rec-sku-normalization',
      category: 'normalization',
      severity: 'critical',
      title: 'Zjednotenie variácií názvov SKU (Label Normalization)',
      description: `V analýzach bolo zistených ${skuDriftCount} prípadov odchýlok od oficiálnych názvov produktov v katalógu. Gemini vracia mierne odlišné zápisy (napr. objemy, príchute), čo znižuje presnosť párovania.`,
      impact: '+14% Presnosť párovania s katalógom',
      evidence: {
        metric: 'Detegovaný Label Drift',
        value: `${skuDriftCount} SKU variácií`,
        detail: `Zistené odchýlky pri ${topDrifts.length} kľúčových položkách.`
      },
      suggestedRule: ruleSnippet,
      targetPromptCategory: 'both',
      targetCategories: ['price', 'shelfShare', 'osa', 'both', 'system'],
      examples: topDrifts.map(d => ({ original: d.original, canonical: d.canonical, count: d.count }))
    });
  }

  // C. Odporúčanie na čítanie cien a malých desatinných čísiel (Price OCR & Cents)
  const lacksCentsRule = !combinedPrompts.includes('halier') && !combinedPrompts.includes('desatin') && !combinedPrompts.includes('cent');
  
  if (priceDetectionRate < 85 || lacksCentsRule) {
    const ruleSnippet = `### PRAVIDLO PRE ČÍTANIE CENIEK A DESATINNÝCH ČASTÍ:\n- Cenovky na regáli často zobrazujú centy/haliere v menšom fonte (horný index / superskript). Vždy dôkladne preskúmaj malý text vedľa hlavnej číslice a extrahuj celú cenu vo formáte "1.49" (nikdy nie zaokrúhlene "1" alebo "1.00").\n- Ak je cenovka prečiarknutá (akciová), extrahuj obe hodnoty a zoraď: "REGULAR" (pôvodná vyššia) a "PROMO" (akciová nižšia).`;

    recommendations.push({
      id: 'rec-price-ocr-cents',
      category: 'price_ocr',
      severity: priceDetectionRate < 65 ? 'critical' : 'warning',
      title: 'Zlepšenie OCR čítania cenoviek a drobných centov',
      description: `Pokrytie prečítaných cien je ${priceDetectionRate}%. Cenovky so zmenšeným písmom pre centy môžu spôsobovať stratu údajov alebo nesprávne zaokrúhlenie.`,
      impact: '+22% Úspešnosť extrakcie cenoviek',
      evidence: {
        metric: 'Pokrytie cenoviek',
        value: `${priceDetectionRate}% produktov s cenou`,
        detail: `${totalDetectedItems - productsWithPriceCount} položiek bez identifikovanej cenovky.`
      },
      suggestedRule: ruleSnippet,
      targetPromptCategory: 'price',
      targetCategories: ['price', 'both']
    });
  }

  // D. Odporúčanie pre filtrovanie Ghost produktov (Potlač regálu)
  const lacksGhostRule = !combinedPrompts.includes('ghost') && !combinedPrompts.includes('tapet') && !combinedPrompts.includes('potlač');
  if (ghostProductRate > 1.5 || lacksGhostRule) {
    const ruleSnippet = `### PRAVIDLO PRE DETEKCIU GHOST PRODUKTOV (2D POTLAČ):\n- Označ príznakom "g: true" (Ghost) všetky produkty, ktoré sú len 2D fotografiou alebo ilustráciou vytlačenou na zadnom paneli regálu, deliacej lište alebo propagačnej grafike a nepredstavujú skutočný fyzický tovar na polici.\n- Fyzický tovar sa vyznačuje reálnou 3D hĺbkou, vrhaným tieňom a umiestnením priamo na rošte police.`;

    recommendations.push({
      id: 'rec-ghost-filtering',
      category: 'ghost_filtering',
      severity: ghostProductRate > 4 ? 'warning' : 'info',
      title: 'Filtrovanie falošných detekcií z regálovej potlače (Ghost)',
      description: 'Zadné steny regálov a reklamné bannery obsahujú ilustrácie fliaš/balení, ktoré AI môže omylom vyhodnotiť ako reálny fyzický tovar na predajni.',
      impact: '-95% Falošných pozitívov z bannerov',
      evidence: {
        metric: 'Výskyt Ghost položiek',
        value: `${ghostProductRate}% zo všetkých detekcií`,
        detail: `Detegovaných ${ghostCount} položiek s podozrením na regálovú grafiku.`
      },
      suggestedRule: ruleSnippet,
      targetPromptCategory: 'system',
      targetCategories: ['system', 'shelfShare', 'osa', 'both']
    });
  }

  // E. Odporúčanie pre POS materiály a reklamné pútače (SOS)
  if (posCount > 0 || !combinedPrompts.includes('pos_material')) {
    const ruleSnippet = `### KLASIFIKÁCIA POS MATERIÁLOV PRE SHELF SHARE (SOS):\n- Presne rozlišuj medzi tovarom ("product") a marketingovými pútačmi ("pos_material").\n- Pre POS materiály urči presný podtyp: "wobbler" (kývač), "stopper" (regálový predel), "stand" (stojan), "pallet" (paletové vystavenie), "secondary_display" (druhotné umiestnenie).\n- Pre POS materiály nepriraďuj cenovku bežného tovaru, pokiaľ neobsahuje špeciálnu promo správu.`;

    recommendations.push({
      id: 'rec-pos-materials',
      category: 'pos_materials',
      severity: 'optimization',
      title: 'Kategorizácia a presné ohraničenie POS materiálov',
      description: 'Zlepšite schopnosť modelu detegovať a správne klasifikovať regálové stojany, wobblery a stopery bez ich zámeny za bežné SKU.',
      impact: '+18% Presnosť klasifikácie marketingu',
      evidence: {
        metric: 'Identifikované POSM',
        value: `${posCount} kusov v auditoch`,
        detail: 'Zlepšenie sledovania sekundárnych vystavení a POS podpory.'
      },
      suggestedRule: ruleSnippet,
      targetPromptCategory: 'shelfShare',
      targetCategories: ['shelfShare', 'both']
    });
  }

  // F. Odporúčanie pre Facingy a štruktúru regálu (SOS)
  const lacksFacingRule = !combinedPrompts.includes('facing') && !combinedPrompts.includes('kus') && !combinedPrompts.includes('shelf share') && !combinedPrompts.includes('samostatn');
  if (lacksFacingRule || totalDetectedItems > 0) {
    const ruleSnippet = `### PRAVIDLO PRE DETEKCIU JEDNOTLIVÝCH KUSOV (FACINGOV) A SOS:
- Každé jednotlivé fyzické balenie tovaru na polici označ samostatným bounding boxom (1 kus = 1 samostatný box).
- Nikdy nezlučuj susediace rovnaké produkty do jedného spoločného širokého obdĺžnika; pre presný výpočet Share of Shelf (SOS) a plochy je vyžadovaný presný počet kusov a ich šírka.
- Pri regálovom rade vyhodnocuj produkty plynule zľava doprava a zhora nadol podľa jednotlivých políc.`;

    recommendations.push({
      id: 'rec-sos-facing-layout',
      category: 'structure',
      severity: lacksFacingRule ? 'critical' : 'optimization',
      title: 'Detekcia jednotlivých kusov (Facingov) a štruktúry pre SOS',
      description: 'Pre spoľahlivý výpočet podielu kategórií na regále (Share of Shelf) musí AI detegovať každý facing osobitne bez zhlukovania balení.',
      impact: '+24% Presnosť výpočtu podielu regálu (SOS)',
      evidence: {
        metric: 'Detegované produkty',
        value: `${totalDetectedItems} ks`,
        detail: lacksFacingRule ? 'V texte promptu chýba explicitné pravidlo pre 1-to-1 facingy.' : 'Pravidlo pre presné ohraničenie kusov na regáli pre SOS.'
      },
      suggestedRule: ruleSnippet,
      targetPromptCategory: 'shelfShare',
      targetCategories: ['shelfShare', 'both']
    });
  }

  // G. Odporúčanie pre nízku istotu (Low Confidence)
  if (avgConfidence < 0.88 || topProblematicSkus.some(s => s.avgConfidence < 0.75)) {
    const lowConfItems = topProblematicSkus.filter(s => s.avgConfidence < 0.8).slice(0, 3);
    const namesList = lowConfItems.map(i => `"${i.name}"`).join(', ');
    const ruleSnippet = `### DETAILNÁ ANALÝZA ŤAŽKO ČITATEĽNÝCH BALENÍ:\n- Pri produktoch s lesklým obalom alebo odleskami svetla (najmä ${namesList || 'plechovky, sklenené fľaše'}) sa zameraj na typické farebné akcenty loga, tvar viečka a veľkosť balenia pre dosiahnutie vysokej istoty.\n- Ak je produkt z časti zakrytý cenovkovou lištou, odvoď názov z viditeľnej vrchnej etikety.`;

    recommendations.push({
      id: 'rec-confidence-enhancement',
      category: 'confidence',
      severity: 'warning',
      title: 'Zvýšenie AI istoty pri lesklých a čiastočne zakrytých obaloch',
      description: `Priemerná istota modelu je ${Math.round(avgConfidence * 100)}%. Niektoré položky (${namesList || 'špecifické SKU'}) vykazujú zníženú istotu v dôsledku odleskov a prekrytia lištou.`,
      impact: '+9% Zvýšenie priemernej istoty (Confidence)',
      evidence: {
        metric: 'Priemerná istota AI',
        value: `${Math.round(avgConfidence * 100)}%`,
        detail: `Identifikovaných ${topProblematicSkus.length} položiek vyžadujúcich spresnenie vizuálnych deskriptorov.`
      },
      suggestedRule: ruleSnippet,
      targetPromptCategory: 'both',
      targetCategories: ['system', 'price', 'shelfShare', 'osa', 'both']
    });
  }

  // H. Odporúčanie pre špecifické kategórie (Category Rules pre SOS)
  const topCategories = categoryBreakdown.slice(0, 2);
  if (topCategories.length > 0) {
    const catNames = topCategories.map(c => c.category).join(', ');
    const ruleSnippet = `### ŠPECIFIKÁ PRE KATEGÓRIE (${catNames}):\n- Dôsledne rozlišuj príchute, varianty ZERO/BEZ CUKRU a objemy (napr. 0.33L plechovka vs. 0.5L PET vs. 1.5L multipack).\n- Uvádzaj jednotný formát objemu s medzerou (napr. "0.5L", "1.5L", "500g").`;

    recommendations.push({
      id: 'rec-category-specifics',
      category: 'category_rules',
      severity: 'optimization',
      title: `Optimalizácia pre dominantné kategórie (${catNames})`,
      description: `Analýzy obsahujú prevažne kategórie ${catNames}. Zavedenie presných pravidiel pre varianty bez cukru a formáty balení zamedzí chybám pri Shelf Share reportoch.`,
      impact: '+11% Rozlíšenie príchutí a variantov',
      evidence: {
        metric: 'Dominantné kategórie',
        value: `${topCategories.reduce((sum, c) => sum + c.count, 0)} detekovaných SKU`,
        detail: `Pokrýva viac než ${Math.round((topCategories.reduce((sum, c) => sum + c.count, 0) / (totalDetectedItems || 1)) * 100)}% sortimentu v auditoch.`
      },
      suggestedRule: ruleSnippet,
      targetPromptCategory: 'shelfShare',
      targetCategories: ['shelfShare', 'both']
    });
  }

  // I. Odporúčanie pre Out-of-Stock (OSA - On-Shelf Availability)
  const lacksOsaRule = !combinedPrompts.includes('out of stock') && !combinedPrompts.includes('výpadok') && !combinedPrompts.includes('prázdn') && !combinedPrompts.includes('chýba');
  if (lacksOsaRule) {
    const ruleSnippet = `### PRAVIDLO PRE AUDIT DOSTUPNOSTI (OSA & OUT-OF-STOCK):
- Sleduj medzery a prázdne miesta na policiach. Ak je na regáli prázdna pozícia s cenovkou bez tovaru, vyhodnoť ju ako výpadok (Out of Stock).
- Nikdy neoznačuj prázdny priestor police alebo grafiku zadnej steny ako prítomný tovar.`;

    recommendations.push({
      id: 'rec-osa-out-of-stock',
      category: 'structure',
      severity: 'warning',
      title: 'Identifikácia výpadkov tovaru a medzier na regáli (OSA / OOS)',
      description: 'Audit On-Shelf Availability (OSA) vyžaduje dôsledné rozlíšenie dostupného tovaru voči prázdnym miestam na policiach s chýbajúcimi výrobkami.',
      impact: '+20% Rýchlosť záchytu regálových výpadkov',
      evidence: {
        metric: 'Dostupnosť pravidla OSA',
        value: 'Chýba v prompte',
        detail: 'Prompt neobsahuje inštrukcie pre evidenciu prázdnych pozícií regálu.'
      },
      suggestedRule: ruleSnippet,
      targetPromptCategory: 'osa',
      targetCategories: ['osa', 'both']
    });
  }

  // J. Odporúčanie pre kompaktný minifikovaný JSON a tokenovú efektivitu (System)
  const lacksCompactSchemaRule = !combinedPrompts.includes('minifik') && !combinedPrompts.includes('ymin') && !combinedPrompts.includes('xmin');
  if (lacksCompactSchemaRule) {
    const ruleSnippet = `### PRAVIDLO PRE FORMÁT JSON A TOKENOVÚ EFEKTIVITU:
- Vráť striktne minifikovaný JSON bez formátovania a zbytočných medzier.
- Používaj výhradne skrátené kľúče schémy (n: názov, b: značka, p: cena, t: typ, g: ghost, box_2d: [ymin, xmin, ymax, xmax] v rozsahu 0-1000).`;

    recommendations.push({
      id: 'rec-system-compact-json',
      category: 'structure',
      severity: 'optimization',
      title: 'Kompaktný formát JSON a tokenová efektivita',
      description: 'Vynútenie skrátených kľúčov v JSON znižuje spotrebu výstupných tokenov a zrýchľuje odpoveď modelu.',
      impact: '-40% Spotreba tokenov pri inferencii',
      evidence: {
        metric: 'Štruktúra schémy',
        value: 'Optimalizácia',
        detail: 'Minimalizácia tokenovej réžie modelu pri spracovaní regálov.'
      },
      suggestedRule: ruleSnippet,
      targetPromptCategory: 'system',
      targetCategories: ['system', 'both']
    });
  }

  // 6. Súhrn počtu odporúčaní
  const recommendationsCount = {
    critical: recommendations.filter(r => r.severity === 'critical').length,
    warning: recommendations.filter(r => r.severity === 'warning').length,
    optimization: recommendations.filter(r => r.severity === 'optimization').length,
    info: recommendations.filter(r => r.severity === 'info').length,
  };

  const summary: PromptAuditSummary = {
    totalAnalyses: analyses.length,
    totalImages,
    totalDetectedItems,
    avgConfidence,
    priceDetectionRate,
    regularVsPromoRatio: { regular: regularPricesCount, promo: promoPricesCount },
    ghostProductRate,
    posMaterialCount: posCount,
    skuDriftCount,
    unmatchedSkuCount,
    categoryBreakdown,
    topProblematicSkus,
    recommendationsCount,
    healthScore
  };

  return { summary, recommendations };
};

/**
 * Bezpečne integruje navrhované pravidlo do existujúceho textu promptu
 */
export const injectRuleIntoPrompt = (currentPrompt: string, ruleToInject: string): string => {
  const trimmed = currentPrompt.trim();
  if (!trimmed) return ruleToInject;

  // Ak už pravidlo existuje (alebo jeho časť), nepridávaj duplicitne
  const firstLine = ruleToInject.split('\n')[0].trim();
  if (trimmed.includes(firstLine)) {
    return trimmed;
  }

  return `${trimmed}\n\n${ruleToInject}`;
};

/**
 * Overí, či dané odporúčanie patrí do vybraného typu analýzy
 */
export const isRecommendationForCategory = (
  rec: PromptRecommendation,
  targetCategory: PromptTemplate['category']
): boolean => {
  if (targetCategory === 'both') {
    return true;
  }
  if (rec.targetCategories && Array.isArray(rec.targetCategories)) {
    return rec.targetCategories.includes(targetCategory);
  }
  if (rec.targetPromptCategory === targetCategory) {
    return true;
  }
  if (rec.targetPromptCategory === 'both') {
    if (rec.category === 'price_ocr') return targetCategory === 'price';
    if (rec.category === 'pos_materials') return targetCategory === 'shelfShare';
    return true;
  }
  return false;
};

// ==========================================
// PERSISTENCIA ARCHÍVU A KOŠA ODPORÚČANÍ
// ==========================================

const STORAGE_KEY_ARCHIVED = 'salesapp_recommendations_archived_ids';
const STORAGE_KEY_TRASHED = 'salesapp_recommendations_trashed_ids';

export const getArchivedRecommendationIds = (): Set<string> => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_ARCHIVED) : null;
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
};

export const getTrashedRecommendationIds = (): Set<string> => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_TRASHED) : null;
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
};

export const saveArchivedRecommendationIds = (ids: Set<string>): void => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ARCHIVED, JSON.stringify(Array.from(ids)));
    }
  } catch (err) {
    console.warn('Nepodarilo sa uložiť archivované odporúčania:', err);
  }
};

export const saveTrashedRecommendationIds = (ids: Set<string>): void => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_TRASHED, JSON.stringify(Array.from(ids)));
    }
  } catch (err) {
    console.warn('Nepodarilo sa uložiť vymazané odporúčania:', err);
  }
};

export const archiveRecommendationId = (id: string): { archived: Set<string>; trashed: Set<string> } => {
  const archived = getArchivedRecommendationIds();
  const trashed = getTrashedRecommendationIds();
  archived.add(id);
  trashed.delete(id);
  saveArchivedRecommendationIds(archived);
  saveTrashedRecommendationIds(trashed);
  return { archived, trashed };
};

export const trashRecommendationId = (id: string): { archived: Set<string>; trashed: Set<string> } => {
  const archived = getArchivedRecommendationIds();
  const trashed = getTrashedRecommendationIds();
  trashed.add(id);
  archived.delete(id);
  saveArchivedRecommendationIds(archived);
  saveTrashedRecommendationIds(trashed);
  return { archived, trashed };
};

export const restoreRecommendationId = (id: string): { archived: Set<string>; trashed: Set<string> } => {
  const archived = getArchivedRecommendationIds();
  const trashed = getTrashedRecommendationIds();
  archived.delete(id);
  trashed.delete(id);
  saveArchivedRecommendationIds(archived);
  saveTrashedRecommendationIds(trashed);
  return { archived, trashed };
};

export const clearTrashedRecommendationIds = (): Set<string> => {
  const empty = new Set<string>();
  saveTrashedRecommendationIds(empty);
  return empty;
};

