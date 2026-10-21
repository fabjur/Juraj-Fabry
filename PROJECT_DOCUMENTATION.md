# Salesapp Vision - Detailná biznis a technicko-procesná dokumentácia

**Verzia:** 2.5  
**Dátum:** 1. august 2026  
**Cieľová skupina:** Business Lead, Category Managers, Sales Force Directors, Retail Auditors, AI Operations & Product Owners  

---

## 1. Manažérske zhrnutie & Účel systému

**Salesapp Vision** je špecializované podnikové riešenie určené na automatizáciu a digitalizáciu terénnych auditov maloobchodných predajní (Retail Field Audit). Aplikácia využívajúca pokročilú multimodálnu umelú inteligenciu (Multimodal Computer Vision) okamžite transformuje fotografické snímky regálov z predajní na štruktúrované obchodné a analytické dáta.

### Hlavný biznis problém, ktorý aplikácia rieši:
* **Prácnosť a chybovosť terénu:** Tradičné ručné rátanie facingov (kusov v rade), odpisovanie cenoviek z regálov a kontrola prítomnosti tovaru obchodnými zástupcami je časovo náročná a náchylná na ľudské chyby.
* **Absencia okamžitej spätnej väzby:** Výsledky manuálnych auditov sa zvyčajne spracovávajú v centrále s viacdňovým alebo týždenným oneskorením.
* **Strata tržieb z nedostupnosti (Out-of-Stock):** Pomalé odhaľovanie prázdnych miest na regáli vedie k priamym finančným stratám.
* **Nedorozumenia pri promo akciách:** Chýbajúca evidencia akčných etiketiek a nedodržiavanie odporúčaných predajných cien (MOC/RRP).

---

## 2. Hlavné biznis ciele a prínosy (Business ROI)

1. **Zvýšenie produktivity terénneho tímu o 70%+**
   * Obchodný zástupca namiesto 20 minút ručného zápisu spraví 2-3 fotografie regálu a AI vykoná kompletnú pasportizáciu v priebehu sekúnd.
2. **Real-Time kontrola plnenia dohody s reťazcom (Compliance)**
   * Okamžité overenie, či retailový reťazec dodržiava dohodnutý podiel na regáli (Share of Shelf), zmluvné cenovky a plánogramové rozloženie.
3. **Maximálna dostupnosť tovaru na pultoch (On-Shelf Availability - OSA)**
   * Rýchla detekcia výpadkov (OOS - Out of Stock) a vytvorenie podkladov pre okamžité doplnenie tovaru zo skladu predajne.
4. **Detailný monitoring konkurenčnej stratégie**
   * Automatický zber informácií o cenách, zľavách a promo akciách konkurenčných značiek na jednom mieste.
5. **Ochrana obchodného tajomstva (Local-First privacy)**
   * Všetky spracované dáta a historické audity zostávajú uložené lokálne v klientskom zariadení používateľa, bez odosielania interných databáz tovaru na servery tretích strán.

---

## 3. Workflow terénneho auditu (End-to-End proces)

```
[ Fotografovanie regálu ] ➡️ [ AI Vizuálna analýza ] ➡️ [ Automatické spájanie fotiek ]
                                                                  │
[ Verifikácia a ručné korekcie ] ⬅️ [ Výpočet metrík OSP/SOS/OSA ] ⬅┘
         │
         ▼
[ Exporty (PDF / XLS) a Manažérske reporty ]
```

1. **Príprava a výber predajne:** Obchodný zástupca si vyberie konkrétnu predajňu (napr. Tesco Bratislava, Billa Košice).
2. **Snímanie v teréne:** Zástupca vyhotoví sériu fotografií regálového modulu s cca 20% prekrývaním vedľajších snímok.
3. **Výber typu auditu:** Zvoľuje sa požadovaná hĺbka analýzy:
   * **OSP (Pricing):** Zamerané primárne na ceny, MOC a akčné etiketky.
   * **SOS (Shelf Share):** Zamerané na rozloženie plochy, počty facingov a kategórie.
   * **OSA (Availability):** Zamerané na detekciu výpadkov a prítomnosť kľúčových produktov (Must-Have list).
   * **Kompletný audit (Both):** Paralelné vyhodnotenie všetkých indikátorov.
4. **Automatizované spracovanie a spájanie (Deduplikácia):** AI analyzuje produkty, identifikuje duplikáty vzniknuté prekrývaním snímok a zjednotí ich do jedného výsledku za predajňu.
5. **Verifikácia a schválenie:** Obchodný zástupca skontroluje zistenia (s možnosťou doplniť chýbajúcu cenu alebo opraviť názov) a audit uzavrie.

---

## 4. Fyzika a princíp fungovania Computer Vision (Vizuálnej AI)

Computer Vision v Salesapp Vision nespolieha len na tradičné uzatvorené obdĺžnikové klasifikátory (ako staršie modely YOLO/SSD), ale využíva **pokročilé multimodálne neuronové siete Google Gemini**.

### 4.1 Paralelné spracovanie vizuálnej a textovej vrstvy
1. **Sémantická lokalizácia objektov (Bounding Boxes):** Model analyzuje pixelovú maticu regálovej fotografie a stotožňuje jednotlivé balenia produktov. Pre každý zistený produkt generuje priestorové súradnice v normalizovanej mriežke `[ymin, xmin, ymax, xmax]` v rozsahu od 0 do 1000.
2. **Optické rozpoznávanie znakov (OCR):** Súbežne s lokalizáciou obalov AI čiastkovo číta regálové etiketky (cenovky). Dekóduje číselné hodnoty bežných predajných cien, akčných cien (akčná MOC), ako aj názvy reťazcov a textové upozornenia („Akcia“, „Super cena“, „Klubová karta“).
3. **Vizuálno-Sémantická fúzia:** Model v jednom výpočtovom kroku prepája priestorovú polohu obalu produktu s najbližšie prislúchajúcou cenovkou umiestnenou na regálovej lište pod produktom.

---

## 5. Zabezpečenie a neustále zlepšovanie presnosti (Accuracy Iteration Loop)

Aby systém dosahoval maximálnu presnosť rozpoznávania aj pri zhoršených terénnych podmienkach (stieň, odlesky na obaloch, šikmý úhel), využíva kombináciu 4 kľúčových mechanizmov:

```
[ Referenčná fotka obalu ] ➡️ [ AI Visual Fingerprint Generator ] ➡️ [ Vkladanie do Promptu ]
                                                                           │
[ Ručné korekcie používateľom v UI ] ⬅️ [ Zobrazenie výsledku s Bounding Boxom ] ⬅┘
```

1. **Vizuálne odtlačky produktov (Visual Fingerprinting):**
   * Pre každý kľúčový produkt v katalógu je možné vygenerovať podrobný textovo-vizuálny profil na základe referenčnej fotografie obalu.
   * AI analyzuje obal a zapíše jeho unikatnosti: *„Svetlomodrá fľaša, zlaté logo v strede, červené uzatváracie viečko, typická etiketa s grafikou ovocia“*.
   * Tento vizuálny odtlačok sa dynamicky pripája do systémového promptu (`{{knownProducts}}`), čo modelu umožňuje okamžite rozpoznať produkt na regáli bez nutnosti pretrénovávania celej siete.
2. **Správa aliasov a regálových názvov:**
   * Obchodné etiketky na regáloch často obsahujú skrátené alebo skomolené názvy (napr. *„COCA COLA ZERO 0.5L PET“* namiesto oficiálneho katalógového názvu). Systém udržiava maticu aliasov pre automatické 100% spárovanie s Master databázou.
3. **Prompt Manager & Dynamic Fine-Tuning:**
   * Správcovia systému majú k dispozícii modul **Prompt Manager**, v ktorom môžu upravovať inštrukcie pre AI (napr. prisnejšie pravidlá pre detekciu akčných cenoviek) a ihneď ich testovať na tréningových fotografiách regálov.
4. **Human-in-the-Loop Verifikácia:**
   * Zistené záchyty sa zobrazujú s indexom istoty (Confidence Score, napr. 95%). Ak je produkt identifikovaný s nižšou istotou, UI zvýrazní položku pre obchodného zástupcu, ktorý môže jedným klikom opraviť názov alebo doplniť cenu. Tým sa udržiava 100% čistota reportovaných dát.

---

## 6. Architektúra prepojenia na Google Gemini API

Aplikácia komunikuje priamo s rozhraním **Google Gemini API** prostredníctvom oficiálneho TypeScript SDK `@google/genai`.

### 6.1 Hlavné podporované modely v aplikácii
* **Gemini 3.6 Flash (`gemini-3.8-flash`) – Odporúčaný štandard:**
  * Najlepšia rovnováha medzi bleskovou rýchlosťou spracovania (cca 1.5 – 3 sekundy na fotku), presnosťou detekcie a nízkymi prevádzkovými nákladmi ($0.75 vstup / $3.75 výstup za 1M tokenov). Určený pre 80%+ bežných auditov.
* **Gemini 3.1 Flash-Lite / 2.5 Flash-Lite (`gemini-3.1-flash-lite`, `gemini-2.5-flash-lite`) – Ultra Low-Cost varianta:**
  * Ultra-úsporný model s najnižšou cenou ($0.10 vstup / $0.40 výstup za 1M tokenov). Vhodný pre masové denné audity dostupnosti (OSA) vo veľkých sieťach predajní.
* **Gemini 3.6 Pro (`gemini-3.6-pro`) – Maximálna analytická presnosť:**
  * Najvýkonnejší model pre komplexné, veľmi husté regály, zlé svetelné podmienky, nečitateľné cenovky a kontroly plánogramov (Quality Check, $2.00 vstup / $12.00 výstup za 1M tokenov).
* **Gemini 2.5 Flash (`gemini-2.5-flash`) – Stabilný ekonomický model:**
  * Tradičný osvedčený model ($0.30 vstup / $2.50 výstup za 1M tokenov).
* **Gemini 2.5 Pro (`gemini-2.5-pro`) – Pro analytika:**
  * Pokročilý model ($1.25 vstup / $10.00 výstup za 1M tokenov).

### 6.2 Konfigurácia štruktúrovaného výstupu (JSON Schema Enforcement)
Aplikácia využíva funkciu **Structured Outputs / responseSchema**. Pri API volaní sa modelu prostredníctvom SDK odovzdáva presná JSON schéma, čím je na úrovni samotnej dekódovacej vrstvy LLM garantované, že model vráti len validný JSON bez sprievodného textu.

```typescript
// Ukážka volania rozhrania Gemini API z prostredia Salesapp Vision
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [
    { inlineData: { mimeType: 'image/jpeg', data: base64ImageData } },
    { text: userPromptText }
  ],
  config: {
    systemInstruction: systemInstructionText,
    temperature: 0.1, // Nízka teplota pre maximálnu deterministickú presnosť
    responseMimeType: 'application/json',
    responseSchema: analysisResponseSchema
  }
});
```

---

## 7. Tok a ekonomika Input / Output Tokenov

Náklady a rýchlosť AI analýzy sú priamo závislé od počtu spracovaných **Input** a **Output** tokenov.

### 7.1 Input Tokeny (Vstupné náklady)
Input tokeny pozostávajú z dvoch zložiek:
1. **Textový kontext (Text Tokens):**
   * Systémové inštrukcie (~800 tokenov).
   * Katalóg známych produktov a vizuálnych odtlačkov (`{{knownProducts}}`, ~500 – 2000 tokenov podľa veľkosti kategórie).
   * Používateľský prompt a parametre predajne (~200 tokenov).
2. **Obrazový kontext (Vision Tokens):**
   * Model Gemini prevádza fotografie regálov na obdĺžnikové dlaždice (Tiles). Snímka s rozlíšením Full HD / 4K wygeneruje približne **258 až 1 500+ vstupných obrázkových tokenov**.

### 7.2 Output Tokeny (Výstupné náklady a náročnosť)
Output tokeny reprezentujú samotnú vygenerovanú odpoveď v formáte JSON:
* Každý identifikovaný produkt na regáli (vrátane názvu, súradníc `box_2d`, bežnej ceny, akčnej ceny a istoty) vyžaduje približne **80 až 120 výstupných tokenov**.
* Pri regáli s 30 nájdenými produktmi dosahuje výstup dĺžku **2 500 až 4 000 Output Tokenov**.
* Nakoľko sú výstupné tokeny jednotkovo drahšie než vstupné, schéma je navrhnutá tak, aby bola maximálne kompaktná bez zbytočnej verbosity.

---

## 8. JSON Štruktúra súborov a dát z analýzy

Spracovaný výstup z modelu Gemini je okamžite validovaný a uložený do lokálnej databázy. Nasledujúca ukážka reprezentuje reálnu štruktúru dát, ktoré aplikácia získa z vizuálnej analýzy:

```json
{
  "storeName": "Tesco Supermarket - Bratislava Petržalka",
  "chain": "Tesco",
  "analysisType": "both",
  "products": [
    {
      "name": "Coca-Cola Zero 0.5L PET",
      "sku": "CC-ZERO-05",
      "category": "Nealko nápoje",
      "confidence": 0.96,
      "count": 4,
      "box_2d": [215, 120, 480, 290],
      "prices": {
        "regularPrice": 1.19,
        "promoPrice": 0.89,
        "isPromo": true,
        "promoType": "Klubová cena",
        "currency": "EUR"
      }
    },
    {
      "name": "Kofola Originál 2L",
      "sku": "KOF-ORIG-20",
      "category": "Nealko nápoje",
      "confidence": 0.94,
      "count": 6,
      "box_2d": [210, 310, 520, 580],
      "prices": {
        "regularPrice": 1.69,
        "promoPrice": null,
        "isPromo": false,
        "currency": "EUR"
      }
    }
  ],
  "shelfMetrics": {
    "totalFacings": 10,
    "totalShelfAreaPixels": 345000,
    "shareByBrand": [
      {
        "brand": "Coca-Cola",
        "facingCount": 4,
        "facingSharePercent": 40.0,
        "areaSharePercent": 38.5
      },
      {
        "brand": "Kofola",
        "facingCount": 6,
        "facingSharePercent": 60.0,
        "areaSharePercent": 61.5
      }
    ]
  },
  "analysisSummary": "Na regáli boli úspešne identifikované 2 kľúčové značky. Značka Coca-Cola je v aktívnej promo akcii (Klubová cena 0.89€ oproti MOC 1.19€). Zistiť neboli žiadne výpadky v povinnom sortimente."
}
```

---

## 9. Detailná špecifikácia biznis modulov

### 9.1 Správa master dát a Vizuálne odtlačky (Product Listing & Visual Fingerprint)
* **Katalóg produktov (Master Data):** Evidencia vlastného aj konkurenčného portfólia (EAN, SKU, Názov, Výrobca, Kategória, Odporúčaná cena).
* **Vizuálny odtlačok (Visual Fingerprinting):** Pre každý kľúčový produkt je možné nahrať referenčné fotografie obalu. AI z nich vygeneruje podrobný textový vizuálny popis (farby, dominantné grafické prvky, typ fľaše/škatule), ktorý umožňuje spoľahlivé rozpoznanie produktu aj pri zhoršených svetelných podmienkach alebo čiastočnom zakrytí na regáli.
* **Správa aliasov:** Definovanie neoficiálnych alebo skrátených názvov produktov na regálových etiketách pre presné spárovanie.

### 9.2 On-Shelf Pricing - OSP (Cenový audit a monitoring)
* **Detekcia dvoch hladín cien:** Systém rozpoznáva **bežnú MOC** aj **akčnú cenu**.
* **Identifikácia promo etiketiek:** Zistenie prítomnosti akčných pútačov (napr. „AKCIA“, „ZĽAVA“, „KLUBOVÁ CENA“).
* **Porovnanie s MOC:** Kontrola dodržiavania odporúčaných cien od výrobcu.
* **Cenová história:** Sledovanie vývoja ceny produktu v konkrétnych reťazcoch a predajniach v čase pomocou prehľadných grafov.

### 9.3 Share of Shelf - SOS (Podiel na regáli)
* **Výpočet podielu podľa plochy (By Area):** Meria percentuálny podiel štvorcových metrov/pixlov, ktoré značka alebo kategória zaberá na regáli. Presnejšie vyjadruje vizuálnu dominanciu (veľké balenia vs. malé balenia).
* **Výpočet podielu podľa facingov (By Count):** Meria podiel fyzických kusov viditeľných v prvej línii regálu.
* **Porovnanie Vlastné vs. Konkurencia:** Okamžitý koláčový a stĺpcový prehľad trhového podielu v regáli.

### 9.4 On-Shelf Availability - OSA (Dostupnosť a kontrola výpadkov)
* **Must-Have Listy:** Nastavenie matice povinnej zalistovanosti pre jednotlivé reťazce.
* **Automatický audit dostupnosti:** Porovnanie zistených produktov na regáli s povinným zoznamom.
* **Matica prítomnosti (Distribution Matrix):** Prehľadová tabuľka [Predajne] x [Kľúčové produkty] so stavom:
  * 🟢 **Prítomný (In Stock)** – produkt bol fyzicky identifikovaný.
  * 🔴 **Chýba / Výpadok (Out of Stock)** – produkt nebol nájdený na regáli, riziko ušlého zisku.
* **Upozornenie na voľné miesta (Out of Stock Gaps):** Detekcia prázdnych medzier na regálových policiach.

### 9.5 Promo Guardian (Kontrola akčnej aktivity)
* **Monitorovanie vlastných akcií:** Overenie, či reťazec v správnom termíne označil váš produkt akčnou cenou a etiketou.
* **Detekcia konkurenčných akcií:** Včasné varovanie pred promo agresivitou konkurencie v danej kategórii.
* **Kategorizácia akcií:**
  * ✅ *Naša aktívna promo akcia*
  * 🎯 *Konkurenčná promo akcia*
  * ⚠️ *Chýbajúce označenie akcie*

### 9.6 Planogram Compliance & Auditing (Kontrola kvality vystavenia)
* **Porovnanie s ideálnym plánogramom:** Možnosť nahrať vzorový plánogram a porovnať ho s reálnou fotografiou z predajne.
* **Scoring kvality (Quality Check):** AI vyhodnotí percentuálnu zhodu vystavenia (správne poradie políc, dodržanie blokového vystavenia značky, umiestnenie POS materiálov).

### 9.7 Správa reťazcov a predajní (Retail Networks)
* **Štruktúra predajnej siete:** Evidencia reťazcov (Tesco, Kaufland, Billa, Lidl, Coop Jednota atď.) a konkrétnych prevádzok.
* **Automatické rozpoznanie predajne:** AI dokáže zistiť názov alebo adresu predajne z regálovej cenovky alebo kontextu.

### 9.8 Ekonomika a nákladovosť AI auditov (Token & Cost Economics)
* **Oficiálny cenník Gemini Developer API (k 2. augustu 2026):**
  Ceny za **1 000 000 (1 milión) tokenov**:

| Model | Standard – Vstup | Standard – Výstup | Batch – Vstup | Batch – Výstup |
| :--- | :---: | :---: | :---: | :---: |
| **Gemini 3.6 Flash** | $0,30 USD | $2,50 USD | $0,15 USD | $1,25 USD |
| **Gemini 3.1 Flash-Lite** | $0,10 USD | $0,40 USD | $0,05 USD | $0,20 USD |
| **Gemini 3.6 Pro (prompt ≤ 200k)** | $1,25 USD | $10,00 USD | $0,625 USD | $5,00 USD |

* **Praktický prepočet nákladov na 1 snímku regálu (Gemini 3.6 Flash Standard):**
  * **Vstupné tokeny (Input):** cca 1 000 – 2 500 tokenov / snímku (prompt + obrazové dáta) ≈ **$0,0003 – $0,00075 USD**
  * **Výstupné tokeny (Output):** cca 1 500 – 3 500 tokenov / snímku (detekcia 20–30 produktov a cien v JSON) ≈ **$0,00375 – $0,00875 USD**
  * **Priemerné náklady na 1 analyzovanú fotku:** cca **$0,004 – $0,009 USD** (cca **0,004 € – 0,008 €** na fotku).
  * V režime **Batch API** (dávkové asynchrónne spracovanie) sú náklady polovičné (**50% zľava**).
* **Transparentné sledovanie nákladov (Cost Panel):** Prehľad o odhadovaných nákladoch na spracované fotografie a vyčerpaných AI tokenoch pre presný budget management.

---

## 10. Biznis model údajov (Doménové entity)

1. **Produkt (Catalog Item):**
   * Základná referenčná jednotka. Obsahuje názov, kategóriu, výrobcu, EAN/SKU, odporúčanú cenu (MOC), aliasy a vizuálny odtlačok obalu.
2. **Predajňa (Store):**
   * Maloobchodná prevádzka definovaná názvom reťazca, adresou a špecifickými pravidlami zalistovania.
3. **Audit / Analýza (Analysis Session):**
   * Záznam z jednej návštevy predajne. Obsahuje dátum, vyhotovené fotografie, vybraný typ auditu, použité prompt pravidlá a finálne agregované výsledky.
4. **Záchyt na regáli (Detection Result / Finding):**
   * Konkrétny nájdený produkt na fotografii vrátane súradníc (Bounding Box), zistenej ceny, príznaku akcie a úrovne istoty rozpoznania (Confidence Score).
5. **Report dostupnosti (Distribution Report):**
   * Šablóna a výsledok maticového porovnania dostupnosti sortimentu naprieč predajňami.

---

## 11. Ochrana obchodného tajomstva a Bezpečnosť dát

* **Lokálne ukladanie (Local-First Architecture):** Všetky vytvorené audity, katalógy produktov, histórie cien a nastavenia sú uložené výhradne v lokálnej databáze internetového prehliadača používateľa (IndexedDB cez Dexie.js).
* **Žiadna cloudová databáza aplikácie:** Aplikácia neukladá obchodné dáta zložiek na žiadne medziservery.
* **Prístupové API kľúče:** Používateľ využítva vlastný zabezpečený API kľúč pre služby Google AI Studio, čo zaručuje plnú kontrolu nad prístupovými právami a fakturáciou.

---

## 12. Zhrnutie a biznis hodnota

Salesapp Vision spája najnovšie výdobytky multimodálnej vizuálnej umelej inteligencie s praktickými potrebami terénneho obchodu. Poskytuje obchodným riaditeľom, kategórovým manažérom a obchodným zástupcom jednotný, rýchly a spoľahlivý nástroj na udržanie stopercentného prehľadu o dianí na maloobchodných regáloch.
