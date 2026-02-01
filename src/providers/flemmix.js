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
    console.log(`[Flemmix] Navigation vers recherche: ${query}`);
    await page.goto(`https://flemmix.irish/?s=${encodeURIComponent(query)}`);
    
    // Attente intelligente : soit les résultats, soit le message "aucun résultat"
    try {
        await page.waitForFunction(() => {
            // Si Cloudflare est là
            if (document.title.includes('Just a moment') || document.title.includes('Un instant')) return false;
            // Si la page est chargée (présence de body)
            return !!document.body;
        }, { timeout: 15000 });
    } catch (e) {
        console.log("Timeout waiting for page load, continuing anyway to inspect DOM...");
    }

    // Extraction générique
    return await page.evaluate(() => {
        const items = [];
        // Sélecteurs larges pour attraper n'importe quel type de grille de résultats WordPress
        const candidates = document.querySelectorAll('article, .result-item, .movie-poster, .item, .post');
        
        candidates.forEach(el => {
            const link = el.querySelector('a');
            const img = el.querySelector('img');
            // Essayer plusieurs endroits pour le titre
            const titleEl = el.querySelector('h1, h2, h3, .title, .name'); 
            
            if (link && titleEl) {
                let imgUrl = img ? (img.getAttribute('data-src') || img.src) : null;
                
                items.push({
                    title: titleEl.innerText.trim(),
                    slug: link.href, // URL complète
                    image: imgUrl,
                    url: link.href
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
    
    // Injection de script pour masquer webdriver (Anti-detection supplémentaire)
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });
    });

    const page = await context.newPage();

    try {
        // 1. Essai Recherche Exacte
        let results = await performSearch(page, query);

        // 2. Si 0 résultat, on tente une recherche Google ciblée (Fallback)
        if (results.length === 0) {
            console.log(`[Flemmix] Recherche interne vide. Tentative via Google...`);
            await page.goto(`https://www.google.com/search?q=site:flemmix.irish+${encodeURIComponent(query)}`);
            await page.waitForTimeout(2000); // Attente chargement Google

            // Extraction résultats Google
            const googleResults = await page.evaluate(() => {
                const items = [];
                // Sélecteurs Google standards (peuvent changer, mais souvent stables pour les titres/liens)
                const gElements = document.querySelectorAll('.g'); // Classe générique des résultats
                
                gElements.forEach(el => {
                    const link = el.querySelector('a');
                    const title = el.querySelector('h3');
                    
                    if (link && title && link.href.includes('flemmix.irish')) {
                        items.push({
                            title: title.innerText.replace(' - Flemmix', '').trim(),
                            slug: link.href,
                            image: null, // Google ne donne pas facilement l'image
                            url: link.href
                        });
                    }
                });
                return items;
            });
            
            results = googleResults;
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
                if (src && !src.includes('google') && !src.includes('facebook') && !src.includes('cloudflare')) {
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
