import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const API = "https://event-jukebox-backend.onrender.com";
const ADMIN_KEY = "demo123";
const ADMIN_PIN = "1234";

export default function Admin() {
  const [authorized, setAuthorized] = useState(false);
  const [pin, setPin] = useState("");

  const [queue, setQueue] = useState([]);
  const [songs, setSongs] = useState([]);
  const [settings, setSettings] = useState({});
  const [current, setCurrent] = useState(null);

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");

  const audioRef = useRef(null);

  useEffect(() => {
    if (!authorized) return;

    loadQueue();
    loadSongs();
    loadSettings();

    const socket = io(API);
    socket.on("queue:update", setQueue);
    socket.on("settings:update", setSettings);
    socket.on("emergency", () => {
      setQueue([]);
      setCurrent(null);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    });

    return () => socket.disconnect();
  }, [authorized]);

  function loadQueue() {
    fetch(`${API}/api/queue`).then(r => r.json()).then(setQueue);
  }

  function loadSongs() {
    fetch(`${API}/api/songs`).then(r => r.json()).then(setSongs);
  }

  function loadSettings() {
    fetch(`${API}/api/settings`).then(r => r.json()).then(setSettings);
  }

  function login() {
    if (pin === ADMIN_PIN) setAuthorized(true);
  }

  async function startNext() {
    const res = await fetch(`${API}/api/admin/start-next?key=${ADMIN_KEY}`, {
      method: "POST"
    });

    const song = await res.json();
    if (!song || song.error) return;

    setCurrent(song);

    setTimeout(() => {
      if (!audioRef.current) return;
      audioRef.current.src = `${API}/songs/${song.filename}`;
      audioRef.current.play();
    }, 100);
  }

  async function finishAndNext() {
    await fetch(`${API}/api/admin/finish-current?key=${ADMIN_KEY}`, {
      method: "POST"
    });
    setCurrent(null);
    startNext();
  }

  async function skip() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    await fetch(`${API}/api/admin/skip?key=${ADMIN_KEY}`, {
      method: "POST"
    });

    setCurrent(null);
    startNext();
  }

  async function clearQueue() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setCurrent(null);
    await fetch(`${API}/api/admin/clear?key=${ADMIN_KEY}`);
    loadQueue();
  }

  async function emergency() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setCurrent(null);

    await fetch(`${API}/api/admin/emergency?key=${ADMIN_KEY}`, {
      method: "POST"
    });

    loadQueue();
    loadSettings();
  }

  async function toggleRequests() {
    const next = {
      ...settings,
      requestsOpen: !settings.requestsOpen
    };

    const res = await fetch(`${API}/api/admin/settings?key=${ADMIN_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next)
    });

    const data = await res.json();
    if (data.settings) setSettings(data.settings);
  }

  async function saveSettings() {
    const res = await fetch(`${API}/api/admin/settings?key=${ADMIN_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });

    const data = await res.json();
    if (data.settings) {
      setSettings(data.settings);
      setMessage("Einstellungen gespeichert.");
    }
  }

  async function addSong(e) {
    e.preventDefault();
    setMessage("");

    if (!title || !artist || !file) {
      setMessage("Bitte Titel, Artist und MP3 auswählen.");
      return;
    }

    const form = new FormData();
    form.append("title", title);
    form.append("artist", artist);
    form.append("file", file);

    const res = await fetch(`${API}/api/admin/add-song?key=${ADMIN_KEY}`, {
      method: "POST",
      body: form
    });

    if (!res.ok) {
      setMessage("Upload fehlgeschlagen.");
      return;
    }

    setTitle("");
    setArtist("");
    setFile(null);
    setMessage("Song wurde hochgeladen.");
    loadSongs();
  }

  async function deleteSong(id) {
    if (!window.confirm("Song wirklich löschen/ausblenden?")) return;

    await fetch(`${API}/api/admin/delete-song/${id}?key=${ADMIN_KEY}`, {
      method: "POST"
    });

    loadSongs();
  }

  if (!authorized) {
    return (
      <main style={styles.page}>
        <section style={styles.loginCard}>
          <p style={styles.kicker}>CONTROL PANEL</p>
          <h1 style={styles.logo}>
            EFFEKTE.CH
            <br />
            PLAY
          </h1>
          <p style={styles.subtitle}>Admin Login</p>

          <input
            style={styles.input}
            type="password"
            placeholder="PIN"
            value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === "Enter" && login()}
          />

          <button style={styles.primaryButton} onClick={login}>
            Login
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <p style={styles.kicker}>CONTROL PANEL</p>
        <h1 style={styles.logo}>
          EFFEKTE.CH
          <br />
          PLAY
        </h1>
        <p style={styles.subtitle}>Playback · Queue · Songs · Event Control</p>
      </header>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Playback</h2>

        <audio ref={audioRef} controls onEnded={finishAndNext} style={styles.audio} />

        <div style={styles.nowBox}>
          <span style={styles.label}>Aktuell</span>
          <strong style={styles.nowText}>
            {current ? `${current.artist} – ${current.title}` : "Kein Song läuft"}
          </strong>
        </div>

        <div style={styles.actionGrid}>
          <button style={styles.primaryButton} onClick={startNext}>Start</button>
          <button style={styles.secondaryButton} onClick={skip}>Skip</button>
          <button style={styles.secondaryButton} onClick={clearQueue}>Queue leeren</button>
          <button style={styles.dangerButton} onClick={emergency}>Emergency</button>
        </div>
      </section>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Event Control</h2>

        <div style={styles.statusBox}>
          <span style={styles.label}>Requests</span>
          <strong style={settings.requestsOpen ? styles.openText : styles.closedText}>
            {settings.requestsOpen ? "OFFEN" : "GESCHLOSSEN"}
          </strong>
        </div>

        <button
          style={settings.requestsOpen ? styles.dangerButtonFull : styles.primaryButton}
          onClick={toggleRequests}
        >
          {settings.requestsOpen ? "Requests schließen" : "Requests öffnen"}
        </button>

        <div style={styles.settingsGrid}>
          <label style={styles.miniLabel}>Queue Limit</label>
          <input
            style={styles.input}
            type="number"
            value={settings.queueLimit || 20}
            onChange={e =>
              setSettings(prev => ({
                ...prev,
                queueLimit: Number(e.target.value)
              }))
            }
          />

          <label style={styles.miniLabel}>Cooldown in Sekunden</label>
          <input
            style={styles.input}
            type="number"
            value={settings.cooldownSeconds || 30}
            onChange={e =>
              setSettings(prev => ({
                ...prev,
                cooldownSeconds: Number(e.target.value)
              }))
            }
          />

          <button style={styles.primaryButton} onClick={saveSettings}>
            Einstellungen speichern
          </button>
        </div>

        {message && <p style={styles.message}>{message}</p>}
      </section>

      <section style={styles.card}>
        <h2 style={styles.cardTitle}>Song hinzufügen</h2>

        <form onSubmit={addSong} style={styles.form}>
          <input
            style={styles.input}
            placeholder="Titel"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />

          <input
            style={styles.input}
            placeholder="Artist"
            value={artist}
            onChange={e => setArtist(e.target.value)}
          />

          <input
            style={styles.input}
            type="file"
            accept="audio/mpeg,audio/mp3"
            onChange={e => setFile(e.target.files[0])}
          />

          <button style={styles.primaryButton} type="submit">
            MP3 hochladen & speichern
          </button>
        </form>
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>Queue</h2>
          <span style={styles.badge}>{queue.length}</span>
        </div>

        {queue.length === 0 && <p style={styles.empty}>Queue ist leer.</p>}

        {queue.map((item, index) => (
          <div key={item.queueId} style={styles.queueItem}>
            <span style={styles.queueNumber}>
              {String(index + 1).padStart(2, "0")}
            </span>

            <div style={styles.itemText}>
              <strong>{item.title}</strong>
              <span>{item.artist}</span>
            </div>

            <span style={styles.status}>{item.status}</span>
          </div>
        ))}
      </section>

      <section style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>Songs verwalten</h2>
          <span style={styles.badge}>{songs.length}</span>
        </div>

        {songs.length === 0 && <p style={styles.empty}>Keine Songs vorhanden.</p>}

        {songs.map(song => (
          <div key={song.id} style={styles.songManageItem}>
            <div style={styles.itemText}>
              <strong>{song.artist} – {song.title}</strong>
              <span>{song.filename}</span>
            </div>

            <button style={styles.smallDangerButton} onClick={() => deleteSong(song.id)}>
              löschen
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top center, rgba(255,204,0,0.18), transparent 34%), #000",
    color: "#fff",
    fontFamily: "Arial, sans-serif",
    padding: "18px",
    boxSizing: "border-box",
    overflowX: "hidden"
  },

  header: {
    maxWidth: 520,
    margin: "0 auto 22px",
    textAlign: "center",
    paddingTop: 24
  },

loginCard: {
  width: "100%",
  maxWidth: 520,
  margin: "80px auto",
  background: "rgba(14,14,14,0.95)",
  border: "1px solid rgba(255,204,0,0.22)",
  borderRadius: 28,
  padding: "28px 22px",
  boxSizing: "border-box",
  textAlign: "center",
  boxShadow: "0 0 38px rgba(255,204,0,0.08)",
  overflow: "hidden"
},

  kicker: {
    color: "#ffcc00",
    letterSpacing: 6,
    fontSize: 12,
    fontWeight: 900,
    margin: 0
  },

logo: {
  color: "#ffcc00",
  fontSize: "clamp(38px, 12vw, 64px)",
  lineHeight: 0.86,
  fontStyle: "italic",
  fontWeight: 1000,
  margin: "14px auto",
  textShadow: "0 0 30px rgba(255,204,0,0.36)",
  maxWidth: "100%",
  textAlign: "center",
  wordBreak: "normal"
},

  subtitle: {
    color: "#ccc",
    margin: "0 0 18px",
    lineHeight: 1.4,
    fontSize: 17
  },

  card: {
    width: "100%",
    maxWidth: 520,
    margin: "0 auto 18px",
    background: "rgba(14,14,14,0.95)",
    border: "1px solid rgba(255,204,0,0.22)",
    borderRadius: 26,
    padding: 18,
    boxSizing: "border-box",
    boxShadow: "0 0 34px rgba(255,204,0,0.06)"
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },

  cardTitle: {
    color: "#fff",
    margin: "0 0 16px",
    fontSize: 28,
    lineHeight: 1.05
  },

  audio: {
    width: "100%",
    marginBottom: 16
  },

  nowBox: {
    background: "#ffcc00",
    color: "#000",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    boxSizing: "border-box"
  },

  statusBox: {
    background: "#050505",
    border: "1px solid rgba(255,204,0,0.35)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16
  },

  label: {
    display: "block",
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: 900,
    textTransform: "uppercase",
    marginBottom: 8
  },

  nowText: {
    display: "block",
    fontSize: 22,
    lineHeight: 1.1
  },

  openText: {
    color: "#00e676",
    fontSize: 28,
    fontWeight: 1000
  },

  closedText: {
    color: "#ff4444",
    fontSize: 28,
    fontWeight: 1000
  },

  actionGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10
  },

  settingsGrid: {
    display: "grid",
    gap: 12,
    marginTop: 16
  },

  miniLabel: {
    color: "#aaa",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 2,
    textTransform: "uppercase"
  },

  form: {
    display: "grid",
    gap: 12
  },

  input: {
    width: "100%",
    background: "#050505",
    border: "1px solid rgba(255,204,0,0.45)",
    borderRadius: 16,
    padding: "15px",
    color: "#fff",
    fontSize: 17,
    outline: "none",
    boxSizing: "border-box"
  },

  primaryButton: {
    width: "100%",
    background: "#ffcc00",
    color: "#000",
    border: "none",
    borderRadius: 16,
    padding: "15px 16px",
    fontWeight: 1000,
    cursor: "pointer",
    fontSize: 16
  },

  secondaryButton: {
    width: "100%",
    background: "#222",
    color: "#fff",
    border: "1px solid #444",
    borderRadius: 16,
    padding: "15px 16px",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 16
  },

  dangerButton: {
    width: "100%",
    background: "#2a0808",
    color: "#fff",
    border: "1px solid #6b1b1b",
    borderRadius: 16,
    padding: "15px 16px",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 16
  },

  dangerButtonFull: {
    width: "100%",
    background: "#2a0808",
    color: "#fff",
    border: "1px solid #6b1b1b",
    borderRadius: 16,
    padding: "15px 16px",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 16
  },

  smallDangerButton: {
    background: "#2a0808",
    color: "#fff",
    border: "1px solid #6b1b1b",
    borderRadius: 14,
    padding: "11px 13px",
    fontWeight: 900,
    cursor: "pointer"
  },

  message: {
    background: "rgba(255,204,0,0.15)",
    border: "1px solid rgba(255,204,0,0.35)",
    color: "#fff",
    padding: 12,
    borderRadius: 16,
    marginTop: 12,
    textAlign: "center",
    fontWeight: 800
  },

  badge: {
    background: "#ffcc00",
    color: "#000",
    minWidth: 38,
    height: 38,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    padding: "0 10px",
    fontWeight: 1000
  },

  empty: {
    color: "#aaa",
    textAlign: "center",
    fontSize: 17
  },

  queueItem: {
    display: "grid",
    gridTemplateColumns: "38px 1fr 70px",
    gap: 10,
    alignItems: "center",
    padding: "14px 0",
    borderBottom: "1px solid rgba(255,255,255,0.08)"
  },

  queueNumber: {
    color: "#ffcc00",
    fontWeight: 1000
  },

  status: {
    color: "#888",
    textAlign: "right",
    fontSize: 12
  },

  songManageItem: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 12,
    alignItems: "center",
    padding: "14px 0",
    borderBottom: "1px solid rgba(255,255,255,0.08)"
  },

  itemText: {
    minWidth: 0,
    display: "grid",
    gap: 4
  }
};
