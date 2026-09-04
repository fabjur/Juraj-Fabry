const fs = require('fs');

if (fs.existsSync('./krok_user_contexts.txt')) {
    const content = fs.readFileSync('./krok_user_contexts.txt', 'utf8');
    const regex = /krok\s*[-–]?\s*[1-9]/gi;
    let match;
    const matches = [];
    while ((match = regex.exec(content)) !== null) {
        matches.push({ index: match.index, text: match[0] });
    }
    console.log(`Found ${matches.length} regex matches for krok numbers.`);
    matches.slice(0, 50).forEach(m => {
        // extract 150 chars around each match
        const start = Math.max(0, m.index - 100);
        const end = Math.min(content.length, m.index + 200);
        console.log(`\nMatch "${m.text}" at pos ${m.index}:`);
        console.log(content.substring(start, end));
    });
} else {
    console.log("krok_user_contexts.txt not found.");
}
