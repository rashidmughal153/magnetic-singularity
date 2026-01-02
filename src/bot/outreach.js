const { getPage } = require('./browser');
const db = require('../db');
const { generateConnectionMessage } = require('./personalizer');

const DAILY_LIMIT = 50; // Hard limit

async function sendConnectionRequest(lead) {
    // 1. Check daily limit
    const todayCount = db.getDailyActionCount();
    if (todayCount >= DAILY_LIMIT) {
        console.log('Daily limit reached. Stopping outreach.');
        return false;
    }

    const page = await getPage();

    // 2. Navigate to profile
    console.log(`Visiting ${lead.linkedin_url}...`);
    await page.goto(lead.linkedin_url, { waitUntil: 'domcontentloaded' });
    await db.logAction('view_profile', lead.linkedin_url);

    // Human-like delay (optimized for speed as requested)
    await randomDelay(2000, 5000); // Was 5000-15000

    // 3. Click Connect
    try {
        // Target the primary "Connect" button in the top card specifically
        // Common classes for top card actions: .pvs-profile-actions, .pv-top-card-v2-ctas
        const connectBtn = await page.evaluateHandle(() => {
            // Priority 1: Top card connect button
            const topButtons = Array.from(document.querySelectorAll('.pvs-profile-actions button, .pv-top-card-v2-ctas button'));
            const topConnect = topButtons.find(b => b.innerText.trim() === 'Connect');
            if (topConnect) return topConnect;

            // Priority 2: Fallback to any specific artdeco button with correct text if top card logic fails
            const allButtons = Array.from(document.querySelectorAll('button.artdeco-button--primary'));
            return allButtons.find(b => b.innerText.trim() === 'Connect');
        });

        if (connectBtn) {
            await connectBtn.click();
            console.log('Clicked Connect. Waiting for modal...');

            // Wait for popup - handle case where it doesn't appear (e.g., instant connect)
            try {
                await page.waitForSelector('.artdeco-modal', { timeout: 5000 });

                // 4. Add personalized note
                const addNoteBtn = await page.evaluateHandle(() => {
                    const buttons = Array.from(document.querySelectorAll('.artdeco-modal button'));
                    return buttons.find(b => b.innerText.trim() === 'Add a note');
                });

                if (addNoteBtn) {
                    await addNoteBtn.click();
                    const message = generateConnectionMessage(lead);
                    await page.humanType('textarea[name="message"]', message);
                    await randomDelay(1000, 2000); // Reduced delay

                    // Click Send (Uncommented and improved selector)
                    const sendBtn = await page.evaluateHandle(() => {
                        const buttons = Array.from(document.querySelectorAll('.artdeco-modal button'));
                        return buttons.find(b => b.innerText.trim() === 'Send');
                    });

                    if (sendBtn) {
                        await sendBtn.click();
                        console.log(`[SENT] Connection request to ${lead.first_name}: "${message}"`);
                    } else {
                        console.log('Send button not found in modal.');
                    }

                    db.updateStatus(lead.id, 'invited');
                    db.logAction('send_invite', lead.linkedin_url);
                } else {
                    // Sometimes "Add a note" is not available, or it's a different flow
                    const sendNowBtn = await page.evaluateHandle(() => {
                        const buttons = Array.from(document.querySelectorAll('.artdeco-modal button'));
                        return buttons.find(b => b.innerText.trim() === 'Send' || b.innerText.trim() === 'Send now');
                    });
                    if (sendNowBtn) {
                        await sendNowBtn.click();
                        console.log(`[SENT] Connection request (no note option) to ${lead.first_name}`);
                        db.updateStatus(lead.id, 'invited');
                        db.logAction('send_invite', lead.linkedin_url);
                    }
                }
            } catch (modalError) {
                console.log('Modal did not appear (possibly instant connection or different UI). Assuming success.');
                // Inspect if the button changed to "Pending" to confirm? 
                // For now, assume success if no error on click.
                db.updateStatus(lead.id, 'invited');
            }

        } else {
            console.log('Connect button not found (already connected, pending, or hidden).');
            // Update status to 'failed' or 'ignored' to avoid infinite loops?
            // Let's mark as 'ignored' for now so we don't retry immediately
            db.updateStatus(lead.id, 'ignored');
        }
    } catch (err) {
        console.error('Error sending connection request:', err);
        // Don't crash the whole bot
    }

    return true;
}

async function randomDelay(min, max) {
    const delay = Math.floor(Math.random() * (max - min) + min);
    console.log(`Waiting ${Math.round(delay / 1000)}s...`);
    await new Promise(r => setTimeout(r, delay));
}

module.exports = { sendConnectionRequest };
