const fs = require('fs');

const file = './krok_matches.txt';
if (fs.existsSync(file)) {
    const data = fs.readFileSync(file, 'utf8');
    console.log(`Successfully read ${file}. Total length: ${data.length} characters.`);
    
    // Let's search for "krok" or similar in krok_matches.txt
    const searchTerms = ['krok', 'Krok', 'Refaktoring', 'refaktoring', 'faza', 'fáza'];
    searchTerms.forEach(term => {
        let count = 0;
        let pos = data.indexOf(term);
        while (pos !== -1) {
            count++;
            pos = data.indexOf(term, pos + 1);
        }
        console.log(`Term "${term}" found ${count} times.`);
    });
    
    // Let's print occurrences with context
    const lines = data.split('\n');
    console.log(`Total lines: ${lines.length}`);
    lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('krok') || line.toLowerCase().includes('faza') || line.toLowerCase().includes('fáza') || line.toLowerCase().includes('refaktor')) {
            if (line.length < 500) {
                console.log(`Line ${idx + 1}: ${line}`);
            }
        }
    });
} else {
    console.log("File not found.");
}
