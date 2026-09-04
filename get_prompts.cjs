const fs = require('fs');

const file2 = './migrated_prompt_history/prompt_2026-01-18T16:13:52.401Z.json';
const data = JSON.parse(fs.readFileSync(file2, 'utf8'));

console.log(`Number of messages in File 2: ${data.length}`);

const userMessages = data.filter(m => m.author === 'user');
console.log(`Number of user messages in File 2: ${userMessages.length}`);

userMessages.forEach((m, idx) => {
    console.log(`\n--- USER MESSAGE ${idx} (ID: ${m.id}) ---`);
    if (m.payload && m.payload.text) {
        console.log(m.payload.text.substring(0, 1000));
    }
});
