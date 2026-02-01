const fastify = require('fastify')({ logger: true });
const path = require('path');
const cors = require('@fastify/cors');

// Import Providers
const animeSama = require('./src/providers/animeSama');
const flemmix = require('./src/providers/flemmix');
const yandex = require('./src/providers/yandexFallback');

const PROVIDERS = {
    'anime-sama': animeSama,
    'flemmix': flemmix,
    'yandex': yandex
};

// Activer CORS
fastify.register(cors);

// Servir les fichiers statiques
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  prefix: '/', 
});

// Route API : Recherche Multi-Sources
fastify.post('/api/search', async (request, reply) => {
  const { query } = request.body;
  if (!query) return reply.status(400).send({ error: "Query manquante" });

  try {
    // 1. Lancer les recherches standards en parallèle
    const standardProviders = { 'anime-sama': animeSama, 'flemmix': flemmix };
    const promises = Object.entries(standardProviders).map(async ([name, provider]) => {
        try {
            const results = await provider.searchAnime(query);
            return results.map(r => ({ ...r, provider: name }));
        } catch (e) {
            console.error(`Erreur provider ${name}:`, e.message);
            return [];
        }
    });

    const resultsArray = await Promise.all(promises);
    let flattenedResults = resultsArray.flat();

    // 2. Fallback Yandex si aucun résultat
    if (flattenedResults.length === 0) {
        console.log("Aucun résultat interne. Lancement du Fallback Yandex...");
        try {
            const yandexResults = await yandex.searchAnime(query);
            const taggedYandex = yandexResults.map(r => ({ ...r, provider: 'yandex' }));
            flattenedResults = flattenedResults.concat(taggedYandex);
        } catch (e) {
            console.error("Erreur Yandex:", e);
        }
    }

    return { results: flattenedResults };

  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: "Erreur lors de la recherche globale" });
  }
});

// Route API : Récupérer les épisodes d'un provider spécifique
fastify.get('/api/anime/:provider/:slug', async (request, reply) => {
  const { provider, slug } = request.params;
  
  if (!PROVIDERS[provider]) {
      return reply.status(404).send({ error: "Provider inconnu" });
  }

  try {
    console.log(`Extraction via ${provider} pour : ${slug}`);
    const episodes = await PROVIDERS[provider].fetchEpisodes(slug);
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
