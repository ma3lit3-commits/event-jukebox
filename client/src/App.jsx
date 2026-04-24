import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const API = `http://${window.location.hostname}:3001`;

export default function App() {
  const [songs, setSongs] = useState([]);
  const [queue, setQueue] = useState([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${API}/api/songs`)
      .then(res => res.json())
      .then(setSongs);

    fetch(`${API}/api/queue`)
      .then(res => res.json())
      .then(setQueue);

    const socket = io(API);
    socket.on("queue:update", setQueue);

    return () => socket.disconnect();
  }, []);

async function addSong(songId) {
  setMessage("");

  const lastAdd = localStorage.getItem("lastAdd");
  const now = Date.now();

  if (lastAdd && now - lastAdd < 10000) {
    setMessage("Bitte kurz warten bevor du erneut einen Song hinzufügst.");
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
  const filteredSongs = songs.filter(song =>
    `${song.artist} ${song.title}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main style={{ padding: 20 }}>
      <h1>Event Jukebox</h1>

      <input
        placeholder="Song suchen..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 20 }}
      />

      {message && (
  <p style={{ background: "#eee", padding: 10, borderRadius: 8 }}>
    {message}
  </p>
)}

      <h2>Songs</h2>
      {filteredSongs.map(song => (
        <div key={song.id} style={{ marginBottom: 10 }}>
          <strong>{song.title}</strong> – {song.artist}
          <br />
          <button onClick={() => addSong(song.id)}>
            In Queue
          </button>
        </div>
      ))}

      <h2>Queue</h2>
      {queue.map((item, i) => (
        <div key={item.queueId}>
          {i + 1}. {item.artist} – {item.title}
          {item.status === "playing" ? " (läuft)" : ""}
        </div>
      ))}
    </main>
  );
}
