import { useCallback, useEffect, useState } from 'react';
import { applyNewView, getNewView, proposeNewView, rejectNewView } from '../api.js';
import { checkCriterion } from '../../shared/criteria-check.js';
import { componentLabel } from '../../shared/consistency.js';
import AiError from './AiError.jsx';
import AiWait from './AiWait.jsx';
import DemoTag from './DemoTag.jsx';
import MockupView from './MockupView.jsx';
import StoryFields from './StoryFields.jsx';
import { SelfCheckNote } from './Consistency.jsx';

// Uus vaade promptist (L24): kirjeldus → AI eelvaade (mockup, lugu, kriteeriumid) → [Lisa] [Muuda] [Loobu].
// „Lisa“ loob uue loo või lisab olemasolevale loole uue vaate (vaade 1 jääb puutumata); vaate number tuleb serverist.

const AI_ERRORS = new Set(['not_configured', 'timeout', 'unavailable', 'invalid_response', 'cli_missing', 'not_logged_in', 'usage_limit']);
const linkText = (ref, mockup) => (ref === -1 ? 'ei puuduta vaadet'
  : Number.isInteger(ref) && mockup.components[ref] ? `Seos: ${componentLabel(mockup.components[ref], ref)}` : "Seos mockup'iga puudub");
// Kriteeriumi hoiatused: muudetud teksti puhul arvutatakse uuesti; AI enesekontrolli märge ainult muutmata tekstil.
function CriterionNotes({ item, original }) {
  const edited = original === undefined || item.text !== original.text;
  return (
    <>
      {!edited && <SelfCheckNote mark={original.selfCheck} />}
      {checkCriterion(item.text).map((w) => <p key={w.message} className="warning">⚠ {w.message}</p>)}
    </>
  );
}

// Vaade ilma andmete laadimiseta (renderdustestide jaoks eraldi).
export function NewViewView({
  data, description = '', running = false, busy = false, aiError = null, error = '', notice = '', editing = false, draft = null, target = { kind: 'new', storyId: '' },
  onDescription, onPropose, onApply, onEdit, onCancelEdit, onReject, onDraft, onTarget,
}) {
  const p = data.proposal;
  const disabled = busy || running;
  const criteria = editing ? draft.criteria : p?.criteria ?? [];
  const byIndex = new Map((p?.criteria ?? []).map((c) => [c.index, c]));
  const setCriterion = (i, text) => onDraft({ ...draft, criteria: draft.criteria.map((c, j) => (j === i ? { ...c, text } : c)) });
  const targetStory = data.stories.find((s) => s.id === Number(target.storyId));
  return (
    <div className="new-view">
      {!p && (
        <form className="new-view__form" onSubmit={(e) => { e.preventDefault(); onPropose(); }} noValidate>
          <label htmlFor="uus-vaade">Kirjelda uut vaadet</label>
          <textarea id="uus-vaade" rows={3} maxLength={500} value={description} disabled={running} onChange={(e) => onDescription(e.target.value)}
            placeholder="Nt: Sihtkoha vaade, kus külastaja näeb vaatamisväärsuse kirjeldust ja saab selle reisiplaani lisada." />
          <button type="submit" disabled={running || !description.trim()} data-step="new-view-propose">Paku vaade (AI)</button>
        </form>
      )}
      {running && <AiWait label="AI koostab vaadet" />}
      <AiError error={aiError} onRetry={onPropose} retrying={running} />
      {notice && <p className="notice" role="status">{notice}</p>}
      {p && (
        <section className="new-view__proposal" aria-label="Uue vaate ettepanek">
          <p className="muted">{p.demo && <><DemoTag />{' '}</>}AI ettepanek – ei ole veel backlog'is. Kirjeldus: „{p.description}“</p>
          <div className="criteria-mockup__columns">
            <div>
              {editing ? (
                <StoryFields idBase="uus-vaade-lugu" value={draft.story} onChange={(story) => onDraft({ ...draft, story })} roles={data.roles} busy={busy} />
              ) : (
                <p><strong>Lugu:</strong> {p.story.title}</p>
              )}
              <p className="story-ready__heading">Vastuvõtukriteeriumid</p>
              <ol className="new-view__criteria">
                {criteria.map((c, i) => (
                  <li key={editing ? i : c.index}>
                    {editing ? (
                      <span className="new-view__edit-row">
                        <input aria-label={`Kriteerium ${i + 1}`} value={c.text} disabled={busy} onChange={(e) => setCriterion(i, e.target.value)} />
                        <button type="button" className="icon-button" disabled={busy || criteria.length === 1}
                          onClick={() => onDraft({ ...draft, criteria: draft.criteria.filter((_, j) => j !== i) })}>✗ Eemalda</button>
                      </span>
                    ) : c.text}
                    <CriterionNotes item={c} original={c.index === undefined ? undefined : byIndex.get(c.index)} />
                    <span className="muted story-criteria__link">{c.index === undefined ? "Seos mockup'iga puudub (käsitsi lisatud)" : linkText(byIndex.get(c.index).ref, p.mockup)}</span>
                  </li>
                ))}
              </ol>
              {editing && (
                <button type="button" className="secondary" disabled={busy || criteria.length >= 10}
                  onClick={() => onDraft({ ...draft, criteria: [...draft.criteria, { text: '' }] })}>+ Lisa kriteerium</button>
              )}
            </div>
            <div>
              <p className="story-ready__heading">Mockup</p>
              <MockupView mockup={p.mockup} />
            </div>
          </div>
          <fieldset className="new-view__target">
            <legend>Kuhu lisada?</legend>
            <label><input type="radio" name="uus-vaade-siht" checked={target.kind === 'new'} disabled={busy} onChange={() => onTarget({ ...target, kind: 'new' })} /> Uus lugu backlog'i lõppu</label>
            <label>
              <input type="radio" name="uus-vaade-siht" checked={target.kind === 'story'} disabled={busy || data.stories.length === 0} onChange={() => onTarget({ ...target, kind: 'story' })} />
              {' '}Lisavaade olemasolevale loole:{' '}
              <select aria-label="Olemasolev lugu" value={target.storyId} disabled={busy || target.kind !== 'story'} onChange={(e) => onTarget({ ...target, storyId: e.target.value })}>
                <option value="">— vali lugu —</option>
                {data.stories.map((s) => <option key={s.id} value={s.id}>{s.number}. {s.title}</option>)}
              </select>
            </label>
            {target.kind === 'story' && targetStory && (
              <p className="muted">Loo „{targetStory.title}“ sõnastust ei muudeta; lisandub uus vaade ja kriteeriumid loo lõppu. Olemasolev vaade 1 jääb puutumata.</p>
            )}
            {target.kind === 'story' && editing && <p className="muted">Loo väljade muudatusi ei kasutata – lisatakse ainult vaade ja kriteeriumid.</p>}
          </fieldset>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="actions">
            <button type="button" onClick={onApply} disabled={busy || (target.kind === 'story' && !target.storyId)}>
              {busy ? 'Lisan…' : editing ? 'Lisa muudetuna' : 'Lisa'}
            </button>
            {editing
              ? <button type="button" className="secondary" onClick={onCancelEdit} disabled={busy}>Tühista muutmine</button>
              : <button type="button" className="secondary" onClick={onEdit} disabled={busy}>Muuda</button>}
            <button type="button" className="secondary" onClick={onReject} disabled={busy}>Loobu</button>
          </div>
        </section>
      )}
    </div>
  );
}

export default function NewViewPanel({ projectId, onApplied }) {
  const [data, setData] = useState({ proposal: null, stories: [], roles: [] });
  const [description, setDescription] = useState('');
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [target, setTarget] = useState({ kind: 'new', storyId: '' });

  const refresh = useCallback(async () => {
    try {
      setData(await getNewView(projectId));
    } catch (e) {
      setError(e.message);
    }
  }, [projectId]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    window.addEventListener('pjt:changed', refresh);
    return () => window.removeEventListener('pjt:changed', refresh);
  }, [refresh]);

  async function propose() {
    setRunning(true);
    setAiError(null);
    setError('');
    setNotice('');
    try {
      setData(await proposeNewView(projectId, description));
    } catch (e) {
      if (AI_ERRORS.has(e.code)) setAiError({ message: e.message, code: e.code, retryAfterSeconds: e.retryAfterSeconds });
      else setError(e.message);
    } finally {
      setRunning(false);
    }
  }

  const p = data.proposal;
  const startEdit = () => {
    setDraft({ story: { ...p.story, touchesView: true }, criteria: p.criteria.map((c) => ({ index: c.index, text: c.text })) });
    setEditing(true);
  };
  async function act(call, message) {
    setBusy(true);
    setError('');
    try {
      const res = await call();
      setData(res);
      setEditing(false);
      setDraft(null);
      setNotice(message(res));
      if (res.result) { setDescription(''); setTarget({ kind: 'new', storyId: '' }); onApplied?.(); }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const apply = () => act(() => applyNewView(projectId, {
    proposalId: p.id,
    target: target.kind === 'new' ? { kind: 'new' } : { kind: 'story', storyId: Number(target.storyId) },
    ...(editing ? {
      criteria: draft.criteria.map((c) => (c.index === undefined ? { text: c.text } : { index: c.index, text: c.text })),
      ...(target.kind === 'new' ? { story: { role: draft.story.role, rolePhrase: draft.story.rolePhrase, want: draft.story.want, soThat: draft.story.soThat, size: draft.story.size } } : {}),
    } : {}),
  }), (res) => {
    const n = res.stories.find((s) => s.id === res.result.storyId)?.number;
    return res.result.created ? `Lisati uus lugu ${n} koos mockup'i ja kriteeriumidega.` : `Loole ${n} lisati vaade ${res.result.viewNo}.`;
  });
  const reject = () => act(() => rejectNewView(projectId, p.id), () => 'Ettepanekust loobuti – midagi ei lisatud.');

  return (
    <NewViewView data={data} description={description} running={running} busy={busy} aiError={aiError} error={error} notice={notice}
      editing={editing} draft={draft} target={target}
      onDescription={setDescription} onPropose={propose} onApply={apply} onEdit={startEdit} onCancelEdit={() => { setEditing(false); setDraft(null); }}
      onReject={reject} onDraft={setDraft} onTarget={setTarget} />
  );
}

