import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const API = `http://${window.location.hostname}:3001`;
const ADMIN_KEY = "demo123";

export default function Admin() {
  const [queue, setQueue] = useState([]);
  const [songs, setSongs] = useState([]);
  const [current, setCurrent] = useState(null);

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState("");

  const audioRef = useRef(null);

  useEffect(() => {
    loadQueue();
    loadSongs();

    const socket = io(API);
    socket.on("queue:update", setQueue);

    return () => socket.disconnect();
  }, []);

  function loadQueue() {
    fetch(`${API}/api/queue`).then(res => res.json()).then(setQueue);
  }

  function loadSongs() {
    fetch(`${API}/api/songs`).then(res => res.json()).then(setSongs);
  }

  async function startNext() {
    const res = await fetch(`${API}/api/admin/start-next?key=${ADMIN_KEY}`, {
      method: "POST"
    });

    const song = await res.json();
    if (!song) return;

    setCurrent(song);

    setTimeout(() => {
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
    audioRef.current.pause();

    await fetch(`${API}/api/admin/skip?key=${ADMIN_KEY}`, {
      method: "POST"
    });

    setCurrent(null);
    startNext();
  }

  async function clearQueue() {
    audioRef.current.pause();
    setCurrent(null);

    await fetch(`${API}/api/admin/clear?key=${ADMIN_KEY}`);
  }

  async function addSong(e) {
    e.preventDefault();
    setMessage("");

    if (!title || !artist || !file) {
      setMessage("Bitte Titel, Artist und MP3-Datei auswählen.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("artist", artist);
    formData.append("file", file);

    const res = await fetch(`${API}/api/admin/add-song?key=${ADMIN_KEY}`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Fehler beim Hochladen.");
      return;
    }

    setTitle("");
    setArtist("");
    setFile(null);
    setMessage("Song wurde hochgeladen und gespeichert.");
    loadSongs();
  }

  async function deleteSong(id) {
    const confirmDelete = window.confirm("Song wirklich ausblenden?");
    if (!confirmDelete) return;

    const res = await fetch(`${API}/api/admin/delete-song/${id}?key=${ADMIN_KEY}`, {
      method: "POST"
    });

    if (res.ok) {
      setSongs(prev => prev.filter(song => song.id !== id));
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <p style={styles.kicker}>CONTROL PANEL</p>
        <h1 style={styles.title}>EFFEKTE.CH PLAY</h1>
        <p style={styles.subtitle}>Admin für Playback, Queue und Songdatenbank</p>
      </section>

      <section style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Playback</h2>

          <audio ref={audioRef} controls onEnded={finishAndNext} style={styles.audio} />

          <div style={styles.nowBox}>
            <span style={styles.label}>Aktuell</span>
            <strong style={styles.nowText}>
              {current ? `${current.artist} – ${current.title}` : "Kein Song läuft"}
            </strong>
          </div>

          <div style={styles.row}>
            <button style={styles.button} onClick={startNext}>Start Playback</button>
            <button style={styles.buttonSecondary} onClick={skip}>Skip</button>
            <button style={styles.dangerButton} onClick={clearQueue}>Queue leeren</button>
          </div>
        </div>

        <div style={styles.card}>
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

            <button style={styles.button} type="submit">
              MP3 hochladen & Song speichern
            </button>
          </form>

          {message && <p style={styles.message}>{message}</p>}
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.queueHeader}>
          <h2 style={styles.cardTitle}>Songs verwalten</h2>
          <span style={styles.badge}>{songs.length}</span>
        </div>

        {songs.length === 0 && <p style={styles.empty}>Keine Songs vorhanden.</p>}

        {songs.map(song => (
          <div key={song.id} style={styles.songManageItem}>
            <div>
              <strong>{song.artist} – {song.title}</strong>
              <br />
              <span style={styles.fileName}>{song.filename}</span>
            </div>

            <button
              style={styles.dangerButton}
              onClick={() => deleteSong(song.id)}
            >
              löschen
            </button>
          </div>
        ))}
      </section>

      <section style={styles.card}>
        <div style={styles.queueHeader}>
          <h2 style={styles.cardTitle}>Queue</h2>
          <span style={styles.badge}>{queue.length}</span>
        </div>

        {queue.length === 0 && <p style={styles.empty}>Queue ist leer.</p>}

        {queue.map((item, index) => (
          <div key={item.queueId} style={styles.queueItem}>
            <span style={styles.queueNumber}>{String(index + 1).padStart(2, "0")}</span>
            <span>{item.artist} – {item.title}</span>
            <span style={styles.status}>{item.status}</span>
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
      "radial-gradient(circle at top center, rgba(255,204,0,0.18), transparent 32%), #000",
    color: "#fff",
    fontFamily: "Arial, sans-serif",
    padding: 28,
    boxSizing: "border-box"
  },
  header: {
    marginBottom: 26
  },
  kicker: {
    color: "#ffcc00",
    letterSpacing: 4,
    fontSize: 12,
    fontWeight: 900,
    margin: 0
  },
  title: {
    color: "#ffcc00",
    fontSize: 52,
    fontStyle: "italic",
    fontWeight: 1000,
    margin: "8px 0",
    textShadow: "0 0 28px rgba(255,204,0,0.35)"
  },
  subtitle: {
    color: "#ccc",
    margin: 0
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 18,
    marginBottom: 18
  },
  card: {
    background: "rgba(14,14,14,0.95)",
    border: "1px solid rgba(255,204,0,0.22)",
    borderRadius: 22,
    padding: 22,
    boxShadow: "0 0 34px rgba(255,204,0,0.06)",
    marginBottom: 18
  },
  cardTitle: {
    color: "#fff",
    marginTop: 0,
    marginBottom: 16,
    fontSize: 24
  },
  audio: {
    width: "100%",
    marginBottom: 16
  },
  nowBox: {
    background: "#ffcc00",
    color: "#000",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16
  },
  label: {
    display: "block",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: 900,
    textTransform: "uppercase",
    marginBottom: 6
  },
  nowText: {
    fontSize: 20
  },
  row: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap"
  },
  form: {
    display: "grid",
    gap: 12
  },
  input: {
    background: "#050505",
    border: "1px solid rgba(255,204,0,0.45)",
    borderRadius: 14,
    padding: "13px 14px",
    color: "#fff",
    fontSize: 16,
    outline: "none",
    boxSizing: "border-box"
  },
  button: {
    background: "#ffcc00",
    color: "#000",
    border: "none",
    borderRadius: 14,
    padding: "13px 16px",
    fontWeight: 900,
    cursor: "pointer"
  },
  buttonSecondary: {
    background: "#222",
    color: "#fff",
    border: "1px solid #444",
    borderRadius: 14,
    padding: "13px 16px",
    fontWeight: 900,
    cursor: "pointer"
  },
  dangerButton: {
    background: "#2a0808",
    color: "#fff",
    border: "1px solid #6b1b1b",
    borderRadius: 14,
    padding: "13px 16px",
    fontWeight: 900,
    cursor: "pointer"
  },
  message: {
    background: "rgba(255,204,0,0.15)",
    border: "1px solid rgba(255,204,0,0.35)",
    color: "#fff",
    padding: 12,
    borderRadius: 14
  },
  queueHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  badge: {
    background: "#ffcc00",
    color: "#000",
    padding: "5px 12px",
    borderRadius: 999,
    fontWeight: 900
  },
  empty: {
    color: "#aaa"
  },
  queueItem: {
    display: "grid",
    gridTemplateColumns: "50px 1fr 90px",
    gap: 12,
    padding: "13px 0",
    borderBottom: "1px solid rgba(255,255,255,0.08)"
  },
  songManageItem: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 12,
    alignItems: "center",
    padding: "13px 0",
    borderBottom: "1px solid rgba(255,255,255,0.08)"
  },
  queueNumber: {
    color: "#ffcc00",
    fontWeight: 1000
  },
  status: {
    color: "#888",
    textAlign: "right"
  },
  fileName: {
    color: "#888",
    fontSize: 12
  }
};
