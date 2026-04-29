const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { Server } = require("socket.io");
const db = require("./db");

const ADMIN_KEY = process.env.ADMIN_KEY || "demo123";

let spotifyToken = null;
let spotifyTokenExpiresAt = 0;

async function getSpotifyToken() {
  if (spotifyToken && Date.now() < spotifyTokenExpiresAt) {
    return spotifyToken;
  }

  const auth = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error_description || "Spotify Token Fehler");
  }

  spotifyToken = data.access_token;
  spotifyTokenExpiresAt = Date.now() + data.expires_in * 1000 - 60000;

  return spotifyToken;
}

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

const songsDir = path.join(__dirname, "../client/public/songs");
const settingsFile = path.join(__dirname, "settings.json");

if (!fs.existsSync(songsDir)) {
  fs.mkdirSync(songsDir, { recursive: true });
}

const defaultSettings = {
  queueLimit: 20,
  cooldownSeconds: 30,
  eventName: "EFFEKTE.CH PLAY",
  claim: "IT’S YOUR SHOW.",
  requestsOpen: true
};

function getSettings() {
  try {
    if (!fs.existsSync(settingsFile)) {
      fs.writeFileSync(settingsFile, JSON.stringify(defaultSettings, null, 2));
      return defaultSettings;
    }

    return {
      ...defaultSettings,
      ...JSON.parse(fs.readFileSync(settingsFile, "utf8"))
    };
  } catch {
    return defaultSettings;
  }
}

function saveSettings(settings) {
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

function emitQueue() {
  db.all(
    `
    SELECT 
      queue.id AS queueId,
      queue.status,
      songs.id,
      songs.title,
      songs.artist,
      songs.filename,
      songs.active
    FROM queue
    JOIN songs ON queue.song_id = songs.id
    ORDER BY queue.id ASC
    `,
    [],
    (err, rows) => {
      if (!err) io.emit("queue:update", rows || []);
    }
  );
}

function checkAdmin(req, res) {
  if (req.query.key !== ADMIN_KEY) {
    res.status(403).json({ error: "Nicht erlaubt" });
    return false;
  }
  return true;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, songsDir),
  filename: (req, file, cb) => {
    const clean = Date.now() + "-" + file.originalname.replace(/\s+/g, "-");
    cb(null, clean);
  }
});

const upload = multer({ storage });

app.use("/songs", express.static(songsDir));

app.get("/", (req, res) => {
  res.send("Event Jukebox Backend läuft.");
});

app.get("/api/settings", (req, res) => {
  res.json(getSettings());
});

app.get("/api/songs", (req, res) => {
  db.all(
    "SELECT * FROM songs WHERE active = 1 ORDER BY id DESC",
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB Fehler" });
      res.json(rows || []);
    }
  );
});

app.get("/api/queue", (req, res) => {
  db.all(
    `
    SELECT 
      queue.id AS queueId,
      queue.status,
      songs.id,
      songs.title,
      songs.artist,
      songs.filename,
      songs.active
    FROM queue
    JOIN songs ON queue.song_id = songs.id
    ORDER BY queue.id ASC
    `,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB Fehler" });
      res.json(rows || []);
    }
  );
});

app.post("/api/queue", (req, res) => {
  const settings = getSettings();

  if (!settings.requestsOpen) {
    return res.status(403).json({ error: "Requests sind geschlossen" });
  }

  const songId = req.body.songId;

  if (!songId) {
    return res.status(400).json({ error: "songId fehlt" });
  }

  db.all("SELECT * FROM queue WHERE status = 'queued'", [], (err, rows) => {
    if (err) return res.status(500).json({ error: "DB Fehler" });

    if ((rows || []).length >= settings.queueLimit) {
      return res.status(400).json({ error: "Queue ist voll" });
    }

    db.run(
      "INSERT INTO queue (song_id, status) VALUES (?, 'queued')",
      [songId],
      function (err2) {
        if (err2) return res.status(500).json({ error: "DB Fehler" });

        emitQueue();
        res.json({ success: true });
      }
    );
  });
});

app.get("/api/spotify/search", async (req, res) => {
  try {
    const q = req.query.q;

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const token = await getSpotifyToken();

    const spotifyRes = await fetch(
      `https://api.spotify.com/v1/search?type=track&limit=12&q=${encodeURIComponent(q)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await spotifyRes.json();

    if (!spotifyRes.ok) {
      return res.status(500).json({
        error: data.error?.message || "Spotify Suche fehlgeschlagen"
      });
    }

    const tracks = data.tracks.items.map(track => ({
      spotifyId: track.id,
      title: track.name,
      artist: track.artists.map(a => a.name).join(", "),
      album: track.album.name,
      image: track.album.images?.[1]?.url || track.album.images?.[0]?.url || null,
      previewUrl: track.preview_url,
      source: "spotify"
    }));

    res.json(tracks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/settings", (req, res) => {
  if (!checkAdmin(req, res)) return;

  const next = {
    ...getSettings(),
    ...req.body
  };

  saveSettings(next);
  io.emit("settings:update", next);

  res.json({ success: true, settings: next });
});

app.post("/api/admin/add-song", upload.single("file"), (req, res) => {
  if (!checkAdmin(req, res)) return;

  const { title, artist } = req.body;

  if (!title || !artist || !req.file) {
    return res.status(400).json({ error: "Titel, Artist oder Datei fehlt" });
  }

  db.run(
    "INSERT INTO songs (title, artist, filename, active) VALUES (?, ?, ?, 1)",
    [title, artist, req.file.filename],
    function (err) {
      if (err) return res.status(500).json({ error: "DB Fehler" });

      res.json({ success: true });
    }
  );
});

app.post("/api/admin/delete-song/:id", (req, res) => {
  if (!checkAdmin(req, res)) return;

  db.run(
    "UPDATE songs SET active = 0 WHERE id = ?",
    [req.params.id],
    err => {
      if (err) return res.status(500).json({ error: "DB Fehler" });
      res.json({ success: true });
    }
  );
});

app.post("/api/admin/start-next", (req, res) => {
  if (!checkAdmin(req, res)) return;

  db.get(
    `
    SELECT 
      queue.id AS queueId,
      songs.id,
      songs.title,
      songs.artist,
      songs.filename
    FROM queue
    JOIN songs ON queue.song_id = songs.id
    WHERE queue.status = 'queued'
    ORDER BY queue.id ASC
    LIMIT 1
    `,
    [],
    (err, song) => {
      if (err) return res.status(500).json({ error: "DB Fehler" });
      if (!song) return res.json(null);

      db.run("UPDATE queue SET status = 'playing' WHERE id = ?", [song.queueId], err2 => {
        if (err2) return res.status(500).json({ error: "DB Fehler" });

        emitQueue();
        res.json(song);
      });
    }
  );
});

app.post("/api/admin/finish-current", (req, res) => {
  if (!checkAdmin(req, res)) return;

  db.run("DELETE FROM queue WHERE status = 'playing'", [], err => {
    if (err) return res.status(500).json({ error: "DB Fehler" });

    emitQueue();
    res.json({ success: true });
  });
});

app.post("/api/admin/skip", (req, res) => {
  if (!checkAdmin(req, res)) return;

  db.run("DELETE FROM queue WHERE status = 'playing'", [], err => {
    if (err) return res.status(500).json({ error: "DB Fehler" });

    emitQueue();
    res.json({ success: true });
  });
});

app.get("/api/admin/clear", (req, res) => {
  if (!checkAdmin(req, res)) return;

  db.run("DELETE FROM queue", [], err => {
    if (err) return res.status(500).json({ error: "DB Fehler" });

    emitQueue();
    res.json({ success: true });
  });
});

app.post("/api/admin/emergency", (req, res) => {
  if (!checkAdmin(req, res)) return;

  db.run("DELETE FROM queue");

  const current = getSettings();
  const next = {
    ...current,
    requestsOpen: false
  };

  saveSettings(next);

  io.emit("queue:update", []);
  io.emit("settings:update", next);
  io.emit("emergency");

  res.json({ success: true });
});

io.on("connection", () => {
  emitQueue();
});

server.listen(3001, "0.0.0.0", () => {
  console.log("Server läuft auf http://localhost:3001");
});
