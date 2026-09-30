import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProject } from '../api.js';
import Conversation from '../components/Conversation.jsx';
import RolesPanel from '../components/RolesPanel.jsx';
import StoriesPanel from '../components/StoriesPanel.jsx';

export default function ProjectView() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState(null);
  const [rolesVersion, setRolesVersion] = useState(0);

  useEffect(() => {
    setProject(null);
    setError('');
    getProject(id).then(setProject).catch((e) => setError(e.status === 404 ? 'Projekti ei leitud.' : e.message));
  }, [id]);

  return (
    <main>
      <p><Link to="/">← Projektide loend</Link></p>
      {error && <p className="error">{error}</p>}
      {!error && !project && <p className="muted">Laadin…</p>}
      {project && (
        <>
          <section className="card">
            <h2>{project.name}</h2>
            {project.description ? <p>{project.description}</p> : <p className="muted">Kirjeldus puudub.</p>}
          </section>
          <section className="card">
            <h2>Juhitud vestlus</h2>
            <Conversation projectId={project.id} onPhaseChange={setPhase} />
          </section>
          <section className="card">
            <h2>Rollid</h2>
            <RolesPanel projectId={project.id} ready={phase === 'done'} onRolesChanged={() => setRolesVersion((v) => v + 1)} />
          </section>
          <section className="card">
            <h2>Kasutajalood</h2>
            <StoriesPanel projectId={project.id} rolesVersion={rolesVersion} />
          </section>
        </>
      )}
    </main>
  );
}
