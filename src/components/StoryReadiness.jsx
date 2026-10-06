import { useState } from 'react';
import { READY, STORY_STATUSES } from '../../shared/dor.js';
import { STATUS_LABELS } from '../stories/selection.js';
import { checkCriterion, CRITERION_MAX } from '../../shared/criteria-check.js';

const ORIGIN = { ai: 'AI', ai_edited: 'AI, muudetud', manual: 'käsitsi' };
const MAX_CRITERIA = 10;

// L15: vastuvõtukriteeriumide käsitsi lisamine, muutmine ja kinnitusega kustutamine. Hoiatus uueneb kirjutamise ajal
// (sama checkCriterion reegel mis serveris); salvestamist see ei keela. Seos mockup'iga on kriteeriumi enda väli.
function StoryCriteria({ story, busy, onAdd, onUpdate, onDelete }) {
  const [mode, setMode] = useState(null); // null | { type: 'edit' | 'delete', id }
  const [draft, setDraft] = useState('');
  const [text, setText] = useState('');
  const idBase = `loo-${story.id}-k`;
  const warnings = (t) => (t.trim() ? checkCriterion(t).map((w) => w.message) : []);
  const startEdit = (c) => { setMode({ type: 'edit', id: c.id }); setDraft(c.text); };
  const link = (c) => (c.linkLabel ? `Seos: ${c.linkLabel}` : "Seos mockup'iga puudub");

  async function add(e) {
    e.preventDefault();
    if (text.trim() && await onAdd(text)) setText('');
  }
  async function save(e, c) {
    e.preventDefault();
    if (await onUpdate(c.id, draft)) setMode(null);
  }

  return (
    <>
      <p className="story-ready__heading">Vastuvõtukriteeriumid</p>
      {story.criteria.length === 0 && <p className="muted">Kriteeriume pole.</p>}
      {story.criteria.length > 0 && (
        <ol className="story-criteria">
          {story.criteria.map((c, i) => (
            <li key={c.id}>
              {mode?.type === 'edit' && mode.id === c.id ? (
                <form onSubmit={(e) => save(e, c)} noValidate>
                  <label htmlFor={`${idBase}-${c.id}`}>K{i + 1} tekst</label>
                  <input id={`${idBase}-${c.id}`} value={draft} maxLength={CRITERION_MAX} disabled={busy} onChange={(e) => setDraft(e.target.value)} />
                  {warnings(draft).map((w) => <p key={w} className="warning">⚠ {w}</p>)}
                  {c.linkLabel && <p className="muted">Seos mockup'iga („{c.linkLabel}“) jääb alles – kontrolli pärast muutmist kooskõla.</p>}
                  <span className="actions">
                    <button type="submit" disabled={busy || !draft.trim()}>Salvesta</button>
                    <button type="button" className="secondary" disabled={busy} onClick={() => setMode(null)}>Tühista</button>
                  </span>
                </form>
              ) : (
                <>
                  <span><strong>K{i + 1}.</strong> {c.text} <span className="tag">{ORIGIN[c.origin] ?? c.origin}</span></span>
                  {c.warnings.map((w) => <p key={w} className="warning">⚠ {w}</p>)}
                  <span className="muted story-criteria__link">{link(c)}</span>
                  {mode?.type === 'delete' && mode.id === c.id ? (
                    <span className="story-criteria__confirm" role="alert">
                      Kustuta K{i + 1} „{c.text}“?{c.linkLabel ? ` Koos sellega kaob seos „${c.linkLabel}“.` : ''}{' '}
                      <button type="button" disabled={busy} onClick={async () => { if (await onDelete(c.id)) setMode(null); }}>Kustuta</button>{' '}
                      <button type="button" className="secondary" disabled={busy} onClick={() => setMode(null)}>Tühista</button>
                    </span>
                  ) : (
                    <span className="story-manage">
                      <button type="button" className="link-button" disabled={busy || mode !== null} onClick={() => startEdit(c)} aria-label={`Muuda kriteeriumi K${i + 1}`}>✎ Muuda</button>
                      <button type="button" className="link-button story-manage__delete" disabled={busy || mode !== null}
                        onClick={() => setMode({ type: 'delete', id: c.id })} aria-label={`Kustuta kriteerium K${i + 1}`}>Kustuta</button>
                    </span>
                  )}
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      <form className="story-questions__add" onSubmit={add} noValidate>
        <label htmlFor={`${idBase}-uus`}>Lisa kriteerium</label>
        <input id={`${idBase}-uus`} value={text} maxLength={CRITERION_MAX} disabled={busy || story.criteria.length >= MAX_CRITERIA}
          onChange={(e) => setText(e.target.value)} placeholder="Nt: Iga sihtkoha kaardil on piirkonna nimi." />
        {warnings(text).map((w) => <p key={w} className="warning">⚠ {w}</p>)}
        <button type="submit" className="secondary" disabled={busy || !text.trim() || story.criteria.length >= MAX_CRITERIA}>Lisa kriteerium</button>
        {story.criteria.length >= MAX_CRITERIA && <p className="muted">Loos võib olla kuni {MAX_CRITERIA} kriteeriumi.</p>}
      </form>
    </>
  );
}

// Loo staatus, valmisoleku definitsioon (DoR) ja avatud küsimused (L19, L20). Kõik on käsitsi tegevused.
// „Valmis arenduseks“ on valikus keelatud, kui DoR pole täidetud; küsimuse vastamine staatust ei muuda.
// onAddCriterion / onUpdateCriterion / onDeleteCriterion (L15) tagastavad õnnestumisel true.
export default function StoryReadiness({ story, busy = false, error = '', onStatus, onAddQuestion, onResolve, onAddCriterion = null, onUpdateCriterion = null, onDeleteCriterion = null }) {
  const [text, setText] = useState('');
  const { readiness, questions } = story;
  const idBase = `loo-${story.id}`;

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    if (await onAddQuestion(text)) setText('');
  }

  return (
    <div className="story-ready" id={`${idBase}-valmisolek`}>
      {story.criteria && onAddCriterion && (
        <StoryCriteria story={story} busy={busy} onAdd={onAddCriterion} onUpdate={onUpdateCriterion} onDelete={onDeleteCriterion} />
      )}

      <label htmlFor={`${idBase}-staatus`}>Staatus</label>
      <select id={`${idBase}-staatus`} value={story.status} disabled={busy} onChange={(e) => onStatus(e.target.value)}>
        {STORY_STATUSES.map((s) => (
          <option key={s} value={s} disabled={s === READY && !readiness.ok && story.status !== READY}>
            {STATUS_LABELS[s]}{s === READY && !readiness.ok ? ' – DoR pole täidetud' : ''}
          </option>
        ))}
      </select>
      {readiness.expired && (
        <p className="warning story-ready__expired" role="status">
          Valmisolek aegunud: lugu ei vasta enam valmisoleku definitsioonile, seda ei loeta valmis olevaks. Paranda puudused või vali uus staatus.
        </p>
      )}

      <p className="story-ready__heading">Valmisoleku definitsioon (DoR)</p>
      <ul className="dor-list">
        {readiness.checks.map((c) => (
          <li key={c.key} className={c.ok ? 'dor-list__ok' : 'dor-list__missing'}>
            <span aria-hidden="true">{c.ok ? '✓' : '✗'}</span> {c.label}{c.detail ? ` – ${c.detail}` : ''}
            <span className="visually-hidden">{c.ok ? ' (täidetud)' : ' (puudu)'}</span>
          </li>
        ))}
      </ul>

      <p className="story-ready__heading">Avatud küsimused</p>
      {questions.length === 0 && <p className="muted">Küsimusi pole.</p>}
      {questions.length > 0 && (
        <ul className="story-questions">
          {questions.map((q) => (
            <li key={q.id}>
              <span className={q.resolvedAt ? 'story-questions__resolved' : ''}>{q.text}</span>{' '}
              {q.resolvedAt
                ? <span className="tag">vastatud</span>
                : <button type="button" className="secondary icon-button" disabled={busy} onClick={() => onResolve(q.id)}>Vastatud</button>}
            </li>
          ))}
        </ul>
      )}
      <form className="story-questions__add" onSubmit={submit} noValidate>
        <label htmlFor={`${idBase}-kusimus`}>Uus avatud küsimus</label>
        <input id={`${idBase}-kusimus`} value={text} maxLength={300} disabled={busy} onChange={(e) => setText(e.target.value)}
          placeholder="Nt: Klient täpsustab maksevõimalused." />
        <button type="submit" className="secondary" disabled={busy || !text.trim()}>Lisa küsimus</button>
        <p className="muted">Küsimuse lisamine muudab staatuse „Vajab täpsustamist“. Vastatuks märkimine staatust ei muuda.</p>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
