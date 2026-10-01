import { useCallback, useEffect, useRef, useState } from 'react';
import { getStories, moveStory } from '../api.js';
import { focusAfterMove, movedMessage, sizeCounts } from '../backlog/order.js';
import BacklogList from './BacklogList.jsx';

const HIGHLIGHT_MS = 1500;

// Kokkuvõte, teated ja loend ilma andmete laadimiseta (renderdustestide jaoks eraldi).
export function BacklogView({ stories, focusStoryId = null, busy = false, error = '', status = '', highlightId = null, onMove, buttonRef }) {
  const counts = sizeCounts(stories);
  return (
    <>
      <p className="muted backlog__summary">
        {stories.length} lugu · S {counts.S} · M {counts.M} · L {counts.L}
      </p>
      <p className="backlog__status" role="status" aria-live="polite">{status}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <BacklogList stories={stories} busy={busy} highlightId={highlightId} focusStoryId={focusStoryId} onMove={onMove} buttonRef={buttonRef} />
    </>
  );
}

// Backlog vestluse kõrval (L07). version muutub, kui lugusid lisatakse; siis laaditakse loend uuesti.
// Järjekord muutub ekraanil alles pärast serveri vastust, nii et näha on alati salvestatud seis.
export default function BacklogPanel({ projectId, version }) {
  const [stories, setStories] = useState(null);
  const [focusStoryId, setFocusStoryId] = useState(null); // L08: "Alustame sellest"
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
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh, version]);

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
    />
  );
}
