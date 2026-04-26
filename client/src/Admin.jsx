import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const API = "https://event-jukebox-backend.onrender.com";
const ADMIN_KEY = "demo123";
const ADMIN_PIN = "1234";

export default function Admin() {
  const [authorized, setAuthorized] = useState(false);
  const [pin, setPin] = useState("");

  const [queue, setQueue] = useState([]);
  const [settings, setSettings] = useState({});
  const [current, setCurrent] = useState(null);

  const audioRef = useRef(null);

  useEffect(() => {
    if (!authorized) return;

    loadQueue();
    loadSettings();

    const socket = io(API);

    socket.on("queue:update", setQueue);
    socket.on("settings:update", setSettings);

    return () => socket.disconnect();
  }, [authorized]);

  function loadQueue() {
    fetch(`${API}/api/queue`).then(res => res.json()).then(setQueue);
  }

  function loadSettings() {
    fetch(`${API}/api/settings`).then(res => res.json()).then(setSettings);
  }

  function login() {
    if (pin === ADMIN_PIN) setAuthorized(true);
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

  async function skip() {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;

    await fetch(`${API}/api/admin/skip?key=${ADMIN_KEY}`, {
      method: "POST"
    });

    setCurrent(null);
    startNext();
  }

  async function emergency() {
    audioRef.current.pause();
    audioRef.current.currentTime = 0;

    await fetch(`${API}/api/admin/emergency?key=${ADMIN_KEY}`, {
      method: "POST"
    });
  }

  async function toggleRequests() {
    await fetch(`${API}/api/admin/settings?key=${ADMIN_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...settings,
        requestsOpen: !settings.requestsOpen
      })
    });
  }

  if (!authorized) {
    return (
      <main style={styles.page}>
        <div style={styles.loginCard}>
          <h1 style={styles.title}>ADMIN</h1>

          <input
            style={styles.input}
            type="password"
            placeholder="PIN"
            value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === "Enter" && login()}
          />

          <button style={styles.button} onClick={login}>
            Login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>CONTROL</h1>

        <audio ref={audioRef} controls style={styles.audio} />

        <div style={styles.card}>
          <p style={styles.label}>NOW PLAYING</p>
          <strong>
            {current
              ? `${current.artist} – ${current.title}`
              : "Kein Song"}
          </strong>
        </div>

        <div style={styles.buttonStack}>
          <button style={styles.button} onClick={startNext}>
            Start
          </button>
          <button style={styles.secondary} onClick={skip}>
            Skip
          </button>
          <button style={styles.secondary} onClick={toggleRequests}>
            {settings.requestsOpen ? "Close Requests" : "Open Requests"}
          </button>
          <button style={styles.danger} onClick={emergency}>
            Emergency
          </button>
        </div>

        <div style={styles.card}>
          <p style={styles.label}>QUEUE</p>

          {queue.length === 0 && <p>Leer</p>}

          {queue.map((q, i) => (
            <div key={q.queueId} style={styles.queueItem}>
              <span>{i + 1}</span>
              <span>
                {q.artist} – {q.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#000",
    color: "#fff",
    fontFamily: "Arial",
    padding: 20
  },

  container: {
    maxWidth: 520,
    margin: "0 auto",
    display: "grid",
    gap: 18
  },

  title: {
    color: "#ffcc00",
    textAlign: "center",
    fontSize: 42,
    fontWeight: 1000
  },

  loginCard: {
    maxWidth: 320,
    margin: "100px auto",
    display: "grid",
    gap: 12
  },

  input: {
    padding: 14,
    borderRadius: 12,
    border: "1px solid #555",
    background: "#111",
    color: "#fff"
  },

  audio: {
    width: "100%"
  },

  card: {
    background: "#111",
    padding: 16,
    borderRadius: 14,
    border: "1px solid #333"
  },

  label: {
    fontSize: 12,
    color: "#aaa",
    marginBottom: 6
  },

  buttonStack: {
    display: "grid",
    gap: 10
  },

  button: {
    background: "#ffcc00",
    color: "#000",
    padding: 14,
    borderRadius: 12,
    border: "none",
    fontWeight: 900
  },

  secondary: {
    background: "#222",
    color: "#fff",
    padding: 14,
    borderRadius: 12,
    border: "1px solid #444"
  },

  danger: {
    background: "#300",
    color: "#fff",
    padding: 14,
    borderRadius: 12,
    border: "1px solid #900"
  },

  queueItem: {
    display: "flex",
    gap: 10,
    padding: "6px 0",
    borderBottom: "1px solid #222"
  }
};
