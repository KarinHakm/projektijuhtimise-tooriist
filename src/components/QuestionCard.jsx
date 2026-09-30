import { setOther, toggleOption, toggleOther, toggleSkip } from '../conversation/answers.js';

// Üks täpsustav küsimus: AI variandid nuppudena + "Muu (kirjutan ise)" ja "Jäta vahele".
export default function QuestionCard({ question, draft, onChange, disabled }) {
  const otherId = `muu-${question.id}`;

  return (
    <fieldset className="question" disabled={disabled}>
      <legend>
        {question.text}
        {question.multiSelect && <span className="muted"> (võid valida mitu)</span>}
      </legend>
      <div className="choices">
        {question.options.map((option) => (
          <button
            key={option}
            type="button"
            className="choice"
            aria-pressed={draft.selected.includes(option)}
            onClick={() => onChange(toggleOption(question, draft, option))}
          >
            {option}
          </button>
        ))}
        <button type="button" className="choice" aria-pressed={draft.otherOpen} aria-controls={otherId} onClick={() => onChange(toggleOther(question, draft))}>
          Muu (kirjutan ise)
        </button>
        <button type="button" className="choice choice--skip" aria-pressed={draft.skipped} onClick={() => onChange(toggleSkip(draft))}>
          Jäta vahele
        </button>
      </div>
      {draft.otherOpen && (
        <>
          <label htmlFor={otherId} className="visually-hidden">Oma vastus küsimusele „{question.text}“</label>
          <input
            id={otherId}
            className="other-input"
            placeholder="Kirjuta oma vastus"
            maxLength={500}
            value={draft.other}
            onChange={(e) => onChange(setOther(draft, e.target.value))}
            autoFocus
          />
        </>
      )}
    </fieldset>
  );
}
