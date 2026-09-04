const fs = require('fs');

const files = [
    './migrated_prompt_history/prompt_2026-01-18T15:52:35.057Z.json',
    './migrated_prompt_history/prompt_2026-01-18T16:13:52.401Z.json'
];

let stream = fs.createWriteStream('./krok_search_results.txt');

files.forEach(file => {
    if (!fs.existsSync(file)) return;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    stream.write(`\n==========================================\nSEARCHING FILE: ${file}\n==========================================\n`);
    data.forEach((m, idx) => {
        if (m.payload && m.payload.text) {
            const text = m.payload.text;
            const textLower = text.toLowerCase();
            // Match any mentions of Krok, refaktor, or optimization
            if (textLower.includes('krok') || textLower.includes('refaktor') || textLower.includes('optimaliz')) {
                stream.write(`\n--- MSG ${idx} (ID: ${m.id}, Author: ${m.author}) ---\n`);
                // Write first 4000 characters of the message
                stream.write(text.substring(0, 4000) + (text.length > 4000 ? '\n...[TRUNCATED IN EXPORT]...' : '') + '\n');
            }
        }
    });
});

stream.end(() => {
    console.log("Successfully wrote all search results to ./krok_search_results.txt");
});
