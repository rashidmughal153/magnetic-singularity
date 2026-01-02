const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'leads.db');
const db = new Database(dbPath);

// Initialize schema IMMEDIATELY so tables exist before preparing statements
try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    db.exec(schema);
    console.log('Database initialized');
} catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
}

// Keep this for backward compatibility if called elsewhere
function initDB() {
    // No-op since we init on load
}

// Prepare statements for performance
const insertLeadStmt = db.prepare(`
    INSERT OR IGNORE INTO leads (linkedin_url, first_name, last_name, full_name, job_title, bio)
    VALUES (@linkedin_url, @first_name, @last_name, @full_name, @job_title, @bio)
`);

const getLeadStmt = db.prepare('SELECT * FROM leads WHERE linkedin_url = ?');
const updateLeadStatusStmt = db.prepare('UPDATE leads SET status = ? WHERE id = ?');
const logActionStmt = db.prepare('INSERT INTO action_logs (type, target_url) VALUES (?, ?)');
const countDailyActionsStmt = db.prepare(`
    SELECT COUNT(*) as count FROM action_logs 
    WHERE timestamp >= datetime('now', 'start of day')
`);

module.exports = {
    db,
    initDB,
    addLead: (lead) => insertLeadStmt.run(lead),
    getLead: (url) => getLeadStmt.get(url),
    updateStatus: (id, status) => updateLeadStatusStmt.run(status, id),
    logAction: (type, url) => logActionStmt.run(type, url),
    getDailyActionCount: () => countDailyActionsStmt.get().count
};
