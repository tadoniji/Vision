const { chromium } = require('playwright');
const tmdb = require('../services/tmdb');

const BROWSER_ARGS = [
    '--disable-blink-features=AutomationControlled',
// ... (reste du code inchangé jusqu'à la fin du try catch de recherche)

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
