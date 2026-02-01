const { fetchEpisodes } = require('./src/providers/animeSama');

(async () => {
    const slug = "one-piece";
    console.log(`Testing fetchEpisodes for slug: ${slug}`);
    
    // Test with a limited run or full run
    const episodes = await fetchEpisodes(slug);
    
    console.log(`Found ${episodes.length} episodes total.`);
    
    if (episodes.length > 0) {
        console.log("Sample Episode:");
        console.log(JSON.stringify(episodes[0], null, 2));
    }
})();
