const fs = require('fs');
const path = require('path');

const NOTES_FILE = path.join(__dirname, '../data/notes.json');

// Ensure directory exists
if (!fs.existsSync(path.dirname(NOTES_FILE))) {
    fs.mkdirSync(path.dirname(NOTES_FILE), { recursive: true });
}

if (!fs.existsSync(NOTES_FILE)) {
    fs.writeFileSync(NOTES_FILE, JSON.stringify({ content: "" }));
}

function getNotes() {
    try {
        const data = fs.readFileSync(NOTES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { content: "" };
    }
}

function saveNotes(content) {
    try {
        fs.writeFileSync(NOTES_FILE, JSON.stringify({ content }));
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = { getNotes, saveNotes };
