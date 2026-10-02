import { useCallback, useEffect, useState } from 'react';
import { applyFinding, getReview, ignoreFinding, runReview, undoFinding } from '../api.js';
import { composeTitle } from '../../shared/story-format.js';
import { findOverlaps } from '../../shared/overlap.js';
import AiWait from './AiWait.jsx';
import DemoTag from './DemoTag.jsx';

// Backlog'i ülevaatus (L27). Ülevaatuse käivitamine ei muuda backlog'i. Iga leiu juures [Rakenda] [Muuda] [Ignoreeri]:
// tüübid 1–4, AI jagamine (5, L28) ja ühendamine (6, L29) rakendatakse siin; jagamise ja ühendamise „Muuda“ avab olemasoleva vormi backlog'is.

export const TYPE_LABELS = {
  connextra: 'Pealkirja vorm', no_criteria: 'Kriteeriumid puuduvad', untestable: 'Mittekontrollitav kriteerium',
  no_mockup: "Mockup puudub", too_large: 'Liiga suur lugu', overlap: 'Kattuvad lood',
};
export const DECISION_LABELS = { not_view: 'märgi mitte-vaatelooks', needs_mockup: "lisa küsimus „Vajab mockup'i“" };
const STATUS_TEXT = { applied: 'Rakendatud', ignored: 'Ignoreeritud', undone: 'Tagasi võetud' };

// Leiu ettepaneku tekst kaardil. Mockup'i leiu juures on alati näha, kumba tulemust AI soovitab.
function Suggestion({ f, stories }) {
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
    case 'too_large': return <SplitPreview f={f} stories={stories} />;
    case 'overlap': return s.merge ? <MergePreview f={f} stories={stories} /> : <><p><strong>Ettepanek:</strong> {s.text}</p><p>AI ühendamisettepanek oli vigane – vajuta „Muuda“ ja ühenda ise.</p></>;
    default: return null;
  }
}

// L28: AI jagamise eelvaade – mõlema uue loo pealkiri ja kriteeriumid, mis algse looga juhtub ja võimalik kattuvus.
function SplitPreview({ f, stories }) {
  const s = f.suggestion;
  const story = stories.find((x) => x.id === f.storyIds[0]);
  const info = f.splitInfo;
  if (!story) return null;
  const parts = [s.first, s.second].map((p, i) => {
    const toSecond = i === 1;
    return {
      title: composeTitle({ rolePhrase: story.rolePhrase, ...p }),
      criteria: f.before.criteria.filter((c) => s.criteriaToSecond.includes(c.id) === toSecond),
      overlaps: findOverlaps({ role: story.role, want: p.want }, stories, [story.id]),
    };
  });
  return (
    <div className="split-preview">
      <p className="split-preview__title">Ettepanek: jaga kaheks – eelvaade</p>
      {parts.map((p, i) => (
        <div key={i} className="review-split__part">
          <p><strong>Osa {i + 1}{i === 0 ? ' (algne lugu)' : ' (uus lugu)'}:</strong> {p.title}</p>
          {p.criteria.length ? <ol>{p.criteria.map((c) => <li key={c.id}>{c.text}</li>)}</ol> : <p className="muted">Kriteeriume ei ole.</p>}
          {p.overlaps.map((o) => (
            <p key={o.id} className="warning" role="note">⚠ Võimalik kattuvus looga {o.number} – kontrolli enne rakendamist. Jagamist see ei keela.</p>
          ))}
        </div>
      ))}
      {s.reason && <p className="muted">AI põhjendus: {s.reason}</p>}
      {info && (
        <ul>
          <li>Osa 1 jääb algse loo kohale, osa 2 lisatakse kohe selle järele.</li>
          {info.questions.length > 0 && <li>Küsimused ({info.questions.length}) jäävad osale 1.</li>}
          {info.mockupVersions > 0 && <li>Mockup'i versioonid jäävad osale 1; osale 2 viidud kriteeriumide seos mockup'iga eemaldatakse.</li>}
          {info.isFocus && <li>Alustamise lugu jääb osaks 1.</li>}
          {info.aboveMvpLine && <li>Ka osa 2 läheb MVP joone kohale.</li>}
          {info.pendingProposals > 0 && <li>Algse loo ootel ettepanekud ({info.pendingProposals}) lükatakse tagasi.</li>}
          <li>Jagamise saab tagasi võtta, kuni kumbagi osa pole muudetud.</li>
        </ul>
      )}
    </div>
  );
}

// L29: AI ühendamise eelvaade – ühendatud lugu, alles jäävad kriteeriumid, kordused (mõlema tekstiga) ja mis juhtub.
function MergePreview({ f, stories }) {
  const m = f.suggestion.merge;
  const info = f.mergeInfo;
  const keep = stories.find((x) => x.id === f.suggestion.keepId);
  const remove = stories.find((x) => x.id === f.suggestion.removeId);
  if (!keep || !remove) return null;
  const number = (id) => stories.findIndex((x) => x.id === id) + 1;
  const all = [...f.before.criteria.keep, ...f.before.criteria.remove];
  const text = (id) => all.find((c) => c.id === id)?.text ?? '';
  const lostLinks = info ? info.criteria.filter((c) => m.keepCriteria.includes(c.id) && c.linkLabel && !c.linkSurvives) : [];
  return (
    <div className="split-preview">
      <p className="split-preview__title">Ettepanek: ühenda lugu {number(remove.id)} looga {number(keep.id)} – eelvaade</p>
      {info?.blocked && (
        <p className="error" role="alert">Ühendada ei saa: mõlemal lool on mockup'i versioonid ({info.mockups.keep} ja {info.mockups.remove}). Teisi lugusid saab ühendada.</p>
      )}
      <p><strong>Ühendatud lugu{info ? ` (kohal ${info.resultPosition})` : ''}:</strong> {composeTitle({ rolePhrase: keep.rolePhrase, ...m.story })}</p>
      <p>Säilib lugu {number(keep.id)} (id, staatus, roll „{keep.role}“); lugu {number(remove.id)} eemaldatakse.
        {keep.role !== remove.role && ` Loo ${number(remove.id)} roll „${remove.role}“ ühendatud loos ei säili.`}</p>
      <p className="review-split__label">Kriteeriumid, mis jäävad alles ({m.keepCriteria.length}):</p>
      {m.keepCriteria.length ? <ol>{m.keepCriteria.map((id) => <li key={id}>{text(id)}</li>)}</ol> : <p className="muted">Kriteeriume ei jää.</p>}
      {m.duplicates.length > 0 && (
        <>
          <p className="review-split__label">Korduseks märgitud – eemaldatakse ({m.duplicates.length}):</p>
          <ul className="review-dups">
            {m.duplicates.map((d) => (
              <li key={d.id}>
                Eemaldatakse: <span className="review-dups__removed">„{text(d.id)}“</span><br />
                <span className="review-dups__kept">Säilib: „{text(d.of)}“</span>
              </li>
            ))}
          </ul>
          <p className="muted">Kriteeriume ei liideta uueks tekstiks. Kui kordus pole tegelikult kordus, vajuta „Muuda“ ja märgi see alles.</p>
        </>
      )}
      {f.suggestion.text && <p className="muted">AI põhjendus: {f.suggestion.text}</p>}
      {info && !info.blocked && (
        <ul>
          <li>Küsimused: {info.questions.length ? `kõik ${info.questions.length} jäävad ühendatud loole${info.questions.some((q) => !q.resolvedAt) ? '; avatud küsimuse tõttu saab lugu staatuse „Vajab täpsustamist“' : ''}.` : 'küsimusi pole.'}</li>
          <li>Mockup: {info.mockups.from ? `loo ${number(info.mockups.from === 'keep' ? keep.id : remove.id)} mockup (${info.mockups[info.mockups.from]} versiooni) jääb ühendatud loole.` : 'kummalgi lool pole mockup\'i.'}</li>
          {lostLinks.map((c) => <li key={c.id}>Kriteeriumi „{c.text}“ seos „{c.linkLabel}“ eemaldatakse (selle loo mockup ei jää alles).</li>)}
          {info.focus && <li>Alustamise lugu on ühendatud lugu.</li>}
          {info.mvp.count !== null && (info.mvp.keepAbove || info.mvp.removeAbove) && (
            <li>MVP joon: ühendatud lugu on joone kohal{info.mvp.keepAbove && info.mvp.removeAbove ? '; joone kohal on ühe loo võrra vähem' : ''}.</li>
          )}
          {info.pendingProposals > 0 && <li>Ootel ettepanekud ({info.pendingProposals}) lükatakse tagasi ja tagasivõtmisel neid ei taastata.</li>}
          <li>Ühendamise saab tagasi võtta, kuni ühendatud lugu ega backlog'i järjekord pole muutunud.</li>
        </ul>
      )}
    </div>
  );
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

function FindingCard({ f, stories, number, busy, editing, error, actions }) {
  const decided = f.status !== 'open';
  const canApply = !decided && !f.stale && f.suggestion !== null && (f.type !== 'overlap' || (Boolean(f.suggestion.merge) && !f.mergeInfo?.blocked));
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
      {f.canUndo && (
        <>
          {error && <p className="error" role="alert">{error.message}</p>}
          <button type="button" className="secondary" disabled={busy} onClick={() => actions.undo(f)}>{f.type === 'overlap' ? 'Võta ühendamine tagasi' : 'Võta jagamine tagasi'}</button>
        </>
      )}
      {!decided && (
        <>
          <p><strong>Probleem:</strong> {f.problem}</p>
          <p><strong>Põhjendus:</strong> {f.reason}</p>
          <Suggestion f={f} stories={stories} />
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
              <FindingCard key={f.id} f={f} stories={stories} number={number} busy={busy || running} editing={editingId === f.id}
                error={findingError?.id === f.id ? findingError : null} actions={actions} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// onSplit(storyId, initial, findingId) ja onMerge(keepId, removeId, findingId, initial) avavad backlog'i vormi.
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
      return decide(f, () => applyFinding(projectId, f.id, value)); // ka AI jagamine ja ühendamine (L28, L29): server salvestab tagasivõtmise seisu
    },
    edit: (f) => {
      setFindingError(null);
      if (f.type === 'too_large') return onSplit(f.storyIds[0], f.suggestion, f.id); // vorm AI osade ja jaotusega
      if (f.type === 'overlap') return onMerge(f.suggestion.keepId, f.suggestion.removeId, f.id, f.suggestion.merge); // vorm AI sõnastuse ja kordustega
      return setEditingId(f.id);
    },
    cancelEdit: () => { setEditingId(null); setFindingError(null); },
    ignore: (f) => decide(f, () => ignoreFinding(projectId, f.id)),
    undo: (f) => decide(f, () => undoFinding(projectId, f.id)),
  };

  return <ReviewView review={review} stories={stories} running={running} busy={busy} error={error} notice={notice}
    editingId={editingId} findingError={findingError} onRun={run} actions={actions} />;
}
