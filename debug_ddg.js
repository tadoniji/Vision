const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    const query = 'flemmix lorax';
    console.log(`Testing DDG for: ${query}`);

    await page.goto(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
    
    await page.waitForTimeout(2000);

    const results = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.result__a')).map(a => ({
            title: a.innerText,
            href: a.href
        }));
    });

    console.log(`Found ${results.length} results.`);
    console.log(results);

    await browser.close();
})();
