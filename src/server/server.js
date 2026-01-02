const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('../db');
const { runDailyRoutine } = require('../bot/workflow');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// API: Get Stats
app.get('/api/stats', (req, res) => {
    try {
        const stats = {
            totalLeads: db.db.prepare('SELECT COUNT(*) as c FROM leads').get().c,
            connected: db.db.prepare("SELECT COUNT(*) as c FROM leads WHERE status='connected'").get().c,
            invited: db.db.prepare("SELECT COUNT(*) as c FROM leads WHERE status='invited'").get().c,
            dailyActions: db.getDailyActionCount(),
            limit: db.db.prepare("SELECT value FROM settings WHERE key='daily_action_limit'").get().value
        };
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: Get Logs
app.get('/api/logs', (req, res) => {
    try {
        const logs = db.db.prepare('SELECT * FROM action_logs ORDER BY timestamp DESC LIMIT 20').all();
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// API: Trigger Bot
app.post('/api/run', async (req, res) => {
    const { keywords, username, password } = req.body;
    if (!keywords || !username || !password) {
        return res.status(400).json({ error: 'Missing credentials or keywords' });
    }

    // Run in background
    runDailyRoutine(keywords, username, password);

    res.json({ message: 'Bot started in background' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Dashboard running on http://localhost:${PORT}`);
    db.initDB();
});
