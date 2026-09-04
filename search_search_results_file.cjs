const fs = require('fs');

const file = './krok_search_results.txt';
if (fs.existsSync(file)) {
    const data = fs.readFileSync(file, 'utf8');
    const lines = data.split('\n');
    let output = '';
    
    const keywords = ['krok 3', 'krok tri', 'step 3', 'refaktoring krok 3', 'fáza 3', 'krok 1', 'krok 2'];
    lines.forEach((line, idx) => {
        const containsKeyword = keywords.some(kw => line.toLowerCase().includes(kw));
        if (containsKeyword) {
            output += `\n--- Line ${idx + 1} ---\n`;
            const start = Math.max(0, idx - 15);
            const end = Math.min(lines.length - 1, idx + 15);
            for (let i = start; i <= end; i++) {
                const marker = (i === idx) ? '>>>' : '   ';
                output += `${marker} ${i + 1}: ${lines[i]}\n`;
            }
        }
    });
    fs.writeFileSync('./krok_search_results_matches.txt', output, 'utf8');
    console.log("Written matches to ./krok_search_results_matches.txt");
} else {
    console.log("File not found.");
}
