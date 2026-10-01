import { useEffect, useState } from 'react';
import { Link, Route, Routes, useMatch } from 'react-router-dom';
import { getHealth } from './api.js';
import ProjectList from './pages/ProjectList.jsx';
import ProjectView from './pages/ProjectView.jsx';

export default function App() {
  const [server, setServer] = useState('kontrollin…');
  const projectPage = useMatch('/projects/:id'); // projekti vaade on kaheveeruline ja vajab laiemat lehte (L07)

  useEffect(() => {
    getHealth()
      .then((h) => setServer(h.status === 'ok' ? 'OK' : 'viga'))
      .catch(() => setServer('ei vasta'));
  }, []);

  return (
    <div className={projectPage ? 'page page--wide' : 'page'}>
      <header className="header">
        <Link to="/" className="brand">Projektijuhtimise tööriist</Link>
        <span className="muted">Server: {server}</span>
      </header>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/projects/:id" element={<ProjectView />} />
        <Route path="*" element={<p>Lehte ei leitud. <Link to="/">Projektide loendisse</Link></p>} />
      </Routes>
    </div>
  );
}
