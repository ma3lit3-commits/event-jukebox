import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const API = `http://${window.location.hostname}:3001`;
const BRAND = "EFFEKTE.CH PLAY";

export default function App() {
  const [songs, setSongs] = useState([]);
  const [queue, setQueue] = useState([]);
const [settings, setSettings] = useState({});
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${API}/api/songs`).then(res => res.json()).then(setSongs);
    fetch(`${API}/api/queue`).then(res => res.json()).then(setQueue);
fetch(`${API}/api/settings`).then(res => res.json()).then(setSettings);

    const socket = io(API);
    socket.on("queue:update", setQueue);
socket.on("settings:update", setSettings);

    return () => socket.disconnect();
  }, []);

  async function addSong(songId) {
    setMessage("");

    const lastAdd = localStorage.getItem("lastAdd");
    const now = Date.now();

if (settings.requestsOpen === false) {
  setMessage("Musikwünsche sind aktuell geschlossen.");
  return;
}

    if (lastAdd && now - lastAdd < 10000) {
      setMessage("Bitte kurz warten, bevor du erneut einen Song hinzufügst.");
      return;
    }

    const alreadyInQueue = queue.some(q => q.id === songId);

    if (alreadyInQueue) {
      setMessage("Dieser Song ist bereits in der Warteschlange.");
      return;
    }

    const res = await fetch(`${API}/api/queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ songId })
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Fehler");
      return;
    }

    localStorage.setItem("lastAdd", now);
    setMessage("Song wurde hinzugefügt.");
  }

  const nowPlaying = queue.find(item => item.status === "playing");
  const upcoming = queue.filter(item => item.status === "queued");

  const filteredSongs = songs.filter(song =>
    `${song.artist} ${song.title}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main style={styles.page}>
      <div style={styles.bgGlow}></div>
      <div style={styles.lightLeft}></div>
      <div style={styles.lightRight}></div>

      <section style={styles.hero}>
        <p style={styles.kicker}>QR MUSIC REQUESTS</p>
        <h1 style={styles.title}>{BRAND}</h1>
        <p style={styles.claim}>IT’S YOUR SHOW.</p>
      </section>

      <section style={styles.nowCard}>
        <div style={styles.nowIcon}>
          <div style={styles.wave}>▮▮▮▮▮</div>
        </div>

        <div style={styles.nowText}>
          <p style={styles.smallLabel}>JETZT LÄUFT</p>
          {nowPlaying ? (
            <>
              <h2 style={styles.nowTitle}>{nowPlaying.title}</h2>
              <p style={styles.nowArtist}>{nowPlaying.artist}</p>
            </>
          ) : (
            <>
              <h2 style={styles.nowTitle}>Noch kein Song läuft</h2>
              <p style={styles.nowArtist}>Warte auf den ersten Request.</p>
            </>
          )}
        </div>

        <div style={styles.watermark}>effekte.ch</div>
      </section>

      <section style={styles.grid}>
        <div>
          <div style={styles.searchBox}>
            <span style={styles.searchIcon}>⌕</span>
            <input
              placeholder="Song suchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={styles.input}
            />
          </div>

          {message && <p style={styles.message}>{message}</p>}

{settings.requestsOpen === false && (
  <div style={styles.closedBox}>
    Musikwünsche sind aktuell geschlossen.
  </div>
)}
         
 <section style={styles.panel}>
            <h3 style={styles.panelTitle}>SONGS</h3>

            {filteredSongs.map(song => (
              <div key={song.id} style={styles.songItem}>
                <div style={styles.cover}>
                  {song.title.slice(0, 1)}
                </div>

                <div style={styles.songInfo}>
                  <strong>{song.title}</strong>
                  <span>{song.artist}</span>
                </div>

                <button style={styles.addButton} onClick={() => addSong(song.id)}>
                  +
                </button>
              </div>
            ))}
          </section>
        </div>

        <section style={styles.panel}>
          <div style={styles.queueHeader}>
            <h3 style={styles.panelTitle}>ALS NÄCHSTES</h3>
            <span style={styles.queueBadge}>{upcoming.length}</span>
          </div>

          {upcoming.length === 0 && (
            <p style={styles.empty}>Noch keine Songs in der Queue.</p>
          )}

          {upcoming.map((item, i) => (
            <div key={item.queueId} style={styles.queueItem}>
              <span style={styles.queueNumber}>{String(i + 1).padStart(2, "0")}</span>
              <div style={styles.songInfo}>
                <strong>{item.title}</strong>
                <span>{item.artist}</span>
              </div>
              <span style={styles.drag}>≡</span>
            </div>
          ))}
        </section>
      </section>

      <footer style={styles.footer}>
        RESPECT THE MUSIC. RESPECT EACH OTHER. <span>ENJOY.</span>
      </footer>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#000",
    color: "#fff",
    fontFamily: "Arial, sans-serif",
    padding: "34px 22px",
    boxSizing: "border-box",
    position: "relative",
    overflow: "hidden"
  },
  bgGlow: {
    position: "fixed",
    inset: 0,
    background:
      "radial-gradient(circle at top center, rgba(255,204,0,0.28), transparent 32%), radial-gradient(circle at bottom center, rgba(255,204,0,0.08), transparent 38%)",
    pointerEvents: "none"
  },
  lightLeft: {
    position: "fixed",
    top: -80,
    left: 30,
    width: 4,
    height: 360,
    background: "#ffcc00",
    transform: "rotate(26deg)",
    boxShadow: "0 0 38px #ffcc00",
    opacity: 0.8
  },
  lightRight: {
    position: "fixed",
    top: -70,
    right: 30,
    width: 4,
    height: 380,
    background: "#ffcc00",
    transform: "rotate(-26deg)",
    boxShadow: "0 0 38px #ffcc00",
    opacity: 0.8
  },
  hero: {
    textAlign: "center",
    position: "relative",
    zIndex: 1,
    marginBottom: 28
  },
  kicker: {
    color: "#ffcc00",
    letterSpacing: 8,
    fontWeight: 800,
    fontSize: 14,
    margin: 0
  },
  title: {
    color: "#ffcc00",
    fontSize: "clamp(44px, 8vw, 92px)",
    lineHeight: 0.95,
    fontStyle: "italic",
    fontWeight: 1000,
    margin: "14px 0 6px",
    textShadow: "0 0 35px rgba(255,204,0,0.45)"
  },
  claim: {
    margin: 0,
    letterSpacing: 8,
    fontWeight: 900,
    fontSize: 18,
    color: "#fff"
  },
  nowCard: {
    maxWidth: 1120,
    margin: "0 auto 22px",
    background: "#ffcc00",
    color: "#000",
    borderRadius: 24,
    padding: 28,
    display: "grid",
    gridTemplateColumns: "120px 1fr auto",
    gap: 24,
    alignItems: "center",
    boxShadow: "0 0 55px rgba(255,204,0,0.35)",
    position: "relative",
    zIndex: 1,
    overflow: "hidden"
  },
  nowIcon: {
    width: 110,
    height: 110,
    borderRadius: 18,
    background: "#050505",
    display: "grid",
    placeItems: "center",
    color: "#ffcc00",
    fontSize: 28
  },
  wave: {
    letterSpacing: 3,
    transform: "scaleY(1.5)"
  },
  smallLabel: {
    fontSize: 13,
    letterSpacing: 3,
    fontWeight: 900,
    margin: "0 0 12px"
  },
  nowTitle: {
    fontSize: "clamp(28px, 5vw, 48px)",
    lineHeight: 1,
    margin: 0,
    fontWeight: 950
  },
  nowArtist: {
    fontSize: 22,
    margin: "8px 0 0",
    color: "#111"
  },
  watermark: {
    fontSize: 54,
    fontWeight: 1000,
    opacity: 0.11,
    transform: "rotate(-2deg)"
  },
  grid: {
    maxWidth: 1120,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    position: "relative",
    zIndex: 1
  },
  searchBox: {
    height: 64,
    borderRadius: 18,
    border: "1px solid rgba(255,204,0,0.65)",
    background: "rgba(5,5,5,0.9)",
    display: "flex",
    alignItems: "center",
    padding: "0 18px",
    marginBottom: 12
  },
  searchIcon: {
    color: "#ffcc00",
    fontSize: 32,
    marginRight: 14
  },
  input: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#fff",
    fontSize: 18
  },
  message: {
    background: "rgba(255,204,0,0.18)",
    border: "1px solid rgba(255,204,0,0.6)",
    padding: 12,
    borderRadius: 14
  },
  panel: {
    background: "rgba(12,12,12,0.9)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 18,
    backdropFilter: "blur(12px)"
  },
  panelTitle: {
    color: "#ffcc00",
    letterSpacing: 2,
    margin: "0 0 14px",
    fontSize: 18
  },
  songItem: {
    display: "grid",
    gridTemplateColumns: "56px 1fr 56px",
    alignItems: "center",
    gap: 14,
    padding: "12px 0",
    borderBottom: "1px solid rgba(255,255,255,0.08)"
  },
  cover: {
    width: 52,
    height: 52,
    borderRadius: 10,
    background: "linear-gradient(135deg, #ffcc00, #6b5500)",
    color: "#000",
    display: "grid",
    placeItems: "center",
    fontWeight: 1000,
    fontSize: 24
  },
  songInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 4
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: "#ffcc00",
    color: "#000",
    border: "none",
    fontSize: 30,
    fontWeight: 900,
    boxShadow: "0 0 24px rgba(255,204,0,0.32)"
  },
  queueHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  },
  queueBadge: {
    background: "#ffcc00",
    color: "#000",
    padding: "3px 10px",
    borderRadius: 999,
    fontWeight: 900
  },
  queueItem: {
    display: "grid",
    gridTemplateColumns: "44px 1fr 28px",
    gap: 10,
    alignItems: "center",
    padding: "15px 0",
    borderBottom: "1px solid rgba(255,255,255,0.08)"
  },
  queueNumber: {
    color: "#ffcc00",
    fontWeight: 1000,
    fontSize: 22
  },
  drag: {
    color: "#777",
    fontSize: 24
  },
  empty: {
    color: "#aaa"
  },
  footer: {
    textAlign: "center",
    color: "#bbb",
    letterSpacing: 5,
    fontSize: 13,
    marginTop: 28,
    position: "relative",
    zIndex: 1
  },
closedBox: {
  background: "#2a0808",
  border: "1px solid #6b1b1b",
  color: "#fff",
  borderRadius: 16,
  padding: 16,
  margin: "18px 0",
  fontWeight: 900,
  textAlign: "center"
}
};
