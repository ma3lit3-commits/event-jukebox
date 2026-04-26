import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import Admin from "./Admin";

const API = "https://event-jukebox-backend.onrender.com";

export default function App() {
  if (window.location.pathname.startsWith("/admin")) {
    return <Admin />;
  }

  const [songs, setSongs] = useState([]);
  const [queue, setQueue] = useState([]);
  const [settings, setSettings] = useState({});
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSongs();
    loadQueue();
    loadSettings();

    const socket = io(API);

    socket.on("queue:update", setQueue);
    socket.on("settings:update", setSettings);
    socket.on("emergency", () => {
      setQueue([]);
      setMessage("System wurde zurückgesetzt.");
    });

    return () => socket.disconnect();
  }, []);

  function loadSongs() {
    fetch(`${API}/api/songs`)
      .then(res => res.json())
      .then(setSongs)
      .catch(() => setMessage("Songs konnten nicht geladen werden."));
  }

  function loadQueue() {
    fetch(`${API}/api/queue`)
      .then(res => res.json())
      .then(setQueue)
      .catch(() => setMessage("Queue konnte nicht geladen werden."));
  }

  function loadSettings() {
    fetch(`${API}/api/settings`)
      .then(res => res.json())
      .then(setSettings)
      .catch(() => {});
  }

  async function addSong(songId) {
    setMessage("");

    if (settings.requestsOpen === false) {
      setMessage("Musikwünsche sind aktuell geschlossen.");
      return;
    }

    const res = await fetch(`${API}/api/queue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ songId })
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Song konnte nicht hinzugefügt werden.");
      return;
    }

    setMessage("Song wurde zur Queue hinzugefügt.");
    loadQueue();
  }

  const playing = queue.find(item => item.status === "playing");
  const upcoming = queue.filter(item => item.status === "queued");

  const filteredSongs = useMemo(() => {
    const term = search.toLowerCase().trim();

    if (!term) return songs;

    return songs.filter(song =>
      `${song.title} ${song.artist}`.toLowerCase().includes(term)
    );
  }, [songs, search]);

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <p style={styles.kicker}>QR MUSIC REQUESTS</p>
          <h1 style={styles.title}>
            EFFEKTE.CH
            <br />
            PLAY
          </h1>
          <p style={styles.claim}>IT’S YOUR SHOW.</p>
        </header>

        <section style={styles.nowBox}>
          <div style={styles.cover}>
            {playing ? playing.title.slice(0, 1).toUpperCase() : "▮▮▮"}
          </div>

          <div style={styles.nowContent}>
            <span style={styles.label}>Jetzt läuft</span>
            <h2 style={styles.nowTitle}>
              {playing ? playing.title : "Noch kein Song läuft"}
            </h2>
            <p style={styles.nowSub}>
              {playing ? playing.artist : "Warte auf den ersten Request."}
            </p>
          </div>
        </section>

        {settings.requestsOpen === false && (
          <div style={styles.closedBox}>
            Musikwünsche sind aktuell geschlossen.
          </div>
        )}

        {message && <p style={styles.message}>{message}</p>}

        <section style={styles.searchBox}>
          <span style={styles.searchIcon}>⌕</span>
          <input
            style={styles.searchInput}
            placeholder="Song suchen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Songs</h3>
            <span style={styles.badge}>{filteredSongs.length}</span>
          </div>

          {filteredSongs.length === 0 && (
            <p style={styles.empty}>Keine Songs gefunden.</p>
          )}

          {filteredSongs.map(song => (
            <div key={song.id} style={styles.songItem}>
              <div style={styles.songLetter}>
                {song.title.slice(0, 1).toUpperCase()}
              </div>

              <div style={styles.songInfo}>
                <strong style={styles.songTitle}>{song.title}</strong>
                <span style={styles.songArtist}>{song.artist}</span>
              </div>

              <button
                style={styles.addButton}
                onClick={() => addSong(song.id)}
                aria-label="Song hinzufügen"
              >
                +
              </button>
            </div>
          ))}
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Als nächstes</h3>
            <span style={styles.badge}>{upcoming.length}</span>
          </div>

          {upcoming.length === 0 && (
            <p style={styles.empty}>Noch keine Songs in der Queue.</p>
          )}

          {upcoming.map((item, index) => (
            <div key={item.queueId} style={styles.queueItem}>
              <span style={styles.queueNumber}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <div style={styles.songInfo}>
                <strong style={styles.songTitle}>{item.title}</strong>
                <span style={styles.songArtist}>{item.artist}</span>
              </div>
            </div>
          ))}
        </section>

        <footer style={styles.footer}>
          RESPECT THE MUSIC. RESPECT EACH OTHER. ENJOY.
        </footer>
      </div>
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

  shell: {
    width: "100%",
    maxWidth: 680,
    margin: "0 auto",
    boxSizing: "border-box"
  },

  header: {
    textAlign: "center",
    padding: "34px 0 22px"
  },

  kicker: {
    color: "#ffcc00",
    letterSpacing: 8,
    fontSize: 13,
    fontWeight: 900,
    margin: 0
  },

  title: {
    color: "#ffcc00",
    fontSize: "clamp(54px, 15vw, 86px)",
    lineHeight: 0.82,
    fontStyle: "italic",
    fontWeight: 1000,
    margin: "22px 0 18px",
    textShadow: "0 0 28px rgba(255,204,0,0.35)"
  },

  claim: {
    color: "#fff",
    letterSpacing: 8,
    fontSize: "clamp(16px, 4vw, 26px)",
    fontWeight: 900,
    margin: 0
  },

  nowBox: {
    background: "#ffcc00",
    color: "#000",
    borderRadius: 28,
    padding: 20,
    margin: "18px 0",
    display: "grid",
    gridTemplateColumns: "86px 1fr",
    gap: 18,
    alignItems: "center",
    overflow: "hidden",
    boxSizing: "border-box"
  },

  cover: {
    width: 86,
    height: 86,
    borderRadius: 20,
    background: "#000",
    color: "#ffcc00",
    display: "grid",
    placeItems: "center",
    fontSize: 30,
    fontWeight: 1000
  },

  nowContent: {
    minWidth: 0
  },

  label: {
    display: "block",
    fontSize: 12,
    letterSpacing: 4,
    fontWeight: 1000,
    textTransform: "uppercase",
    marginBottom: 8
  },

  nowTitle: {
    fontSize: "clamp(30px, 8vw, 48px)",
    lineHeight: 0.92,
    fontWeight: 1000,
    margin: 0,
    wordBreak: "break-word"
  },

  nowSub: {
    fontSize: "clamp(18px, 5vw, 26px)",
    lineHeight: 1.1,
    margin: "10px 0 0"
  },

  closedBox: {
    background: "#2a0808",
    border: "1px solid #6b1b1b",
    color: "#fff",
    borderRadius: 18,
    padding: 16,
    margin: "16px 0",
    fontWeight: 900,
    textAlign: "center"
  },

  message: {
    background: "rgba(255,204,0,0.14)",
    border: "1px solid rgba(255,204,0,0.35)",
    color: "#fff",
    borderRadius: 18,
    padding: 14,
    margin: "16px 0",
    fontWeight: 800,
    textAlign: "center"
  },

  searchBox: {
    display: "grid",
    gridTemplateColumns: "46px 1fr",
    alignItems: "center",
    border: "1px solid rgba(255,204,0,0.7)",
    borderRadius: 22,
    padding: "8px 14px",
    margin: "18px 0",
    background: "rgba(0,0,0,0.45)",
    boxSizing: "border-box"
  },

  searchIcon: {
    color: "#ffcc00",
    fontSize: 32,
    fontWeight: 900
  },

  searchInput: {
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#fff",
    fontSize: 22,
    minWidth: 0,
    padding: "14px 0"
  },

  panel: {
    background: "rgba(14,14,14,0.95)",
    border: "1px solid rgba(255,204,0,0.22)",
    borderRadius: 26,
    padding: 18,
    boxShadow: "0 0 34px rgba(255,204,0,0.06)",
    width: "100%",
    boxSizing: "border-box",
    margin: "18px 0"
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    marginBottom: 8
  },

  panelTitle: {
    color: "#ffcc00",
    textTransform: "uppercase",
    letterSpacing: 6,
    fontSize: 20,
    fontWeight: 1000,
    margin: 0
  },

  badge: {
    background: "#ffcc00",
    color: "#000",
    width: 38,
    height: 38,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    fontWeight: 1000
  },

  songItem: {
    display: "grid",
    gridTemplateColumns: "62px 1fr 58px",
    gap: 14,
    alignItems: "center",
    padding: "16px 0",
    borderBottom: "1px solid rgba(255,255,255,0.08)"
  },

  songLetter: {
    width: 58,
    height: 58,
    borderRadius: 14,
    background: "linear-gradient(135deg, #ffcc00, #b89400)",
    color: "#000",
    display: "grid",
    placeItems: "center",
    fontSize: 28,
    fontWeight: 1000
  },

  songInfo: {
    minWidth: 0,
    display: "grid",
    gap: 4
  },

  songTitle: {
    color: "#fff",
    fontSize: 20,
    lineHeight: 1.05,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },

  songArtist: {
    color: "#bbb",
    fontSize: 17,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  },

  addButton: {
    width: 58,
    height: 58,
    borderRadius: 14,
    border: "none",
    background: "#ffcc00",
    color: "#000",
    fontSize: 36,
    fontWeight: 1000,
    cursor: "pointer"
  },

  queueItem: {
    display: "grid",
    gridTemplateColumns: "48px 1fr",
    gap: 12,
    alignItems: "center",
    padding: "14px 0",
    borderBottom: "1px solid rgba(255,255,255,0.08)"
  },

  queueNumber: {
    color: "#ffcc00",
    fontWeight: 1000,
    fontSize: 18
  },

  empty: {
    color: "#aaa",
    fontSize: 18,
    textAlign: "center",
    margin: "26px 0"
  },

  footer: {
    color: "#ccc",
    letterSpacing: 6,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 1.8,
    padding: "28px 0 18px"
  }
};
