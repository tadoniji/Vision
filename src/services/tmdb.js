const axios = require('axios');
const cheerio = require('cheerio');

const TMDB_URL = 'https://www.themoviedb.org';

async function getPoster(query) {
    // Nettoyage du titre (enlève [Ext], les années entre parenthèses, etc pour optimiser la recherche)
    const cleanQuery = query
        .replace(/\[Ext\]/g, '')
        .replace(/\(\d{4}\)/g, '') // Enlever l'année ex: (2023)
        .replace(/saison \d+/i, '')
        .replace(/season \d+/i, '')
        .trim();

    try {
        const searchUrl = `${TMDB_URL}/search?query=${encodeURIComponent(cleanQuery)}`;
        
        const { data } = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        const $ = cheerio.load(data);
        
        // Sélecteur pour la première affiche de résultat
        const imageEl = $('.card .image img').first();
        let src = imageEl.attr('data-src') || imageEl.attr('src');

        if (src) {
            // TMDB met souvent des urls relatives ou vides
            if (!src.startsWith('http')) {
                src = `${TMDB_URL}${src}`;
            }
            // Remplacer la taille 'w94_and_h141_bestv2' par une meilleure qualité 'w600_and_h900_bestv2'
            return src.replace('w94_and_h141_bestv2', 'w600_and_h900_bestv2');
        }

    } catch (e) {
        // En cas d'erreur ou pas de résultat, on retourne null
        // console.error(`Erreur TMDB pour ${cleanQuery}:`, e.message);
    }
    
    return null;
}

module.exports = { getPoster };
