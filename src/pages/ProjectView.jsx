import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getProject, getStage, setActiveStage, skipStage } from '../api.js';
import { CARDS } from '../../shared/stage.js';
import { startsOfferedAbove, stepsForBlock, visibleBlocks } from '../chat/target.js';
import { goToStep } from '../stage/navigate.js';
import { splitDemoName } from '../demo/name.js';
import DemoTag from '../components/DemoTag.jsx';
import BacklogPanel from '../components/BacklogPanel.jsx';
import ChatComposer from '../components/ChatComposer.jsx';
import Conversation from '../components/Conversation.jsx';
import CriteriaPanel from '../components/CriteriaPanel.jsx';
import NewViewPanel from '../components/NewViewPanel.jsx';
import NextSteps from '../components/NextSteps.jsx';
import PriorityPanel from '../components/PriorityPanel.jsx';
import RefinementPanel from '../components/RefinementPanel.jsx';
import RolesPanel from '../components/RolesPanel.jsx';
import StagePanel from '../components/StagePanel.jsx';
import StoriesPanel from '../components/StoriesPanel.jsx';

// Sammud, mille tegevus on teksti kirjutamine: fookus läheb vestluse kasti (vt shared/stage.js focus).
const COMPOSE_FOCUS = new Set(['#chat-text']);

export default function ProjectView() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const [phase, setPhase] = useState(null);
  const [rolesVersion, setRolesVersion] = useState(0);
  const [backlogVersion, setBacklogVersion] = useState(0);
  const [consistencyVersion, setConsistencyVersion] = useState(0); // L23: seose või ülevaatuse muutus
  const [stage, setStage] = useState(null);
  const [newViewOpen, setNewViewOpen] = useState(false); // L24: avatakse backlog'i nupust „+ Uus vaade“
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

  // L37: samm, mille tegevus on teksti kirjutamine (idee, kliendi täpsustus), toob fookusesse vestluse kasti.
  // „(AI)“ samm vajutab ploki ettepaneku nuppu ise (üks klõps); tulemus on ootel ettepanek, mis vajab kinnitust.
  // Kui nuppu pole või see on keelatud (nt AI juba töötab), jääb ainult kerimine.
  const go = useCallback((step) => {
    if (COMPOSE_FOCUS.has(step.focus)) {
      window.dispatchEvent(new CustomEvent('pjt:compose', { detail: { card: step.card } }));
      goToStep({ card: step.card, focus: null });
      return;
    }
    const button = step.ai && step.focus?.startsWith('[data-step=') ? document.getElementById(CARDS[step.card])?.querySelector(step.focus) : null;
    // Peidetud algusnupu (startsOfferedAbove) korral keritakse ploki juurde.
    goToStep(button && !button.offsetParent ? { card: step.card, focus: null } : step);
    if (button?.matches('button:not(:disabled)')) button.click();
  }, []);

  // L13: "Mida teeme edasi?" (1–4 sammu) iga nähtava AI väljundi ploki lõpus – server annab sammud kaardi kaupa
  // (stepsByCard). Vanade, juba vastatud vestlussõnumite ega backlog'i ülevaatuse juures plokki ei ole.
  // L37: sama ploki nähtava otsuse juurde viivat sammu ei korrata (stepsForBlock).
  const stepsAfter = (card) => stage?.stepsByCard?.[card] && <NextSteps steps={stepsForBlock(card, stage.stepsByCard[card])} onGo={go} />;
  // L37: ploki algusnupp peidetakse, kui sama samm on juba teise ploki „Mida teeme edasi?“ all (üks nupp ühe tegevuse kohta).
  const hiddenStarts = startsOfferedAbove(Object.fromEntries(Object.entries(stage?.stepsByCard ?? {}).map(([card, steps]) => [card, stepsForBlock(card, steps)])));
  const blockClass = (card) => ['chat-block', ...(hiddenStarts[card] ?? []).map((n) => `chat-block--hide-${n}`)].join(' ');

  // L37: vestluse plokk ilmub alles siis, kui selle etapini on jõutud. Uue ploki ilmumisel (mitte avamisel) keritakse sinna.
  const blocks = visibleBlocks(stage);
  const shown = (card) => blocks.includes(card);
  const shownBefore = useRef(null);
  const blocksKey = blocks.join(',');
  useEffect(() => {
    if (!stage) return;
    const before = shownBefore.current;
    shownBefore.current = blocksKey;
    const added = before === null ? null : blocksKey.split(',').find((c) => c && !before.split(',').includes(c));
    if (added) requestAnimationFrame(() => goToStep({ card: added, focus: null }));
  }, [stage, blocksKey]);
  const newViewShown = newViewOpen || Boolean(stage?.stepsByCard?.newView);
  const openNewView = () => {
    setNewViewOpen(true);
    requestAnimationFrame(() => goToStep({ card: 'newView', focus: '#uus-vaade' }));
  };

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
              ? <StagePanel {...splitDemoName(project.name)} stage={stage} onGo={go} onActivate={onActivate} onSkip={onSkip} error={stageError} />
              : <h2 className="project-header__title">{splitDemoName(project.name).name}{splitDemoName(project.name).demo && <DemoTag />}</h2>}
          </div>
          {project.description ? <p className="project-description">{project.description}</p> : <p className="muted project-description">Kirjeldus puudub.</p>}
          {/* L07: laial ekraanil vestlus vasakul ja backlog paremal; kitsal ekraanil on backlog vestluse all.
              L37: üks vestlus – sammud ilmuvad ajalises järjekorras ja kogu vabatekst kirjutatakse alla ühte kasti. */}
          <div className="project-layout">
            <section className="card chat" aria-labelledby="vestlus-pealkiri">
              <h2 id="vestlus-pealkiri">Vestlus</h2>
              <section className="chat-block" id={CARDS.conversation} tabIndex={-1} aria-label="Idee ja täpsustavad küsimused">
                <Conversation projectId={project.id} onPhaseChange={setPhase} />
                {stepsAfter('conversation')}
              </section>
              {shown('roles') && (
                <section className={blockClass('roles')} id={CARDS.roles} tabIndex={-1} aria-labelledby="plokk-rollid">
                  <BlockHead id="plokk-rollid" title="Rollid">Pakun kasutajarollid. Vali sobivad, lisa puuduvad või eemalda üleliigsed.</BlockHead>
                  <RolesPanel projectId={project.id} ready={phase === 'done'} onRolesChanged={() => setRolesVersion((v) => v + 1)} />
                  {stepsAfter('roles')}
                </section>
              )}
              {shown('stories') && (
                <section className={blockClass('stories')} id={CARDS.stories} tabIndex={-1} aria-labelledby="plokk-lood">
                  <BlockHead id="plokk-lood" title="Kasutajalood">Pakun lood põhitöövoo (happy path) järjekorras. Vali, millised lähevad backlog'i.</BlockHead>
                  <StoriesPanel
                    projectId={project.id}
                    rolesVersion={rolesVersion}
                    backlogVersion={backlogVersion}
                    onBacklogChanged={() => setBacklogVersion((v) => v + 1)}
                  />
                  {stepsAfter('stories')}
                </section>
              )}
              {shown('priority') && (
                <section className={blockClass('priority')} id={CARDS.priority} tabIndex={-1} aria-labelledby="plokk-prioriteet">
                  <BlockHead id="plokk-prioriteet" title="Millest alustada?">Milline lugu on kliendile kõige olulisem? Pakun põhjendatud soovituse.</BlockHead>
                  <PriorityPanel
                    projectId={project.id}
                    backlogVersion={backlogVersion}
                    onFocusChanged={() => setBacklogVersion((v) => v + 1)}
                  />
                  {stepsAfter('priority')}
                </section>
              )}
              {shown('criteria') && (
                <section className={blockClass('criteria')} id={CARDS.criteria} tabIndex={-1} aria-labelledby="plokk-kriteeriumid">
                  <BlockHead id="plokk-kriteeriumid" title="Kriteeriumid ja mockup">Pakun valitud loole vastuvõtukriteeriumid ja mockup'i. Kinnita, muuda või eemalda.</BlockHead>
                  <CriteriaPanel projectId={project.id} focusVersion={backlogVersion} onConsistencyChanged={() => setConsistencyVersion((v) => v + 1)} />
                  {stepsAfter('criteria')}
                </section>
              )}
              {shown('refinement') && (
                <section className="chat-block" id={CARDS.refinement} tabIndex={-1} aria-labelledby="plokk-tapsustus">
                  <BlockHead id="plokk-tapsustus" title="Kliendi täpsustus">Kas klient soovib midagi muuta? Näitan muudatuse eelvaadet enne rakendamist.</BlockHead>
                  <RefinementPanel projectId={project.id} version={`${backlogVersion}-${consistencyVersion}`} onApplied={() => setBacklogVersion((v) => v + 1)} />
                  {stepsAfter('refinement')}
                </section>
              )}
              {newViewShown && (
                <section className="chat-block" id={CARDS.newView} tabIndex={-1} aria-labelledby="plokk-uus-vaade">
                  <BlockHead id="plokk-uus-vaade" title="Uus vaade">Kirjelda uut vaadet – pakun mockup'i, loo ja kriteeriumid.</BlockHead>
                  {newViewOpen && <button type="button" className="secondary chat-block__close" onClick={() => setNewViewOpen(false)}>Sulge</button>}
                  <NewViewPanel projectId={project.id} onApplied={() => setBacklogVersion((v) => v + 1)} />
                  {stepsAfter('newView')}
                </section>
              )}
              <ChatComposer projectId={project.id} stage={stage} phase={phase} onGo={go} />
            </section>
            <section className="card backlog-column" id={CARDS.backlog} tabIndex={-1} aria-labelledby="backlog-heading">
              <h2 id="backlog-heading">Backlog</h2>
              <BacklogPanel projectId={project.id} version={backlogVersion} onBacklogChanged={() => setBacklogVersion((v) => v + 1)} onNewView={openNewView} />
            </section>
          </div>
        </>
      )}
    </main>
  );
}

// Vestluse ploki päis: AI sõnum, mis ütleb, mida see samm teeb.
function BlockHead({ id, title, children }) {
  return (
    <header className="chat-block__head">
      <p className="msg__who">AI</p>
      <h3 id={id}>{title}</h3>
      <p>{children}</p>
    </header>
  );
}
