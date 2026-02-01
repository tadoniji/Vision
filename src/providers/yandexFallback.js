const { chromium } = require('playwright');
const tmdb = require('../services/tmdb');

const BROWSER_ARGS = [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certifcate-errors',
    '--ignore-certifcate-errors-spki-list',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

async function getBrowser() {
    return await chromium.launch({ 
        headless: true, 
        args: BROWSER_ARGS
    });
}

async function searchAnime(query) {
    console.log(`[Yandex Fallback] Searching for: ${query} stream gratuit`);
    const browser = await getBrowser();
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'fr-FR'
    });
    
    // Anti-detection
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();
    const results = [];

    try {
        // Recherche Yandex (Mots clés optimisés)
        const searchUrl = `https://yandex.com/search/?text=${encodeURIComponent(query + " stream gratuit french")}`;
        await page.goto(searchUrl);
        
        // Attente chargement
        await page.waitForTimeout(2000);

        // Extraction résultats
        const items = await page.evaluate(() => {
            const extracted = [];
            const elements = document.querySelectorAll('.serp-item');
            const REQUIRED_KEYWORDS = ['french', 'stream', 'film', 'movie', 'vostfr', 'vf', 'streaming', 'gratuit', 'complet', 'voir', 'regarder', 'serie', 'anime'];
            
            elements.forEach(el => {
                const titleEl = el.querySelector('h2, .organic__title-wrapper');
                const linkEl = el.querySelector('a.organic__url, a');
                
                if (titleEl && linkEl) {
                    const title = titleEl.innerText.trim();
                    const url = linkEl.href;
                    const lowerText = (title + " " + url).toLowerCase();
                    
                    // Filtrage 1: Exclure Yandex interne
                    const isExternal = url.startsWith('http') && !url.includes('yandex.com') && !url.includes('ya.ru');
                    
                    // Filtrage 2: Pertinence (Doit contenir au moins un mot clé de streaming)
                    const isRelevant = REQUIRED_KEYWORDS.some(k => lowerText.includes(k));

                    if (isExternal && isRelevant) {
                        extracted.push({
                            title: `[Ext] ${title}`,
                            slug: url, 
                            url: url,
                            image: 'https://yastatic.net/s3/home/logos/share/share-logo_ru.png' 
                        });
                    }
                }
            });
            return extracted.slice(0, 10);
        });

        results.push(...items);
        console.log(`[Yandex] Found ${results.length} results.`);

        // Enrichissement avec les images TMDB
        if (results.length > 0) {
            console.log(`[Yandex] Fetching posters from TMDB for ${results.length} items...`);
            await Promise.all(results.map(async (item) => {
                const poster = await tmdb.getPoster(item.title);
                if (poster) {
                    item.image = poster;
                }
            }));
        }

    } catch (e) {
        console.error("[Yandex] Error:", e.message);
    } finally {
        await browser.close();
    }

    return results;
}

// Extracteur Générique : Visite le site et cherche des IFrames/Videos
async function fetchEpisodes(url) {
    console.log(`[Yandex (Generic)] Crawling external site: ${url}`);
    
    if (!url.startsWith('http')) {
        url = decodeURIComponent(url);
    }

    const browser = await getBrowser();
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000); 

        const episodes = await page.evaluate(() => {
            const eps = [];
            const baseUrl = window.location.origin;

            const toAbs = (link) => {
                if (!link) return null;
                if (link.startsWith('http')) return link;
                return baseUrl + (link.startsWith('/') ? '' : '/') + link;
            };

            // 1. Détection des IFrames (Lecteurs déjà présents)
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach((iframe, i) => {
                let src = iframe.src || iframe.getAttribute('data-src');
                if (src && src.startsWith('http')) {
                    try {
                        const urlObj = new URL(src);
                        const isRoot = urlObj.pathname === '/' || urlObj.pathname === '';
                        const isAd = src.includes('google') || src.includes('facebook') || src.includes('amazon') || src.includes('cloudflare');

                        if (!isRoot && !isAd) {
                            eps.push({
                                season: "Lecteur Direct",
                                episode: i + 1,
                                type: "Embed",
                                providers: [{ name: `Lecteur ${i+1} (Page actuelle)`, url: src }]
                            });
                        }
                    } catch(e){}
                }
            });

            // 2. Détection des Liens d'épisodes (Crawling de liste)
            const links = document.querySelectorAll('a');
            const pageTitle = document.title;
            let globalSeason = "Saison Inconnue";
            
            const titleSeasonMatch = pageTitle.match(/(?:saison|season)\s*(\d+)/i);
            if (titleSeasonMatch) globalSeason = "Saison " + titleSeasonMatch[1];

            const seasonRegex = /(saison|season)\s*(\d+)/i;
            const strictEpRegex = /(?:episode|ep|épisode)\s*(\d+)|e(\d+)|(\d+)x(\d+)|s\d+e(\d+)/i;
            const numberRegex = /^(\d{1,3})$/;

            links.forEach(a => {
                const text = a.innerText.trim();
                const titleAttr = a.getAttribute('title') || "";
                const fullText = (text + " " + titleAttr).trim();
                const href = toAbs(a.getAttribute('href'));
                
                if (!href || href === window.location.href || href.includes('javascript') || href.includes('#')) return;

                let epNum = null;
                let currentSeason = globalSeason;

                const epMatch = fullText.match(strictEpRegex);
                if (epMatch) {
                    epNum = epMatch[1] || epMatch[2] || epMatch[4] || epMatch[5];
                } 
                else if (numberRegex.test(text)) {
                    if (href.toLowerCase().match(/episode|ep\.|ep-|\/e\d+/)) {
                        epNum = text;
                    } 
                    else if (a.parentElement.className.match(/episode|saison|season/i)) {
                        epNum = text;
                    }
                    else {
                        epNum = text;
                    }
                }

                if (epNum) {
                    let prev = a.parentElement;
                    let foundSeason = null;
                    for(let k=0; k<3; k++) {
                        if(!prev) break;
                        const sMatch = (prev.innerText || "").match(seasonRegex);
                        if(sMatch) {
                            foundSeason = "Saison " + sMatch[2];
                            break;
                        }
                        prev = prev.parentElement;
                    }
                    if(foundSeason) currentSeason = foundSeason;

                    eps.push({
                        season: currentSeason,
                        episode: parseInt(epNum),
                        type: "Lien",
                        providers: [{ name: "Ouvrir Page Épisode", url: href }]
                    });
                }
            });

            // Nettoyage des doublons (Même URL)
            const uniqueEps = [];
            const seenUrls = new Set();
            eps.forEach(e => {
                const u = e.providers[0].url;
                if(!seenUrls.has(u)) {
                    seenUrls.add(u);
                    uniqueEps.push(e);
                }
            });

            return uniqueEps.sort((a,b) => a.episode - b.episode);
        });

        console.log(`[Yandex] Extracted ${episodes.length} streams/links from ${url}`);
        return episodes;

    } catch (e) {
        console.error("[Yandex] Extract Error:", e.message);
        return [{
            season: "Erreur",
            episode: 0,
            type: "Error",
            providers: [{ name: "Site protégé ou inaccessible", url: url }]
        }];
    } finally {
        await browser.close();
    }
}

module.exports = { searchAnime, fetchEpisodes };
