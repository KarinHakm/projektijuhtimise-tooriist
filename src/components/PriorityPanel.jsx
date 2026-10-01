import { useCallback, useEffect, useState } from 'react';
import { acceptPriority, choosePriority, getPriority, proposePriority } from '../api.js';
import AiError from './AiError.jsx';
import AiWait from './AiWait.jsx';

const POLL_MS = 3000;

// Vaade ilma andmete laadimiseta (renderdustestide jaoks eraldi).
// data = { focusStoryId, focusTitle, proposal, stories, aiRunning }
export function PriorityView({ data, busy = null, error = '', choosing = false, chosenId = null, onPropose, onAccept, onStartChoosing, onPick, onChoose, onCancel }) {
  const { focusTitle, proposal, stories } = data;
  const disabled = Boolean(busy);

  if (stories.length === 0) return <p className="muted">Prioriteeti saab küsida pärast lugude lisamist backlog'i.</p>;

  return (
    <div className="priority">
      {focusTitle && (
        <p className="priority__focus">
          <span className="tag tag--focus">Alustame sellest</span> {focusTitle}
        </p>
      )}

      {proposal && !choosing && (
        <section className="priority-proposal" aria-labelledby="priority-proposal-title">
          <h3 id="priority-proposal-title">AI soovitus – ei ole veel kinnitatud</h3>
          {proposal.message && <p>{proposal.message}</p>}
          <p><strong>Soovitan alustada loost:</strong> {proposal.title}</p>
          <p><strong>Põhjendus:</strong> {proposal.reason}</p>
          <div className="actions">
            <button type="button" onClick={onAccept} disabled={disabled}>
              {busy === 'accept' ? 'Kinnitan…' : 'Nõus, alustame sellest'}
            </button>
            <button type="button" className="secondary" onClick={onStartChoosing} disabled={disabled}>Valin ise teise</button>
          </div>
        </section>
      )}

      {choosing && (
        <fieldset className="priority-choose">
          <legend>Vali lugu, millest alustada</legend>
          {stories.map((s, i) => (
            <label key={s.id} className="priority-choose__option">
              <input type="radio" name="priority-story" value={s.id} checked={chosenId === s.id} onChange={() => onPick(s.id)} disabled={disabled} />
              {i + 1}. {s.title}
            </label>
          ))}
          <div className="actions">
            <button type="button" onClick={onChoose} disabled={disabled || chosenId === null}>
              {busy === 'choose' ? 'Salvestan…' : 'Alustame sellest'}
            </button>
            <button type="button" className="secondary" onClick={onCancel} disabled={disabled}>Tühista</button>
          </div>
        </fieldset>
      )}

      {!proposal && !choosing && (
        <>
          {!focusTitle && <p>Milline lugu on kliendile kõige olulisem? AI soovitab, millest alustada; otsuse teed sina.</p>}
          <div className="actions">
            <button type="button" onClick={onPropose} disabled={disabled}>
              {focusTitle ? 'Küsi AI-lt uus soovitus' : 'Küsi AI soovitust'}
            </button>
            <button type="button" className="secondary" onClick={onStartChoosing} disabled={disabled}>
              {focusTitle ? 'Vali teine lugu' : 'Valin ise'}
            </button>
          </div>
        </>
      )}

      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

// Prioriteet (L08): AI soovitab ühe loo koos põhjendusega; kasutaja nõustub või valib ise teise.
// backlogVersion muutub, kui backlog muutub; onFocusChanged annab backlog'i paneelile teada uuest märgist.
export default function PriorityPanel({ projectId, backlogVersion, onFocusChanged }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(null); // 'propose' | 'accept' | 'choose' | null
  const [aiError, setAiError] = useState(null);
  const [error, setError] = useState('');
  const [choosing, setChoosing] = useState(false);
  const [chosenId, setChosenId] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setData(await getPriority(projectId));
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh, backlogVersion]);

  useEffect(() => {
    if (!data?.aiRunning || busy) return undefined;
    const timer = setTimeout(refresh, POLL_MS);
    return () => clearTimeout(timer);
  }, [data, busy, refresh]);

  async function run(kind, call, { focusChanges = false } = {}) {
    setBusy(kind);
    setError('');
    if (kind === 'propose') setAiError(null);
    try {
      setData(await call());
      if (focusChanges) {
        setChoosing(false);
        setChosenId(null);
        onFocusChanged?.();
      }
    } catch (e) {
      if (kind === 'propose') { if (e.code !== 'in_progress') setAiError(e); } else setError(e.message);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  if (loadError) return <p className="error">Prioriteeti ei saanud laadida: {loadError}</p>;
  if (!data) return <p className="muted">Laadin…</p>;

  const waiting = busy === 'propose' || data.aiRunning;
  return (
    <>
      {waiting ? <AiWait label="AI valib loo, millest alustada" /> : (
        <PriorityView
          data={data}
          busy={busy}
          error={error}
          choosing={choosing}
          chosenId={chosenId}
          onPropose={() => run('propose', () => proposePriority(projectId))}
          onAccept={() => run('accept', () => acceptPriority(projectId, data.proposal.id), { focusChanges: true })}
          onStartChoosing={() => { setChoosing(true); setChosenId(data.focusStoryId ?? null); }}
          onPick={setChosenId}
          onChoose={() => run('choose', () => choosePriority(projectId, chosenId), { focusChanges: true })}
          onCancel={() => { setChoosing(false); setChosenId(null); }}
        />
      )}
      {!waiting && aiError && <AiError error={aiError} onRetry={() => run('propose', () => proposePriority(projectId))} retrying={busy === 'propose'} />}
    </>
  );
}
