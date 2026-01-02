const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        const htmlPath = path.join(__dirname, 'public', 'debug_error.html');
        // Use absolute path for file://
        await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

        const profiles = await page.evaluate(() => {
            const cards = document.querySelectorAll('.reusable-search__result-container, .entity-result__item, li.reusable-search__result-container, [data-view-name="people-search-result"]');

            return Array.from(cards).map(card => {
                // Strategy 1: Standard / Old Layout
                let linkAnchor = card.querySelector('a.app-aware-link');
                let nameSpan = card.querySelector('.entity-result__title-text a span[aria-hidden="true"]');
                let jobDiv = card.querySelector('.entity-result__primary-subtitle');
                let locDiv = card.querySelector('.entity-result__secondary-subtitle');

                // Strategy 2: Randomized Classes Layout (using data-view-name)
                if (!linkAnchor) {
                    linkAnchor = card.querySelector('[data-view-name="search-result-lockup-title"]');
                    if (linkAnchor && linkAnchor.tagName !== 'A') {
                        linkAnchor = linkAnchor.closest('a');
                    }
                }

                let fullName = '';
                if (nameSpan) {
                    fullName = nameSpan.innerText.trim();
                } else if (linkAnchor) {
                    fullName = linkAnchor.innerText.trim();
                    fullName = fullName.split('\n')[0].trim();
                }

                if (!linkAnchor || !fullName) return null;

                if (!jobDiv) {
                    const allTextLines = card.innerText.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                    if (allTextLines.length > 2) {
                        const nameIdx = allTextLines.indexOf(fullName);
                        if (nameIdx !== -1 && allTextLines[nameIdx + 2]) {
                            jobDiv = { innerText: allTextLines[nameIdx + 2] || '' };
                            locDiv = { innerText: allTextLines[nameIdx + 3] || '' };
                        }
                    }
                }

                return {
                    linkedin_url: linkAnchor.href.split('?')[0],
                    full_name: fullName,
                    job_title: jobDiv ? jobDiv.innerText.trim() : '',
                    location: locDiv ? locDiv.innerText.trim() : ''
                };
            }).filter(p => p !== null);
        });

        console.log(`Extracted ${profiles.length} profiles.`);
        console.log(JSON.stringify(profiles, null, 2));

        await browser.close();
    } catch (e) {
        console.error(e);
    }
})();
