import NextSteps from './NextSteps.jsx';

export const STATUS_LABELS = {
  done: 'tehtud ✓',
  skipped: 'andmed puuduvad',
  next: 'soovitatud järgmine',
  available: 'saab teha',
  blocked: 'eeldus puudub',
  not_built: 'pole veel tehtud',
};

// Etappide riba (L14) ja soovitatud järgmine samm (L13). Andmed tulevad serverist (shared/stage.js).
// Riba kaudu saab avada ainult tehtud, vahele jäetud või kättesaadava etapi; eelduseta etapp on hall koos põhjusega.
export default function StagePanel({ stage, onGo }) {
  const { stages, lastDone, steps, allBuiltDone } = stage;
  const first = steps[0];
  const firstStage = first ? stages.find((s) => s.key === first.stage) : null;
  return (
    <section className="card stage-panel" aria-labelledby="stage-heading">
      <h2 id="stage-heading" className="visually-hidden">Projekti etapid</h2>
      <ol className="stage-bar">
        {stages.map((s, i) => (
          <li key={s.key} className={`stage stage--${s.status}`} aria-current={s.status === 'next' ? 'step' : undefined}>
            {s.selectable ? (
              <button type="button" className="stage__button" onClick={() => onGo({ card: s.card, focus: null })}>{i + 1}. {s.label}</button>
            ) : (
              <span className="stage__name" aria-disabled="true">{i + 1}. {s.label}</span>
            )}
            <span className="stage__status">{STATUS_LABELS[s.status]}{s.optional && s.status !== 'done' ? ' · valikuline' : ''}</span>
            {s.reason && <span className="stage__reason">{s.reason}</span>}
          </li>
        ))}
      </ol>
      <p><strong>Viimati läbitud etapp:</strong> {lastDone ? lastDone.label : 'veel ükski'}</p>
      <p>
        <strong>Soovitatud järgmine samm:</strong>{' '}
        {first ? <>{first.label}{first.optional ? ' (valikuline)' : ''} – etapp „{firstStage.label}“</> : 'pole'}
      </p>
      {allBuiltDone && <p className="muted">Kõik rakenduses olemasolevad etapid on läbitud; edasised sammud on valikulised. Groomimist pole veel tehtud.</p>}
      <NextSteps steps={steps} onGo={onGo} />
      <p className="muted stage-panel__limit">
        Vahelejätmine: valikulise etapi „Täpsustused“ võib vahele jätta. Teised etapid sõltuvad eelmistest (nt kriteeriumid vajavad
        alustamise lugu), seega neid vahele jätta ei saa. „Groomimine“ pole veel tehtud.
      </p>
    </section>
  );
}
