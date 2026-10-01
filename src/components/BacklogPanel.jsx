import { useCallback, useEffect, useRef, useState } from 'react';
import { addStoryQuestion, getStories, moveStory, resolveStoryQuestion, setMvpLine, setStoryStatus } from '../api.js';
import { focusAfterMove, movedMessage, sizeCounts } from '../backlog/order.js';
import BacklogList from './BacklogList.jsx';

const HIGHLIGHT_MS = 1500;

// Kokkuvõte, teated ja loend ilma andmete laadimiseta (renderdustestide jaoks eraldi).
export function BacklogView({ stories, focusStoryId = null, busy = false, error = '', status = '', highlightId = null, onMove, buttonRef, readiness = null, mvpCount = null, onMvp = null }) {
  const counts = sizeCounts(stories);
  return (
    <>
      <p className="muted backlog__summary">
        {stories.length} lugu · S {counts.S} · M {counts.M} · L {counts.L}
        {mvpCount !== null && mvpCount !== undefined && <> · MVP: {mvpCount} lugu</>}
      </p>
      <p className="backlog__status" role="status" aria-live="polite">{status}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <BacklogList stories={stories} busy={busy} highlightId={highlightId} focusStoryId={focusStoryId} onMove={onMove} buttonRef={buttonRef} readiness={readiness} mvpCount={mvpCount} onMvp={onMvp} />
    </>
  );
}

// Backlog vestluse kõrval (L07). version muutub, kui lugusid lisatakse; siis laaditakse loend uuesti.
// Järjekord muutub ekraanil alles pärast serveri vastust, nii et näha on alati salvestatud seis.
export default function BacklogPanel({ projectId, version }) {
  const [stories, setStories] = useState(null);
  const [focusStoryId, setFocusStoryId] = useState(null); // L08: "Alustame sellest"
  const [mvpCount, setMvpCount] = useState(null); // L17
  const pendingMvpFocus = useRef(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [highlight, setHighlight] = useState(null); // { id } – uus objekt iga tõstega, et esiletõst algaks otsast
  const buttons = useRef(new Map());
  const pendingFocus = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getStories(projectId);
      setStories(data.stories);
      setFocusStoryId(data.focusStoryId ?? null);
      setMvpCount(data.mvpCount ?? null);
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh, version]);
  // Kriteeriumide, mockup'i jm muutus mõjutab valmisolekut: loend laaditakse uuesti iga muutva päringu järel (api.js sündmus).
  useEffect(() => {
    window.addEventListener('pjt:changed', refresh);
    return () => window.removeEventListener('pjt:changed', refresh);
  }, [refresh]);

  // L19/L20: staatus ja avatud küsimused. Viga näidatakse selle loo lahtris.
  const [readinessError, setReadinessError] = useState({ id: null, message: '' });
  async function runReadiness(storyId, call) {
    setBusy(true);
    setReadinessError({ id: null, message: '' });
    try {
      const data = await call();
      setStories(data.stories);
      return true;
    } catch (e) {
      setReadinessError({ id: storyId, message: e.message });
      await refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }
  // L17: MVP joon. Teade ekraanilugejale ja fookus jääb joone nupule (servas teisele nupule).
  async function changeMvp(count, kind) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const data = await setMvpLine(projectId, count);
      setStories(data.stories);
      setMvpCount(data.mvpCount ?? null);
      setStatus(count === null ? 'MVP joon eemaldati.'
        : count === 0 ? "MVP joon on backlog'i kõige ülemine – MVP-s lugusid pole."
          : `MVP joon on nüüd loo ${count} all. MVP-s on ${count} lugu.`);
      pendingMvpFocus.current = { kind, count, total: data.stories.length };
    } catch (e) {
      setError(e.message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (busy || !pendingMvpFocus.current) return;
    const { kind, count, total } = pendingMvpFocus.current;
    pendingMvpFocus.current = null;
    const get = (d) => buttons.current.get(`mvp-${d}`);
    if (count === null) get('add')?.focus();
    else if (kind === 'up' || kind === 'add') (count === 0 ? get('down') : get('up'))?.focus();
    else (count === total ? get('up') : get('down'))?.focus();
  }, [busy, mvpCount]);

  const readiness = {
    errorFor: readinessError.id,
    error: readinessError.message,
    onStatus: (id, value) => runReadiness(id, () => setStoryStatus(projectId, id, value)),
    onAddQuestion: (id, text) => runReadiness(id, () => addStoryQuestion(projectId, id, text)),
    onResolve: (id, questionId) => runReadiness(id, () => resolveStoryQuestion(projectId, id, questionId)),
  };

  useEffect(() => {
    if (!highlight) return undefined;
    const timer = setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlight]);

  // Nupud on päringu ajal keelatud; fookus antakse tagasi alles siis, kui need on uuesti lubatud.
  useEffect(() => {
    if (busy || !pendingFocus.current || !stories) return;
    const { id, direction } = pendingFocus.current;
    pendingFocus.current = null;
    const target = focusAfterMove(stories, id, direction);
    if (target) buttons.current.get(`${id}-${target}`)?.focus();
  }, [busy, stories]);

  const buttonRef = (id, direction) => (el) => {
    if (el) buttons.current.set(`${id}-${direction}`, el);
    else buttons.current.delete(`${id}-${direction}`);
  };

  async function move(id, direction) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const data = await moveStory(projectId, id, direction);
      setStories(data.stories);
      setFocusStoryId(data.focusStoryId ?? null);
      setMvpCount(data.mvpCount ?? null);
      setStatus(movedMessage(data.stories, id));
      setHighlight({ id });
      pendingFocus.current = { id, direction };
    } catch (e) {
      setError(e.message);
      if (e.status === 404 || e.status === 409) await refresh(); // nt teises vahelehes vahepeal tõstetud
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <p className="error">Backlog'i ei saanud laadida: {loadError}</p>;
  if (!stories) return <p className="muted">Laadin backlog'i…</p>;

  return (
    <BacklogView
      stories={stories}
      focusStoryId={focusStoryId}
      busy={busy}
      error={error}
      status={status}
      highlightId={highlight?.id ?? null}
      onMove={move}
      buttonRef={buttonRef}
      readiness={readiness}
      mvpCount={mvpCount}
      onMvp={changeMvp}
    />
  );
}
