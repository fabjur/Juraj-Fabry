import type { Analysis, SerializableImageState } from '../types';

// Helper to create an SVG data URL
const createSvgDataUrl = (svgContent: string): string => {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent.trim())}`;
};

// 1. Nealko nápoje & Vody shelf SVG
const generateDrinksShelfSvg = (): string => {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 750" width="1000" height="750">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#1e2430"/>
        <stop offset="100%" stop-color="#0f131a"/>
      </linearGradient>
      <linearGradient id="metalShelf" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#e2e8f0"/>
        <stop offset="30%" stop-color="#cbd5e1"/>
        <stop offset="70%" stop-color="#94a3b8"/>
        <stop offset="100%" stop-color="#64748b"/>
      </linearGradient>
      <linearGradient id="kofolaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#3b1b0b"/>
        <stop offset="50%" stop-color="#6b2a0c"/>
        <stop offset="100%" stop-color="#241005"/>
      </linearGradient>
      <linearGradient id="cocaColaGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#991b1b"/>
        <stop offset="50%" stop-color="#dc2626"/>
        <stop offset="100%" stop-color="#7f1d1d"/>
      </linearGradient>
      <linearGradient id="rajecGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#0284c7"/>
        <stop offset="50%" stop-color="#38bdf8"/>
        <stop offset="100%" stop-color="#0369a1"/>
      </linearGradient>
      <linearGradient id="mattoniGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#047857"/>
        <stop offset="50%" stop-color="#10b981"/>
        <stop offset="100%" stop-color="#065f46"/>
      </linearGradient>
      <linearGradient id="birellGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#d97706"/>
        <stop offset="50%" stop-color="#fbbf24"/>
        <stop offset="100%" stop-color="#b45309"/>
      </linearGradient>
      <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="8" stdDeviation="6" flood-opacity="0.5"/>
      </filter>
    </defs>

    <!-- Background -->
    <rect width="1000" height="750" fill="url(#bgGrad)"/>
    <rect x="20" y="20" width="960" height="710" fill="#18202c" rx="12"/>

    <!-- Header Store Banner -->
    <rect x="20" y="20" width="960" height="55" fill="#eab308" rx="8"/>
    <text x="50" y="55" font-family="system-ui, sans-serif" font-weight="900" font-size="22" fill="#713f12">BILLA • REGÁL NEALKO &amp; MINERÁLKY</text>
    <text x="820" y="54" font-family="system-ui, sans-serif" font-weight="700" font-size="14" fill="#854d0e">BAJKALSKÁ, BRATISLAVA</text>

    <!-- Top Shelf Bar -->
    <rect x="30" y="340" width="940" height="24" fill="url(#metalShelf)" rx="3" filter="url(#dropShadow)"/>
    <rect x="30" y="360" width="940" height="18" fill="#e2e8f0"/>
    <!-- Top Price Tags -->
    <rect x="60" y="362" width="70" height="14" fill="#ffffff" stroke="#94a3b8" rx="2"/>
    <text x="75" y="373" font-family="monospace" font-size="10" font-weight="bold" fill="#0f172a">1.69 €</text>
    <rect x="220" y="362" width="70" height="14" fill="#ffffff" stroke="#94a3b8" rx="2"/>
    <text x="235" y="373" font-family="monospace" font-size="10" font-weight="bold" fill="#0f172a">1.69 €</text>
    <rect x="380" y="362" width="70" height="14" fill="#ffffff" stroke="#94a3b8" rx="2"/>
    <text x="395" y="373" font-family="monospace" font-size="10" font-weight="bold" fill="#0f172a">1.69 €</text>
    <rect x="540" y="362" width="70" height="14" fill="#ffffff" stroke="#94a3b8" rx="2"/>
    <text x="555" y="373" font-family="monospace" font-size="10" font-weight="bold" fill="#dc2626">1.99 €</text>
    <rect x="700" y="362" width="70" height="14" fill="#ffffff" stroke="#94a3b8" rx="2"/>
    <text x="715" y="373" font-family="monospace" font-size="10" font-weight="bold" fill="#dc2626">1.99 €</text>
    <rect x="850" y="362" width="70" height="14" fill="#ffffff" stroke="#94a3b8" rx="2"/>
    <text x="865" y="373" font-family="monospace" font-size="10" font-weight="bold" fill="#dc2626">1.99 €</text>

    <!-- Top Shelf Bottles: KOFOLA 2L (3 facings) -->
    <g id="kofola_1">
      <rect x="50" y="110" width="110" height="230" rx="28" fill="url(#kofolaGrad)" filter="url(#dropShadow)"/>
      <rect x="85" y="85" width="40" height="30" rx="6" fill="#1e293b"/>
      <rect x="92" y="70" width="26" height="18" rx="3" fill="#ea580c"/>
      <rect x="55" y="170" width="100" height="85" rx="10" fill="#ea580c"/>
      <text x="65" y="210" font-family="sans-serif" font-weight="900" font-size="19" fill="#ffffff">KOFOLA</text>
      <text x="75" y="235" font-family="sans-serif" font-weight="700" font-size="12" fill="#fff7ed">Original 2L</text>
    </g>
    <g id="kofola_2">
      <rect x="210" y="110" width="110" height="230" rx="28" fill="url(#kofolaGrad)" filter="url(#dropShadow)"/>
      <rect x="245" y="85" width="40" height="30" rx="6" fill="#1e293b"/>
      <rect x="252" y="70" width="26" height="18" rx="3" fill="#ea580c"/>
      <rect x="215" y="170" width="100" height="85" rx="10" fill="#ea580c"/>
      <text x="225" y="210" font-family="sans-serif" font-weight="900" font-size="19" fill="#ffffff">KOFOLA</text>
      <text x="235" y="235" font-family="sans-serif" font-weight="700" font-size="12" fill="#fff7ed">Original 2L</text>
    </g>
    <g id="kofola_3">
      <rect x="370" y="110" width="110" height="230" rx="28" fill="url(#kofolaGrad)" filter="url(#dropShadow)"/>
      <rect x="405" y="85" width="40" height="30" rx="6" fill="#1e293b"/>
      <rect x="412" y="70" width="26" height="18" rx="3" fill="#ea580c"/>
      <rect x="375" y="170" width="100" height="85" rx="10" fill="#ea580c"/>
      <text x="385" y="210" font-family="sans-serif" font-weight="900" font-size="19" fill="#ffffff">KOFOLA</text>
      <text x="395" y="235" font-family="sans-serif" font-weight="700" font-size="12" fill="#fff7ed">Original 2L</text>
    </g>

    <!-- Top Shelf Bottles: COCA-COLA 2L (3 facings) -->
    <g id="coca_1">
      <rect x="530" y="110" width="110" height="230" rx="28" fill="url(#cocaColaGrad)" filter="url(#dropShadow)"/>
      <rect x="565" y="85" width="40" height="30" rx="6" fill="#1e293b"/>
      <rect x="572" y="70" width="26" height="18" rx="3" fill="#dc2626"/>
      <rect x="535" y="170" width="100" height="85" rx="10" fill="#dc2626"/>
      <text x="542" y="210" font-family="sans-serif" font-weight="900" font-size="15" fill="#ffffff">Coca-Cola</text>
      <text x="555" y="235" font-family="sans-serif" font-weight="700" font-size="12" fill="#fee2e2">Original 2L</text>
    </g>
    <g id="coca_2">
      <rect x="685" y="110" width="110" height="230" rx="28" fill="url(#cocaColaGrad)" filter="url(#dropShadow)"/>
      <rect x="720" y="85" width="40" height="30" rx="6" fill="#1e293b"/>
      <rect x="727" y="70" width="26" height="18" rx="3" fill="#dc2626"/>
      <rect x="690" y="170" width="100" height="85" rx="10" fill="#dc2626"/>
      <text x="697" y="210" font-family="sans-serif" font-weight="900" font-size="15" fill="#ffffff">Coca-Cola</text>
      <text x="710" y="235" font-family="sans-serif" font-weight="700" font-size="12" fill="#fee2e2">Original 2L</text>
    </g>
    <g id="coca_3">
      <rect x="835" y="110" width="110" height="230" rx="28" fill="url(#cocaColaGrad)" filter="url(#dropShadow)"/>
      <rect x="870" y="85" width="40" height="30" rx="6" fill="#1e293b"/>
      <rect x="877" y="70" width="26" height="18" rx="3" fill="#dc2626"/>
      <rect x="840" y="170" width="100" height="85" rx="10" fill="#dc2626"/>
      <text x="847" y="210" font-family="sans-serif" font-weight="900" font-size="15" fill="#ffffff">Coca-Cola</text>
      <text x="860" y="235" font-family="sans-serif" font-weight="700" font-size="12" fill="#fee2e2">Original 2L</text>
    </g>

    <!-- Bottom Shelf Bar -->
    <rect x="30" y="670" width="940" height="24" fill="url(#metalShelf)" rx="3" filter="url(#dropShadow)"/>
    <rect x="30" y="690" width="940" height="18" fill="#e2e8f0"/>
    <!-- Bottom Price Tags -->
    <rect x="60" y="692" width="70" height="14" fill="#ffffff" stroke="#94a3b8" rx="2"/>
    <text x="75" y="703" font-family="monospace" font-size="10" font-weight="bold" fill="#0284c7">0.79 €</text>
    <rect x="200" y="692" width="70" height="14" fill="#ffffff" stroke="#94a3b8" rx="2"/>
    <text x="215" y="703" font-family="monospace" font-size="10" font-weight="bold" fill="#0284c7">0.79 €</text>
    <rect x="340" y="692" width="70" height="14" fill="#ffffff" stroke="#94a3b8" rx="2"/>
    <text x="355" y="703" font-family="monospace" font-size="10" font-weight="bold" fill="#0284c7">0.79 €</text>
    <rect x="490" y="692" width="70" height="14" fill="#ffffff" stroke="#94a3b8" rx="2"/>
    <text x="505" y="703" font-family="monospace" font-size="10" font-weight="bold" fill="#047857">0.89 €</text>
    <rect x="630" y="692" width="70" height="14" fill="#ffffff" stroke="#94a3b8" rx="2"/>
    <text x="645" y="703" font-family="monospace" font-size="10" font-weight="bold" fill="#047857">0.89 €</text>
    <rect x="790" y="692" width="70" height="14" fill="#fef08a" stroke="#ca8a04" rx="2"/>
    <text x="800" y="703" font-family="monospace" font-size="10" font-weight="bold" fill="#b45309">1.09 € AKCIA</text>

    <!-- Bottom Shelf Bottles: RAJEC 1.5L (3 facings) -->
    <g id="rajec_1">
      <rect x="50" y="440" width="95" height="230" rx="22" fill="url(#rajecGrad)" filter="url(#dropShadow)"/>
      <rect x="80" y="415" width="35" height="30" rx="4" fill="#bae6fd"/>
      <rect x="55" y="510" width="85" height="85" rx="8" fill="#0284c7"/>
      <text x="68" y="550" font-family="sans-serif" font-weight="900" font-size="17" fill="#ffffff">RAJEC</text>
      <text x="65" y="575" font-family="sans-serif" font-weight="700" font-size="11" fill="#e0f2fe">Pramenitá 1.5L</text>
    </g>
    <g id="rajec_2">
      <rect x="190" y="440" width="95" height="230" rx="22" fill="url(#rajecGrad)" filter="url(#dropShadow)"/>
      <rect x="220" y="415" width="35" height="30" rx="4" fill="#bae6fd"/>
      <rect x="195" y="510" width="85" height="85" rx="8" fill="#0284c7"/>
      <text x="208" y="550" font-family="sans-serif" font-weight="900" font-size="17" fill="#ffffff">RAJEC</text>
      <text x="205" y="575" font-family="sans-serif" font-weight="700" font-size="11" fill="#e0f2fe">Pramenitá 1.5L</text>
    </g>
    <g id="rajec_3">
      <rect x="330" y="440" width="95" height="230" rx="22" fill="url(#rajecGrad)" filter="url(#dropShadow)"/>
      <rect x="360" y="415" width="35" height="30" rx="4" fill="#bae6fd"/>
      <rect x="335" y="510" width="85" height="85" rx="8" fill="#0284c7"/>
      <text x="348" y="550" font-family="sans-serif" font-weight="900" font-size="17" fill="#ffffff">RAJEC</text>
      <text x="345" y="575" font-family="sans-serif" font-weight="700" font-size="11" fill="#e0f2fe">Pramenitá 1.5L</text>
    </g>

    <!-- Bottom Shelf Bottles: MATTONI 1.5L (2 facings) -->
    <g id="mattoni_1">
      <rect x="480" y="440" width="95" height="230" rx="22" fill="url(#mattoniGrad)" filter="url(#dropShadow)"/>
      <rect x="510" y="415" width="35" height="30" rx="4" fill="#a7f3d0"/>
      <rect x="485" y="510" width="85" height="85" rx="8" fill="#047857"/>
      <text x="492" y="550" font-family="sans-serif" font-weight="900" font-size="15" fill="#ffffff">MATTONI</text>
      <text x="498" y="575" font-family="sans-serif" font-weight="700" font-size="11" fill="#d1fae5">Minerálna 1.5L</text>
    </g>
    <g id="mattoni_2">
      <rect x="620" y="440" width="95" height="230" rx="22" fill="url(#mattoniGrad)" filter="url(#dropShadow)"/>
      <rect x="650" y="415" width="35" height="30" rx="4" fill="#a7f3d0"/>
      <rect x="625" y="510" width="85" height="85" rx="8" fill="#047857"/>
      <text x="632" y="550" font-family="sans-serif" font-weight="900" font-size="15" fill="#ffffff">MATTONI</text>
      <text x="638" y="575" font-family="sans-serif" font-weight="700" font-size="11" fill="#d1fae5">Minerálna 1.5L</text>
    </g>

    <!-- Bottom Shelf Cans: BIRELL RADLER (2 facings) -->
    <g id="birell_1">
      <rect x="765" y="470" width="85" height="200" rx="14" fill="url(#birellGrad)" filter="url(#dropShadow)"/>
      <rect x="770" y="520" width="75" height="80" rx="6" fill="#b45309"/>
      <text x="778" y="555" font-family="sans-serif" font-weight="900" font-size="14" fill="#ffffff">BIRELL</text>
      <text x="774" y="578" font-family="sans-serif" font-weight="700" font-size="10" fill="#fef3c7">Pomelo 0.5L</text>
    </g>
    <g id="birell_2">
      <rect x="865" y="470" width="85" height="200" rx="14" fill="url(#birellGrad)" filter="url(#dropShadow)"/>
      <rect x="870" y="520" width="75" height="80" rx="6" fill="#b45309"/>
      <text x="878" y="555" font-family="sans-serif" font-weight="900" font-size="14" fill="#ffffff">BIRELL</text>
      <text x="874" y="578" font-family="sans-serif" font-weight="700" font-size="10" fill="#fef3c7">Pomelo 0.5L</text>
    </g>
  </svg>`;
};

// 2. Pivný regál SOS Audit shelf SVG
const generateBeerShelfSvg = (): string => {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 750" width="1000" height="750">
    <defs>
      <linearGradient id="beerBg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#18181b"/>
        <stop offset="100%" stop-color="#09090b"/>
      </linearGradient>
      <linearGradient id="pilsnerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#064e3b"/>
        <stop offset="40%" stop-color="#059669"/>
        <stop offset="100%" stop-color="#022c22"/>
      </linearGradient>
      <linearGradient id="bazantGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#78350f"/>
        <stop offset="50%" stop-color="#d97706"/>
        <stop offset="100%" stop-color="#451a03"/>
      </linearGradient>
      <linearGradient id="kozelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#422006"/>
        <stop offset="50%" stop-color="#854d0e"/>
        <stop offset="100%" stop-color="#291404"/>
      </linearGradient>
      <linearGradient id="budvarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#831843"/>
        <stop offset="50%" stop-color="#db2777"/>
        <stop offset="100%" stop-color="#500724"/>
      </linearGradient>
      <linearGradient id="metalShelf2" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#94a3b8"/>
        <stop offset="50%" stop-color="#64748b"/>
        <stop offset="100%" stop-color="#334155"/>
      </linearGradient>
    </defs>

    <rect width="1000" height="750" fill="url(#beerBg)"/>
    <rect x="20" y="20" width="960" height="710" fill="#111827" rx="12"/>

    <!-- Header Store Banner -->
    <rect x="20" y="20" width="960" height="55" fill="#0284c7" rx="8"/>
    <text x="50" y="55" font-family="system-ui, sans-serif" font-weight="900" font-size="22" fill="#ffffff">TESCO EXTRA • PIVNÝ AUDIT REGÁLU (SOS)</text>
    <text x="750" y="54" font-family="system-ui, sans-serif" font-weight="700" font-size="14" fill="#e0f2fe">ZLATÉ PIESKY, BRATISLAVA</text>

    <!-- Top Shelf Bar -->
    <rect x="30" y="340" width="940" height="22" fill="url(#metalShelf2)" rx="2"/>
    <rect x="30" y="360" width="940" height="16" fill="#cbd5e1"/>
    <!-- Price tags -->
    <rect x="50" y="361" width="65" height="14" fill="#ffffff" rx="2"/>
    <text x="62" y="372" font-family="monospace" font-size="10" font-weight="bold" fill="#047857">1.45 €</text>
    <rect x="180" y="361" width="65" height="14" fill="#ffffff" rx="2"/>
    <text x="192" y="372" font-family="monospace" font-size="10" font-weight="bold" fill="#047857">1.45 €</text>
    <rect x="310" y="361" width="65" height="14" fill="#ffffff" rx="2"/>
    <text x="322" y="372" font-family="monospace" font-size="10" font-weight="bold" fill="#047857">1.45 €</text>
    <rect x="440" y="361" width="65" height="14" fill="#ffffff" rx="2"/>
    <text x="452" y="372" font-family="monospace" font-size="10" font-weight="bold" fill="#047857">1.45 €</text>
    <rect x="570" y="361" width="65" height="14" fill="#ffffff" rx="2"/>
    <text x="582" y="372" font-family="monospace" font-size="10" font-weight="bold" fill="#047857">1.45 €</text>
    <rect x="730" y="361" width="65" height="14" fill="#ffffff" rx="2"/>
    <text x="742" y="372" font-family="monospace" font-size="10" font-weight="bold" fill="#b91c1c">1.29 €</text>
    <rect x="850" y="361" width="65" height="14" fill="#ffffff" rx="2"/>
    <text x="862" y="372" font-family="monospace" font-size="10" font-weight="bold" fill="#b91c1c">1.29 €</text>

    <!-- Top Shelf: PILSNER URQUELL 0.5L (5 facings - DOMINANT SOS) -->
    <g id="pilsner_1">
      <rect x="45" y="120" width="95" height="220" rx="14" fill="url(#pilsnerGrad)"/>
      <rect x="50" y="170" width="85" height="90" rx="8" fill="#065f46"/>
      <text x="57" y="210" font-family="serif" font-weight="900" font-size="15" fill="#fef08a">PILSNER</text>
      <text x="55" y="235" font-family="serif" font-weight="700" font-size="13" fill="#ffffff">URQUELL</text>
      <text x="72" y="252" font-family="sans-serif" font-size="10" fill="#a7f3d0">0.5L</text>
    </g>
    <g id="pilsner_2">
      <rect x="170" y="120" width="95" height="220" rx="14" fill="url(#pilsnerGrad)"/>
      <rect x="175" y="170" width="85" height="90" rx="8" fill="#065f46"/>
      <text x="182" y="210" font-family="serif" font-weight="900" font-size="15" fill="#fef08a">PILSNER</text>
      <text x="180" y="235" font-family="serif" font-weight="700" font-size="13" fill="#ffffff">URQUELL</text>
      <text x="197" y="252" font-family="sans-serif" font-size="10" fill="#a7f3d0">0.5L</text>
    </g>
    <g id="pilsner_3">
      <rect x="295" y="120" width="95" height="220" rx="14" fill="url(#pilsnerGrad)"/>
      <rect x="300" y="170" width="85" height="90" rx="8" fill="#065f46"/>
      <text x="307" y="210" font-family="serif" font-weight="900" font-size="15" fill="#fef08a">PILSNER</text>
      <text x="305" y="235" font-family="serif" font-weight="700" font-size="13" fill="#ffffff">URQUELL</text>
      <text x="322" y="252" font-family="sans-serif" font-size="10" fill="#a7f3d0">0.5L</text>
    </g>
    <g id="pilsner_4">
      <rect x="420" y="120" width="95" height="220" rx="14" fill="url(#pilsnerGrad)"/>
      <rect x="425" y="170" width="85" height="90" rx="8" fill="#065f46"/>
      <text x="432" y="210" font-family="serif" font-weight="900" font-size="15" fill="#fef08a">PILSNER</text>
      <text x="430" y="235" font-family="serif" font-weight="700" font-size="13" fill="#ffffff">URQUELL</text>
      <text x="447" y="252" font-family="sans-serif" font-size="10" fill="#a7f3d0">0.5L</text>
    </g>
    <g id="pilsner_5">
      <rect x="545" y="120" width="95" height="220" rx="14" fill="url(#pilsnerGrad)"/>
      <rect x="550" y="170" width="85" height="90" rx="8" fill="#065f46"/>
      <text x="557" y="210" font-family="serif" font-weight="900" font-size="15" fill="#fef08a">PILSNER</text>
      <text x="555" y="235" font-family="serif" font-weight="700" font-size="13" fill="#ffffff">URQUELL</text>
      <text x="572" y="252" font-family="sans-serif" font-size="10" fill="#a7f3d0">0.5L</text>
    </g>

    <!-- Top Shelf: BUDVAR 0.5L (2 facings) -->
    <g id="budvar_1">
      <rect x="715" y="120" width="95" height="220" rx="14" fill="url(#budvarGrad)"/>
      <rect x="720" y="170" width="85" height="90" rx="8" fill="#9d174d"/>
      <text x="730" y="210" font-family="serif" font-weight="900" font-size="16" fill="#fbcfe8">BUDVAR</text>
      <text x="737" y="235" font-family="sans-serif" font-weight="700" font-size="12" fill="#ffffff">Original</text>
    </g>
    <g id="budvar_2">
      <rect x="835" y="120" width="95" height="220" rx="14" fill="url(#budvarGrad)"/>
      <rect x="840" y="170" width="85" height="90" rx="8" fill="#9d174d"/>
      <text x="850" y="210" font-family="serif" font-weight="900" font-size="16" fill="#fbcfe8">BUDVAR</text>
      <text x="857" y="235" font-family="sans-serif" font-weight="700" font-size="12" fill="#ffffff">Original</text>
    </g>

    <!-- Bottom Shelf Bar -->
    <rect x="30" y="670" width="940" height="22" fill="url(#metalShelf2)" rx="2"/>
    <rect x="30" y="690" width="940" height="16" fill="#cbd5e1"/>
    <!-- Price tags -->
    <rect x="50" y="691" width="65" height="14" fill="#ffffff" rx="2"/>
    <text x="62" y="702" font-family="monospace" font-size="10" font-weight="bold" fill="#78350f">1.15 €</text>
    <rect x="180" y="691" width="65" height="14" fill="#ffffff" rx="2"/>
    <text x="192" y="702" font-family="monospace" font-size="10" font-weight="bold" fill="#78350f">1.15 €</text>
    <rect x="310" y="691" width="65" height="14" fill="#ffffff" rx="2"/>
    <text x="322" y="702" font-family="monospace" font-size="10" font-weight="bold" fill="#78350f">1.15 €</text>
    <rect x="500" y="691" width="65" height="14" fill="#ffffff" rx="2"/>
    <text x="512" y="702" font-family="monospace" font-size="10" font-weight="bold" fill="#422006">0.99 €</text>
    <rect x="630" y="691" width="65" height="14" fill="#ffffff" rx="2"/>
    <text x="642" y="702" font-family="monospace" font-size="10" font-weight="bold" fill="#422006">0.99 €</text>
    <rect x="760" y="691" width="65" height="14" fill="#ffffff" rx="2"/>
    <text x="772" y="702" font-family="monospace" font-size="10" font-weight="bold" fill="#422006">0.99 €</text>
    <rect x="880" y="691" width="65" height="14" fill="#ffffff" rx="2"/>
    <text x="892" y="702" font-family="monospace" font-size="10" font-weight="bold" fill="#422006">0.99 €</text>

    <!-- Bottom Shelf: ZLATÝ BAŽANT 12% (3 facings) -->
    <g id="bazant_1">
      <rect x="45" y="450" width="95" height="220" rx="14" fill="url(#bazantGrad)"/>
      <rect x="50" y="500" width="85" height="90" rx="8" fill="#92400e"/>
      <text x="60" y="535" font-family="serif" font-weight="900" font-size="14" fill="#fef3c7">ZLATÝ</text>
      <text x="56" y="555" font-family="serif" font-weight="900" font-size="14" fill="#fde68a">BAŽANT</text>
      <text x="75" y="580" font-family="sans-serif" font-weight="700" font-size="11" fill="#ffffff">12% 0.5L</text>
    </g>
    <g id="bazant_2">
      <rect x="170" y="450" width="95" height="220" rx="14" fill="url(#bazantGrad)"/>
      <rect x="175" y="500" width="85" height="90" rx="8" fill="#92400e"/>
      <text x="185" y="535" font-family="serif" font-weight="900" font-size="14" fill="#fef3c7">ZLATÝ</text>
      <text x="181" y="555" font-family="serif" font-weight="900" font-size="14" fill="#fde68a">BAŽANT</text>
      <text x="200" y="580" font-family="sans-serif" font-weight="700" font-size="11" fill="#ffffff">12% 0.5L</text>
    </g>
    <g id="bazant_3">
      <rect x="295" y="450" width="95" height="220" rx="14" fill="url(#bazantGrad)"/>
      <rect x="300" y="500" width="85" height="90" rx="8" fill="#92400e"/>
      <text x="310" y="535" font-family="serif" font-weight="900" font-size="14" fill="#fef3c7">ZLATÝ</text>
      <text x="306" y="555" font-family="serif" font-weight="900" font-size="14" fill="#fde68a">BAŽANT</text>
      <text x="325" y="580" font-family="sans-serif" font-weight="700" font-size="11" fill="#ffffff">12% 0.5L</text>
    </g>

    <!-- Bottom Shelf: KOZEL 10% (4 facings) -->
    <g id="kozel_1">
      <rect x="485" y="450" width="95" height="220" rx="14" fill="url(#kozelGrad)"/>
      <rect x="490" y="500" width="85" height="90" rx="8" fill="#713f12"/>
      <text x="502" y="540" font-family="serif" font-weight="900" font-size="16" fill="#fef08a">KOZEL</text>
      <text x="505" y="565" font-family="sans-serif" font-weight="700" font-size="12" fill="#ffffff">10% Svetlé</text>
    </g>
    <g id="kozel_2">
      <rect x="610" y="450" width="95" height="220" rx="14" fill="url(#kozelGrad)"/>
      <rect x="615" y="500" width="85" height="90" rx="8" fill="#713f12"/>
      <text x="627" y="540" font-family="serif" font-weight="900" font-size="16" fill="#fef08a">KOZEL</text>
      <text x="630" y="565" font-family="sans-serif" font-weight="700" font-size="12" fill="#ffffff">10% Svetlé</text>
    </g>
    <g id="kozel_3">
      <rect x="735" y="450" width="95" height="220" rx="14" fill="url(#kozelGrad)"/>
      <rect x="740" y="500" width="85" height="90" rx="8" fill="#713f12"/>
      <text x="752" y="540" font-family="serif" font-weight="900" font-size="16" fill="#fef08a">KOZEL</text>
      <text x="755" y="565" font-family="sans-serif" font-weight="700" font-size="12" fill="#ffffff">10% Svetlé</text>
    </g>
    <g id="kozel_4">
      <rect x="860" y="450" width="95" height="220" rx="14" fill="url(#kozelGrad)"/>
      <rect x="865" y="500" width="85" height="90" rx="8" fill="#713f12"/>
      <text x="877" y="540" font-family="serif" font-weight="900" font-size="16" fill="#fef08a">KOZEL</text>
      <text x="880" y="565" font-family="sans-serif" font-weight="700" font-size="12" fill="#ffffff">10% Svetlé</text>
    </g>
  </svg>`;
};

// 3. Mliečne výrobky & Maslá shelf SVG
const generateDairyShelfSvg = (): string => {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 750" width="1000" height="750">
    <defs>
      <linearGradient id="dairyBg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
      <linearGradient id="milkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#1d4ed8"/>
        <stop offset="50%" stop-color="#3b82f6"/>
        <stop offset="100%" stop-color="#1e40af"/>
      </linearGradient>
      <linearGradient id="butterRajo" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#b45309"/>
        <stop offset="50%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#78350f"/>
      </linearGradient>
      <linearGradient id="butterLiptov" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#047857"/>
        <stop offset="50%" stop-color="#10b981"/>
        <stop offset="100%" stop-color="#065f46"/>
      </linearGradient>
    </defs>

    <rect width="1000" height="750" fill="url(#dairyBg)"/>
    <rect x="20" y="20" width="960" height="710" fill="#0f172a" rx="12"/>

    <!-- Header Store Banner -->
    <rect x="20" y="20" width="960" height="55" fill="#15803d" rx="8"/>
    <text x="50" y="55" font-family="system-ui, sans-serif" font-weight="900" font-size="22" fill="#ffffff">LIDL • MLIEČNY CHLADIACI REGÁL</text>
    <text x="760" y="54" font-family="system-ui, sans-serif" font-weight="700" font-size="14" fill="#bbf7d0">RUŽINOVSKÁ, BRATISLAVA</text>

    <!-- Shelf 1 (Milk) -->
    <rect x="30" y="350" width="940" height="20" fill="#94a3b8" rx="2"/>
    <rect x="30" y="370" width="940" height="16" fill="#e2e8f0"/>
    <rect x="60" y="371" width="70" height="14" fill="#ffffff" rx="2"/>
    <text x="75" y="382" font-family="monospace" font-size="10" font-weight="bold" fill="#1e3a8a">0.89 €</text>
    <rect x="270" y="371" width="70" height="14" fill="#ffffff" rx="2"/>
    <text x="285" y="382" font-family="monospace" font-size="10" font-weight="bold" fill="#1e3a8a">0.89 €</text>
    <rect x="520" y="371" width="70" height="14" fill="#ffffff" rx="2"/>
    <text x="535" y="382" font-family="monospace" font-size="10" font-weight="bold" fill="#1e3a8a">0.89 €</text>
    <rect x="750" y="371" width="70" height="14" fill="#ffffff" rx="2"/>
    <text x="765" y="382" font-family="monospace" font-size="10" font-weight="bold" fill="#1e3a8a">0.89 €</text>

    <!-- 4 Rajo Mlieko cartons -->
    <g id="rajo_mlieko_1">
      <rect x="60" y="110" width="160" height="240" rx="8" fill="url(#milkGrad)"/>
      <rect x="80" y="160" width="120" height="110" rx="6" fill="#ffffff"/>
      <text x="100" y="210" font-family="sans-serif" font-weight="900" font-size="28" fill="#1d4ed8">rajo</text>
      <text x="92" y="240" font-family="sans-serif" font-weight="700" font-size="13" fill="#334155">Trvanlivé Mlieko</text>
      <text x="110" y="260" font-family="sans-serif" font-weight="900" font-size="14" fill="#dc2626">1.5% • 1L</text>
    </g>
    <g id="rajo_mlieko_2">
      <rect x="270" y="110" width="160" height="240" rx="8" fill="url(#milkGrad)"/>
      <rect x="290" y="160" width="120" height="110" rx="6" fill="#ffffff"/>
      <text x="310" y="210" font-family="sans-serif" font-weight="900" font-size="28" fill="#1d4ed8">rajo</text>
      <text x="302" y="240" font-family="sans-serif" font-weight="700" font-size="13" fill="#334155">Trvanlivé Mlieko</text>
      <text x="320" y="260" font-family="sans-serif" font-weight="900" font-size="14" fill="#dc2626">1.5% • 1L</text>
    </g>
    <g id="rajo_mlieko_3">
      <rect x="520" y="110" width="160" height="240" rx="8" fill="url(#milkGrad)"/>
      <rect x="540" y="160" width="120" height="110" rx="6" fill="#ffffff"/>
      <text x="560" y="210" font-family="sans-serif" font-weight="900" font-size="28" fill="#1d4ed8">rajo</text>
      <text x="552" y="240" font-family="sans-serif" font-weight="700" font-size="13" fill="#334155">Trvanlivé Mlieko</text>
      <text x="570" y="260" font-family="sans-serif" font-weight="900" font-size="14" fill="#dc2626">1.5% • 1L</text>
    </g>
    <g id="rajo_mlieko_4">
      <rect x="750" y="110" width="160" height="240" rx="8" fill="url(#milkGrad)"/>
      <rect x="770" y="160" width="120" height="110" rx="6" fill="#ffffff"/>
      <text x="790" y="210" font-family="sans-serif" font-weight="900" font-size="28" fill="#1d4ed8">rajo</text>
      <text x="782" y="240" font-family="sans-serif" font-weight="700" font-size="13" fill="#334155">Trvanlivé Mlieko</text>
      <text x="800" y="260" font-family="sans-serif" font-weight="900" font-size="14" fill="#dc2626">1.5% • 1L</text>
    </g>

    <!-- Shelf 2 (Butter) -->
    <rect x="30" y="670" width="940" height="20" fill="#94a3b8" rx="2"/>
    <rect x="30" y="690" width="940" height="16" fill="#e2e8f0"/>
    <rect x="60" y="691" width="90" height="14" fill="#fef08a" stroke="#ca8a04" rx="2"/>
    <text x="68" y="702" font-family="monospace" font-size="10" font-weight="bold" fill="#b45309">2.49 € AKCIA</text>
    <rect x="290" y="691" width="90" height="14" fill="#fef08a" stroke="#ca8a04" rx="2"/>
    <text x="298" y="702" font-family="monospace" font-size="10" font-weight="bold" fill="#b45309">2.49 € AKCIA</text>
    <rect x="550" y="691" width="70" height="14" fill="#ffffff" rx="2"/>
    <text x="565" y="702" font-family="monospace" font-size="10" font-weight="bold" fill="#065f46">2.79 €</text>
    <rect x="770" y="691" width="70" height="14" fill="#ffffff" rx="2"/>
    <text x="785" y="702" font-family="monospace" font-size="10" font-weight="bold" fill="#065f46">2.79 €</text>

    <!-- Rajo Maslo (2 blocks) -->
    <g id="rajo_maslo_1">
      <rect x="60" y="470" width="200" height="200" rx="10" fill="url(#butterRajo)"/>
      <rect x="75" y="510" width="170" height="120" rx="8" fill="#fffbeb"/>
      <text x="110" y="555" font-family="sans-serif" font-weight="900" font-size="28" fill="#1d4ed8">rajo</text>
      <text x="95" y="585" font-family="sans-serif" font-weight="900" font-size="16" fill="#b45309">Tradičné Maslo</text>
      <text x="125" y="612" font-family="sans-serif" font-weight="700" font-size="13" fill="#78350f">82% • 250g</text>
    </g>
    <g id="rajo_maslo_2">
      <rect x="290" y="470" width="200" height="200" rx="10" fill="url(#butterRajo)"/>
      <rect x="305" y="510" width="170" height="120" rx="8" fill="#fffbeb"/>
      <text x="340" y="555" font-family="sans-serif" font-weight="900" font-size="28" fill="#1d4ed8">rajo</text>
      <text x="325" y="585" font-family="sans-serif" font-weight="900" font-size="16" fill="#b45309">Tradičné Maslo</text>
      <text x="355" y="612" font-family="sans-serif" font-weight="700" font-size="13" fill="#78350f">82% • 250g</text>
    </g>

    <!-- Liptov Maslo (2 blocks) -->
    <g id="liptov_maslo_1">
      <rect x="540" y="470" width="190" height="200" rx="10" fill="url(#butterLiptov)"/>
      <rect x="555" y="510" width="160" height="120" rx="8" fill="#ecfdf5"/>
      <text x="585" y="555" font-family="serif" font-weight="900" font-size="24" fill="#047857">LIPTOV</text>
      <text x="575" y="585" font-family="sans-serif" font-weight="800" font-size="15" fill="#065f46">Čerstvé Maslo</text>
      <text x="605" y="612" font-family="sans-serif" font-weight="700" font-size="13" fill="#064e3b">82% • 250g</text>
    </g>
    <g id="liptov_maslo_2">
      <rect x="760" y="470" width="190" height="200" rx="10" fill="url(#butterLiptov)"/>
      <rect x="775" y="510" width="160" height="120" rx="8" fill="#ecfdf5"/>
      <text x="805" y="555" font-family="serif" font-weight="900" font-size="24" fill="#047857">LIPTOV</text>
      <text x="795" y="585" font-family="sans-serif" font-weight="800" font-size="15" fill="#065f46">Čerstvé Maslo</text>
      <text x="825" y="612" font-family="sans-serif" font-weight="700" font-size="13" fill="#064e3b">82% • 250g</text>
    </g>
  </svg>`;
};

// 4. Káva & Čaje shelf SVG
const generateCoffeeShelfSvg = (): string => {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 750" width="1000" height="750">
    <defs>
      <linearGradient id="coffeeBg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#2a1b15"/>
        <stop offset="100%" stop-color="#140a06"/>
      </linearGradient>
      <linearGradient id="jacobsGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#15803d"/>
        <stop offset="50%" stop-color="#22c55e"/>
        <stop offset="100%" stop-color="#166534"/>
      </linearGradient>
      <linearGradient id="popradGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#991b1b"/>
        <stop offset="50%" stop-color="#ef4444"/>
        <stop offset="100%" stop-color="#7f1d1d"/>
      </linearGradient>
      <linearGradient id="nescafeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#78350f"/>
        <stop offset="50%" stop-color="#d97706"/>
        <stop offset="100%" stop-color="#451a03"/>
      </linearGradient>
    </defs>

    <rect width="1000" height="750" fill="url(#coffeeBg)"/>
    <rect x="20" y="20" width="960" height="710" fill="#1c110d" rx="12"/>

    <!-- Header Store Banner -->
    <rect x="20" y="20" width="960" height="55" fill="#dc2626" rx="8"/>
    <text x="50" y="55" font-family="system-ui, sans-serif" font-weight="900" font-size="22" fill="#ffffff">KAUFLAND • KÁVOVÝ REGÁL &amp; PROMO AKCIE</text>
    <text x="760" y="54" font-family="system-ui, sans-serif" font-weight="700" font-size="14" fill="#fee2e2">AVION, BRATISLAVA</text>

    <!-- Top Shelf Bar -->
    <rect x="30" y="340" width="940" height="20" fill="#94a3b8" rx="2"/>
    <rect x="30" y="360" width="940" height="16" fill="#e2e8f0"/>
    <rect x="60" y="361" width="90" height="14" fill="#fef08a" stroke="#ca8a04" rx="2"/>
    <text x="68" y="372" font-family="monospace" font-size="10" font-weight="bold" fill="#b45309">3.89 € AKCIA</text>
    <rect x="230" y="361" width="90" height="14" fill="#fef08a" stroke="#ca8a04" rx="2"/>
    <text x="238" y="372" font-family="monospace" font-size="10" font-weight="bold" fill="#b45309">3.89 € AKCIA</text>
    <rect x="400" y="361" width="90" height="14" fill="#fef08a" stroke="#ca8a04" rx="2"/>
    <text x="408" y="372" font-family="monospace" font-size="10" font-weight="bold" fill="#b45309">3.89 € AKCIA</text>
    <rect x="600" y="361" width="70" height="14" fill="#ffffff" rx="2"/>
    <text x="615" y="372" font-family="monospace" font-size="10" font-weight="bold" fill="#7f1d1d">2.69 €</text>
    <rect x="780" y="361" width="70" height="14" fill="#ffffff" rx="2"/>
    <text x="795" y="372" font-family="monospace" font-size="10" font-weight="bold" fill="#7f1d1d">2.69 €</text>

    <!-- Top Shelf: Jacobs Krönung 250g (3 facings) -->
    <g id="jacobs_1">
      <rect x="50" y="120" width="130" height="220" rx="10" fill="url(#jacobsGrad)"/>
      <rect x="60" y="160" width="110" height="90" rx="6" fill="#fef08a"/>
      <text x="75" y="195" font-family="serif" font-weight="900" font-size="18" fill="#15803d">JACOBS</text>
      <text x="70" y="225" font-family="serif" font-weight="700" font-size="14" fill="#78350f">Krönung</text>
      <text x="88" y="242" font-family="sans-serif" font-weight="900" font-size="11" fill="#14532d">250g</text>
    </g>
    <g id="jacobs_2">
      <rect x="220" y="120" width="130" height="220" rx="10" fill="url(#jacobsGrad)"/>
      <rect x="230" y="160" width="110" height="90" rx="6" fill="#fef08a"/>
      <text x="245" y="195" font-family="serif" font-weight="900" font-size="18" fill="#15803d">JACOBS</text>
      <text x="240" y="225" font-family="serif" font-weight="700" font-size="14" fill="#78350f">Krönung</text>
      <text x="258" y="242" font-family="sans-serif" font-weight="900" font-size="11" fill="#14532d">250g</text>
    </g>
    <g id="jacobs_3">
      <rect x="390" y="120" width="130" height="220" rx="10" fill="url(#jacobsGrad)"/>
      <rect x="400" y="160" width="110" height="90" rx="6" fill="#fef08a"/>
      <text x="415" y="195" font-family="serif" font-weight="900" font-size="18" fill="#15803d">JACOBS</text>
      <text x="410" y="225" font-family="serif" font-weight="700" font-size="14" fill="#78350f">Krönung</text>
      <text x="428" y="242" font-family="sans-serif" font-weight="900" font-size="11" fill="#14532d">250g</text>
    </g>

    <!-- Top Shelf: Popradská Káva 250g (2 facings) -->
    <g id="poprad_1">
      <rect x="580" y="120" width="140" height="220" rx="10" fill="url(#popradGrad)"/>
      <rect x="595" y="160" width="110" height="90" rx="6" fill="#ffffff"/>
      <text x="605" y="195" font-family="sans-serif" font-weight="900" font-size="15" fill="#991b1b">POPRADSKÁ</text>
      <text x="618" y="225" font-family="sans-serif" font-weight="700" font-size="13" fill="#1e293b">Štandard</text>
      <text x="635" y="242" font-family="sans-serif" font-weight="900" font-size="11" fill="#b91c1c">250g</text>
    </g>
    <g id="poprad_2">
      <rect x="760" y="120" width="140" height="220" rx="10" fill="url(#popradGrad)"/>
      <rect x="775" y="160" width="110" height="90" rx="6" fill="#ffffff"/>
      <text x="785" y="195" font-family="sans-serif" font-weight="900" font-size="15" fill="#991b1b">POPRADSKÁ</text>
      <text x="798" y="225" font-family="sans-serif" font-weight="700" font-size="13" fill="#1e293b">Štandard</text>
      <text x="815" y="242" font-family="sans-serif" font-weight="900" font-size="11" fill="#b91c1c">250g</text>
    </g>

    <!-- Bottom Shelf Bar -->
    <rect x="30" y="670" width="940" height="20" fill="#94a3b8" rx="2"/>
    <rect x="30" y="690" width="940" height="16" fill="#e2e8f0"/>
    <rect x="100" y="691" width="70" height="14" fill="#ffffff" rx="2"/>
    <text x="115" y="702" font-family="monospace" font-size="10" font-weight="bold" fill="#78350f">6.49 €</text>
    <rect x="360" y="691" width="70" height="14" fill="#ffffff" rx="2"/>
    <text x="375" y="702" font-family="monospace" font-size="10" font-weight="bold" fill="#78350f">6.49 €</text>
    <rect x="620" y="691" width="70" height="14" fill="#ffffff" rx="2"/>
    <text x="635" y="702" font-family="monospace" font-size="10" font-weight="bold" fill="#78350f">6.49 €</text>

    <!-- Bottom Shelf: Nescafé Classic 200g (3 glass jars) -->
    <g id="nescafe_1">
      <rect x="80" y="450" width="160" height="220" rx="20" fill="url(#nescafeGrad)"/>
      <rect x="95" y="490" width="130" height="100" rx="8" fill="#dc2626"/>
      <text x="112" y="535" font-family="sans-serif" font-weight="900" font-size="20" fill="#ffffff">NESCAFÉ</text>
      <text x="135" y="565" font-family="serif" font-weight="700" font-size="14" fill="#fef08a">Classic</text>
      <text x="145" y="582" font-family="sans-serif" font-weight="900" font-size="11" fill="#fee2e2">200g</text>
    </g>
    <g id="nescafe_2">
      <rect x="340" y="450" width="160" height="220" rx="20" fill="url(#nescafeGrad)"/>
      <rect x="355" y="490" width="130" height="100" rx="8" fill="#dc2626"/>
      <text x="372" y="535" font-family="sans-serif" font-weight="900" font-size="20" fill="#ffffff">NESCAFÉ</text>
      <text x="395" y="565" font-family="serif" font-weight="700" font-size="14" fill="#fef08a">Classic</text>
      <text x="405" y="582" font-family="sans-serif" font-weight="900" font-size="11" fill="#fee2e2">200g</text>
    </g>
    <g id="nescafe_3">
      <rect x="600" y="450" width="160" height="220" rx="20" fill="url(#nescafeGrad)"/>
      <rect x="615" y="490" width="130" height="100" rx="8" fill="#dc2626"/>
      <text x="632" y="535" font-family="sans-serif" font-weight="900" font-size="20" fill="#ffffff">NESCAFÉ</text>
      <text x="655" y="565" font-family="serif" font-weight="700" font-size="14" fill="#fef08a">Classic</text>
      <text x="665" y="582" font-family="sans-serif" font-weight="900" font-size="11" fill="#fee2e2">200g</text>
    </g>
  </svg>`;
};

// Generates complete sample analyses ready for Dexie
export const generateSampleAnalyses = (): Analysis[] => {
  const now = Date.now();
  const drinksSvg = createSvgDataUrl(generateDrinksShelfSvg());
  const beerSvg = createSvgDataUrl(generateBeerShelfSvg());
  const dairySvg = createSvgDataUrl(generateDairyShelfSvg());
  const coffeeSvg = createSvgDataUrl(generateCoffeeShelfSvg());

  // Analysis 1: Drinks & Waters (Billa)
  const image1: SerializableImageState = {
    id: 'demo-img-drinks-1',
    file: {
      name: 'Billa_Bajkalska_Nealko_Regal_01.jpg',
      type: 'image/svg+xml',
      lastModified: now - 3600000 * 24,
      data: drinksSvg
    },
    imageUrl: drinksSvg,
    uploadDate: new Date(now - 3600000 * 24).toISOString(),
    status: 'success',
    error: null,
    analysisType: 'both',
    model: 'gemini-2.5-flash',
    retryCount: 0,
    assignedStore: { id: 1, name: 'Billa Bajkalská', chain: 'Billa', city: 'Bratislava' },
    assignedStoreId: 1,
    analysisResult: {
      modelName: 'gemini-2.5-flash',
      products: [
        // Kofola Original 2L (3 facings)
        {
          id: 'p-kof-1',
          name: 'Kofola Original 2L',
          brand: 'Kofola',
          confidence: 0.98,
          boundingBox: { x: 0.05, y: 0.11, width: 0.11, height: 0.32 },
          prices: [{ value: '1.69 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-kof-2',
          name: 'Kofola Original 2L',
          brand: 'Kofola',
          confidence: 0.97,
          boundingBox: { x: 0.21, y: 0.11, width: 0.11, height: 0.32 },
          prices: [{ value: '1.69 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-kof-3',
          name: 'Kofola Original 2L',
          brand: 'Kofola',
          confidence: 0.98,
          boundingBox: { x: 0.37, y: 0.11, width: 0.11, height: 0.32 },
          prices: [{ value: '1.69 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        // Coca-Cola Original 2L (3 facings)
        {
          id: 'p-coca-1',
          name: 'Coca-Cola Original 2L',
          brand: 'Coca-Cola',
          confidence: 0.96,
          boundingBox: { x: 0.53, y: 0.11, width: 0.11, height: 0.32 },
          prices: [{ value: '1.99 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-coca-2',
          name: 'Coca-Cola Original 2L',
          brand: 'Coca-Cola',
          confidence: 0.97,
          boundingBox: { x: 0.68, y: 0.11, width: 0.11, height: 0.32 },
          prices: [{ value: '1.99 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-coca-3',
          name: 'Coca-Cola Original 2L',
          brand: 'Coca-Cola',
          confidence: 0.95,
          boundingBox: { x: 0.83, y: 0.11, width: 0.11, height: 0.32 },
          prices: [{ value: '1.99 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        // Rajec Pramenitá Voda 1.5L (3 facings)
        {
          id: 'p-rajec-1',
          name: 'Rajec Pramenitá Voda 1.5L',
          brand: 'Rajec',
          confidence: 0.95,
          boundingBox: { x: 0.05, y: 0.55, width: 0.10, height: 0.33 },
          prices: [{ value: '0.79 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-rajec-2',
          name: 'Rajec Pramenitá Voda 1.5L',
          brand: 'Rajec',
          confidence: 0.96,
          boundingBox: { x: 0.19, y: 0.55, width: 0.10, height: 0.33 },
          prices: [{ value: '0.79 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-rajec-3',
          name: 'Rajec Pramenitá Voda 1.5L',
          brand: 'Rajec',
          confidence: 0.95,
          boundingBox: { x: 0.33, y: 0.55, width: 0.10, height: 0.33 },
          prices: [{ value: '0.79 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        // Mattoni Minerálna Voda 1.5L (2 facings)
        {
          id: 'p-mattoni-1',
          name: 'Mattoni Minerálna Voda 1.5L',
          brand: 'Mattoni',
          confidence: 0.94,
          boundingBox: { x: 0.48, y: 0.55, width: 0.10, height: 0.33 },
          prices: [{ value: '0.89 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-mattoni-2',
          name: 'Mattoni Minerálna Voda 1.5L',
          brand: 'Mattoni',
          confidence: 0.95,
          boundingBox: { x: 0.62, y: 0.55, width: 0.10, height: 0.33 },
          prices: [{ value: '0.89 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        // Birell Pomelo & Grep 0.5L (2 facings)
        {
          id: 'p-birell-1',
          name: 'Birell Pomelo & Grep 0.5L',
          brand: 'Birell',
          confidence: 0.96,
          boundingBox: { x: 0.76, y: 0.62, width: 0.09, height: 0.27 },
          prices: [{ value: '1.09 €', type: 'PROMO' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-birell-2',
          name: 'Birell Pomelo & Grep 0.5L',
          brand: 'Birell',
          confidence: 0.97,
          boundingBox: { x: 0.86, y: 0.62, width: 0.09, height: 0.27 },
          prices: [{ value: '1.09 €', type: 'PROMO' }],
          priceIntegrityStatus: 'valid'
        }
      ]
    }
  };

  const analysis1: Analysis = {
    id: 'demo-analysis-billa-drinks',
    name: 'Billa Bajkalská - Nealko nápoje & Vody',
    createdAt: new Date(now - 3600000 * 24).toISOString(),
    images: [image1],
    analysisType: 'both',
    store: { id: 1, name: 'Billa Bajkalská', chain: 'Billa', city: 'Bratislava' },
    storeId: 1,
    brandClassifications: {
      ourBrands: ['Kofola', 'Rajec'],
      competitorBrands: ['Coca-Cola', 'Mattoni', 'Birell']
    }
  };

  // Analysis 2: Beer shelf SOS audit (Tesco)
  const image2: SerializableImageState = {
    id: 'demo-img-beer-1',
    file: {
      name: 'Tesco_Zlate_Piesky_Pivny_Regal_SOS.jpg',
      type: 'image/svg+xml',
      lastModified: now - 3600000 * 12,
      data: beerSvg
    },
    imageUrl: beerSvg,
    uploadDate: new Date(now - 3600000 * 12).toISOString(),
    status: 'success',
    error: null,
    analysisType: 'shelfShare',
    model: 'gemini-2.5-flash',
    retryCount: 0,
    assignedStore: { id: 2, name: 'Tesco Extra Zlaté Piesky', chain: 'Tesco', city: 'Bratislava' },
    assignedStoreId: 2,
    analysisResult: {
      modelName: 'gemini-2.5-flash',
      products: [
        // Pilsner Urquell 0.5L (5 facings)
        {
          id: 'p-pils-1',
          name: 'Pilsner Urquell 0.5L',
          brand: 'Pilsner Urquell',
          confidence: 0.99,
          boundingBox: { x: 0.045, y: 0.16, width: 0.10, height: 0.31 },
          prices: [{ value: '1.45 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-pils-2',
          name: 'Pilsner Urquell 0.5L',
          brand: 'Pilsner Urquell',
          confidence: 0.99,
          boundingBox: { x: 0.170, y: 0.16, width: 0.10, height: 0.31 },
          prices: [{ value: '1.45 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-pils-3',
          name: 'Pilsner Urquell 0.5L',
          brand: 'Pilsner Urquell',
          confidence: 0.98,
          boundingBox: { x: 0.295, y: 0.16, width: 0.10, height: 0.31 },
          prices: [{ value: '1.45 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-pils-4',
          name: 'Pilsner Urquell 0.5L',
          brand: 'Pilsner Urquell',
          confidence: 0.99,
          boundingBox: { x: 0.420, y: 0.16, width: 0.10, height: 0.31 },
          prices: [{ value: '1.45 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-pils-5',
          name: 'Pilsner Urquell 0.5L',
          brand: 'Pilsner Urquell',
          confidence: 0.99,
          boundingBox: { x: 0.545, y: 0.16, width: 0.10, height: 0.31 },
          prices: [{ value: '1.45 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        // Budweiser Budvar 0.5L (2 facings)
        {
          id: 'p-bud-1',
          name: 'Budweiser Budvar 0.5L',
          brand: 'Budvar',
          confidence: 0.96,
          boundingBox: { x: 0.715, y: 0.16, width: 0.10, height: 0.31 },
          prices: [{ value: '1.29 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-bud-2',
          name: 'Budweiser Budvar 0.5L',
          brand: 'Budvar',
          confidence: 0.96,
          boundingBox: { x: 0.835, y: 0.16, width: 0.10, height: 0.31 },
          prices: [{ value: '1.29 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        // Zlatý Bažant 12% 0.5L (3 facings)
        {
          id: 'p-baz-1',
          name: 'Zlatý Bažant 12% 0.5L',
          brand: 'Zlatý Bažant',
          confidence: 0.97,
          boundingBox: { x: 0.045, y: 0.60, width: 0.10, height: 0.31 },
          prices: [{ value: '1.15 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-baz-2',
          name: 'Zlatý Bažant 12% 0.5L',
          brand: 'Zlatý Bažant',
          confidence: 0.98,
          boundingBox: { x: 0.170, y: 0.60, width: 0.10, height: 0.31 },
          prices: [{ value: '1.15 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-baz-3',
          name: 'Zlatý Bažant 12% 0.5L',
          brand: 'Zlatý Bažant',
          confidence: 0.97,
          boundingBox: { x: 0.295, y: 0.60, width: 0.10, height: 0.31 },
          prices: [{ value: '1.15 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        // Velkopopovický Kozel 10% 0.5L (4 facings)
        {
          id: 'p-koz-1',
          name: 'Velkopopovický Kozel 10% 0.5L',
          brand: 'Kozel',
          confidence: 0.96,
          boundingBox: { x: 0.485, y: 0.60, width: 0.10, height: 0.31 },
          prices: [{ value: '0.99 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-koz-2',
          name: 'Velkopopovický Kozel 10% 0.5L',
          brand: 'Kozel',
          confidence: 0.96,
          boundingBox: { x: 0.610, y: 0.60, width: 0.10, height: 0.31 },
          prices: [{ value: '0.99 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-koz-3',
          name: 'Velkopopovický Kozel 10% 0.5L',
          brand: 'Kozel',
          confidence: 0.95,
          boundingBox: { x: 0.735, y: 0.60, width: 0.10, height: 0.31 },
          prices: [{ value: '0.99 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-koz-4',
          name: 'Velkopopovický Kozel 10% 0.5L',
          brand: 'Kozel',
          confidence: 0.96,
          boundingBox: { x: 0.860, y: 0.60, width: 0.10, height: 0.31 },
          prices: [{ value: '0.99 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        }
      ]
    }
  };

  const analysis2: Analysis = {
    id: 'demo-analysis-tesco-beer',
    name: 'Tesco Extra - Pivný regál SOS Audit',
    createdAt: new Date(now - 3600000 * 12).toISOString(),
    images: [image2],
    analysisType: 'shelfShare',
    store: { id: 2, name: 'Tesco Extra Zlaté Piesky', chain: 'Tesco', city: 'Bratislava' },
    storeId: 2,
    brandClassifications: {
      ourBrands: ['Pilsner Urquell', 'Kozel'],
      competitorBrands: ['Zlatý Bažant', 'Budvar']
    }
  };

  // Analysis 3: Dairy Products & Butter (Lidl)
  const image3: SerializableImageState = {
    id: 'demo-img-dairy-1',
    file: {
      name: 'Lidl_Ruzinovska_Mliecny_Chladiaci_Box.jpg',
      type: 'image/svg+xml',
      lastModified: now - 3600000 * 6,
      data: dairySvg
    },
    imageUrl: dairySvg,
    uploadDate: new Date(now - 3600000 * 6).toISOString(),
    status: 'success',
    error: null,
    analysisType: 'price',
    model: 'gemini-2.5-flash',
    retryCount: 0,
    assignedStore: { id: 3, name: 'Lidl Ružinovská', chain: 'Lidl', city: 'Bratislava' },
    assignedStoreId: 3,
    analysisResult: {
      modelName: 'gemini-2.5-flash',
      products: [
        // Rajo Trvanlivé Mlieko 1.5% 1L (4 facings)
        {
          id: 'p-rml-1',
          name: 'Rajo Trvanlivé Mlieko 1.5% 1L',
          brand: 'Rajo',
          confidence: 0.98,
          boundingBox: { x: 0.06, y: 0.15, width: 0.16, height: 0.34 },
          prices: [{ value: '0.89 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-rml-2',
          name: 'Rajo Trvanlivé Mlieko 1.5% 1L',
          brand: 'Rajo',
          confidence: 0.98,
          boundingBox: { x: 0.27, y: 0.15, width: 0.16, height: 0.34 },
          prices: [{ value: '0.89 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-rml-3',
          name: 'Rajo Trvanlivé Mlieko 1.5% 1L',
          brand: 'Rajo',
          confidence: 0.97,
          boundingBox: { x: 0.52, y: 0.15, width: 0.16, height: 0.34 },
          prices: [{ value: '0.89 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-rml-4',
          name: 'Rajo Trvanlivé Mlieko 1.5% 1L',
          brand: 'Rajo',
          confidence: 0.98,
          boundingBox: { x: 0.75, y: 0.15, width: 0.16, height: 0.34 },
          prices: [{ value: '0.89 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        // Rajo Tradičné Maslo 250g (2 facings, promo)
        {
          id: 'p-rmas-1',
          name: 'Rajo Tradičné Maslo 250g',
          brand: 'Rajo',
          confidence: 0.99,
          boundingBox: { x: 0.06, y: 0.63, width: 0.20, height: 0.28 },
          prices: [{ value: '2.49 €', type: 'PROMO' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-rmas-2',
          name: 'Rajo Tradičné Maslo 250g',
          brand: 'Rajo',
          confidence: 0.98,
          boundingBox: { x: 0.29, y: 0.63, width: 0.20, height: 0.28 },
          prices: [{ value: '2.49 €', type: 'PROMO' }],
          priceIntegrityStatus: 'valid'
        },
        // Liptov Tradičné Maslo 250g (2 facings)
        {
          id: 'p-lmas-1',
          name: 'Liptov Tradičné Maslo 250g',
          brand: 'Liptov',
          confidence: 0.96,
          boundingBox: { x: 0.54, y: 0.63, width: 0.19, height: 0.28 },
          prices: [{ value: '2.79 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-lmas-2',
          name: 'Liptov Tradičné Maslo 250g',
          brand: 'Liptov',
          confidence: 0.96,
          boundingBox: { x: 0.76, y: 0.63, width: 0.19, height: 0.28 },
          prices: [{ value: '2.79 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        }
      ]
    }
  };

  const analysis3: Analysis = {
    id: 'demo-analysis-lidl-dairy',
    name: 'Lidl Ružinovská - Mliečne výrobky & Maslá',
    createdAt: new Date(now - 3600000 * 6).toISOString(),
    images: [image3],
    analysisType: 'price',
    store: { id: 3, name: 'Lidl Ružinovská', chain: 'Lidl', city: 'Bratislava' },
    storeId: 3,
    brandClassifications: {
      ourBrands: ['Rajo'],
      competitorBrands: ['Liptov', 'Pilos', 'Tami']
    }
  };

  // Analysis 4: Coffee Shelf Promo Audit (Kaufland)
  const image4: SerializableImageState = {
    id: 'demo-img-coffee-1',
    file: {
      name: 'Kaufland_Avion_Kavovy_Regal_Akcie.jpg',
      type: 'image/svg+xml',
      lastModified: now - 3600000 * 2,
      data: coffeeSvg
    },
    imageUrl: coffeeSvg,
    uploadDate: new Date(now - 3600000 * 2).toISOString(),
    status: 'success',
    error: null,
    analysisType: 'promo',
    model: 'gemini-2.5-flash',
    retryCount: 0,
    assignedStore: { id: 4, name: 'Kaufland Avion', chain: 'Kaufland', city: 'Bratislava' },
    assignedStoreId: 4,
    analysisResult: {
      modelName: 'gemini-2.5-flash',
      products: [
        // Jacobs Krönung Mletá Káva 250g (3 facings, promo)
        {
          id: 'p-jac-1',
          name: 'Jacobs Krönung Mletá Káva 250g',
          brand: 'Jacobs',
          confidence: 0.97,
          boundingBox: { x: 0.05, y: 0.16, width: 0.13, height: 0.31 },
          prices: [{ value: '3.89 €', type: 'PROMO' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-jac-2',
          name: 'Jacobs Krönung Mletá Káva 250g',
          brand: 'Jacobs',
          confidence: 0.97,
          boundingBox: { x: 0.22, y: 0.16, width: 0.13, height: 0.31 },
          prices: [{ value: '3.89 €', type: 'PROMO' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-jac-3',
          name: 'Jacobs Krönung Mletá Káva 250g',
          brand: 'Jacobs',
          confidence: 0.96,
          boundingBox: { x: 0.39, y: 0.16, width: 0.13, height: 0.31 },
          prices: [{ value: '3.89 €', type: 'PROMO' }],
          priceIntegrityStatus: 'valid'
        },
        // Popradská Káva Štandard 250g (2 facings)
        {
          id: 'p-pop-1',
          name: 'Popradská Káva Štandard 250g',
          brand: 'Popradská káva',
          confidence: 0.98,
          boundingBox: { x: 0.58, y: 0.16, width: 0.14, height: 0.31 },
          prices: [{ value: '2.69 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-pop-2',
          name: 'Popradská Káva Štandard 250g',
          brand: 'Popradská káva',
          confidence: 0.98,
          boundingBox: { x: 0.76, y: 0.16, width: 0.14, height: 0.31 },
          prices: [{ value: '2.69 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        // Nescafé Classic 200g (3 facings)
        {
          id: 'p-nes-1',
          name: 'Nescafé Classic 200g',
          brand: 'Nescafé',
          confidence: 0.96,
          boundingBox: { x: 0.08, y: 0.60, width: 0.16, height: 0.31 },
          prices: [{ value: '6.49 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-nes-2',
          name: 'Nescafé Classic 200g',
          brand: 'Nescafé',
          confidence: 0.96,
          boundingBox: { x: 0.34, y: 0.60, width: 0.16, height: 0.31 },
          prices: [{ value: '6.49 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        },
        {
          id: 'p-nes-3',
          name: 'Nescafé Classic 200g',
          brand: 'Nescafé',
          confidence: 0.95,
          boundingBox: { x: 0.60, y: 0.60, width: 0.16, height: 0.31 },
          prices: [{ value: '6.49 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid'
        }
      ]
    }
  };

  const analysis4: Analysis = {
    id: 'demo-analysis-kaufland-coffee',
    name: 'Kaufland Avion - Káva & Akciový regál',
    createdAt: new Date(now - 3600000 * 2).toISOString(),
    images: [image4],
    analysisType: 'promo',
    store: { id: 4, name: 'Kaufland Avion', chain: 'Kaufland', city: 'Bratislava' },
    storeId: 4,
    brandClassifications: {
      ourBrands: ['Jacobs', 'Popradská káva'],
      competitorBrands: ['Nescafé', 'Tchibo', 'Eduscho']
    }
  };

  // Analysis 5: Audit z 8.10. (Extrahované video snímky a kompletné výstupy)
  const imageVideo1: SerializableImageState = {
    id: 'demo-img-audit-810-frame1',
    file: {
      name: 'Regal_Kaufland_08.10.2026_frame_1.0s.jpg',
      type: 'image/svg+xml',
      lastModified: now - 3600000,
      data: drinksSvg
    },
    imageUrl: drinksSvg,
    uploadDate: new Date(now - 3600000).toISOString(),
    status: 'success',
    error: null,
    analysisType: 'both',
    model: 'gemini-3.8-flash',
    retryCount: 0,
    assignedStore: { id: 4, name: 'Kaufland Avion', chain: 'Kaufland', city: 'Bratislava' },
    assignedStoreId: 4,
    analysisResult: {
      modelName: 'gemini-3.8-flash',
      products: [
        {
          id: 'p-810-kof-1',
          name: 'Kofola Original 2L',
          brand: 'Kofola',
          confidence: 0.98,
          boundingBox: { x: 0.05, y: 0.15, width: 0.11, height: 0.31 },
          prices: [{ value: '1.69 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid',
          verificationStatus: 'human_verified',
          facings: 1
        },
        {
          id: 'p-810-kof-2',
          name: 'Kofola Original 2L',
          brand: 'Kofola',
          confidence: 0.98,
          boundingBox: { x: 0.21, y: 0.15, width: 0.11, height: 0.31 },
          prices: [{ value: '1.69 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid',
          verificationStatus: 'human_verified',
          facings: 1
        },
        {
          id: 'p-810-coca-1',
          name: 'Coca-Cola Original 2L',
          brand: 'Coca-Cola',
          confidence: 0.97,
          boundingBox: { x: 0.54, y: 0.15, width: 0.11, height: 0.31 },
          prices: [{ value: '1.99 €', type: 'REGULAR' }, { value: '1.49 €', type: 'PROMO' }],
          priceIntegrityStatus: 'valid',
          regularPrice: 1.99,
          promoPrice: 1.49,
          facings: 1
        },
        {
          id: 'p-810-rajec-1',
          name: 'Rajec Pramenitá Voda Neperlivá 1.5L',
          brand: 'Rajec',
          confidence: 0.96,
          boundingBox: { x: 0.05, y: 0.55, width: 0.10, height: 0.33 },
          prices: [{ value: '0.79 €', type: 'REGULAR' }],
          priceIntegrityStatus: 'valid',
          facings: 1
        },
        {
          id: 'p-810-pos-1',
          name: 'Akciový wobbler Super Cena',
          brand: 'Akcia',
          type: 'pos_material',
          posType: 'wobbler',
          confidence: 0.94,
          boundingBox: { x: 0.48, y: 0.42, width: 0.08, height: 0.12 },
          prices: []
        }
      ]
    }
  };

  const imageVideo2: SerializableImageState = {
    id: 'demo-img-audit-810-frame2',
    file: {
      name: 'Regal_Kaufland_08.10.2026_frame_3.5s.jpg',
      type: 'image/svg+xml',
      lastModified: now - 3600000,
      data: coffeeSvg
    },
    imageUrl: coffeeSvg,
    uploadDate: new Date(now - 3600000).toISOString(),
    status: 'success',
    error: null,
    analysisType: 'both',
    model: 'gemini-3.8-flash',
    retryCount: 0,
    assignedStore: { id: 4, name: 'Kaufland Avion', chain: 'Kaufland', city: 'Bratislava' },
    assignedStoreId: 4,
    analysisResult: {
      modelName: 'gemini-3.8-flash',
      products: [
        {
          id: 'p-810-jac-1',
          name: 'Jacobs Krönung Mletá Káva 250g',
          brand: 'Jacobs',
          confidence: 0.97,
          boundingBox: { x: 0.05, y: 0.16, width: 0.13, height: 0.31 },
          prices: [{ value: '4.89 €', type: 'REGULAR' }, { value: '3.89 €', type: 'PROMO' }],
          regularPrice: 4.89,
          promoPrice: 3.89,
          priceIntegrityStatus: 'valid',
          verificationStatus: 'human_verified',
          facings: 2
        },
        {
          id: 'p-810-pop-1',
          name: 'Popradská Káva Štandard 250g',
          brand: 'Popradská káva',
          confidence: 0.98,
          boundingBox: { x: 0.58, y: 0.16, width: 0.14, height: 0.31 },
          prices: [{ value: '2.69 €', type: 'REGULAR' }],
          regularPrice: 2.69,
          priceIntegrityStatus: 'valid',
          facings: 2
        },
        {
          id: 'p-810-nes-1',
          name: 'Nescafé Classic 200g',
          brand: 'Nescafé',
          confidence: 0.96,
          boundingBox: { x: 0.08, y: 0.60, width: 0.16, height: 0.31 },
          prices: [{ value: '6.49 €', type: 'REGULAR' }],
          regularPrice: 6.49,
          priceIntegrityStatus: 'valid',
          facings: 3
        }
      ]
    }
  };

  const analysis810: Analysis = {
    id: 'analysis-08-10-kaufland-avion',
    name: 'Audit regálu 08.10.2026 - Video & Foto (Kaufland Avion)',
    createdAt: new Date('2026-10-08T14:30:00.000Z').toISOString(),
    images: [imageVideo1, imageVideo2],
    analysisType: 'both',
    store: { id: 4, name: 'Kaufland Avion', chain: 'Kaufland', city: 'Bratislava' },
    storeId: 4,
    costInfo: {
      inputTokens: 1420,
      outputTokens: 850,
      cost: 0.00072,
      modelName: 'gemini-3.8-flash'
    },
    brandClassifications: {
      ourBrands: ['Kofola', 'Rajec', 'Jacobs', 'Popradská káva'],
      competitorBrands: ['Coca-Cola', 'Nescafé', 'Tchibo']
    }
  };

  return [analysis810, analysis1, analysis2, analysis3, analysis4];
};
