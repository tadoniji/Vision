const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, '../data/history.json');

// Initialiser le fichier si inexistant
if (!fs.existsSync(HISTORY_FILE)) {
    if (!fs.existsSync(path.dirname(HISTORY_FILE))) {
        fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));
}

function getHistory() {
    try {
        const data = fs.readFileSync(HISTORY_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error("Erreur lecture historique:", e);
        return [];
    }
}

function addToHistory(item) {
    const history = getHistory();
    const entry = {
        ...item,
        timestamp: new Date().toISOString()
    };

    // Éviter les doublons exacts (même slug, même épisode), on met à jour le timestamp
    const existingIndex = history.findIndex(h => h.slug === item.slug && h.episode === item.episode && h.season === item.season);
    
    if (existingIndex >= 0) {
        history[existingIndex] = entry; // Mise à jour (remonte en haut de liste)
    } else {
        history.push(entry);
    }

    // Garder seulement les 100 derniers
    if (history.length > 100) {
        history.shift(); 
    }

    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
        return true;
    } catch (e) {
        console.error("Erreur écriture historique:", e);
        return false;
    }
}

module.exports = { getHistory, addToHistory };
