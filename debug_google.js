const { chromium } = require('playwright');

(async () => {
    // Headless: false pour voir ce qui se passe
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    const query = 'site:flemmix.irish "lorax"';
    console.log(`Testing Google Search for: ${query}`);

    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
    
    // Pause pour observer
    await page.waitForTimeout(5000);

    // Tentative de détection du bouton cookies
    const button = await page.$('button:has-text("Tout accepter"), button:has-text("Accept all")');
    if (button) {
        console.log("Cookie consent button found!");
    } else {
        console.log("No cookie button found.");
    }

    // Dump des résultats
    const results = await page.$$('.g');
    console.log(`Found ${results.length} results selectors (.g)`);

    await browser.close();
})();
