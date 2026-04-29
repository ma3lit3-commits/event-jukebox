const fetch = require("node-fetch");
const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { Server } = require("socket.io");
const db = require("./db");

let spotifyToken = null;
let spotifyTokenExpiresAt = 0;

async function getSpotifyToken() {
  if (spotifyToken && Date.now() < spotifyTokenExpiresAt) {
    return spotifyToken;
  }

  const auth = Buffer.from(
    ⁠ ${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET} ⁠
  ).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: ⁠ Basic ${auth} ⁠,
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

const ADMIN_KEY = "demo123";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

const songsDir = path.join(__dirname, "../client/public/songs");
const settingsFile = path.join(__dirname, "settings.json");

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

const userCooldowns = new Map();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, songsDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, Date.now() + "-" + safeName);
  }
});

const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use("/songs", express.static(songsDir));

function emitQueue() {
  db.all(
    `
    SELECT queue.id as queueId, queue.status, songs.*
    FROM queue
    JOIN songs ON queue.song_id = songs.id
    WHERE queue.status IN ('queued', 'playing')
    ORDER BY queue.id ASC
    `,
    (err, rows) => {
      io.emit("queue:update", rows || []);
    }
  );
}

app.get("/api/settings", (req, res) => {
  res.json(getSettings());
});

app.post("/api/admin/settings", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Nicht erlaubt" });
  }

  const current = getSettings();

const next = {
  queueLimit: Number(req.body.queueLimit || current.queueLimit),
  cooldownSeconds: Number(req.body.cooldownSeconds || current.cooldownSeconds),
  eventName: req.body.eventName || current.eventName,
  claim: req.body.claim || current.claim,
  requestsOpen:
    typeof req.body.requestsOpen === "boolean"
      ? req.body.requestsOpen
      : current.requestsOpen
};

saveSettings(next);
io.emit("settings:update", next);
res.json({ success: true, settings: next });
});

app.get("/api/songs", (req, res) => {
  db.all("SELECT * FROM songs WHERE active = 1 ORDER BY id DESC", (err, rows) => {
    res.json(rows || []);
  });
});

app.get("/api/queue", (req, res) => {
  db.all(
    `
    SELECT queue.id as queueId, queue.status, songs.*
    FROM queue
    JOIN songs ON queue.song_id = songs.id
    WHERE queue.status IN ('queued', 'playing')
    ORDER BY queue.id ASC
    `,
    (err, rows) => {
      res.json(rows || []);
    }
  );
});

app.post("/api/queue", (req, res) => {
  const { songId } = req.body;
  const settings = getSettings();
  if (!settings.requestsOpen) {
    return res.status(400).json({ error: "Musikwünsche sind aktuell geschlossen." });
  }
  const userKey = req.ip;
  const now = Date.now();

  if (!songId) {
    return res.status(400).json({ error: "songId fehlt" });
  }

  const lastRequest = userCooldowns.get(userKey);

  if (lastRequest && now - lastRequest < settings.cooldownSeconds * 1000) {
    return res.status(400).json({
      error: `Bitte warte ${settings.cooldownSeconds} Sekunden zwischen Requests.`
    });
  }

  db.get(
    `
    SELECT COUNT(*) as count
    FROM queue
    WHERE status IN ('queued','playing')
    `,
    (err, row) => {
      if (row && row.count >= settings.queueLimit) {
        return res.status(400).json({ error: "Die Warteschlange ist aktuell voll." });
      }

      db.get(
        `
        SELECT * FROM queue 
        WHERE song_id = ? 
        AND status IN ('queued','playing')
        `,
        [songId],
        (err, existing) => {
          if (existing) {
            return res.status(400).json({ error: "Song ist bereits in der Warteschlange." });
          }

          db.run(
            "INSERT INTO queue (song_id) VALUES (?)",
            [songId],
            () => {
              userCooldowns.set(userKey, now);
              emitQueue();
              res.json({ success: true });
            }
          );
        }
      );
    }
  );
});

app.post("/api/admin/start-next", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Nicht erlaubt" });
  }

  db.get(
    `
    SELECT queue.id as queueId, songs.*
    FROM queue
    JOIN songs ON queue.song_id = songs.id
    WHERE queue.status = 'playing'
    ORDER BY queue.id ASC
    LIMIT 1
    `,
    (err, playing) => {
      if (playing) return res.json(playing);

      db.get(
        `
        SELECT queue.id as queueId, songs.*
        FROM queue
        JOIN songs ON queue.song_id = songs.id
        WHERE queue.status = 'queued'
        ORDER BY queue.id ASC
        LIMIT 1
        `,
        (err, next) => {
          if (!next) return res.json(null);

          db.run("UPDATE queue SET status = 'playing' WHERE id = ?", [next.queueId], () => {
            emitQueue();
            res.json(next);
          });
        }
      );
    }
  );
});

app.post("/api/admin/finish-current", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Nicht erlaubt" });
  }

  db.run(
    `
    UPDATE queue
    SET status = 'played', played_at = CURRENT_TIMESTAMP
    WHERE status = 'playing'
    `,
    () => {
      emitQueue();
      res.json({ success: true });
    }
  );
});

app.post("/api/admin/skip", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Nicht erlaubt" });
  }

  db.run(
    `
    UPDATE queue
    SET status = 'skipped', played_at = CURRENT_TIMESTAMP
    WHERE status = 'playing'
    `,
    () => {
      emitQueue();
      res.json({ success: true });
    }
  );
});

app.get("/api/admin/clear", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Nicht erlaubt" });
  }

  db.run(
    `
    UPDATE queue
    SET status = 'skipped'
    WHERE status IN ('queued', 'playing')
    `,
    () => {
      emitQueue();
      res.json({ success: true });
    }
  );
});

app.post("/api/admin/reset", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Nicht erlaubt" });
  }

  db.run(
    `
    UPDATE queue
    SET status = 'skipped'
    WHERE status IN ('queued', 'playing')
    `,
    () => {
      userCooldowns.clear();
      emitQueue();
      res.json({ success: true });
    }
  );
});

app.post("/api/admin/add-song", upload.single("file"), (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Nicht erlaubt" });
  }

  const { title, artist } = req.body;
  const file = req.file;

  if (!title || !artist || !file) {
    return res.status(400).json({ error: "Fehlende Daten" });
  }

  db.run(
    "INSERT INTO songs (title, artist, filename) VALUES (?, ?, ?)",
    [title, artist, file.filename],
    function (err) {
      if (err) {
        return res.status(500).json({ error: "DB Fehler" });
      }

      res.json({
        success: true,
        id: this.lastID,
        filename: file.filename
      });
    }
  );
});

app.post("/api/admin/delete-song/:id", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Nicht erlaubt" });
  }

  db.run(
    "UPDATE songs SET active = 0 WHERE id = ?",
    [req.params.id],
    err => {
      if (err) {
        return res.status(500).json({ error: "DB Fehler" });
      }

      res.json({ success: true });
    }
  );
});

app.post("/api/admin/emergency", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Nicht erlaubt" });
  }

  // Queue komplett leeren
  db.run("DELETE FROM queue");

  // Aktuelle Settings laden & Requests schliessen
  const current = getSettings();

  const next = {
    ...current,
    requestsOpen: false
  };

  saveSettings(next);

  // 🔥 ALLE Clients sofort updaten
  io.emit("queue:update", []);
  io.emit("settings:update", next);
  io.emit("emergency");

  res.json({ success: true });
});

io.on("connection", () => {
  emitQueue();
});

const PORT = process.env.PORT || 3001;

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

    const tracks = data.tracks.items.map(track => ({
      spotifyId: track.id,
      title: track.name,
      artist: track.artists.map(a => a.name).join(", "),
      image: track.album.images?.[1]?.url || null,
      previewUrl: track.preview_url,
      source: "spotify"
    }));

    res.json(tracks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
