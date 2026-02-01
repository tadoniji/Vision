const { chromium } = require('playwright');

const BROWSER_ARGS = [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certifcate-errors',
    '--ignore-certifcate-errors-spki-list',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

(async () => {
  console.log('Launching browser (Stealth)...');
  const browser = await chromium.launch({ headless: false, args: BROWSER_ARGS });
  const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  const page = await context.newPage();
  
  console.log('Navigating to https://flemmix.irish/');
  await page.goto('https://flemmix.irish/');
  
  await page.waitForTimeout(5000); 
  
  const title = await page.title();
  console.log('Page Title:', title);
  
  // Find Search Form
  const form = await page.$('form');
  if (form) {
      console.log('Form found!');
      const html = await form.evaluate(el => el.outerHTML);
      console.log(html);
  } else {
      console.log("No form found.");
  }

  await browser.close();
})();
