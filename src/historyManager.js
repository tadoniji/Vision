const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, '../data/history.json');
const PROGRESS_FILE = path.join(__dirname, '../data/progress.json');

// Initialiser les fichiers si inexistants
if (!fs.existsSync(path.dirname(HISTORY_FILE))) {
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
}

if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));
}
if (!fs.existsSync(PROGRESS_FILE)) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify({}));
}

function getHistory() {
    try {
        const data = fs.readFileSync(HISTORY_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

function getProgress() {
    try {
        const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return {};
    }
}

function addToHistory(item) {
    const history = getHistory();
    const entry = {
        ...item,
        timestamp: new Date().toISOString()
    };

    // Historique linéaire
    history.unshift(entry); // Ajouter au début
    if (history.length > 100) history.pop(); // Garder 100 max

    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
    } catch (e) {
        console.error("Erreur écriture historique:", e);
    }

    // Mise à jour de la progression (Dernier épisode vu)
    if (item.tmdbId) {
        const progress = getProgress();
        progress[item.tmdbId] = {
            season: item.season,
            episode: item.episode,
            timestamp: new Date().toISOString(),
            slug: item.slug,
            title: item.title
        };
        try {
            fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
        } catch (e) {
             console.error("Erreur écriture progression:", e);
        }
    }

    return true;
}

function getLastWatched(tmdbId) {
    const progress = getProgress();
    return progress[tmdbId] || null;
}

module.exports = { getHistory, addToHistory, getLastWatched, getProgress };
