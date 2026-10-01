// "Mida teeme edasi?" (L13): 1–4 järgmist sammu. Sama loend on etappide paneelis ja uusima AI väljundi kaardi lõpus.
// Nupp viib olemasoleva tegevuseni; AI-kutse käivitub alles kaardi enda nupuga.
export default function NextSteps({ steps, onGo }) {
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
    </nav>
  );
}
