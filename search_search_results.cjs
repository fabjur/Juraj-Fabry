const fs = require('fs');

const file = './krok_search_results.txt';
if (fs.existsSync(file)) {
    const data = fs.readFileSync(file, 'utf8');
    const lines = data.split('\n');
    console.log(`Successfully split ${file} into ${lines.length} lines.`);
    
    // Look for lines containing keywords
    const keywords = ['krok', 'krok 1', 'krok 2', 'krok 3', 'step 3', 'refaktoring', 'krokom 1'];
    lines.forEach((line, idx) => {
        const containsKeyword = keywords.some(kw => line.toLowerCase().includes(kw));
        if (containsKeyword) {
            console.log(`\n--- Line ${idx + 1} ---`);
            const start = Math.max(0, idx - 4);
            const end = Math.min(lines.length - 1, idx + 4);
            for (let i = start; i <= end; i++) {
                const marker = (i === idx) ? '>>>' : '   ';
                console.log(`${marker} ${i + 1}: ${lines[i]}`);
            }
        }
    });
} else {
    console.log("File not found.");
}
