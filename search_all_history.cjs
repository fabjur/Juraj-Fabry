const fs = require('fs');
const path = require('path');

const dir = './migrated_prompt_history';
const files = fs.readdirSync(dir).map(f => path.join(dir, f));

let output = '';

files.forEach(file => {
    console.log(`Searching in ${file}...`);
    try {
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));
        data.forEach((m, idx) => {
            if (m.payload && m.payload.text) {
                const text = m.payload.text;
                const textLower = text.toLowerCase();
                if (textLower.includes('krok') || textLower.includes('refaktor') || textLower.includes('step')) {
                    output += `\n==================================================\n`;
                    output += `FILE: ${file} | MESSAGE INDEX: ${idx} | AUTHOR: ${m.author}\n`;
                    output += `==================================================\n`;
                    
                    // Grab around the word 'krok'
                    let lastIdx = 0;
                    while (true) {
                        const matchIdx = textLower.indexOf('krok', lastIdx);
                        if (matchIdx === -1) break;
                        const start = Math.max(0, matchIdx - 200);
                        const end = Math.min(text.length, matchIdx + 800);
                        output += `--- MATCH at character ${matchIdx} ---\n`;
                        output += text.substring(start, end) + `\n-----------------------------------\n`;
                        lastIdx = matchIdx + 4;
                    }
                }
            }
        });
    } catch (e) {
        console.error(`Error processing ${file}:`, e);
    }
});

fs.writeFileSync('./krok_all_history_matches.txt', output, 'utf8');
console.log("Successfully wrote all matches to ./krok_all_history_matches.txt");
