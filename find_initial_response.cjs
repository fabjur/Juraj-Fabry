const fs = require('fs');

const file1 = './migrated_prompt_history/prompt_2026-01-18T15:52:35.057Z.json';
if (fs.existsSync(file1)) {
    const data = JSON.parse(fs.readFileSync(file1, 'utf8'));
    console.log("Searching for Salesapp and Prompt Manager original response...");
    data.forEach((m, idx) => {
        if (m.payload && m.payload.text) {
            const text = m.payload.text;
            if (text.toLowerCase().includes('nadstavba salesapp') || text.toLowerCase().includes('specificke prompty pre specificke')) {
                console.log(`\n=== FOUND MOTHER PROMPT IN MSG ${idx} (ID: ${m.id}, Author: ${m.author}) ===`);
                console.log(text.substring(0, 1500));
                
                // Now find the model's reply (next messages)
                let replyIdx = idx + 1;
                while (replyIdx < data.length && data[replyIdx].author !== 'user') {
                    const reply = data[replyIdx];
                    console.log(`\n--- REPLY MSG ${replyIdx} (ID: ${reply.id}, Author: ${reply.author}) ---`);
                    console.log(reply.payload && reply.payload.text ? reply.payload.text.substring(0, 4000) : "No text payload");
                    replyIdx++;
                }
                console.log("\n" + "=".repeat(70) + "\n");
            }
        }
    });
} else {
    console.log("File 1 not found.");
}
