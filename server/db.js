const sqlite3 = require("sqlite3").verbose();

const path = require("path");
const db = new sqlite3.Database(path.join(__dirname, "jukebox.db"));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      filename TEXT NOT NULL,
      active INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id INTEGER NOT NULL,
      status TEXT DEFAULT 'queued',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      played_at DATETIME
    )
  `);

  db.get("SELECT COUNT(*) as count FROM songs", (err, row) => {
    if (row.count === 0) {
      const stmt = db.prepare(`
        INSERT INTO songs (title, artist, filename)
        VALUES (?, ?, ?)
      `);

      stmt.run("Demo Song 1", "Artist 1", "song1.mp3");
      stmt.run("Demo Song 2", "Artist 2", "song2.mp3");
      stmt.run("Demo Song 3", "Artist 3", "song3.mp3");

      stmt.finalize();
    }
  });
});

module.exports = db;
