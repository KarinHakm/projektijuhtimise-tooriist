import DemoTag from './DemoTag.jsx';

export const STATUS_LABELS = {
  done: 'tehtud ✓',
  skipped: 'andmed puuduvad',
  passed: 'jäeti vahele',
  next: 'soovitatud järgmine',
  available: 'saab teha',
  blocked: 'eeldus puudub',
  not_built: 'pole veel tehtud',
};
// Märk ribal; tähendus on alati ka tekstina (ekraanilugeja ja "Miks mõni etapp on hall?"), mitte ainult värvina.
export const MARKS = { done: '✓', skipped: '!', passed: '»', next: '●', available: '○', blocked: '🔒', not_built: '–' };

// Projekti kompaktne päis (L13, L14): nimi, etappide riba, viimati läbitud etapp ja soovitatud järgmine samm.
// Jääb kerimisel lehe ülaossa. Andmed tulevad serverist (shared/stage.js).
// Riba kaudu saab avada ainult tehtud, andmeteta või kättesaadava etapi; eelduseta etapp on hall ja põhjus on lahti voldiva rea all.
// onActivate(etapp) = ribal etapi juurde minek (salvestab aktiivse etapi); onSkip(etapp) = „Jäta vahele“ (L14).
export default function StagePanel({ name, demo = false, stage, onGo, onActivate = null, onSkip = null, error = '' }) {
  const { stages, lastDone, steps, allBuiltDone, storyCount } = stage;
  const skippable = stages.find((s) => s.skippable) ?? null;
  const first = steps[0];
  const firstStage = first ? stages.find((s) => s.key === first.stage) : null;
  const explained = stages.filter((s) => s.reason);
  return (
    <header className="project-header" aria-label="Projekt ja etapid">
      <div className="project-header__top">
        <h2 className="project-header__title">{name}{demo && <DemoTag />}</h2>
        <a className="project-header__backlog" href="#kaart-backlog" onClick={(e) => { e.preventDefault(); onGo({ card: 'backlog', focus: null }); }}>
          Backlog ({storyCount})
        </a>
      </div>
      <ol className="stage-bar" aria-label="Etapid">
        {stages.map((s, i) => {
          const content = (
            <>
              <span className="stage__mark" aria-hidden="true">{MARKS[s.status]}</span>
              <span className="stage__num">{i + 1}.</span>
              <span className="stage__label">{s.label}</span>
              <span className="visually-hidden"> – {STATUS_LABELS[s.status]}</span>
            </>
          );
          const title = `${i + 1}. ${s.label}: ${STATUS_LABELS[s.status]}${s.reason ? ` – ${s.reason}` : ''}`;
          return (
            <li key={s.key} className={`stage stage--${s.status}`} aria-current={s.status === 'next' ? 'step' : undefined}>
              {s.selectable
                ? <button type="button" className="stage__button" title={title} onClick={() => (onActivate ? onActivate(s) : onGo({ card: s.card, focus: null }))}>{content}</button>
                : <span className="stage__button stage__button--off" title={title} aria-disabled="true">{content}</span>}
            </li>
          );
        })}
      </ol>
      <p className="stage-summary">
        <span><strong>Viimati läbitud etapp:</strong> {lastDone ? lastDone.label : 'veel ükski'}</span>
        <span>
          <strong>Soovitatud järgmine samm:</strong>{' '}
          {first ? (
            <button type="button" className="secondary stage-summary__go" onClick={() => onGo(first)}>
              {first.label}{first.optional ? ' (valikuline)' : ''}{first.ai ? ' (AI)' : ''}
            </button>
          ) : 'pole'}
          {firstStage && <span className="muted"> – etapp „{firstStage.label}“</span>}
        </span>
        {skippable && onSkip && (
          <button type="button" className="link-button stage-summary__skip" onClick={() => onSkip(skippable)}>Jäta vahele etapp „{skippable.label}“</button>
        )}
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      <details className="stage-details">
        <summary>Miks mõni etapp on hall?</summary>
        <ul>
          {explained.map((s) => (
            <li key={s.key}><strong>{s.label}</strong> – {STATUS_LABELS[s.status]}: {s.reason}</li>
          ))}
        </ul>
        {allBuiltDone && <p>Kõik etapid on läbitud; edasised sammud on valikulised.</p>}
        <p>
          Vahelejätmine: soovitatud või aktiivse etapi saab „Jäta vahele“ nupuga vahele jätta. See ei ava järgmisi etappe, mille
          eeldus puudub (nt kriteeriumid vajavad alustamise lugu). Vahele jäetud etapi juurde saab ribal klõpsates tagasi minna.
        </p>
        {first?.ai && <p>„(AI)“ nupp viib tegevuse juurde; AI-kutse käivitub alles sealse nupuga.</p>}
      </details>
    </header>
  );
}
