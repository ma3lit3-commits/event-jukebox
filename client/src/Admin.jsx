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

  const audioRef = useRef(null);

  useEffect(() => {
    if (!authorized) return;

    loadQueue();
    loadSongs();
    loadSettings();

    const socket = io(API);

    socket.on("queue:update", setQueue);
    socket.on("settings:update", setSettings);

    return () => socket.disconnect();
  }, [authorized]);

  const loadQueue = () =>
    fetch(`${API}/api/queue`).then(r => r.json()).then(setQueue);

  const loadSongs = () =>
    fetch(`${API}/api/songs`).then(r => r.json()).then(setSongs);

  const loadSettings = () =>
    fetch(`${API}/api/settings`).then(r => r.json()).then(setSettings);

  const login = () => {
    if (pin === ADMIN_PIN) setAuthorized(true);
  };

  async function startNext() {
    const res = await fetch(`${API}/api/admin/start-next?key=${ADMIN_KEY}`, { method: "POST" });
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
    await fetch(`${API}/api/admin/skip?key=${ADMIN_KEY}`, { method: "POST" });
    setCurrent(null);
    startNext();
  }

  async function clearQueue() {
    await fetch(`${API}/api/admin/clear?key=${ADMIN_KEY}`);
    loadQueue();
  }

  async function addSong(e) {
    e.preventDefault();

    const form = new FormData();
    form.append("title", title);
    form.append("artist", artist);
    form.append("file", file);

    await fetch(`${API}/api/admin/add-song?key=${ADMIN_KEY}`, {
      method: "POST",
      body: form
    });

    setTitle("");
    setArtist("");
    setFile(null);
    loadSongs();
  }

  async function deleteSong(id) {
    await fetch(`${API}/api/admin/delete-song/${id}?key=${ADMIN_KEY}`, {
      method: "POST"
    });
    loadSongs();
  }

  if (!authorized) {
    return (
      <div style={{padding: 30, textAlign: "center"}}>
        <h1>EFFEKTE.CH PLAY</h1>
        <input
          placeholder="PIN"
          value={pin}
          onChange={e => setPin(e.target.value)}
        />
        <br /><br />
        <button onClick={login}>Login</button>
      </div>
    );
  }

  return (
    <div style={{padding: 20}}>
      <h1>CONTROL</h1>

      <audio ref={audioRef} controls style={{width: "100%"}} />

      <h2>{current ? current.title : "Kein Song"}</h2>

      <button onClick={startNext}>Start</button>
      <button onClick={skip}>Skip</button>
      <button onClick={clearQueue}>Clear</button>

      <hr />

      <h2>Queue</h2>
      {queue.map(q => (
        <div key={q.queueId}>
          {q.title} – {q.artist}
        </div>
      ))}

      <hr />

      <h2>Song hinzufügen</h2>
      <form onSubmit={addSong}>
        <input placeholder="Titel" value={title} onChange={e => setTitle(e.target.value)} />
        <input placeholder="Artist" value={artist} onChange={e => setArtist(e.target.value)} />
        <input type="file" onChange={e => setFile(e.target.files[0])} />
        <button type="submit">Upload</button>
      </form>

      <hr />

      <h2>Songs</h2>
      {songs.map(s => (
        <div key={s.id}>
          {s.title} – {s.artist}
          <button onClick={() => deleteSong(s.id)}>X</button>
        </div>
      ))}
    </div>
  );
}
