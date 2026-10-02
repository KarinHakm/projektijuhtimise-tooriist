import { useCallback, useEffect, useState } from 'react';
import { applyFinding, getReview, ignoreFinding, runReview } from '../api.js';
import { composeTitle } from '../../shared/story-format.js';
import AiWait from './AiWait.jsx';
import DemoTag from './DemoTag.jsx';

// Backlog'i ülevaatus (L27). Ülevaatuse käivitamine ei muuda backlog'i. Iga leiu juures [Rakenda] [Muuda] [Ignoreeri]:
// tüübid 1–4 rakendatakse siin, jagamine (5) ja ühendamine (6) avavad olemasoleva eelvaatega vormi backlog'is.

export const TYPE_LABELS = {
  connextra: 'Pealkirja vorm', no_criteria: 'Kriteeriumid puuduvad', untestable: 'Mittekontrollitav kriteerium',
  no_mockup: "Mockup puudub", too_large: 'Liiga suur lugu', overlap: 'Kattuvad lood',
};
export const DECISION_LABELS = { not_view: 'märgi mitte-vaatelooks', needs_mockup: "lisa küsimus „Vajab mockup'i“" };
const STATUS_TEXT = { applied: 'Rakendatud', ignored: 'Ignoreeritud' };

// Leiu ettepaneku tekst kaardil. Mockup'i leiu juures on alati näha, kumba tulemust AI soovitab.
function Suggestion({ f }) {
  const s = f.suggestion;
  if (!s) {
    if (f.type === 'no_mockup') return <p><strong>Ettepanek:</strong> AI otsust pole – vajuta „Muuda“ ja vali ise, kas lugu puudutab vaadet.</p>;
    return <p><strong>Ettepanek:</strong> AI ettepanekut pole – vajuta „Muuda“ ja paranda ise.</p>;
  }
  const why = s.reason ? <span className="muted"> ({s.reason})</span> : null;
  switch (f.type) {
    case 'connextra': return <p><strong>Ettepanek:</strong> {composeTitle(s)}{why}</p>;
    case 'no_criteria': return <><p><strong>Ettepanek:</strong> lisa kriteeriumid{why}</p><ol>{s.criteria.map((c) => <li key={c}>{c}</li>)}</ol></>;
    case 'untestable': return <p><strong>Ettepanek:</strong> asenda tekstiga „{s.text}“{why}</p>;
    case 'no_mockup': return <p><strong>AI soovitab:</strong> {DECISION_LABELS[s.decision]}{why}</p>;
    case 'too_large': return <><p><strong>Ettepanek:</strong> jaga kaheks loo eelvaatega:</p><ol><li>… soovin {s.first.want}, et {s.first.soThat}</li><li>… soovin {s.second.want}, et {s.second.soThat}</li></ol></>;
    case 'overlap': return <p><strong>Ettepanek:</strong> {s.text}</p>;
    default: return null;
  }
}

// „Muuda“: ettepanek enne rakendamist muudetavana (tüübid 1–4).
function FindingEditor({ f, busy, error, onSubmit, onCancel }) {
  const s = f.suggestion;
  const [text, setText] = useState(() => (f.type === 'connextra' ? s ?? f.before : null));
  const [criteria, setCriteria] = useState(() => (s?.criteria ?? ['']).join('\n'));
  const [criterion, setCriterion] = useState(() => s?.text ?? f.before.text ?? '');
  const [decision, setDecision] = useState(() => s?.decision ?? null); // AI-ta valikut ette ei tehta
  const id = `leid-${f.id}`;
  const submit = (e) => {
    e.preventDefault();
    if (f.type === 'connextra') onSubmit(text);
    if (f.type === 'no_criteria') onSubmit({ criteria: criteria.split('\n').map((c) => c.trim()).filter(Boolean) });
    if (f.type === 'untestable') onSubmit({ text: criterion });
    if (f.type === 'no_mockup') onSubmit({ decision });
  };
  return (
    <form className="story-form review-edit" onSubmit={submit} noValidate>
      {f.type === 'connextra' && (['rolePhrase', 'want', 'soThat']).map((k) => (
        <p key={k}>
          <label htmlFor={`${id}-${k}`}>{{ rolePhrase: 'Roll (olevas käändes)', want: 'soovin …', soThat: 'et …' }[k]}</label>
          <input id={`${id}-${k}`} value={text[k]} disabled={busy} aria-invalid={error?.field === k || undefined}
            onChange={(e) => setText({ ...text, [k]: e.target.value })} />
        </p>
      ))}
      {f.type === 'no_criteria' && (
        <p>
          <label htmlFor={`${id}-k`}>Kriteeriumid (üks rea kohta)</label>
          <textarea id={`${id}-k`} rows={5} value={criteria} disabled={busy} onChange={(e) => setCriteria(e.target.value)} />
        </p>
      )}
      {f.type === 'untestable' && (
        <p>
          <label htmlFor={`${id}-t`}>Kriteerium</label>
          <input id={`${id}-t`} value={criterion} disabled={busy} onChange={(e) => setCriterion(e.target.value)} />
        </p>
      )}
      {f.type === 'no_mockup' && (
        <fieldset>
          <legend>Mida teha?</legend>
          {Object.entries(DECISION_LABELS).map(([key, label]) => (
            <label key={key} className="review-edit__choice">
              <input type="radio" name={`${id}-otsus`} checked={decision === key} disabled={busy} onChange={() => setDecision(key)} /> {label[0].toUpperCase() + label.slice(1)}
              {s?.decision === key && <span className="muted"> (AI soovitus)</span>}
            </label>
          ))}
        </fieldset>
      )}
      {error && <p className="error" role="alert">{error.message}</p>}
      <div className="actions">
        <button type="submit" disabled={busy || (f.type === 'no_mockup' && !decision)}>Rakenda muudetuna</button>
        <button type="button" className="secondary" disabled={busy} onClick={onCancel}>Tühista</button>
      </div>
    </form>
  );
}

function FindingCard({ f, number, busy, editing, error, actions }) {
  const decided = f.status !== 'open';
  const canApply = !decided && !f.stale && f.suggestion !== null;
  return (
    <li className={`review-finding${decided ? ' review-finding--decided' : ''}`}>
      <p className="review-finding__head">
        <span className="tag">{TYPE_LABELS[f.type]}</span>{' '}
        <span className="muted">{f.source === 'ai' ? 'AI leid' : 'Rakenduse kontroll'}</span>
        {decided && <> · <strong>{STATUS_TEXT[f.status]}</strong></>}
      </p>
      <p className="review-finding__stories">
        {f.stories.map((s) => <span key={s.id}>Lugu {number(s.id) ?? '–'}: {s.title ?? '(kustutatud)'}<br /></span>)}
      </p>
      {!decided && (
        <>
          <p><strong>Probleem:</strong> {f.problem}</p>
          <p><strong>Põhjendus:</strong> {f.reason}</p>
          <Suggestion f={f} />
          {f.stale && <p className="error">Lugu on pärast ülevaatust muutunud – see leid on aegunud. Käivita ülevaatus uuesti.</p>}
          {editing ? (
            <FindingEditor f={f} busy={busy} error={error} onSubmit={(value) => actions.apply(f, value)} onCancel={actions.cancelEdit} />
          ) : (
            <>
              {error && <p className="error" role="alert">{error.message}</p>}
              <div className="actions">
                <button type="button" disabled={busy || !canApply} onClick={() => actions.apply(f)}>Rakenda</button>
                <button type="button" className="secondary" disabled={busy || f.stale} onClick={() => actions.edit(f)}>Muuda</button>
                <button type="button" className="secondary" disabled={busy} onClick={() => actions.ignore(f)}>Ignoreeri</button>
              </div>
            </>
          )}
        </>
      )}
    </li>
  );
}

// Vaade ilma andmete laadimiseta (renderdustestide jaoks eraldi).
export function ReviewView({ review, stories, running = false, busy = false, error = null, notice = '', editingId = null, findingError = null, onRun, actions }) {
  const number = (id) => { const i = stories.findIndex((s) => s.id === id); return i < 0 ? null : i + 1; };
  const open = review?.findings.filter((f) => f.status === 'open') ?? [];
  const decided = review?.findings.filter((f) => f.status !== 'open') ?? [];
  return (
    <section className="review" aria-label="Backlog'i ülevaatus">
      <button type="button" className="secondary" data-step="review-run" disabled={busy || running || stories.length === 0} onClick={onRun}>
        {review ? "Vaata backlog uuesti üle" : "Vaata backlog üle"}
      </button>
      {running && <AiWait label="Vaatan backlog'i üle" />}
      {error && <p className="error" role="alert">{error}</p>}
      <p role="status" aria-live="polite" className="notice">{notice}</p>
      {review && (
        <div className="review__result">
          <p className="review__summary">
            {review.demo && <><DemoTag />{' '}</>}
            Ülevaatus: {open.length ? `${open.length} avatud leidu` : 'avatud leide pole'}{decided.length > 0 && `, ${decided.length} otsustatud`}.
            {review.message && <> {review.message}</>}
          </p>
          {review.aiNote && <p className="muted">{review.aiNote}</p>}
          <ul className="review__list">
            {[...open, ...decided].map((f) => (
              <FindingCard key={f.id} f={f} number={number} busy={busy || running} editing={editingId === f.id}
                error={findingError?.id === f.id ? findingError : null} actions={actions} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// onSplit(storyId, initial, findingId) ja onMerge(keepId, removeId | null, findingId) avavad backlog'i vormi.
export default function ReviewPanel({ projectId, stories, onSplit, onMerge }) {
  const [review, setReview] = useState(null);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [findingError, setFindingError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getReview(projectId);
      setReview(data.review);
      setRunning(data.aiRunning);
    } catch (e) {
      setError(e.message);
    }
  }, [projectId]);
  useEffect(() => { refresh(); }, [refresh]);
  // Backlog'i muutus võib leiu aegunuks muuta: laadi uuesti iga muutva päringu järel (api.js sündmus).
  useEffect(() => {
    window.addEventListener('pjt:changed', refresh);
    return () => window.removeEventListener('pjt:changed', refresh);
  }, [refresh]);

  async function run() {
    setRunning(true);
    setError('');
    setNotice('');
    setEditingId(null);
    try {
      const data = await runReview(projectId);
      setReview(data.review);
      setNotice("Ülevaatus on valmis. Backlog'i ei muudetud.");
      // Leiud on pika backlog'i veeru ülaosas: keri esimese avatud leiuni (kui neid on).
      if (data.review?.findings.some((f) => f.status === 'open')) {
        requestAnimationFrame(() => document.querySelector('.review-finding:not(.review-finding--decided)')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  async function decide(f, call) {
    setBusy(true);
    setFindingError(null);
    setNotice('');
    try {
      const data = await call();
      setReview(data.review);
      setEditingId(null);
      setNotice(data.result);
    } catch (e) {
      setFindingError({ id: f.id, message: e.message, field: e.field });
    } finally {
      setBusy(false);
    }
  }

  const actions = {
    apply: (f, value) => {
      if (f.type === 'too_large') return onSplit(f.storyIds[0], f.suggestion, f.id);
      if (f.type === 'overlap') return onMerge(f.suggestion.keepId, f.suggestion.removeId, f.id);
      return decide(f, () => applyFinding(projectId, f.id, value));
    },
    edit: (f) => {
      setFindingError(null);
      if (f.type === 'too_large') return onSplit(f.storyIds[0], null, f.id);
      if (f.type === 'overlap') return onMerge(f.storyIds[0], null, f.id);
      return setEditingId(f.id);
    },
    cancelEdit: () => { setEditingId(null); setFindingError(null); },
    ignore: (f) => decide(f, () => ignoreFinding(projectId, f.id)),
  };

  return <ReviewView review={review} stories={stories} running={running} busy={busy} error={error} notice={notice}
    editingId={editingId} findingError={findingError} onRun={run} actions={actions} />;
}
