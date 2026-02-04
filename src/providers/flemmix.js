const { chromium } = require('playwright');

// Configuration Stealth pour passer Cloudflare en mode Headless (Invisible)
const BROWSER_ARGS = [
    '--disable-blink-features=AutomationControlled', // Cache le flag "robot"
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
        headless: true, // RETOUR À L'INVISIBLE
        args: BROWSER_ARGS
    });
}

// Fonction utilitaire pour nettoyer les résultats
function cleanTitle(text) {
    return text.replace(/\n/g, ' ').trim();
}

async function performSearch(page, query) {
    console.log(`[Flemmix] Navigation vers l'accueil pour recherche POST: ${query}`);
    await page.goto('https://flemmix.irish/');
    
    // Attente du champ de recherche
    try {
        await page.waitForSelector('input[name="story"]', { timeout: 15000 });
    } catch (e) {
        console.log("Champ de recherche non trouvé (Cloudflare ou structure changée?)");
        return [];
    }

    // Remplissage et soumission
    await page.fill('input[name="story"]', query);
    await page.press('input[name="story"]', 'Enter');
    
    // Attente des résultats
    console.log("[Flemmix] Attente des résultats...");
    await page.waitForLoadState('networkidle'); 

    // Extraction générique
    return await page.evaluate(() => {
        const items = [];
        // Sélecteurs larges pour attraper n'importe quel type de grille de résultats
        // Sur DLE (DataLife Engine, que ce site semble utiliser), c'est souvent .short-story ou .movie
        const candidates = document.querySelectorAll('article, .result-item, .movie-poster, .item, .post, .short-story, .short');
        
        candidates.forEach(el => {
            const link = el.querySelector('a');
            const img = el.querySelector('img');
            // Essayer plusieurs endroits pour le titre
            const titleEl = el.querySelector('h1, h2, h3, .title, .name, .poster-title'); 
            
            if (link && titleEl) {
                let imgUrl = img ? (img.getAttribute('data-src') || img.src) : null;
                
                // Correction URL relative
                let href = link.href;
                if (!href.startsWith('http')) {
                    href = window.location.origin + href;
                }

                items.push({
                    title: titleEl.innerText.trim(),
                    slug: href, // URL complète
                    image: imgUrl,
                    url: href
                });
            }
        });
        return items;
    });
}

async function searchAnime(query) {
    console.log(`[Flemmix (Stealth)] Searching for: ${query}`);
    const browser = await getBrowser();
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        locale: 'fr-FR',
        timezoneId: 'Europe/Paris'
    });
    
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });
    });

    const page = await context.newPage();

    try {
        // Recherche via le formulaire
        let results = await performSearch(page, query);

        // Si 0 résultat et que la query a plusieurs mots, on essaie avec le dernier mot
        if (results.length === 0 && query.includes(' ')) {
            const words = query.split(' ');
            const simpleQuery = words[words.length - 1]; // "Lorax"
            if (simpleQuery.length > 3) {
                console.log(`[Flemmix] Aucun résultat exact. Tentative avec : "${simpleQuery}"`);
                results = await performSearch(page, simpleQuery);
            }
        }

        console.log(`[Flemmix] Found ${results.length} results.`);
        return results;

    } catch (e) {
        console.error("Error in Flemmix search:", e);
        return [];
    } finally {
        await browser.close();
    }
}

async function fetchEpisodes(url) {
    console.log(`[Flemmix (Stealth)] Fetching episodes for: ${url}`);
    
    if (!url.startsWith('http')) {
        url = `https://flemmix.irish/${decodeURIComponent(url)}`;
    } else {
        url = decodeURIComponent(url);
    }

    const browser = await getBrowser();
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        await page.goto(url);
        
        // Gestion Cloudflare éventuelle
        try {
            await page.waitForFunction(() => !document.title.includes('Just a moment') && !document.title.includes('Un instant'), { timeout: 10000 });
        } catch(e) {}
        
        await page.waitForTimeout(2000);

        // Extraction ciblée des lecteurs
        const episodes = await page.evaluate(() => {
            const eps = [];
            
            // 1. Chercher les Iframes dans les boites vidéos identifiées (.video-box, .entry-content)
            const iframes = Array.from(document.querySelectorAll('.video-box iframe, .entry-content iframe, iframe'));
            
            iframes.forEach((iframe, index) => {
                const src = iframe.getAttribute('data-src') || iframe.src;
                
                // Filtrage
                if (src && !src.includes('google') && !src.includes('facebook') && !src.includes('cloudflare') && !src.includes('youtube') && !src.includes('youtu.be')) {
                    eps.push({
                        season: "Film/Série",
                        episode: index + 1,
                        type: "VF/VOSTFR",
                        providers: [{ name: "Lecteur " + (index + 1), url: src }]
                    });
                }
            });

            return eps;
        });

        return episodes;

    } catch (e) {
        console.error("Error fetching episodes Flemmix:", e);
        return [];
    } finally {
        await browser.close();
    }
}

module.exports = { searchAnime, fetchEpisodes };
