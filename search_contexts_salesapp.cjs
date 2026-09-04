const fs = require('fs');

const file = './krok_user_contexts.txt';
if (fs.existsSync(file)) {
    const data = fs.readFileSync(file, 'utf8');
    const lines = data.split('\n');
    let output = '';
    
    const keywords = ['salesapp', 'kava', 'napoje', 'cokolad', 'krok 3', 'fáza 3', 'krok tri'];
    lines.forEach((line, idx) => {
        const containsKeyword = keywords.some(kw => line.toLowerCase().includes(kw));
        if (containsKeyword) {
            output += `\n--- Line ${idx + 1} ---\n`;
            const start = Math.max(0, idx - 8);
            const end = Math.min(lines.length - 1, idx + 8);
            for (let i = start; i <= end; i++) {
                const marker = (i === idx) ? '>>>' : '   ';
                output += `${marker} ${i + 1}: ${lines[i]}\n`;
            }
        }
    });
    fs.writeFileSync('./krok_salesapp_matches.txt', output, 'utf8');
    console.log("Written matches to ./krok_salesapp_matches.txt");
} else {
    console.log("File not found.");
}
