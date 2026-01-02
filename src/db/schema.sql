CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    linkedin_url TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    full_name TEXT,
    job_title TEXT,
    location TEXT,
    bio TEXT,
    status TEXT DEFAULT 'new', -- new, connected, invited, accepted, messaged, replied, ignored, failed
    connection_sent_at DATETIME,
    message_sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS action_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- view_profile, send_invite, send_message
    target_url TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER,
    content TEXT,
    type TEXT, -- invite, follow_up_1, follow_up_2
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(lead_id) REFERENCES leads(id)
);

-- Initialize default settings if not exists
INSERT OR IGNORE INTO settings (key, value) VALUES ('daily_action_limit', '50');
INSERT OR IGNORE INTO settings (key, value) VALUES ('min_delay_seconds', '120');
INSERT OR IGNORE INTO settings (key, value) VALUES ('max_delay_seconds', '600');
