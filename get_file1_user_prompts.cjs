const fs = require('fs');

const file1 = './migrated_prompt_history/prompt_2026-01-18T15:52:35.057Z.json';
const data = JSON.parse(fs.readFileSync(file1, 'utf8'));

const userMessages = data.filter(m => m.author === 'user');
console.log(`Total user messages in File 1: ${userMessages.length}`);

// Let's write the last 30 user messages to a file
let out = '';
const lastIdx = userMessages.length;
const startIdx = Math.max(0, lastIdx - 40);

userMessages.slice(startIdx, lastIdx).forEach((m, idx) => {
    out += `\n--- USER MESSAGE ${startIdx + idx} (ID: ${m.id}) ---\n`;
    if (m.payload && m.payload.text) {
        out += m.payload.text + '\n';
    }
});

fs.writeFileSync('./user_messages_last.txt', out);
console.log("Wrote last 40 user messages of file 1 to ./user_messages_last.txt");
