const fs = require('fs');

const file1 = './migrated_prompt_history/prompt_2026-01-18T15:52:35.057Z.json';
if (fs.existsSync(file1)) {
    const data = JSON.parse(fs.readFileSync(file1, 'utf8'));
    console.log("Searching for proposed plan with Step 1-3 descriptions...");
    data.forEach((m, idx) => {
        if (m.payload && m.payload.text) {
            const text = m.payload.text;
            const textLower = text.toLowerCase();
            // Check if the message contains Step 1, Step 2, and Step 3 references together (Slovak 'Krok 1', 'Krok 2', 'Krok 3')
            if (textLower.includes('krok 1') && textLower.includes('krok 2') && textLower.includes('krok 3')) {
                console.log(`\n=== FOUND PLAN IN MSG ${idx} (ID: ${m.id}, Author: ${m.author}) ===`);
                console.log(text.substring(0, 3000));
                console.log("\n=======================================================\n");
            }
        }
    });
} else {
    console.log("File 1 not found.");
}
