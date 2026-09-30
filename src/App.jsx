import { useEffect, useState } from 'react';
import { getHealth } from './api.js';

export default function App() {
  const [server, setServer] = useState('kontrollin…');

  useEffect(() => {
    getHealth()
      .then((h) => setServer(h.status === 'ok' ? 'OK' : 'viga'))
      .catch(() => setServer('ei vasta'));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Projektijuhtimise tööriist</h1>
      <p>Server: {server}</p>
    </main>
  );
}
