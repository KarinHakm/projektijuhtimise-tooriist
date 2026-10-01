import { useCallback, useEffect, useState } from 'react';
import { composeTitle } from '../../shared/story-format.js';
import { applyRefinement, getRefinement, proposeRefinement, rejectRefinement } from '../api.js';
import AiError from './AiError.jsx';
import AiWait from './AiWait.jsx';
import MockupView from './MockupView.jsx';
import { CheckWarnings, LinkLine } from './Consistency.jsx';

const POLL_MS = 3000;
const STATUS_LABELS = { added: 'Lisandub', modified: 'Muutub', unchanged: 'Muutmata' };

// Eelvaate redigeerimine ("Muuda"): loo sõnastus ja kriteeriumide tekstid. Mockup'i käsitsi muuta veel ei saa.
function EditForm({ proposal, rolePhrase, busy, onApply, onCancel }) {
  const [want, setWant] = useState(proposal.after.want);
  const [soThat, setSoThat] = useState(proposal.after.soThat);
  const [criteria, setCriteria] = useState(proposal.after.criteria);
  const setText = (i, text) => setCriteria((all) => all.map((c, j) => (j === i ? { ...c, text } : c)));
  return (
    <div className="refine-edit">
      <p className="muted">Muuda ettepanekut enne rakendamist. Mockup'i käsitsi muutmine ei ole veel võimalik.</p>
      <label htmlFor="refine-want">Tegevus (ilma sõnata „soovin“)</label>
      <input id="refine-want" value={want} onChange={(e) => setWant(e.target.value)} disabled={busy} />
      <label htmlFor="refine-sothat">Kasu (ilma sõnata „et“)</label>
      <input id="refine-sothat" value={soThat} onChange={(e) => setSoThat(e.target.value)} disabled={busy} />
      <p className="muted">Pealkiri: {composeTitle({ rolePhrase, want, soThat })}</p>
      <p><strong>Kriteeriumid</strong></p>
      <ol className="refine-edit__criteria">
        {criteria.map((c, i) => (
          <li key={i}>
            <textarea rows={2} aria-label={`Kriteerium ${i + 1}`} value={c.text} onChange={(e) => setText(i, e.target.value)} disabled={busy} />
            <button type="button" className="icon-button" onClick={() => setCriteria((all) => all.filter((_, j) => j !== i))} disabled={busy || criteria.length === 1}>✗ Eemalda</button>
          </li>
        ))}
      </ol>
      <div className="actions">
        <button type="button" onClick={() => onApply({ want, soThat, criteria })} disabled={busy}>Rakenda muudetuna</button>
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>Tühista muutmine</button>
      </div>
    </div>
  );
}

// Vaade ilma andmete laadimiseta (renderdustestide jaoks eraldi).
export function RefinementView({ data, focusStoryId = null, busy = null, error = '', notice = '', text = '', editing = false, onText, onPropose, onApply, onEdit, onCancelEdit, onReject, onOpenStory, onBackToFocus }) {
  const { story, proposal } = data;
  const disabled = Boolean(busy);
  if (!story) return <p className="muted">Vali enne prioriteedi juures lugu, millest alustada.</p>;
  const separate = focusStoryId !== null && story.id !== focusStoryId;

  return (
    <div className="refinement">
      <p>
        <strong>Täpsustatav lugu:</strong> {story.title}
        {separate && <span className="tag">eraldi täpsustusvoog – alustamise lugu ei muutu</span>}
      </p>
      {separate && <button type="button" className="secondary" onClick={onBackToFocus} disabled={disabled}>Tagasi alustamise loo juurde</button>}
      {notice && <p className="notice" role="status">{notice}</p>}

      {!proposal && (
        <>
          <label htmlFor="kliendi-tapsustus">Kliendi täpsustus</label>
          <textarea id="kliendi-tapsustus" rows={3} value={text} onChange={(e) => onText(e.target.value)} disabled={disabled}
            placeholder="Nt: Paketi hinnas peab olema näha, kas see sisaldab käibemaksu." />
          <button type="button" onClick={onPropose} disabled={disabled || !text.trim()}>Koosta muudatusettepanek</button>
          {data.consistency?.warningCount > 0 && (
            <p className="consistency-warning">⚠ Kontrolli: praeguses seisus on {data.consistency.warningCount} kooskõla hoiatust (vt „Kriteeriumid ja mockup“).</p>
          )}
        </>
      )}

      {proposal && (
        <section className="refine-proposal" aria-labelledby="refine-title">
          <h3 id="refine-title">Muudatusettepanek – ei ole veel rakendatud</h3>
          <p className="muted">Kliendi täpsustus: „{proposal.clarification}“</p>
          {proposal.message && <p>{proposal.message}</p>}

          {editing ? (
            <EditForm proposal={proposal} rolePhrase={story.rolePhrase} busy={disabled} onApply={onApply} onCancel={onCancelEdit} />
          ) : (
            <>
              <h4>Loo sõnastus {proposal.preview.storyChanged ? '' : '(muutmata)'}</h4>
              <div className="before-after">
                <div><p className="before-after__label">Enne</p><p>{composeTitle({ rolePhrase: story.rolePhrase, ...proposal.before })}</p></div>
                <div><p className="before-after__label">Pärast</p><p className={proposal.preview.storyChanged ? 'diff--modified' : ''}>{composeTitle({ rolePhrase: story.rolePhrase, ...proposal.after })}</p></div>
              </div>

              <h4>Kriteeriumid</h4>
              <ul className="diff-list">
                {proposal.preview.criteria.items.map((c, i) => (
                  <li key={i} className={`diff--${c.status}`}>
                    <span className="diff__label">{STATUS_LABELS[c.status]}</span> K{i + 1}. {c.text}
                    {c.oldText && <span className="diff__old">Enne: {c.oldText}</span>}
                    {proposal.preview.consistency && (
                      <>
                        <LinkLine link={proposal.preview.consistency.criteria[i].link} />
                        <CheckWarnings warnings={proposal.preview.consistency.criteria[i].warnings} />
                      </>
                    )}
                  </li>
                ))}
                {proposal.preview.criteria.removed.map((t, i) => (
                  <li key={`r${i}`} className="diff--removed"><span className="diff__label">Eemaldub</span> {t}</li>
                ))}
              </ul>

              <h4>Mockup</h4>
              <div className="before-after">
                <div>
                  <p className="before-after__label">Enne{proposal.before.mockup ? ` (versioon ${proposal.before.mockup.version})` : ''}</p>
                  {proposal.before.mockup ? <MockupView mockup={proposal.before.mockup} marks={proposal.preview.mockup.removed} mark="removed" /> : <p className="muted">Mockup puudub.</p>}
                </div>
                <div>
                  <p className="before-after__label">Pärast</p>
                  <MockupView mockup={proposal.after.mockup} marks={proposal.preview.mockup.added} mark="added" notes={proposal.preview.consistency?.components ?? null} />
                </div>
              </div>
              {proposal.preview.consistency && (
                <p className="muted">
                  Kooskõla pärast muudatust: kontrollimist vajavaid hoiatusi {proposal.preview.consistency.warningCount}. Seosed pakkus AI – kontrolli need üle;
                  rakendamise järel saad seoseid muuta ja uue versiooni üle vaadata.
                </p>
              )}

              <section className="other-stories" aria-labelledby="other-stories-title">
                <h4 id="other-stories-title">Soovitused teistele lugudele</h4>
                {proposal.otherStories.length === 0 ? <p className="muted">Teisi lugusid see täpsustus ei mõjuta.</p> : (
                  <>
                    <p className="muted">Ainult soovitused – see ettepanek ei muuda ühtegi teist lugu.</p>
                    <ul>
                      {proposal.otherStories.map((o) => (
                        <li key={o.storyId}>
                          <p><strong>{o.title}</strong></p>
                          <p>{o.suggestion}</p>
                          <button type="button" className="secondary" onClick={() => onOpenStory(o.storyId)} disabled={disabled}>Täpsusta seda lugu</button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>

              <div className="actions">
                <button type="button" onClick={() => onApply(null)} disabled={disabled}>{busy === 'apply' ? 'Rakendan…' : 'Rakenda'}</button>
                <button type="button" className="secondary" onClick={onEdit} disabled={disabled}>Muuda</button>
                <button type="button" className="secondary" onClick={onReject} disabled={disabled}>Loobu</button>
              </div>
            </>
          )}
        </section>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

// Kliendi täpsustus (L11, L12). Täpsustatav lugu on selle voo oma valik (vaikimisi alustamise lugu);
// "Täpsusta seda lugu" vahetab ainult täpsustatavat lugu, mitte projekti prioriteeti.
export default function RefinementPanel({ projectId, version, onApplied }) {
  const [storyId, setStoryId] = useState(null); // null = alustamise lugu
  const [focusStoryId, setFocusStoryId] = useState(null);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(null);
  const [aiError, setAiError] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await getRefinement(projectId, storyId);
      setData(next);
      if (storyId === null) setFocusStoryId(next.story?.id ?? null);
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    }
  }, [projectId, storyId]);

  useEffect(() => { refresh(); }, [refresh, version]);

  useEffect(() => {
    if (!data?.aiRunning || busy) return undefined;
    const timer = setTimeout(refresh, POLL_MS);
    return () => clearTimeout(timer);
  }, [data, busy, refresh]);

  async function run(kind, call, { onSuccess, onError }) {
    setBusy(kind);
    setError('');
    try {
      setData(await call());
      onSuccess?.();
    } catch (e) {
      onError(e);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  if (loadError) return <p className="error">Täpsustust ei saanud laadida: {loadError}</p>;
  if (!data) return <p className="muted">Laadin…</p>;

  const waiting = busy === 'propose' || data.aiRunning;
  const switchStory = (id) => { setStoryId(id); setText(''); setNotice(''); setEditing(false); setError(''); setAiError(null); };
  return (
    <>
      {waiting && <AiWait label="AI koostab muudatusettepanekut" />}
      <RefinementView
        data={data}
        focusStoryId={focusStoryId}
        busy={waiting ? 'ai' : busy}
        error={error}
        notice={notice}
        text={text}
        editing={editing}
        onText={setText}
        onPropose={() => {
          setAiError(null);
          setNotice('');
          run('propose', () => proposeRefinement(projectId, data.story.id, text), { onError: (e) => (e.code === 'in_progress' ? null : setAiError(e)) });
        }}
        onApply={(changes) => run('apply', () => applyRefinement(projectId, data.proposal.id, data.story.id, changes), {
          onSuccess: () => { setEditing(false); setText(''); setNotice('Muudatus rakendati valitud loole. Teisi lugusid ei muudetud.'); onApplied?.(); },
          onError: (e) => setError(e.message),
        })}
        onEdit={() => setEditing(true)}
        onCancelEdit={() => setEditing(false)}
        onReject={() => run('reject', () => rejectRefinement(projectId, data.proposal.id), {
          onSuccess: () => { setEditing(false); setNotice('Loobusid ettepanekust; lugu jäi muutmata.'); },
          onError: (e) => setError(e.message),
        })}
        onOpenStory={(id) => switchStory(id)}
        onBackToFocus={() => switchStory(null)}
      />
      {!waiting && aiError && <AiError error={aiError} onRetry={() => { setAiError(null); run('propose', () => proposeRefinement(projectId, data.story.id, text), { onError: setAiError }); }} retrying={busy === 'propose'} />}
    </>
  );
}
