require('./src/logger'); // Init Logger first
const fastify = require('fastify')({ logger: true });
const path = require('path');
const fs = require('fs');
const cors = require('@fastify/cors');

// Import Providers
const animeSama = require('./src/providers/animeSama');
const flemmix = require('./src/providers/flemmix');
const yandex = require('./src/providers/yandexFallback');

// Managers & Services
const { getHistory, addToHistory, getProgress } = require('./src/historyManager');
const { getNotes, saveNotes } = require('./src/notepadManager');
const tmdbService = require('./src/services/tmdb');

const SYSTEM_PROVIDERS = {
    'anime-sama': animeSama,
    'flemmix': flemmix,
    'yandex': yandex
};

const CONFIG_PATH = path.join(__dirname, 'data', 'config.json');

// Helper Config
function getConfig() {
    if (!fs.existsSync(CONFIG_PATH)) return { providers: [], tmdbApiKey: "" };
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    if (!config.tmdbApiKey) config.tmdbApiKey = "";
    return config;
}

function saveConfig(config) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 4));
}

// Activer CORS
fastify.register(cors);

// Servir les fichiers statiques
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/', 
});

// Route API : Config (Lecture)
fastify.get('/api/config', async (request, reply) => {
    return getConfig();
});

// Route API : Config (Écriture)
fastify.post('/api/config', async (request, reply) => {
    const newConfig = request.body;
    saveConfig(newConfig);
    return { success: true };
});

// --- TMDB ROUTES ---

fastify.get('/api/tmdb/search', async (request, reply) => {
    const { query } = request.query;
    const config = getConfig();
    if (!config.tmdbApiKey) return { error: "Clé API TMDB manquante" };
    
    return await tmdbService.searchMulti(query, config.tmdbApiKey);
});

fastify.get('/api/tmdb/details/:type/:id', async (request, reply) => {
    const { type, id } = request.params;
    const config = getConfig();
    if (!config.tmdbApiKey) return { error: "Clé API TMDB manquante" };

    return await tmdbService.getDetails(type, id, config.tmdbApiKey);
});

fastify.get('/api/tmdb/season/:id/:season', async (request, reply) => {
    const { id, season } = request.params;
    const config = getConfig();
    if (!config.tmdbApiKey) return { error: "Clé API TMDB manquante" };

    return await tmdbService.getSeason(id, season, config.tmdbApiKey);
});

fastify.get('/api/tmdb/trending', async (request, reply) => {
    const config = getConfig();
    if (!config.tmdbApiKey) return [];
    return await tmdbService.getTrending(config.tmdbApiKey);
});

fastify.get('/api/tmdb/popular/:type', async (request, reply) => {
    const { type } = request.params;
    const config = getConfig();
    if (!config.tmdbApiKey) return [];
    return await tmdbService.getPopular(type, config.tmdbApiKey);
});

// --- NOTEPAD ROUTES ---

fastify.get('/api/notes', async (request, reply) => {
    return getNotes();
});

fastify.post('/api/notes', async (request, reply) => {
    const { content } = request.body;
    saveNotes(content);
    return { success: true };
});

// --- HISTORY ROUTES ---

fastify.get('/api/history', async (request, reply) => {
    return getHistory();
});

fastify.get('/api/progress', async (request, reply) => {
    return getProgress();
});

fastify.post('/api/history', async (request, reply) => {
    const entry = request.body;
    // Entry needs: slug (title), episode, season, tmdbId (optional but recommended now)
    if (!entry || !entry.title) {
        return reply.status(400).send({ error: "Données incomplètes" });
    }
    
    addToHistory(entry);
    return { success: true };
});

// --- SOURCES ROUTES (The "Play" action) ---

// Cherche des sources pour une requête spécifique (ex: "One Piece S1 E1") sur tous les providers
fastify.post('/api/sources', async (request, reply) => {
    const { query } = request.body;
    if (!query) return reply.status(400).send({ error: "Query manquante" });

    const config = getConfig();
    const activeProviders = config.providers.filter(p => p.enabled);
    
    // On lance la recherche en parallèle sur tous les providers actifs
    const promises = activeProviders.map(async (providerConfig) => {
        try {
            let results = [];
            if (providerConfig.type === 'scraper' && SYSTEM_PROVIDERS[providerConfig.id]) {
                // Pour les sources, on utilise searchAnime des providers existants
                // Note: La plupart des providers retournent une liste d'anime/films, pas directement l'épisode.
                // C'est une limitation ici : on cherche le titre, et l'utilisateur devra peut-être recliquer.
                // MAIS, le but est de trouver le lien direct si possible.
                // Simplification pour ce prototype : On retourne les résultats de recherche du provider.
                // L'utilisateur cliquera sur le bon résultat provider pour lancer le player existant.
                results = await SYSTEM_PROVIDERS[providerConfig.id].searchAnime(query);
            } else if (providerConfig.type === 'custom') {
                const searchUrl = providerConfig.url.replace('{query}', encodeURIComponent(query));
                results = [{
                    title: `Rechercher sur ${providerConfig.name}`,
                    slug: 'external-link',
                    image: 'https://via.placeholder.com/200x300?text=External',
                    url: searchUrl,
                    provider: providerConfig.id,
                    providerName: providerConfig.name,
                    isExternal: true
                }];
            }
            
            // Standardize results
            return results.map(r => ({ ...r, provider: providerConfig.id, providerName: providerConfig.name }));

        } catch (e) {
            console.error(`Erreur source ${providerConfig.name}:`, e.message);
            return [];
        }
    });

    const resultsArrays = await Promise.all(promises);
    const flatResults = resultsArrays.flat();

    return { results: flatResults };
});

// Route Legacy : Récupérer les épisodes d'un provider spécifique (utilisé quand on clique sur un résultat provider)
fastify.get('/api/anime/:provider/:slug', async (request, reply) => {
  const { provider, slug } = request.params;
  
  if (!SYSTEM_PROVIDERS[provider]) {
      return reply.status(404).send({ error: "Scraper interne inconnu" });
  }

  try {
    // console.log(`Extraction via ${provider} pour : ${slug}`);
    const episodes = await SYSTEM_PROVIDERS[provider].fetchEpisodes(slug);
    return { count: episodes.length, results: episodes };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: "Erreur lors du scraping" });
  }
});


// Lancer le serveur
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Serveur Vision lancé sur http://localhost:3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();