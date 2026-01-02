const linkedin = require('./linkedin');
const outreach = require('./outreach');
const browser = require('./browser');
const db = require('../db');

async function runDailyRoutine(keywords, username, password) {
    try {
        console.log('Starting daily routine...');
        await browser.startBrowser(false); // Headed for now to see what's happening
        db.initDB();

        // 1. Login
        await linkedin.login(username, password);

        // 2. Scrape (if we need more leads)
        // Check if we have enough 'new' leads
        // For demo, we always scrape a little to get fresh data
        console.log(`Scraping for: ${keywords}...`);
        await linkedin.searchAndCollect(keywords, 1); // Scrape 1 page

        // 3. Outreach
        const newLeads = db.db.prepare("SELECT * FROM leads WHERE status = 'new' LIMIT 50").all();
        console.log(`Found ${newLeads.length} new leads to process.`);

        let actionsPerformed = 0;
        const limit = parseInt(db.db.prepare("SELECT value FROM settings WHERE key='daily_action_limit'").get().value);

        for (const lead of newLeads) {
            const currentCount = db.getDailyActionCount();
            if (currentCount >= limit) {
                console.log('Daily limit reached (workflow). Stopping.');
                break;
            }

            const success = await outreach.sendConnectionRequest(lead);
            if (success) {
                actionsPerformed++;
            }

            // Extra safety delay between leads
            await new Promise(r => setTimeout(r, 60000 + Math.random() * 60000)); // 1-2 mins
        }

        console.log(`Daily routine finished. Actions: ${actionsPerformed}`);

    } catch (error) {
        console.error('Workflow error:', error);
    } finally {
        await browser.closeBrowser();
    }
}

module.exports = { runDailyRoutine };
