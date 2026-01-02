const db = require('./src/db');

try {
    const lead = {
        linkedin_url: 'https://linkedin.com/in/testuser123',
        first_name: 'Test',
        last_name: 'User',
        full_name: 'Test User',
        job_title: 'Developer',
        location: 'Earth'
        // Missing bio
    };

    console.log('Attempting to add lead...');
    const result = db.addLead(lead);
    console.log('Result:', result);

    const check = db.db.prepare('SELECT * FROM leads WHERE linkedin_url = ?').get('https://linkedin.com/in/testuser123');
    console.log('Retrieved from DB:', check);

} catch (error) {
    console.error('Error adding lead:', error);
}
