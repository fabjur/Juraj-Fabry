const fs = require('fs');

const file1 = './migrated_prompt_history/prompt_2026-01-18T15:52:35.057Z.json';
if (fs.existsSync(file1)) {
    const data = JSON.parse(fs.readFileSync(file1, 'utf8'));
    console.log("Searching for Slovak krok references...");
    data.forEach((m, idx) => {
        if (m.payload && m.payload.text) {
            const text = m.payload.text;
            const textLower = text.toLowerCase();
            if (textLower.includes('krokom 1') || textLower.includes('krok 2') || textLower.includes('krok 3') || textLower.includes('kopu promptov') || textLower.includes('kategóri')) {
                console.log(`\n=== MSG ${idx} (ID: ${m.id}, Author: ${m.author}) ===`);
                console.log(text.substring(0, 1000));
                
                // Print the next message as well (which is usually the assistant's reply)
                if (idx + 1 < data.length) {
                    const next = data[idx + 1];
                    console.log(`\n--- NEXT MSG ${idx + 1} (Author: ${next.author}) ---`);
                    console.log(next.payload && next.payload.text ? next.payload.text.substring(0, 1500) : "No text payload");
                }
                console.log("\n" + "=".repeat(60) + "\n");
            }
        }
    });
} else {
    console.log("File 1 not found.");
}
