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
        await page.waitForTimeout(3000); 

        const episodes = await page.evaluate(() => {
            const eps = [];
            const baseUrl = window.location.origin;

            // Helper pour absolu
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
            // On cherche des liens qui contiennent "episode", "ep ", "e01", etc.
            const links = document.querySelectorAll('a');
            let currentSeason = "Saison Inconnue";
            
            // Regex simplifiée pour détecter une saison dans un titre précédent
            const seasonRegex = /(saison|season)\s*(\d+)/i;

            links.forEach(a => {
                const text = a.innerText.trim();
                const href = toAbs(a.getAttribute('href'));
                
                if (!href || href === window.location.href || href.includes('javascript') || href.includes('#')) return;

                // Est-ce un lien d'épisode ?
                // Ex: "Episode 1", "E1", "1x01"
                const epMatch = text.match(/(?:episode|ep)\s*(\d+)|e(\d+)|(\d+)x(\d+)/i);
                
                if (epMatch) {
                    // Essayer de trouver la saison dans les éléments précédents (h1, h2, h3, ou parent)
                    // C'est une heuristique "Best Effort"
                    let prev = a.parentElement;
                    let foundSeason = null;
                    
                    // Remonter un peu et chercher des headers
                    for(let k=0; k<5; k++) {
                        if(!prev) break;
                        if(prev.previousElementSibling) {
                            const sibText = prev.previousElementSibling.innerText || "";
                            const sMatch = sibText.match(seasonRegex);
                            if(sMatch) {
                                foundSeason = "Saison " + sMatch[2];
                                break;
                            }
                        }
                        prev = prev.parentElement;
                    }
                    
                    // Si on a trouvé une saison proche, on met à jour
                    if(foundSeason) currentSeason = foundSeason;

                    // Numéro épisode
                    const epNum = epMatch[1] || epMatch[2] || epMatch[4];
                    
                    eps.push({
                        season: currentSeason,
                        episode: parseInt(epNum),
                        type: "Lien",
                        providers: [{ name: "Ouvrir Lien", url: href }]
                    });
                }
            });

            return eps;
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
