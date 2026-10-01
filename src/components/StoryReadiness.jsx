import { useState } from 'react';
import { READY, STORY_STATUSES } from '../../shared/dor.js';
import { STATUS_LABELS } from '../stories/selection.js';

// Loo staatus, valmisoleku definitsioon (DoR) ja avatud küsimused (L19, L20). Kõik on käsitsi tegevused.
// „Valmis arenduseks“ on valikus keelatud, kui DoR pole täidetud; küsimuse vastamine staatust ei muuda.
export default function StoryReadiness({ story, busy = false, error = '', onStatus, onAddQuestion, onResolve }) {
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
