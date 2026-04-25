const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const { Server } = require("socket.io");
const db = require("./db");

const ADMIN_KEY = "demo123";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

app.use("/songs", express.static(path.join(__dirname, "../client/public/songs")));

function emitQueue() {
  db.all(`
    SELECT queue.id as queueId, queue.status, songs.*
    FROM queue
    JOIN songs ON queue.song_id = songs.id
    WHERE queue.status IN ('queued', 'playing')
    ORDER BY queue.id ASC
  `, (err, rows) => {
    io.emit("queue:update", rows || []);
  });
}

app.get("/api/songs", (req, res) => {
  db.all("SELECT * FROM songs WHERE active = 1", (err, rows) => {
    res.json(rows || []);
  });
});

app.get("/api/queue", (req, res) => {
  db.all(`
    SELECT queue.id as queueId, queue.status, songs.*
    FROM queue
    JOIN songs ON queue.song_id = songs.id
    WHERE queue.status IN ('queued', 'playing')
    ORDER BY queue.id ASC
  `, (err, rows) => {
    res.json(rows || []);
  });
});

app.post("/api/queue", (req, res) => {
  const { songId } = req.body;

  if (!songId) {
    return res.status(400).json({ error: "songId fehlt" });
  }

  db.run("INSERT INTO queue (song_id) VALUES (?)", [songId], () => {
    emitQueue();
    res.json({ success: true });
  });
});

app.post("/api/admin/start-next", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Nicht erlaubt" });
  }

  db.get(`
    SELECT queue.id as queueId, songs.*
    FROM queue
    JOIN songs ON queue.song_id = songs.id
    WHERE queue.status = 'playing'
    ORDER BY queue.id ASC
    LIMIT 1
  `, (err, playing) => {
    if (playing) {
      return res.json(playing);
    }

    db.get(`
      SELECT queue.id as queueId, songs.*
      FROM queue
      JOIN songs ON queue.song_id = songs.id
      WHERE queue.status = 'queued'
      ORDER BY queue.id ASC
      LIMIT 1
    `, (err, next) => {
      if (!next) {
        return res.json(null);
      }

      db.run("UPDATE queue SET status = 'playing' WHERE id = ?", [next.queueId], () => {
        emitQueue();
        res.json(next);
      });
    });
  });
});

app.post("/api/admin/finish-current", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Nicht erlaubt" });
  }

  db.run(`
    UPDATE queue
    SET status = 'played', played_at = CURRENT_TIMESTAMP
    WHERE status = 'playing'
  `, () => {
    emitQueue();
    res.json({ success: true });
  });
});

app.post("/api/admin/skip", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Nicht erlaubt" });
  }

  db.run(`
    UPDATE queue
    SET status = 'skipped', played_at = CURRENT_TIMESTAMP
    WHERE status = 'playing'
  `, () => {
    emitQueue();
    res.json({ success: true });
  });
});

app.get("/api/admin/clear", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Nicht erlaubt" });
  }

  db.run(`
    UPDATE queue
    SET status = 'skipped'
    WHERE status IN ('queued', 'playing')
  `, () => {
    emitQueue();
    res.json({ success: true });
  });
});

io.on("connection", () => {
  emitQueue();
});

app.post("/api/admin/add-song", (req, res) => {
  if (req.query.key !== "demo123") {
    return res.status(403).json({ error: "Nicht erlaubt" });
  }

  const { title, artist, filename } = req.body;

  if (!title || !artist || !filename) {
    return res.status(400).json({ error: "Fehlende Daten" });
  }

  db.run(
    "INSERT INTO songs (title, artist, filename) VALUES (?, ?, ?)",
    [title, artist, filename],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "DB Fehler" });
      }

      res.json({ success: true, id: this.lastID });
    }
  );
});

server.listen(3001, "0.0.0.0", () => {
  console.log("Server läuft auf http://localhost:3001");
});
