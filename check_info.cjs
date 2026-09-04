const fs = require('fs');

const file = './krok_search_results.txt';
if (fs.existsSync(file)) {
    const stats = fs.statSync(file);
    console.log(`File size: ${stats.size} bytes`);
    
    const content = fs.readFileSync(file, 'utf8');
    console.log("First 300 characters of content:");
    console.log(content.substring(0, 300));
} else {
    console.log("File not found.");
}
