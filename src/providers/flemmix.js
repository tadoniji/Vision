const { chromium } = require('playwright');

let browserInstance = null;

async function getBrowser() {
    if (!browserInstance) {
        browserInstance = await chromium.launch({ 
            headless: false, // Nécessaire pour passer Cloudflare souvent
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
    }
    return browserInstance;
}

async function searchAnime(query) {
    console.log(`[Flemmix (Playwright)] Searching for: ${query}`);
    const browser = await getBrowser();
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        // Recherche directe via URL parameter
        await page.goto(`https://flemmix.irish/?s=${encodeURIComponent(query)}`);
        
        // Attente de sécurité (Cloudflare / Chargement)
        // On attend que le titre ne soit plus "Just a moment..." ou "Un instant..."
        await page.waitForFunction(() => !document.title.includes('Just a moment') && !document.title.includes('Un instant'), { timeout: 30000 });
        await page.waitForTimeout(2000); // Petite pause pour le rendu JS

        // Extraction des résultats
        // On cherche des conteneurs qui ont une image et un titre
        const results = await page.evaluate(() => {
            const items = [];
            // Selecteurs génériques basés sur l'observation courante des sites de streaming WP
            // Souvent article, .result-item, .movie, .tvshows
            const elements = document.querySelectorAll('article, .result-item, .item');
            
            elements.forEach(el => {
                const link = el.querySelector('a');
                const img = el.querySelector('img');
                const title = el.querySelector('h1, h2, h3, .title');

                if (link && title) {
                    items.push({
                        title: title.innerText.trim(),
                        slug: link.href, // On garde l'URL complète pour simplifier
                        image: img ? img.src : null,
                        url: link.href
                    });
                }
            });
            return items;
        });

        console.log(`[Flemmix] Found ${results.length} results.`);
        return results;

    } catch (e) {
        console.error("Error in Flemmix search:", e);
        return [];
    } finally {
        await page.close();
    }
}

async function fetchEpisodes(url) {
    console.log(`[Flemmix (Playwright)] Fetching episodes for: ${url}`);
    
    // Si l'URL n'est pas complète (cas d'un slug partiel), on tente de la reconstruire, 
    // mais ici on s'attend à recevoir l'URL complète du searchAnime
    if (!url.startsWith('http')) {
        url = `https://flemmix.irish/${url}`;
    }

    const browser = await getBrowser();
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        await page.goto(url);
        await page.waitForFunction(() => !document.title.includes('Just a moment') && !document.title.includes('Un instant'), { timeout: 30000 });
        await page.waitForTimeout(2000);

        // Extraction des lecteurs (IFrames souvent)
        const episodes = await page.evaluate(() => {
            const eps = [];
            
            // Cas Film ou Episode unique sur la page
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach((iframe, index) => {
                const src = iframe.src;
                if (src && !src.includes('google') && !src.includes('facebook')) {
                    eps.push({
                        season: "Film/Série",
                        episode: index + 1,
                        type: "VF/VOSTFR", // Difficile à déterminer auto
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
        await page.close();
    }
}

module.exports = { searchAnime, fetchEpisodes };