import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProject, getStage } from '../api.js';
import { CARDS } from '../../shared/stage.js';
import { goToStep } from '../stage/navigate.js';
import BacklogPanel from '../components/BacklogPanel.jsx';
import Conversation from '../components/Conversation.jsx';
import CriteriaPanel from '../components/CriteriaPanel.jsx';
import NextSteps from '../components/NextSteps.jsx';
import PriorityPanel from '../components/PriorityPanel.jsx';
import RefinementPanel from '../components/RefinementPanel.jsx';
import RolesPanel from '../components/RolesPanel.jsx';
import StagePanel from '../components/StagePanel.jsx';
import StoriesPanel from '../components/StoriesPanel.jsx';

export default function ProjectView() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState(null);
  const [rolesVersion, setRolesVersion] = useState(0);
  const [backlogVersion, setBacklogVersion] = useState(0);
  const [consistencyVersion, setConsistencyVersion] = useState(0); // L23: seose või ülevaatuse muutus
  const [stage, setStage] = useState(null);
  const stageRequest = useRef(0);

  useEffect(() => {
    setProject(null);
    setError('');
    getProject(id).then(setProject).catch((e) => setError(e.status === 404 ? 'Projekti ei leitud.' : e.message));
  }, [id]);

  // L13, L14: etapp tuletatakse serveris andmetest; uuesti laaditakse pärast iga muutvat päringut (api.js sündmus).
  const loadStage = useCallback(() => {
    const n = ++stageRequest.current;
    getStage(id).then((s) => { if (n === stageRequest.current) setStage(s); }).catch(() => { if (n === stageRequest.current) setStage(null); });
  }, [id]);
  useEffect(() => {
    setStage(null);
    loadStage();
    window.addEventListener('pjt:changed', loadStage);
    return () => window.removeEventListener('pjt:changed', loadStage);
  }, [loadStage]);

  // "Mida teeme edasi?" ainult uusima AI väljundi kaardi lõpus; vanemate AI vastuste juurde nuppe ei lisata.
  const stepsAfter = (card) => stage?.latestAiCard === card && <NextSteps steps={stage.steps} onGo={goToStep} />;

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
          {stage && <StagePanel stage={stage} onGo={goToStep} />}
          {/* L07: laial ekraanil vestlus vasakul ja backlog paremal; kitsal ekraanil on backlog lugude all. */}
          <div className="project-layout">
            <div>
              <section className="card" id={CARDS.conversation} tabIndex={-1}>
                <h2>Juhitud vestlus</h2>
                <Conversation projectId={project.id} onPhaseChange={setPhase} />
                {stepsAfter('conversation')}
              </section>
              <section className="card" id={CARDS.roles} tabIndex={-1}>
                <h2>Rollid</h2>
                <RolesPanel projectId={project.id} ready={phase === 'done'} onRolesChanged={() => setRolesVersion((v) => v + 1)} />
                {stepsAfter('roles')}
              </section>
              <section className="card" id={CARDS.stories} tabIndex={-1}>
                <h2>Kasutajalood</h2>
                <StoriesPanel
                  projectId={project.id}
                  rolesVersion={rolesVersion}
                  onBacklogChanged={() => setBacklogVersion((v) => v + 1)}
                />
                {stepsAfter('stories')}
              </section>
              <section className="card" id={CARDS.priority} tabIndex={-1}>
                <h2>Prioriteet</h2>
                <PriorityPanel
                  projectId={project.id}
                  backlogVersion={backlogVersion}
                  onFocusChanged={() => setBacklogVersion((v) => v + 1)}
                />
                {stepsAfter('priority')}
              </section>
              <section className="card" id={CARDS.criteria} tabIndex={-1}>
                <h2>Kriteeriumid ja mockup</h2>
                <CriteriaPanel projectId={project.id} focusVersion={backlogVersion} onConsistencyChanged={() => setConsistencyVersion((v) => v + 1)} />
                {stepsAfter('criteria')}
              </section>
              <section className="card" id={CARDS.refinement} tabIndex={-1}>
                <h2>Kliendi täpsustus</h2>
                <RefinementPanel projectId={project.id} version={`${backlogVersion}-${consistencyVersion}`} onApplied={() => setBacklogVersion((v) => v + 1)} />
                {stepsAfter('refinement')}
              </section>
            </div>
            <section className="card" id={CARDS.backlog} tabIndex={-1} aria-labelledby="backlog-heading">
              <h2 id="backlog-heading">Backlog</h2>
              <BacklogPanel projectId={project.id} version={backlogVersion} />
            </section>
          </div>
        </>
      )}
    </main>
  );
}
