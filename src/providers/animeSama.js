const axios = require('axios');
const cheerio = require('cheerio');
const vm = require('vm');

const BASE_URL = 'https://anime-sama.si';

async function fetchEpisodes(slug) {
    const catalogueUrl = `${BASE_URL}/catalogue/${slug}/`;
    console.log(`[AnimeSama] Fetching catalogue: ${catalogueUrl}`);

    try {
        const { data: catalogueHtml } = await axios.get(catalogueUrl);
        const $ = cheerio.load(catalogueHtml);

        const seasons = [];
        
        // Extract "panneauAnime" calls to find seasons/versions
        // Look for scripts containing "panneauAnime"
        $('script').each((i, el) => {
            const scriptContent = $(el).html();
            if (scriptContent && scriptContent.includes('panneauAnime')) {
                // Regex to capture name and url: panneauAnime("Name", "url")
                // Handling both single and double quotes
                const regex = /panneauAnime\s*\(\s*(['"])(.*?)\1\s*,\s*(['"])(.*?)\3\s*\)/g;
                let match;
                while ((match = regex.exec(scriptContent)) !== null) {
                    if (match[2] === "nom" && match[4] === "url") continue;
                    seasons.push({
                        name: match[2],
                        url: match[4]
                    });
                }
            }
        });

        console.log(`[AnimeSama] Found ${seasons.length} seasons/versions.`);
        
        // Fallback: If no seasons found, maybe it's a direct page (Movie or Single Season)
        if (seasons.length === 0) {
             console.log("[AnimeSama] No seasons found, trying direct parsing.");
             // Pseudo-season
             seasons.push({ name: "Unique", url: "" }); 
        }
        
        const allEpisodes = [];
        const episodesMap = new Map();

        for (const season of seasons) {
            // Determine Type (VOSTFR, VF, etc.) from URL
            let type = "VF/VOSTFR"; // Default
            if (season.url) {
                if (season.url.includes("vostfr")) type = "VOSTFR";
                else if (season.url.includes("vf")) type = "VF";
                else if (season.url.includes("kai")) type = "KAI";
            } else {
                // Try to guess from catalogue page title or just keep generic
                if ($('h1').text().toLowerCase().includes('vostfr')) type = "VOSTFR";
                if ($('h1').text().toLowerCase().includes('vf')) type = "VF";
            }
            // ... (rest of logic)
            
            // Construct absolute URL
            // If season.url is empty, use catalogueUrl
            let seasonUrl = catalogueUrl;
            if (season.url) {
                seasonUrl = `${catalogueUrl}${season.url}/`;
            }

            try {
                // If it's the "Unique" case, we already have the HTML (catalogueHtml), but to be safe/consistent with loop, 
                // we can just re-fetch or reuse. Re-fetching is easier for logic flow, but reuse is better.
                // Let's reuse if url is empty.
                
                let $season = $;
                if (season.url) {
                    const { data: seasonHtml } = await axios.get(seasonUrl);
                    $season = cheerio.load(seasonHtml);
                }

                // Find episodes.js script
                let episodesScriptUrl = null;
                $season('script').each((i, el) => {
                    const src = $(el).attr('src');
                    if (src && src.includes('episodes.js')) {
                        episodesScriptUrl = src;
                    }
                });

                if (episodesScriptUrl) {
                    // Resolve relative URL
                    // If src is "episodes.js", it's relative to seasonUrl
                    const absoluteScriptUrl = new URL(episodesScriptUrl, seasonUrl).href;
                    
                    const { data: scriptContent } = await axios.get(absoluteScriptUrl);
                    
                    // Extract arrays eps1, eps2, etc.
                    const context = { eps1: [], eps2: [], eps3: [], eps4: [], eps5: [] }; // Pre-define potential vars
                    try {
                        vm.createContext(context);
                        vm.runInContext(scriptContent, context);
                    } catch (e) {
                        // Fallback: Regex extraction if VM fails (e.g., syntax error in file)
                        console.warn("VM execution failed, trying regex");
                    }

                    // Process extracted arrays
                    Object.keys(context).forEach(key => {
                        if (key.startsWith('eps') && Array.isArray(context[key]) && context[key].length > 0) {
                            const urls = context[key];
                            // Detect Provider Name
                            let providerName = "Lecteur " + key.replace('eps', '');
                            const firstUrl = urls[0];
                            if (firstUrl) {
                                if (firstUrl.includes('sibnet')) providerName = "Sibnet";
                                else if (firstUrl.includes('vidmoly')) providerName = "Vidmoly";
                                else if (firstUrl.includes('sendvid')) providerName = "Sendvid";
                                else if (firstUrl.includes('vk.com')) providerName = "VK";
                                else if (firstUrl.includes('myvi')) providerName = "Myvi";
                                else if (firstUrl.includes('streamtape')) providerName = "Streamtape";
                            }

                            urls.forEach((url, index) => {
                                // Filter out YouTube
                                if (url.includes('youtube.com') || url.includes('youtu.be')) return;

                                const epNum = index + 1;
                                const id = `${type}-${season.name}-Ep${epNum}`;
                                
                                if (!episodesMap.has(id)) {
                                    episodesMap.set(id, {
                                        season: season.name,
                                        episode: epNum,
                                        type: type,
                                        providers: []
                                    });
                                }
                                
                                episodesMap.get(id).providers.push({
                                    name: providerName,
                                    url: url
                                });
                            });
                        }
                    });
                }

            } catch (err) {
                console.error(`Error fetching season ${season.name}: ${err.message}`);
            }
        }

        return Array.from(episodesMap.values());

    } catch (error) {
        console.error("Error in fetchEpisodes:", error);
        return [];
    }
}


async function searchAnime(query) {
    const searchUrl = `${BASE_URL}/template-php/defaut/fetch.php`;
    console.log(`[AnimeSama] Searching for: ${query}`);

    try {
        const { data: searchHtml } = await axios.post(searchUrl, 
            new URLSearchParams({ query: query }), // Send as form-urlencoded
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': 'https://anime-sama.si/',
                    'Origin': 'https://anime-sama.si',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            }
        );

        const $ = cheerio.load(searchHtml);
        const results = [];

        $('a').each((i, el) => {
            const url = $(el).attr('href');
            
            // Extract slug from URL: https://anime-sama.si/catalogue/slug/
            // or relative /catalogue/slug/
            let slug = '';
            if (url) {
                const parts = url.split('/').filter(p => p);
                
                // Case 1: /catalogue/slug
                if (parts.includes('catalogue')) {
                    const catIndex = parts.indexOf('catalogue');
                    if (parts[catIndex + 1]) {
                        slug = parts[catIndex + 1];
                    }
                }
            }

            if (slug) {
                const title = $(el).find('h3').text().trim();
                const image = $(el).find('img').attr('src');
                results.push({ title, slug, url, image });
            }
        });

        console.log(`[AnimeSama] Found ${results.length} results.`);
        return results;

    } catch (error) {
        console.error("Error in searchAnime:", error);
        return [];
    }
}

module.exports = { fetchEpisodes, searchAnime };

