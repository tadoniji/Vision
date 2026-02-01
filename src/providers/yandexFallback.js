const { chromium } = require('playwright');

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
    console.log(`[Yandex Fallback] Searching for: ${query} stream libre`);
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
            return extracted.slice(0, 10); // On en prend un peu plus comme on filtre
        });

        results.push(...items);
        console.log(`[Yandex] Found ${results.length} results.`);

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
    
    // Décodage si nécessaire
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
        await page.waitForTimeout(3000); // Laisser les pubs/scripts se charger

        const episodes = await page.evaluate(() => {
            const eps = [];
            // Chercher toutes les iframes et vidéos
            const iframes = document.querySelectorAll('iframe');
            const videos = document.querySelectorAll('video');

            // Traitement IFrames
            iframes.forEach((iframe, i) => {
                let src = iframe.src || iframe.getAttribute('data-src');
                
                if (src && src.startsWith('http')) {
                    try {
                        const urlObj = new URL(src);
                        // Filtre: Ignorer les domaines racines (ex: https://uptobox.com/) sans slug
                        const isRoot = urlObj.pathname === '/' || urlObj.pathname === '';
                        // Filtre: Pubs/Trackers connus
                        const isAd = src.includes('google') || src.includes('facebook') || src.includes('amazon') || src.includes('cloudflare');

                        if (!isRoot && !isAd) {
                            eps.push({
                                season: "Source Externe",
                                episode: i + 1,
                                type: "Unknown",
                                providers: [{ name: `Stream ${i+1} (Iframe)`, url: src }]
                            });
                        }
                    } catch (e) {
                        // URL invalide, on ignore
                    }
                }
            });

            // Traitement Videos Directes
            videos.forEach((video, i) => {
                let src = video.src || video.currentSrc;
                if (src && src.startsWith('http')) {
                     try {
                        const urlObj = new URL(src);
                        const isRoot = urlObj.pathname === '/' || urlObj.pathname === '';
                        
                        if (!isRoot) {
                            eps.push({
                                season: "Source Externe",
                                episode: i + 1 + iframes.length,
                                type: "Direct",
                                providers: [{ name: `Stream ${i+1} (Video)`, url: src }]
                            });
                        }
                    } catch (e) {}
                }
            });

            return eps;
        });

        console.log(`[Yandex] Extracted ${episodes.length} streams from ${url}`);
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
