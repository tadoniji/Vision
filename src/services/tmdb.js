const axios = require('axios');
const cheerio = require('cheerio');

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_WEB_URL = 'https://www.themoviedb.org';

// Legacy scraper (Fallback)
async function getPoster(query) {
    const cleanQuery = query
        .toLowerCase()
        .replace(/\[ext\]/g, '')
        .replace(/saison \d+/g, '')
        .replace(/season \d+/g, '')
        .replace(/épisode \d+/g, '')
        .replace(/episode \d+/g, '')
        .replace(/\(\d{4}\)/g, '')
        .replace(/(streaming|voir|regarder|gratuit|complet|vf|vostfr|full|hd|fr|french|en ligne)/g, '')
        .replace(/[^a-zA-Z0-9éèàêâôîûùïç\s]/g, ' ')
        .trim();

    const finalQuery = cleanQuery.length > 1 ? cleanQuery : query;

    try {
        const searchUrl = `${TMDB_WEB_URL}/search?query=${encodeURIComponent(finalQuery)}`;
        
        const { data } = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        const $ = cheerio.load(data);
        const imageEl = $('.card .image img').first();
        let src = imageEl.attr('data-src') || imageEl.attr('src');

        if (src) {
            if (!src.startsWith('http')) {
                src = `${TMDB_WEB_URL}${src}`;
            }
            return src.replace('w94_and_h141_bestv2', 'w600_and_h900_bestv2');
        }

    } catch (e) {}
    
    return null;
}

// API Functions
async function searchMulti(query, apiKey) {
    if (!apiKey) return { results: [] };
    try {
        const url = `${TMDB_BASE_URL}/search/multi?api_key=${apiKey}&language=fr-FR&query=${encodeURIComponent(query)}&page=1&include_adult=false`;
        const { data } = await axios.get(url);
        // Filter only movie and tv
        return data.results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
    } catch (error) {
        console.error("TMDB Search Error:", error.message);
        return [];
    }
}

async function getDetails(type, id, apiKey) {
    if (!apiKey) return null;
    try {
        const url = `${TMDB_BASE_URL}/${type}/${id}?api_key=${apiKey}&language=fr-FR`;
        const { data } = await axios.get(url);
        return data;
    } catch (error) {
        console.error(`TMDB Details Error (${type}/${id}):`, error.message);
        return null;
    }
}

async function getSeason(tvId, seasonNumber, apiKey) {
    if (!apiKey) return null;
    try {
        const url = `${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${apiKey}&language=fr-FR`;
        const { data } = await axios.get(url);
        return data;
    } catch (error) {
        console.error(`TMDB Season Error (${tvId}/S${seasonNumber}):`, error.message);
        return null;
    }
}

async function getTrending(apiKey) {
    if (!apiKey) return [];
    try {
        const url = `${TMDB_BASE_URL}/trending/all/week?api_key=${apiKey}&language=fr-FR`;
        const { data } = await axios.get(url);
        return data.results;
    } catch (error) {
        return [];
    }
}

async function getPopular(type, apiKey) {
    if (!apiKey) return [];
    try {
        const url = `${TMDB_BASE_URL}/${type}/popular?api_key=${apiKey}&language=fr-FR&page=1`;
        const { data } = await axios.get(url);
        return data.results.map(r => ({ ...r, media_type: type })); // Force media_type
    } catch (error) {
        return [];
    }
}

// --- AUTH & ACTIONS ---

async function getRequestToken(apiKey) {
    try {
        const { data } = await axios.get(`${TMDB_BASE_URL}/authentication/token/new?api_key=${apiKey}`);
        return data.request_token;
    } catch (e) { return null; }
}

async function createSession(apiKey, requestToken) {
    try {
        const { data } = await axios.post(`${TMDB_BASE_URL}/authentication/session/new?api_key=${apiKey}`, {
            request_token: requestToken
        });
        return data.session_id;
    } catch (e) { return null; }
}

async function rateMedia(type, id, value, sessionId, apiKey) {
    try {
        const url = `${TMDB_BASE_URL}/${type}/${id}/rating?api_key=${apiKey}&session_id=${sessionId}`;
        await axios.post(url, { value: value });
        return true;
    } catch (e) {
        console.error("Rate Error:", e.response ? e.response.data : e.message);
        return false;
    }
}

module.exports = { getPoster, searchMulti, getDetails, getSeason, getTrending, getPopular, getRequestToken, createSession, rateMedia };
