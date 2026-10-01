import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProject } from '../api.js';
import BacklogPanel from '../components/BacklogPanel.jsx';
import Conversation from '../components/Conversation.jsx';
import CriteriaPanel from '../components/CriteriaPanel.jsx';
import PriorityPanel from '../components/PriorityPanel.jsx';
import RefinementPanel from '../components/RefinementPanel.jsx';
import RolesPanel from '../components/RolesPanel.jsx';
import StoriesPanel from '../components/StoriesPanel.jsx';

export default function ProjectView() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState(null);
  const [rolesVersion, setRolesVersion] = useState(0);
  const [backlogVersion, setBacklogVersion] = useState(0);
  const [consistencyVersion, setConsistencyVersion] = useState(0); // L23: seose või ülevaatuse muutus

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
          {/* L07: laial ekraanil vestlus vasakul ja backlog paremal; kitsal ekraanil on backlog lugude all. */}
          <div className="project-layout">
            <div>
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
                <StoriesPanel
                  projectId={project.id}
                  rolesVersion={rolesVersion}
                  onBacklogChanged={() => setBacklogVersion((v) => v + 1)}
                />
              </section>
              <section className="card">
                <h2>Prioriteet</h2>
                <PriorityPanel
                  projectId={project.id}
                  backlogVersion={backlogVersion}
                  onFocusChanged={() => setBacklogVersion((v) => v + 1)}
                />
              </section>
              <section className="card">
                <h2>Kriteeriumid ja mockup</h2>
                <CriteriaPanel projectId={project.id} focusVersion={backlogVersion} onConsistencyChanged={() => setConsistencyVersion((v) => v + 1)} />
              </section>
              <section className="card">
                <h2>Kliendi täpsustus</h2>
                <RefinementPanel projectId={project.id} version={`${backlogVersion}-${consistencyVersion}`} onApplied={() => setBacklogVersion((v) => v + 1)} />
              </section>
            </div>
            <section className="card" aria-labelledby="backlog-heading">
              <h2 id="backlog-heading">Backlog</h2>
              <BacklogPanel projectId={project.id} version={backlogVersion} />
            </section>
          </div>
        </>
      )}
    </main>
  );
}
