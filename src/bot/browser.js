const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');

puppeteer.use(StealthPlugin());

let browser;
let page;

async function startBrowser(headless = false) {
    console.log('Starting browser...');
    browser = await puppeteer.launch({
        headless: headless ? "new" : false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certifcate-errors',
            '--ignore-certifcate-errors-spki-list',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1280,800' // Human-like size
        ],
        userDataDir: path.join(__dirname, '../../user_data'), // Persist session/cookies
        defaultViewport: null
    });

    page = await browser.newPage();

    // Randomize User Agent just in case (though Stealth handles this mostly)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Humanize behavior helpers
    page.humanType = async (selector, text) => {
        await page.type(selector, text, { delay: 50 + Math.random() * 100 });
    };

    console.log('Browser started.');
    return { browser, page };
}

async function getPage() {
    if (!page) {
        throw new Error('Browser not started');
    }
    return page;
}

async function closeBrowser() {
    if (browser) {
        await browser.close();
        browser = null;
        page = null;
        console.log('Browser closed.');
    }
}

module.exports = { startBrowser, getPage, closeBrowser };
