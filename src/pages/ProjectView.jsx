import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProject, getStage, setActiveStage, skipStage } from '../api.js';
import { CARDS } from '../../shared/stage.js';
import { goToStep } from '../stage/navigate.js';
import { splitDemoName } from '../demo/name.js';
import DemoTag from '../components/DemoTag.jsx';
import BacklogPanel from '../components/BacklogPanel.jsx';
import Conversation from '../components/Conversation.jsx';
import CriteriaPanel from '../components/CriteriaPanel.jsx';
import NewViewPanel from '../components/NewViewPanel.jsx';
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

  // Päis jääb kerimisel üles: selle kõrgus läheb CSS-muutujasse, et kaardid ja backlog'i veerg jääksid päise alla.
  const headerRef = useRef(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return undefined;
    const update = () => document.documentElement.style.setProperty('--project-header-h', `${el.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => { observer.disconnect(); document.documentElement.style.removeProperty('--project-header-h'); };
  }, [project]);

  // L13: "Mida teeme edasi?" (1–4 sammu) iga nähtava AI väljundi kaardi lõpus – server annab sammud kaardi kaupa
  // (stepsByCard). Vanade, juba vastatud vestlussõnumite ega backlog'i ülevaatuse juures plokki ei ole.
  const stepsAfter = (card) => stage?.stepsByCard?.[card] && <NextSteps steps={stage.stepsByCard[card]} onGo={goToStep} projectId={project.id} card={card} />;

  // L14: projekti avamisel keritakse aktiivse etapi kaardi juurde (üks kord avamise kohta). Kaardid laadivad oma sisu
  // alles pärast seda ja lükkavad sihtkaarti allapoole, seega lehe kõrguse muutumisel keritakse kuni ~2 s uuesti.
  // Järelkerimine lõpeb kohe, kui kasutaja ise kerib, klõpsab või kasutab klaviatuuri (lehe enda kerimist ei arvestata).
  const openedAt = useRef(null);
  useEffect(() => {
    if (!stage || !project || openedAt.current === id) return undefined;
    openedAt.current = id;
    const active = stage.stages.find((s) => s.key === stage.active);
    const card = active?.card && document.getElementById(CARDS[active.card]);
    if (!card) return undefined;
    requestAnimationFrame(() => goToStep({ card: active.card, focus: null }));
    const userEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    const observer = new ResizeObserver(() => card.scrollIntoView({ block: 'start' }));
    const stop = () => {
      observer.disconnect();
      clearTimeout(timer);
      userEvents.forEach((e) => window.removeEventListener(e, stop, true));
    };
    const timer = setTimeout(stop, 2000);
    userEvents.forEach((e) => window.addEventListener(e, stop, { capture: true, passive: true }));
    observer.observe(document.body);
    return stop;
  }, [stage, project, id]);
  const [stageError, setStageError] = useState('');
  const stageAction = (call) => call().then(setStage).then(() => setStageError('')).catch((e) => setStageError(e.message));
  const onActivate = (s) => {
    goToStep({ card: s.card, focus: null });
    stageAction(() => setActiveStage(id, s.key));
  };
  const onSkip = (s) => stageAction(() => skipStage(id, s.key));

  return (
    <main>
      <p><Link to="/">← Projektide loend</Link></p>
      {error && <p className="error">{error}</p>}
      {!error && !project && <p className="muted">Laadin…</p>}
      {project && (
        <>
          <div ref={headerRef} className="project-header-wrap">
            {stage
              ? <StagePanel {...splitDemoName(project.name)} stage={stage} onGo={goToStep} onActivate={onActivate} onSkip={onSkip} error={stageError} />
              : <h2 className="project-header__title">{splitDemoName(project.name).name}{splitDemoName(project.name).demo && <DemoTag />}</h2>}
          </div>
          {project.description ? <p className="project-description">{project.description}</p> : <p className="muted project-description">Kirjeldus puudub.</p>}
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
                  backlogVersion={backlogVersion}
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
              <section className="card" id={CARDS.newView} tabIndex={-1}>
                <h2>Uus vaade</h2>
                <NewViewPanel projectId={project.id} onApplied={() => setBacklogVersion((v) => v + 1)} />
                {stepsAfter('newView')}
              </section>
              <section className="card" id={CARDS.refinement} tabIndex={-1}>
                <h2>Kliendi täpsustus</h2>
                <RefinementPanel projectId={project.id} version={`${backlogVersion}-${consistencyVersion}`} onApplied={() => setBacklogVersion((v) => v + 1)} />
                {stepsAfter('refinement')}
              </section>
            </div>
            <section className="card backlog-column" id={CARDS.backlog} tabIndex={-1} aria-labelledby="backlog-heading">
              <h2 id="backlog-heading">Backlog</h2>
              <BacklogPanel projectId={project.id} version={backlogVersion} onBacklogChanged={() => setBacklogVersion((v) => v + 1)} />
            </section>
          </div>
        </>
      )}
    </main>
  );
}
