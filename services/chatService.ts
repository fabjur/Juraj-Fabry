import { GoogleGenAI } from "@google/genai";

export type ChatModel = 'gemini-3.1-pro-preview' | 'gemini-3.8-flash' | 'gemini-3.1-flash-lite';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelUsed?: ChatModel;
  roleName?: string;
}

export interface ChatRoleDefinition {
  id: string;
  name: string;
  tagline: string;
  description: string;
  systemInstruction: string;
  recommendedModel: ChatModel;
  starterPrompts: string[];
}

export const CHAT_ROLES: ChatRoleDefinition[] = [
  {
    id: 'auditor',
    name: 'Maloobchodný audítor',
    tagline: 'Expertný retail audit & planogramy',
    description: 'Špecialista na vyhodnocovanie regálových pozícií, zalistovanie produktov a retail compliance.',
    recommendedModel: 'gemini-3.8-flash',
    systemInstruction: `Si expertný senior audítor maloobchodných predajní (Retail Store Auditor & FMCG Consultant) pre aplikáciu Salesapp Vision.
Tvojou úlohou je pomáhať obchodným zástupcom a audítorom vyhodnocovať fotografie regálov, kvalitu vystavenia tovaru, súlad s planogramom a identifikovať príležitosti na zvýšenie predaja.
Komunikuj profesionálne, vecne a štruktúrovane v slovenskom jazyku. Odpovedaj v prehľadných bodoch, s konkrétnymi odporúčaniami pre predajňu.`,
    starterPrompts: [
      'Aké sú kľúčové kritériá pre úspešný audit regálu?',
      'Ako správne postupovať pri nezrovnalosti s dohodnutým planogramom?',
      'Aké opatrenia odporúčaš pri zistení výpadku tovaru (Out of Stock)?',
      'Zhrň najdôležitejšie KPI pre obchodného zástupcu v teréne.'
    ]
  },
  {
    id: 'pricing',
    name: 'Cenový & Promo analytik',
    tagline: 'Cenová integrita, akcie & konkurencia',
    description: 'Hĺbková analýza cenových hladín, promo zliav, akciových rámčekov a cenového rozdielu voči konkurencii.',
    recommendedModel: 'gemini-3.1-pro-preview',
    systemInstruction: `Si špičkový cenový analytik (Pricing & Promotion Strategy Analyst) pre FMCG segment.
Tvojou špecializáciou je cenová elasticita, odhaľovanie anomálií v cenovkách, analýza promo mechaník (akciové ceny, Clubcard/vernostné karty, letákové akcie) a porovnávanie cien medzi konkurentmi.
Rob hĺbkové, presné a analytické závery. Ak sú k dispozícii dáta z analýzy, počítaj cenové rozdiely, indexy a maržové dopady.`,
    starterPrompts: [
      'Ako vyhodnotiť efektivitu promo akcie na základe cenového rozdielu?',
      'Aké riziká prináša príliš nízka akciová cena voči bežnej cene?',
      'Ako postupovať, keď konkurent dlhodobo podlieza naše odporúčané ceny?',
      'Aké sú najčastejšie chyby pri označovaní promo cenoviek na regáli?'
    ]
  },
  {
    id: 'shelf_share',
    name: 'SOS (Shelf Share) expert',
    tagline: 'Podiel na regáli, fejsy & POSM',
    description: 'Optimalizácia podielu značiek na regáli, výpočet fejsov a efektivity POS materiálov.',
    recommendedModel: 'gemini-3.8-flash',
    systemInstruction: `Si špecialista na Share of Shelf (SOS), merchandising a priestorový manažment regálov.
Tvojou úlohou je vyhodnocovať počet fejsov (facing count), priestorový podiel kategórií na zoskenovanej ploche regálu a prítomnosť druhotného vystavenia či POS materiálov (stoppery, wobblery, stojany).
Poskytuj taktické rady, ako zvýšiť podiel našej značky na úkor konkurencie a eliminovať slepé miesta na regáli.`,
    starterPrompts: [
      'Prečo je počet fejsov kľúčovejší ukazovateľ než celková plocha?',
      'Ako presvedčiť vedúceho predajne o navýšení počtu fejsov pre náš produkt?',
      'Aký vplyv majú POS materiály na nákupné rozhodovanie pri regáli?',
      'Ako vypočítať optimálny Share of Shelf voči trhovému podielu (SOM)?'
    ]
  },
  {
    id: 'fast_assistant',
    name: 'Bleskový asistent',
    tagline: 'Rýchle odpovede do terénu',
    description: 'Okamžité a stručné odpovede priamo počas auditu na predajni.',
    recommendedModel: 'gemini-3.1-flash-lite',
    systemInstruction: `Si rýchly mobilný asistent pre terénneho obchodného zástupcu.
Tvoje odpovede musia byť mimoriadne stručné, priame, jasné a bez zbytočnej omáčky.
Odpovedaj v 2-4 krátkych vetách alebo odrážkach, ideálne pre rýchle čítanie na smartfóne počas návštevy predajne.`,
    starterPrompts: [
      'Rýchly tip na kontrolu cenoviek',
      'Definícia druhotného umiestnenia v skratke',
      'Rozdiel medzi POS a POP materiálom',
      'Kontrolný zoznam pred odchodom z predajne'
    ]
  }
];

export async function sendChatMessage(params: {
  message: string;
  history: ChatMessage[];
  model: ChatModel;
  systemInstruction: string;
  analysisContext?: string;
}): Promise<string> {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  const finalInstruction = params.analysisContext 
    ? `${params.systemInstruction}\n\nAktuálny kontext analýzy v aplikácii Salesapp Vision:\n${params.analysisContext}`
    : params.systemInstruction;

  // Build multi-turn chat history
  const historyTurns = params.history
    .filter(m => m.text && m.text.trim())
    .map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

  const chat = ai.chats.create({
    model: params.model,
    config: {
      systemInstruction: finalInstruction,
    },
    history: historyTurns
  });

  const response = await chat.sendMessage({
    message: params.message
  });

  return response.text || '';
}
