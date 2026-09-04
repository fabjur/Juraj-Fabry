const fs = require('fs');

const file = './krok_user_contexts.txt';
if (fs.existsSync(file)) {
    const data = fs.readFileSync(file, 'utf8');
    console.log(`Successfully read ${file}. Total length: ${data.length} characters.`);
    
    // Let's search for "krok" or "fáza" or "Krok" or "krok 1" etc.
    const searchTerms = ['krok', 'Krok', 'Refaktor', 'refaktor', 'optimalizácia', 'kategóri', 'progres', 'prompt'];
    searchTerms.forEach(term => {
        let count = 0;
        let pos = data.indexOf(term);
        while (pos !== -1) {
            count++;
            pos = data.indexOf(term, pos + 1);
        }
        console.log(`Term "${term}" found ${count} times.`);
    });
    
    // Let's output any blocks containing "Krok 1", "Krok 2", "Krok 3"
    const lines = data.split('\n');
    console.log(`Total lines in file: ${lines.length}`);
    lines.forEach((line, idx) => {
        if (line.toLowerCase().includes('krok') || line.toLowerCase().includes('kolo') || line.toLowerCase().includes('fáza')) {
            if (line.length < 500) {
                console.log(`Line ${idx + 1}: ${line}`);
            }
        }
    });
} else {
    console.log("File not found.");
}
