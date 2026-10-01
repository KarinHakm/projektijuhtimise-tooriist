import { useCallback, useEffect, useState } from 'react';
import { acceptMockup, applyCriteria, getCriteria, linkCriterion, proposeCriteria, proposeMockup, rejectMockup, reviewConsistency } from '../api.js';
import { componentLabel } from '../../shared/consistency.js';
import { CheckWarnings, LinkLine, ReviewBox } from './Consistency.jsx';
import {
  accept, addManual, buildSave, CRITERIA_ORIGIN_LABELS, edit, fromProposal, remove, visible, warningsFor,
} from '../criteria/selection.js';
import AiError from './AiError.jsx';
import AiWait from './AiWait.jsx';
import MockupView from './MockupView.jsx';

const POLL_MS = 3000;
const STATE_LABELS = { pending: 'Ootab otsust', accepted: '✓ Kinnitatud', edited: '✎ Muudetud' };

function Warnings({ text }) {
  const list = warningsFor(text);
  return list.map((w) => <p key={w} className="warning">⚠ {w}</p>);
}

// Üks kriteerium: ✓ Nõus, ✎ Muuda (samas kohas) ja ✗ Eemalda.
export function CriterionRow({ item, number, busy, onAccept, onEdit, onRemove, initialEditing = false }) {
  const [editing, setEditing] = useState(initialEditing);
  const [draft, setDraft] = useState(item.text);
  const [error, setError] = useState('');
  const label = item.index === undefined ? 'Käsitsi lisatud' : STATE_LABELS[item.state];

  function save() {
    const result = onEdit(item.key, draft);
    if (result.error) setError(result.error);
    else { setEditing(false); setError(''); }
  }

  return (
    <li className={`criterion criterion--${item.state}`}>
      <span className="criterion__number">{number}.</span>
      <div>
        {editing ? (
          <>
            <label htmlFor={`kriteerium-${item.key}`} className="visually-hidden">Kriteerium {number}</label>
            <textarea id={`kriteerium-${item.key}`} rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={busy} />
            <Warnings text={draft} />
            {error && <p className="error">{error}</p>}
            <div className="actions">
              <button type="button" onClick={save} disabled={busy}>Salvesta</button>
              <button type="button" className="secondary" onClick={() => { setEditing(false); setDraft(item.text); setError(''); }} disabled={busy}>Tühista</button>
            </div>
          </>
        ) : (
          <>
            <p className="criterion__text">{item.text}</p>
            <p className="muted criterion__state">{label}</p>
            <Warnings text={item.text} />
            <div className="actions">
              <button type="button" className="icon-button" aria-pressed={item.state === 'accepted'} onClick={() => onAccept(item.key)} disabled={busy}>✓ Nõus</button>
              <button type="button" className="icon-button" onClick={() => { setDraft(item.text); setEditing(true); }} disabled={busy}>✎ Muuda</button>
              <button type="button" className="icon-button" onClick={() => onRemove(item.key)} disabled={busy}>✗ Eemalda</button>
            </div>
          </>
        )}
      </div>
    </li>
  );
}

// Vaade ilma andmete laadimiseta (renderdustestide jaoks eraldi).
export function CriteriaView({ data, items, busy = null, error = '', mockupError = '', linkError = '', newText = '', addError = '', onNewText, onAdd, onAccept, onEdit, onRemove, onSave, onPropose, onAcceptMockup, onRejectMockup, onProposeMockup, onLink, onReview }) {
  const { story, criteria, mockup, criteriaProposal, mockupProposal } = data;
  const disabled = Boolean(busy);
  if (!story) return <p className="muted">Vali enne prioriteedi juures lugu, millest alustada.</p>;

  const shown = visible(items);
  const removedCount = items.length - shown.length;
  const confirmedCount = buildSave(items, 'confirmed').length;
  const allCount = buildSave(items, 'all').length;

  return (
    <div className="criteria-mockup">
      <p><span className="tag tag--focus">Alustame sellest</span> {story.title}</p>
      <div className="criteria-mockup__columns">
        <section aria-labelledby="criteria-title">
          <h3 id="criteria-title">Vastuvõtukriteeriumid</h3>
          {criteria.length > 0 && (
            <ol className="criteria-saved">
              {criteria.map((c, i) => {
                const check = data.consistency?.criteria[i];
                const value = c.ref?.kind === 'element' ? `element-${c.ref.index}` : c.ref?.kind === 'no_view' ? 'no_view' : 'none';
                return (
                  <li key={c.id}>
                    <span className="criterion__number">K{i + 1}.</span> {c.text} <span className="tag">{CRITERIA_ORIGIN_LABELS[c.origin] ?? c.origin}</span>
                    {c.warnings.map((w) => <p key={w} className="warning">⚠ {w}</p>)}
                    <LinkLine link={check?.link ?? null} />
                    {check?.link?.source === 'ai' && (
                      <button type="button" className="secondary link-confirm" disabled={disabled} onClick={() => onLink(c.id, value)}>
                        Kinnitan selle seose
                      </button>
                    )}
                    {check && <CheckWarnings warnings={check.warnings} />}
                    {mockup && (
                      <label className="link-select">
                        <span>Seo ise:</span>
                        <select value={value} disabled={disabled} onChange={(e) => onLink(c.id, e.target.value)}>
                          <option value="none">— seos puudub —</option>
                          <option value="no_view">ei puuduta vaadet</option>
                          {mockup.components.map((comp, ci) => <option key={ci} value={`element-${ci}`}>{componentLabel(comp, ci)}</option>)}
                        </select>
                      </label>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {linkError && <p className="error" role="alert">{linkError}</p>}
          {criteriaProposal && (
            <div className="criteria-proposal">
              <p className="muted">AI ettepanek – ei ole veel loo juures. Salvestatakse ainult ✓ kinnitatud ja ✎ muudetud kriteeriumid.</p>
              <ol className="criteria-list">
                {shown.map((item, i) => (
                  <CriterionRow key={item.key} item={item} number={i + 1} busy={disabled} onAccept={onAccept} onEdit={onEdit} onRemove={onRemove} />
                ))}
              </ol>
              {removedCount > 0 && <p className="muted">Eemaldatud: {removedCount}. Neid ei salvestata.</p>}
              <div className="criteria-add">
                <label htmlFor="uus-kriteerium" className="visually-hidden">Uus kriteerium</label>
                <input id="uus-kriteerium" value={newText} onChange={(e) => onNewText(e.target.value)} placeholder="Uus kriteerium" disabled={disabled} />
                <button type="button" className="secondary" onClick={onAdd} disabled={disabled}>Lisa kriteerium</button>
              </div>
              {newText && <Warnings text={newText} />}
              {addError && <p className="error">{addError}</p>}
              <div className="actions">
                <button type="button" onClick={() => onSave('confirmed')} disabled={disabled || confirmedCount === 0}>
                  {busy === 'save-confirmed' ? 'Salvestan…' : `Salvesta kinnitatud (${confirmedCount})`}
                </button>
                <button type="button" className="secondary" onClick={() => onSave('all')} disabled={disabled || allCount === 0}>
                  {busy === 'save-all' ? 'Salvestan…' : `Kinnita kõik (${allCount})`}
                </button>
              </div>
              {error && <p className="error" role="alert">{error}</p>}
            </div>
          )}
          {!criteriaProposal && criteria.length === 0 && (
            <button type="button" onClick={onPropose} disabled={disabled}>Paku kriteeriumid ja mockup</button>
          )}
        </section>

        <section aria-labelledby="mockup-title">
          <h3 id="mockup-title">Mockup</h3>
          {mockup && (
            <>
              <p className="muted">Kinnitatud, versioon {mockup.version}</p>
              <MockupView mockup={mockup} notes={data.consistency?.components ?? null} />
            </>
          )}
          {mockupProposal && (
            <div className="mockup-proposal">
              <p className="muted">AI ettepanek – mockup ei ole veel looga seotud.</p>
              <MockupView mockup={mockupProposal.mockup} />
              <div className="actions">
                <button type="button" onClick={onAcceptMockup} disabled={disabled}>{busy === 'mockup-accept' ? 'Kinnitan…' : 'Kinnita mockup'}</button>
                <button type="button" className="secondary" onClick={onProposeMockup} disabled={disabled}>Paku uus</button>
                <button type="button" className="secondary" onClick={onRejectMockup} disabled={disabled}>Loobu</button>
              </div>
            </div>
          )}
          {!mockup && !mockupProposal && (criteria.length > 0 || criteriaProposal) && (
            <button type="button" className="secondary" onClick={onProposeMockup} disabled={disabled}>Paku mockup</button>
          )}
          {mockupError && <p className="error" role="alert">{mockupError}</p>}
        </section>
      </div>
      {(criteria.length > 0 || mockup) && data.consistency && (
        <ReviewBox consistency={data.consistency} mockupVersion={mockup?.version ?? null} busy={disabled} onReview={onReview} />
      )}
    </div>
  );
}

// Kriteeriumid ja mockup alustamise loole (L09, L10). focusVersion muutub, kui alustamise lugu muutub.
export default function CriteriaPanel({ projectId, focusVersion, onConsistencyChanged }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [error, setError] = useState('');
  const [mockupError, setMockupError] = useState('');
  const [newText, setNewText] = useState('');
  const [addError, setAddError] = useState('');
  const [linkError, setLinkError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setData(await getCriteria(projectId));
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh, focusVersion]);

  const proposalId = data?.criteriaProposal?.id;
  useEffect(() => {
    setItems(data?.criteriaProposal ? fromProposal(data.criteriaProposal) : []);
    setError('');
  }, [proposalId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data?.aiRunning || busy) return undefined;
    const timer = setTimeout(refresh, POLL_MS);
    return () => clearTimeout(timer);
  }, [data, busy, refresh]);

  async function run(kind, call, onError) {
    setBusy(kind);
    try {
      setData(await call());
    } catch (e) {
      onError(e);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  if (loadError) return <p className="error">Kriteeriume ei saanud laadida: {loadError}</p>;
  if (!data) return <p className="muted">Laadin…</p>;

  const waiting = busy === 'propose' || busy === 'mockup-propose' || data.aiRunning;
  return (
    <>
      {waiting && <AiWait label={busy === 'mockup-propose' ? 'AI koostab uut mockup’i' : 'AI koostab kriteeriume ja mockup’i'} />}
      <CriteriaView
        data={data}
        items={items}
        busy={waiting ? 'ai' : busy}
        error={error}
        mockupError={mockupError}
        linkError={linkError}
        newText={newText}
        addError={addError}
        onNewText={(t) => { setNewText(t); setAddError(''); }}
        onAdd={() => {
          const result = addManual(items, newText);
          if (result.error) setAddError(result.error);
          else { setItems(result.items); setNewText(''); }
        }}
        onAccept={(key) => setItems((all) => accept(all, key))}
        onEdit={(key, text) => {
          const result = edit(items, key, text);
          if (result.items) setItems(result.items);
          return result;
        }}
        onRemove={(key) => setItems((all) => remove(all, key))}
        onSave={(mode) => {
          setError('');
          run(mode === 'all' ? 'save-all' : 'save-confirmed', () => applyCriteria(projectId, proposalId, buildSave(items, mode)), (e) => setError(e.message));
        }}
        onPropose={() => { setAiError(null); run('propose', () => proposeCriteria(projectId), (e) => { if (e.code !== 'in_progress') setAiError(e); }); }}
        onAcceptMockup={() => { setMockupError(''); run('mockup-accept', () => acceptMockup(projectId, data.mockupProposal.id), (e) => setMockupError(e.message)); }}
        onRejectMockup={() => { setMockupError(''); run('mockup-reject', () => rejectMockup(projectId, data.mockupProposal.id), (e) => setMockupError(e.message)); }}
        onProposeMockup={() => { setMockupError(''); run('mockup-propose', () => proposeMockup(projectId), (e) => setMockupError(e.message)); }}
        onLink={(criterionId, value) => {
          setLinkError('');
          const [kind, index] = value.startsWith('element-') ? ['element', Number(value.slice(8))] : [value, undefined];
          run('link', () => linkCriterion(projectId, criterionId, kind, index), (e) => setLinkError(e.message)).then(() => onConsistencyChanged?.());
        }}
        onReview={() => { setLinkError(''); run('review', () => reviewConsistency(projectId, data.story.id, data.consistency.fingerprint), (e) => setLinkError(e.message)).then(() => onConsistencyChanged?.()); }}
      />
      {!waiting && aiError && <AiError error={aiError} onRetry={() => { setAiError(null); run('propose', () => proposeCriteria(projectId), (e) => setAiError(e)); }} retrying={busy === 'propose'} />}
    </>
  );
}
