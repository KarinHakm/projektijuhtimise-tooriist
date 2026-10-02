import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addStoryQuestion, createStory, deleteStory, getDeleteImpact, getSplitInfo, getStories, moveStory, resolveStoryQuestion, setMvpLine, setStoryStatus,
  getMergeInfo, mergeStoriesInto, splitStoryInTwo, updateStory, applyFinding, addCriterion, updateCriterion, deleteCriterion, markOverlap, unmarkOverlap,
} from '../api.js';
import ReviewPanel from './ReviewPanel.jsx';
import StoryForm from './StoryForm.jsx';
import { focusAfterMove, movedMessage, sizeCounts } from '../backlog/order.js';
import BacklogList from './BacklogList.jsx';

const HIGHLIGHT_MS = 1500;

// Kokkuvõte, teated ja loend ilma andmete laadimiseta (renderdustestide jaoks eraldi).
// review = L27 ülevaatuse paneel (element) või null.
export function BacklogView({ stories, focusStoryId = null, busy = false, error = '', status = '', highlightId = null, onMove, buttonRef, readiness = null, mvpCount = null, onMvp = null, manage = null, review = null }) {
  const counts = sizeCounts(stories);
  return (
    <>
      <p className="muted backlog__summary">
        {stories.length} lugu · S {counts.S} · M {counts.M} · L {counts.L}
        {mvpCount !== null && mvpCount !== undefined && <> · MVP: {mvpCount} lugu</>}
      </p>
      <p className="backlog__status" role="status" aria-live="polite">{status}</p>
      {error && <p className="error" role="alert">{error}</p>}
      {review}
      {/* L15: käsitsi lisamine; uus lugu läheb backlog'i lõppu (MVP joone alla). */}
      {manage && manage.mode?.type !== 'add' && (
        <button type="button" className="secondary backlog__add" disabled={busy} onClick={manage.onAdd}>+ Lisa lugu</button>
      )}
      {manage?.mode?.type === 'add' && (
        <section className="story-form-box" aria-label="Uus lugu">
          <p className="story-form-box__title">Uus lugu (lisatakse backlog'i lõppu)</p>
          <StoryForm idBase="uus-lugu" roles={manage.roles} stories={stories} busy={busy} error={manage.error}
            submitLabel="Lisa backlog'i" onSubmit={manage.onCreate} onCancel={manage.onCancel} />
        </section>
      )}
      <BacklogList stories={stories} busy={busy} highlightId={highlightId} focusStoryId={focusStoryId} onMove={onMove} buttonRef={buttonRef} readiness={readiness} mvpCount={mvpCount} onMvp={onMvp} manage={manage} />
    </>
  );
}

// Backlog vestluse kõrval (L07). version muutub, kui lugusid lisatakse; siis laaditakse loend uuesti.
// Järjekord muutub ekraanil alles pärast serveri vastust, nii et näha on alati salvestatud seis.
export default function BacklogPanel({ projectId, version, onBacklogChanged }) {
  const [stories, setStories] = useState(null);
  const [focusStoryId, setFocusStoryId] = useState(null); // L08: "Alustame sellest"
  const [mvpCount, setMvpCount] = useState(null); // L17
  const [roles, setRoles] = useState([]); // L15: vormi rollisoovitused
  const [mode, setMode] = useState(null); // L15: null | { type: 'add' } | { type: 'edit', id } | { type: 'delete', id, impact }
  const [manageError, setManageError] = useState(null);
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
      setRoles(data.roles ?? []);
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

  // L15: lugude käsitsi lisamine, muutmine ja kustutamine.
  async function runManage(call, message) {
    setBusy(true);
    setManageError(null);
    setStatus('');
    try {
      const data = await call();
      setStories(data.stories);
      setFocusStoryId(data.focusStoryId ?? null);
      setMvpCount(data.mvpCount ?? null);
      setMode(null);
      setStatus(message(data));
      onBacklogChanged?.(); // prioriteedi, kriteeriumide ja täpsustuse paneelid laadivad uuesti
    } catch (e) {
      setManageError({ message: e.message, field: e.field });
    } finally {
      setBusy(false);
    }
  }
  // L27–L29: ülevaatuse leiust avatud jagamis- või ühendamisvorm (mode.findingId); kinnitamine käib leiu kaudu.
  const showForm = () => requestAnimationFrame(() => document.querySelector('.backlog .split-form, .backlog .merge-form')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  const openFromReview = async (load) => {
    setManageError(null);
    try {
      const next = await load();
      setMode(next);
      showForm();
    } catch (e) {
      setError(e.message);
      await refresh();
    }
  };
  const review = (
    <ReviewPanel projectId={projectId} stories={stories ?? []}
      onSplit={(id, initial, findingId) => openFromReview(async () => ({ type: 'split', id, info: await getSplitInfo(projectId, id), initial, findingId }))}
      onMerge={(keepId, removeId, findingId, initial) => openFromReview(async () => ({
        type: 'merge', id: keepId, info: removeId ? await getMergeInfo(projectId, keepId, removeId) : null, findingId,
        initial: initial ? { keepId, ...initial } : null,
      }))} />
  );

  const manage = {
    mode,
    roles,
    error: manageError,
    onAdd: () => { setManageError(null); setMode({ type: 'add' }); },
    onEdit: (id) => { setManageError(null); setMode({ type: 'edit', id }); },
    onCancel: () => { setManageError(null); setMode(null); },
    onCreate: (value) => runManage(() => createStory(projectId, value), (d) => `Lugu lisati backlog'i lõppu (koht ${d.stories.length}).`),
    onSave: (id, value) => runManage(() => updateStory(projectId, id, value), () => 'Loo muudatus salvestati.'),
    onDelete: async (id) => {
      setManageError(null);
      try {
        setMode({ type: 'delete', id, impact: await getDeleteImpact(projectId, id) });
        // L26: „Eemalda lugu N“ kattuvusmärke juurest – kinnitus on selle loo real, keri sinna.
        requestAnimationFrame(() => document.querySelector('.backlog .delete-confirm')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      } catch (e) {
        setError(e.message);
        await refresh();
      }
    },
    onSplit: async (id) => {
      setManageError(null);
      try {
        setMode({ type: 'split', id, info: await getSplitInfo(projectId, id) });
      } catch (e) {
        setError(e.message);
        await refresh();
      }
    },
    // L28: ülevaatuse leiust avatud vorm jagab leiu kaudu (server salvestab tagasivõtmise seisu); muidu käsitsi jagamine (L25).
    onConfirmSplit: (id, body) => (mode?.findingId
      ? runManage(async () => {
        const { result } = await applyFinding(projectId, mode.findingId, body);
        return { ...(await getStories(projectId)), reviewResult: result };
      }, (d) => d.reviewResult)
      : runManage(() => splitStoryInTwo(projectId, id, body), (d) => {
      const at = d.stories.findIndex((x) => x.id === d.split.secondId) + 1;
      return `Lugu jagati kaheks: osa 2 on kohal ${at}.${d.split.rejectedProposals ? ` Ootel ettepanekuid lükati tagasi: ${d.split.rejectedProposals}.` : ''}`;
    })),
    onMerge: (id) => { setManageError(null); setMode({ type: 'merge', id, info: null }); },
    // L26: kattuvaks märkimine, „Pole kattuv“ ja märke juurest ühendamine (olemasolev L26 vorm valitud paariga).
    onMarkOverlapStart: (id) => { setManageError(null); setMode({ type: 'overlap', id }); },
    onMarkOverlap: (id, withId) => runManage(() => markOverlap(projectId, id, withId), (d) => {
      const n = (x) => d.stories.findIndex((st) => st.id === x) + 1;
      return `Lood ${n(id)} ja ${n(withId)} märgiti kattuvaks. Otsusta hiljem: ühenda või eemalda üks.`;
    }),
    onUnmarkOverlap: (id, otherId) => runManage(() => unmarkOverlap(projectId, id, otherId), () => 'Kattuvusmärge eemaldati. Lood jäid muutmata.'),
    onOverlapMerge: async (id, otherId) => {
      setManageError(null);
      const order = (stories ?? []).map((st) => st.id);
      const [keep, remove] = order.indexOf(id) < order.indexOf(otherId) ? [id, otherId] : [otherId, id];
      try {
        setMode({ type: 'merge', id: keep, info: await getMergeInfo(projectId, keep, remove) });
        requestAnimationFrame(() => document.querySelector('.backlog .merge-form')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
      } catch (e) {
        setError(e.message);
        await refresh();
      }
    },
    onMergePick: async (id, keepId, removeId) => {
      setManageError(null);
      try {
        setMode({ type: 'merge', id, info: await getMergeInfo(projectId, keepId, removeId), findingId: mode?.findingId, initial: mode?.initial });
      } catch (e) {
        setManageError({ message: e.message });
      }
    },
    // L29: ülevaatuse leiust avatud vorm ühendab leiu kaudu (server salvestab tagasivõtmise seisu); muidu käsitsi (L26).
    onConfirmMerge: (keepId, body) => (mode?.findingId
      ? runManage(async () => {
        const { result } = await applyFinding(projectId, mode.findingId, { ...body, keepId });
        return { ...(await getStories(projectId)), reviewResult: result };
      }, (d) => d.reviewResult)
      : runManage(() => mergeStoriesInto(projectId, keepId, body), (d) => {
      const at = d.stories.findIndex((x) => x.id === d.merge.keepId) + 1;
      return `Lood ühendati: ühendatud lugu on kohal ${at}.${d.merge.removedCriteria ? ` Eemaldatud kriteeriume: ${d.merge.removedCriteria}.` : ''}${d.merge.rejectedProposals ? ` Ootel ettepanekuid lükati tagasi: ${d.merge.rejectedProposals}.` : ''}`;
    })),
    onConfirmDelete: (id) => runManage(() => deleteStory(projectId, id),
      (d) => (d.deleted.isFocus ? 'Lugu kustutati. See oli alustamise lugu – vali prioriteedi juures uus.' : 'Lugu kustutati.')),
  };

  const readiness = {
    errorFor: readinessError.id,
    error: readinessError.message,
    onStatus: (id, value) => runReadiness(id, () => setStoryStatus(projectId, id, value)),
    onAddQuestion: (id, text) => runReadiness(id, () => addStoryQuestion(projectId, id, text)),
    onResolve: (id, questionId) => runReadiness(id, () => resolveStoryQuestion(projectId, id, questionId)),
    // L15: kriteeriumide muutus mõjutab ka alustamise loo kaarti ja täpsustust – need laaditakse uuesti.
    onAddCriterion: (id, text) => runReadiness(id, () => addCriterion(projectId, id, text)).then((ok) => { if (ok) onBacklogChanged?.(); return ok; }),
    onUpdateCriterion: (id, criterionId, text) => runReadiness(id, () => updateCriterion(projectId, id, criterionId, text)).then((ok) => { if (ok) onBacklogChanged?.(); return ok; }),
    onDeleteCriterion: (id, criterionId) => runReadiness(id, () => deleteCriterion(projectId, id, criterionId)).then((ok) => { if (ok) onBacklogChanged?.(); return ok; }),
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
      manage={manage}
      review={review}
    />
  );
}
