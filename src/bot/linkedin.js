const { getPage } = require('./browser');
const db = require('../db');

console.log('-------------------------------------------');
console.log('   LINKEDIN MODULE LOADED: VERSION DEBUG 3.0');
console.log('-------------------------------------------');

const LOGIN_URL = 'https://www.linkedin.com/login';
const FEED_URL = 'https://www.linkedin.com/feed/';

async function login(username, password) {
    const page = await getPage();
    // Increase default timeout to 60s for slow connections
    page.setDefaultNavigationTimeout(60000);

    try {
        await page.goto(FEED_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (e) {
        console.log('Feed load timed out (continuing anyway)...');
    }

    if (page.url().includes('login') || page.url().includes('linkedin.com/home')) {
        console.log('Not logged in. Logging in...');
        await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        await page.waitForSelector('#username');
        await page.humanType('#username', username);
        await page.humanType('#password', password);

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('.btn__primary--large')
        ]);

        // Check for security challenge (2FA / Device Check)
        if (page.url().includes('checkpoint') || page.url().includes('challenge')) {
            console.log('⚠️ Security check detected! Please check your LinkedIn app or email to approve.');
            console.log('Waiting up to 3 minutes for you to solve the challenge...');

            try {
                // Wait until we are redirected to the feed
                await page.waitForFunction(() => window.location.href.includes('/feed'), { timeout: 180000 });
                console.log('Challenge solved! Proceeding...');
            } catch (e) {
                console.error('Timed out waiting for challenge solution.');
                throw new Error('Login failed: Security challenge not solved in time.');
            }
        }

        // Dismiss "Try Premium" or other popups
        try {
            console.log('Checking for popups...');
            await new Promise(r => setTimeout(r, 2000)); // Wait for animations
            const buttons = await page.$$('button[aria-label="Dismiss"], button.artdeco-modal__dismiss');
            for (const btn of buttons) {
                if (await btn.isVisible()) {
                    await btn.click();
                    console.log('Dismissed a popup.');
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
        } catch (e) {
            // Ignore popup errors
        }

        console.log('Logged in successfully.');
    } else {
        console.log('Already logged in (session restored).');
    }
}

async function searchAndCollect(keyword, maxPages = 1) {
    const page = await getPage();
    const encodedKeyword = encodeURIComponent(keyword);
    let leadsFound = 0;

    for (let i = 1; i <= maxPages; i++) {
        // Search People filter
        const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodedKeyword}&page=${i}`;
        console.log(`Scraping page ${i}: ${searchUrl}`);

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

        // Wait for EITHER results OR "No results" message
        try {
            await page.waitForFunction(() => {
                const hasResults = document.querySelectorAll('.reusable-search__result-container, .entity-result__item, ul.search-results__list li, [data-view-name="people-search-result"]').length > 0;
                const hasNoResults = document.body.innerText.includes('No matching results') || document.body.innerText.includes('No results found');
                return hasResults || hasNoResults;
            }, { timeout: 30000 }); // Increased to 30s
        } catch (e) {
            // Fallback: Check one last time in case of race condition
            const hasResultsFallback = await page.evaluate(() => document.querySelectorAll('.reusable-search__result-container, .entity-result__item, ul.search-results__list li, [data-view-name="people-search-result"]').length > 0);

            if (hasResultsFallback) {
                console.log('Results appeared just after timeout. Proceeding...');
            } else {
                console.log(`Timeout waiting for results on ${page.url()}.`);
                const path = require('path');
                const fs = require('fs');

                // 1. Screenshot
                await page.screenshot({ path: path.join(__dirname, '../../public/debug_error.png') });

                // 2. Dump HTML
                const html = await page.content();
                fs.writeFileSync(path.join(__dirname, '../../public/debug_error.html'), html);

                console.log('Saved screenshot to public/debug_error.png');
                console.log('Saved HTML layout to public/debug_error.html');
                break; // Stop loop if timeout
            }
        }

        // Check if "No results"
        const noResults = await page.evaluate(() => document.body.innerText.includes('No matching results') || document.body.innerText.includes('No results found'));
        if (noResults) {
            console.log('LinkedIn says: No matching results found for this query.');
            break;
        }

        // Scroll to trigger lazy load
        await autoScroll(page);

        // Extract profiles with broader selectors
        const profiles = await page.evaluate(() => {
            // Try multiple common selectors for result cards
            // Added [data-view-name="people-search-result"] for randomized class layout
            const cards = document.querySelectorAll('.reusable-search__result-container, .entity-result__item, li.reusable-search__result-container, [data-view-name="people-search-result"]');

            return Array.from(cards).map(card => {
                // Strategy 1: Standard / Old Layout
                let linkAnchor = card.querySelector('a.app-aware-link');
                let nameSpan = card.querySelector('.entity-result__title-text a span[aria-hidden="true"]');
                let jobDiv = card.querySelector('.entity-result__primary-subtitle');
                let locDiv = card.querySelector('.entity-result__secondary-subtitle');

                // Strategy 2: Randomized Classes Layout (using data-view-name)
                if (!linkAnchor) {
                    linkAnchor = card.querySelector('[data-view-name="search-result-lockup-title"]'); // This is often the name link itself
                    // If the link is wrapped, find the closest 'a'
                    if (linkAnchor && linkAnchor.tagName !== 'A') {
                        linkAnchor = linkAnchor.closest('a');
                    }
                }

                // If we still don't have a name span, try the text content of the link
                let fullName = '';
                if (nameSpan) {
                    fullName = nameSpan.innerText.trim();
                } else if (linkAnchor) {
                    // Start with the link text
                    fullName = linkAnchor.innerText.trim();
                    // Clean up "View full profile" or extra screen reader text if present
                    fullName = fullName.split('\n')[0].trim();
                }

                if (!linkAnchor || !fullName) return null;

                // For job/loc in obfuscated mode, we rely on paragraph order or specific attributes if available
                // In the HTML dump, job and location are in <p> tags following the name.
                // We'll try to find generic text nodes if specific classes are missing.
                if (!jobDiv) {
                    // Heuristic: The text immediately after the name is often the job title
                    const allTextLines = card.innerText.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                    // Usually: [Name, Distance, Job, Location, ...]
                    // simple fallback
                    if (allTextLines.length > 2) {
                        // Find the name index
                        const nameIdx = allTextLines.indexOf(fullName);
                        if (nameIdx !== -1 && allTextLines[nameIdx + 2]) { // Skip '2nd' or dot
                            // This is fuzzy, but better than nothing
                            jobDiv = { innerText: allTextLines[nameIdx + 2] || '' };
                            locDiv = { innerText: allTextLines[nameIdx + 3] || '' };
                        }
                    }
                }

                return {
                    linkedin_url: linkAnchor.href.split('?')[0], // Clean URL
                    full_name: fullName,
                    job_title: jobDiv ? jobDiv.innerText.trim() : '',
                    location: locDiv ? locDiv.innerText.trim() : '',
                    bio: '' // Added missing field
                };
            }).filter(p => p !== null);
        });

        console.log(`Found ${profiles.length} profiles on page ${i}`);

        for (const p of profiles) {
            // Split name
            const names = p.full_name.split(' ');
            p.first_name = names[0];
            p.last_name = names.slice(1).join(' ');

            try {
                db.addLead(p);
                leadsFound++;
            } catch (err) {
                // Ignore duplicates
            }
        }

        // Random delay between pages
        await new Promise(r => setTimeout(r, 5000 + Math.random() * 5000));
    }

    return leadsFound;
}

async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight - window.innerHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

module.exports = { login, searchAndCollect };
