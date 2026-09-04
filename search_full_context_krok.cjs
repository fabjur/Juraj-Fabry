const fs = require('fs');

const file = './krok_search_results.txt';
if (fs.existsSync(file)) {
    const data = fs.readFileSync(file, 'utf8');
    const lines = data.split('\n');
    let output = '';
    
    let matchedCount = 0;
    lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('krok')) {
            matchedCount++;
            output += `\n--- Match #${matchedCount} | Line ${idx + 1} ---\n`;
            const start = Math.max(0, idx - 4);
            const end = Math.min(lines.length - 1, idx + 10);
            for (let i = start; i <= end; i++) {
                const marker = (i === idx) ? '>>>' : '   ';
                output += `${marker} ${i + 1}: ${lines[i]}\n`;
            }
        }
    });
    fs.writeFileSync('./krok_full_context_matches.txt', output, 'utf8');
    console.log(`Success! Found ${matchedCount} lines containing 'krok'. Written to ./krok_full_context_matches.txt`);
} else {
    console.log("File not found.");
}
