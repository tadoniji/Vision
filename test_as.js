
const animeSama = require('./src/providers/animeSama');

async function test() {
    console.log("Testing AnimeSama search...");
    try {
        const start = Date.now();
        const results = await animeSama.searchAnime("one piece");
        const duration = (Date.now() - start) / 1000;
        console.log(`Results found: ${results.length} in ${duration}s`);
        if (results.length > 0) {
            console.log("First result:", results[0]);
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

test();
