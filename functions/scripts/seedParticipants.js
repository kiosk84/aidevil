const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Path to your SQLite database file
const dbPath = path.join(__dirname, '..', 'db', 'fortune.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Failed to open DB:', err);
  else console.log('Connected to DB at', dbPath);
});

// List of participants to seed
const participants = [
  { name: 'Alice', telegramId: 'alice1' },
  { name: 'Bob', telegramId: 'bob42' },
  { name: 'Charlie', telegramId: 'charlie99' },
  // add more here or load from external source
];

// Insert participants with INSERT OR IGNORE
db.serialize(() => {
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO participants (name, telegramId) VALUES (?, ?);'
  );

  for (const p of participants) {
    stmt.run(p.name, p.telegramId, (err) => {
      if (err) console.error('Error inserting', p, err);
      else console.log('Seeded', p.name);
    });
  }

  stmt.finalize(() => {
    console.log('Seeding complete.');
    db.close();
  });
});
