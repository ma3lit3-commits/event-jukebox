import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const API = `http://${window.location.hostname}:3001`;
const ADMIN_KEY = "demo123";

export default function Admin() {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/api/queue`).then(res => res.json()).then(setQueue);

    const socket = io(API);
    socket.on("queue:update", setQueue);

    return () => socket.disconnect();
  }, []);

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

  return (
    <main style={{ padding: 20, fontFamily: "Arial" }}>
      <h1>Jukebox Admin</h1>

      <audio ref={audioRef} controls onEnded={finishAndNext} />

      <h2>Aktuell</h2>
      {current ? (
        <p><strong>{current.artist} – {current.title}</strong></p>
      ) : (
        <p>Kein Song läuft.</p>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button onClick={startNext}>Start Playback</button>
        <button onClick={skip}>Skip</button>
        <button onClick={clearQueue}>Queue leeren</button>
      </div>

      <h2>Queue</h2>
      {queue.length === 0 && <p>Queue ist leer.</p>}

      {queue.map((item, index) => (
        <div key={item.queueId}>
          {index + 1}. {item.artist} – {item.title} [{item.status}]
        </div>
      ))}
    </main>
  );
}
