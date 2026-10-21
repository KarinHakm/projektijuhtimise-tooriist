import { useEffect, useRef, useState } from 'react';
import { interpretNextStep } from '../api.js';
import { FLOW_CARDS, TARGET_LABELS, pickTarget, preferredTarget } from '../chat/target.js';
import { probeTargets, sendToTarget } from '../chat/bus.js';
import { NOTE_MAX } from './NoteField.jsx';
import { NextStepResult, goWithNote } from './NextSteps.jsx';
import AiError from './AiError.jsx';

const IDEA_MAX = 2000;

// Miks kast praegu teksti ei võta (sihtkohta pole).
const HINTS = {
  questions: 'Vasta AI küsimustele ülal: vali vastus nupuga, „Muu (kirjutan ise)“ või „Jäta vahele“.',
  waiting: 'AI koostab vastust…',
  unanswered: 'AI vastus jäi saamata – proovi uuesti ülal oleva nupuga.',
};

// Vestluse kast ilma olekuta (renderdustestide jaoks eraldi). target = sihtkoht või null; options = valitavad sihtkohad.
export function ChatComposerView({ target, options = [], text = '', busy = false, hint = '', message = '', aiError = null, result = null, textareaRef, onText, onTarget, onSubmit, onGoResult }) {
  const max = target === 'conversation' ? IDEA_MAX : NOTE_MAX;
  return (
    <form className="chat-composer" aria-label="Vestluse kast" noValidate onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      {result && <NextStepResult result={result} onGo={onGoResult} />}
      {aiError && <AiError error={aiError} />}
      {message && <p className="error" role="alert">{message}</p>}
      {target ? (
        <p className="chat-composer__target">
          {options.length > 1 ? (
            <>
              <label htmlFor="chat-target">Saadan:</label>{' '}
              <select id="chat-target" value={target} disabled={busy} onChange={(e) => onTarget(e.target.value)}>
                {options.map((o) => <option key={o} value={o}>{TARGET_LABELS[o]}</option>)}
              </select>
            </>
          ) : <>Saadan: <strong>{TARGET_LABELS[target]}</strong></>}
        </p>
      ) : hint && <p className="muted chat-composer__target">{hint}</p>}
      <div className="chat-composer__row">
        <textarea ref={textareaRef} id="chat-text" rows={2} maxLength={max} value={text} disabled={busy || !target}
          aria-label="Kirjuta vabalt: vastus, täpsustus või küsimus"
          placeholder={target === 'conversation' ? 'Nt: Tahame hambaarsti kabinetile veebi, kus patsient saab aja broneerida.' : 'Kirjuta vabalt: vastus, täpsustus või küsimus'}
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSubmit(); } }} />
        <button type="submit" disabled={busy || !target || !text.trim()}>{busy ? 'AI koostab…' : 'Saada'}</button>
      </div>
    </form>
  );
}

// Üks kast kogu vestluse all (L37). Sihtkoht tuleneb vestluse kohast (preferredTarget); kasutaja saab seda muuta.
// Tekst läheb sammu olemasolevasse AI päringusse ja tulemus on ootel ettepanek plokis – midagi ei rakendu ilma kinnituseta.
export default function ChatComposer({ projectId, stage, phase, onGo }) {
  const [text, setText] = useState('');
  const [override, setOverride] = useState(null);
  const [available, setAvailable] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [aiError, setAiError] = useState(null);
  const [result, setResult] = useState(null);
  const textareaRef = useRef(null);

  // Millised sammud võtavad praegu teksti vastu: küsitakse etapi muutumisel ja kui paneel end (de)registreerib.
  useEffect(() => {
    const refresh = () => setAvailable(probeTargets());
    refresh();
    window.addEventListener('pjt:targets', refresh);
    return () => window.removeEventListener('pjt:targets', refresh);
  }, [stage, phase]);

  // „Mida teeme edasi?“ märkus või samm („Sisesta kliendi täpsustus“) toob kasti fookusesse õige sihtkohaga.
  useEffect(() => {
    const focusWith = (card, note) => {
      setOverride(card === 'conversation' || FLOW_CARDS.includes(card) ? card : 'next');
      if (note !== undefined) setText(note);
      setMessage('');
      requestAnimationFrame(() => textareaRef.current?.focus({ preventScroll: true }));
    };
    const onNote = (e) => focusWith(e.detail?.card, e.detail?.note ?? '');
    const onCompose = (e) => focusWith(e.detail?.card);
    window.addEventListener('pjt:note', onNote);
    window.addEventListener('pjt:compose', onCompose);
    return () => {
      window.removeEventListener('pjt:note', onNote);
      window.removeEventListener('pjt:compose', onCompose);
    };
  }, []);

  const auto = pickTarget(preferredTarget(stage, phase), available);
  const target = override && (override === 'next' ? phase === 'done' : available.has(override)) ? override : auto;
  const options = target ? [...(available.has('conversation') ? ['conversation'] : []), ...FLOW_CARDS.filter((c) => available.has(c)), ...(phase === 'done' ? ['next'] : [])] : [];
  const hint = stage ? HINTS[phase] ?? '' : 'Laadin…';

  async function submit() {
    const note = text.trim();
    if (!note || !target || busy) return;
    setBusy(true);
    setMessage('');
    setAiError(null);
    setResult(null);
    try {
      if (target === 'next') {
        setResult(await interpretNextStep(projectId, note));
        setText('');
        return;
      }
      const sent = sendToTarget(target, note);
      if (!sent) {
        setMessage('See samm ei võta praegu teksti vastu. Vali teine sihtkoht.');
        return;
      }
      onGo({ card: target, focus: null });
      if (await sent) {
        setText('');
        setOverride(null);
      } else {
        setMessage('Ettepanekut ei tulnud – vaata teadet ülal plokis. Tekst jäi kasti alles.');
      }
    } catch (e) {
      setAiError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ChatComposerView target={target} options={options} text={text} busy={busy} hint={hint} message={message} aiError={aiError} result={result}
      textareaRef={textareaRef} onText={setText} onTarget={(t) => { setOverride(t); setMessage(''); }} onSubmit={submit}
      onGoResult={() => { goWithNote(result.step, result.note, onGo); setResult(null); }} />
  );
}
