const fs = require('fs');

const file = './krok_search_results.txt';
if (fs.existsSync(file)) {
    const data = fs.readFileSync(file, 'utf8');
    const lines = data.split('\n');
    let output = '';
    
    // Regex for: krok followed by optional space/dash, then a digit
    const regex = /krok\s*[-–]?\s*[1-9]/i;
    lines.forEach((line, idx) => {
        if (regex.test(line)) {
            output += `\n--- Line ${idx + 1} (Matched Regex) ---\n`;
            const start = Math.max(0, idx - 10);
            const end = Math.min(lines.length - 1, idx + 10);
            for (let i = start; i <= end; i++) {
                const marker = (i === idx) ? '>>>' : '   ';
                output += `${marker} ${i + 1}: ${lines[i]}\n`;
            }
        }
    });
    fs.writeFileSync('./krok_anywhere_matches.txt', output, 'utf8');
    console.log("Written matches to ./krok_anywhere_matches.txt");
} else {
    console.log("File not found.");
}
