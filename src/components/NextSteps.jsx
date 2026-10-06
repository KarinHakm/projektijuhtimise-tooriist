import { useState } from 'react';
import { interpretNextStep } from '../api.js';
import AiError from './AiError.jsx';

// "Mida teeme edasi?" (L13): 1–4 järgmist sammu. Sama loend on etappide paneelis ja uusima AI väljundi kaardi lõpus.
// Nupp viib olemasoleva tegevuseni; AI-kutse käivitub alles kaardi enda nupuga.
// Vabatekst (projectId olemas): AI valib kasutaja teksti järgi ühe lubatud sammu; kasutaja läheb sinna ise nupuga.
export default function NextSteps({ steps, onGo, projectId, card }) {
  if (!steps?.length) return null;
  const hasAi = steps.some((s) => s.ai);
  return (
    <nav className="next-steps" aria-label="Mida teeme edasi?">
      <p className="next-steps__title">Mida teeme edasi?</p>
      <div className="actions">
        {steps.map((s, i) => (
          <button key={s.id} type="button" className={i === 0 ? '' : 'secondary'} onClick={() => onGo(s)}>
            {s.label}{s.optional ? ' (valikuline)' : ''}{s.ai ? ' (AI)' : ''}
          </button>
        ))}
      </div>
      {hasAi && <p className="muted">Nupp viib tegevuse juurde. „(AI)“ tegevuse AI-kutse käivitub alles sealse nupuga.</p>}
      {projectId && <NextStepText projectId={projectId} card={card} onGo={onGo} />}
    </nav>
  );
}

// Märkus läheb valitud sammu vabateksti välja (pjt:note) ja fookus sinna; täpsustuse kaardil täpsustuse välja.
export function goWithNote(step, note, onGo) {
  if (note && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pjt:note', { detail: { card: step.card, note } }));
  const noteFocus = step.card === 'refinement' ? '#kliendi-tapsustus' : `[data-note="${step.card}"]`;
  onGo({ card: step.card, focus: note ? noteFocus : step.focus });
}

export function NextStepTextView({ card, text, busy, error, result, onText, onSubmit, onGoResult }) {
  const id = `next-text-${card ?? 'main'}`;
  return (
    <form className="next-steps__text" noValidate onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <label htmlFor={id}>Või kirjuta oma sõnadega, mida soovid edasi teha</label>
      <textarea id={id} rows={2} maxLength={500} value={text} onChange={(e) => onText(e.target.value)} disabled={busy} />
      <button type="submit" className="secondary" disabled={busy || !text.trim()}>{busy ? 'AI tõlgendab…' : 'Küsi AI-lt'}</button>
      {error && <AiError error={error} />}
      {result && (
        <div className="next-steps__result" role="status">
          <p>{result.message}</p>
          {result.note && <p className="muted">Märkus, mis kirjutatakse sammu vabateksti välja: „{result.note}“</p>}
          <button type="button" onClick={onGoResult}>{result.step.label}</button>
          <p className="muted">Midagi ei muudetud. Nupp viib sammu juurde; AI ettepaneku käivitad seal ise.</p>
        </div>
      )}
    </form>
  );
}

function NextStepText({ projectId, card, onGo }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  async function submit() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await interpretNextStep(projectId, text));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <NextStepTextView card={card} text={text} busy={busy} error={error} result={result} onText={setText} onSubmit={submit}
      onGoResult={() => { goWithNote(result.step, result.note, onGo); setResult(null); setText(''); }} />
  );
}
