// "Mida teeme edasi?" (L13): 1–4 järgmist sammu uusima AI väljundi ploki lõpus.
// Nupp viib tegevuseni; „(AI)“ samm vajutab ploki ettepaneku nuppu ise (L37, ProjectView go) – tulemus on ootel ettepanek.
// Oma sõnadega kirjutamine käib vestluse all ühes kastis (L37, ChatComposer).
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
      {hasAi && <p className="muted">„(AI)“ nupp küsib AI-lt ettepaneku (kirjutamist vajav samm viib vestluse kasti); midagi ei rakendu enne sinu kinnitust.</p>}
    </nav>
  );
}

// Vestluse kasti „Mida teeme edasi?“ vastus: AI valis kasutaja teksti järgi ühe lubatud sammu. Andmeid ei muudetud;
// nupp viib sammu juurde ja AI märkus läheb vestluse kasti selle sammu sihtkohaga (pjt:note).
export function NextStepResult({ result, onGo }) {
  return (
    <div className="next-steps__result" role="status">
      <p>{result.message}</p>
      {result.note && <p className="muted">Märkus, mis pannakse vestluse kasti: „{result.note}“</p>}
      <button type="button" onClick={onGo}>{result.step.label}</button>
      <p className="muted">Midagi ei muudetud. Nupp viib sammu juurde; AI ettepaneku käivitad seal ise.</p>
    </div>
  );
}

// Märkus läheb vestluse kasti valitud sammu sihtkohaga (pjt:note) ja leht kerib sammu juurde.
export function goWithNote(step, note, onGo) {
  if (note && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pjt:note', { detail: { card: step.card, note } }));
  onGo({ card: step.card, focus: note ? null : step.focus });
}
