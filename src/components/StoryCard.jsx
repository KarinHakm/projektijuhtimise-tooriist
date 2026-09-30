import { useState } from 'react';
import { isEdited, SIZES, storyTitle } from '../stories/selection.js';

// Üks AI pakutud lugu: number, pealkiri, märkeruut, ✎ Muuda ja ✗ Lükka tagasi.
// Muutmisel on rolli valikus ainult projekti kinnitatud rollid.
export default function StoryCard({ item, number, roles, busy, onToggle, onReject, onSave, initialEditing = false }) {
  const [editing, setEditing] = useState(initialEditing);
  const [form, setForm] = useState(item.draft);
  const [errors, setErrors] = useState([]);
  const fieldError = (field) => errors.find((e) => e.field === field)?.message;
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const id = (field) => `story-${item.index}-${field}`;

  function save(e) {
    e.preventDefault();
    const result = onSave(form);
    if (result?.errors) setErrors(result.errors);
    else {
      setErrors([]);
      setEditing(false);
    }
  }

  return (
    <li className="story-card">
      <div className="story-card__head">
        <span className="story-card__number" aria-label={`Lugu ${number}`}>{number}.</span>
        <label className="story-card__label">
          <input type="checkbox" checked={item.checked} onChange={onToggle} disabled={busy || editing} />
          <span className="story-card__title">{storyTitle(item)}</span>
        </label>
      </div>
      <p className="story-card__meta">
        <span className="tag">{item.draft.role}</span>
        <span className="tag">Suurus {item.draft.size}</span>
        {isEdited(item) && <span className="tag">muudetud</span>}
      </p>
      {item.warnings.map((w) => <p key={w} className="warning">⚠ {w}</p>)}

      {editing ? (
        <form className="story-edit" onSubmit={save} noValidate>
          <label htmlFor={id('role')}>Roll</label>
          <select id={id('role')} value={form.role} onChange={set('role')} disabled={busy}>
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {fieldError('role') && <p className="error">{fieldError('role')}</p>}

          <label htmlFor={id('rolePhrase')}>Roll olevas käändes (nt „Külastajana“)</label>
          <input id={id('rolePhrase')} value={form.rolePhrase} onChange={set('rolePhrase')} disabled={busy} />
          {fieldError('rolePhrase') && <p className="error">{fieldError('rolePhrase')}</p>}

          <label htmlFor={id('want')}>Tegevus (ilma sõnata „soovin“)</label>
          <input id={id('want')} value={form.want} onChange={set('want')} disabled={busy} />
          {fieldError('want') && <p className="error">{fieldError('want')}</p>}

          <label htmlFor={id('soThat')}>Kasu (ilma sõnata „et“)</label>
          <input id={id('soThat')} value={form.soThat} onChange={set('soThat')} disabled={busy} />
          {fieldError('soThat') && <p className="error">{fieldError('soThat')}</p>}

          <label htmlFor={id('size')}>Suurus</label>
          <select id={id('size')} value={form.size} onChange={set('size')} disabled={busy}>
            {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <div className="actions">
            <button type="submit" disabled={busy}>Salvesta</button>
            <button type="button" className="secondary" disabled={busy} onClick={() => { setForm(item.draft); setErrors([]); setEditing(false); }}>
              Tühista
            </button>
          </div>
        </form>
      ) : (
        <div className="actions">
          <button type="button" className="secondary" disabled={busy} onClick={() => { setForm(item.draft); setEditing(true); }}>✎ Muuda</button>
          <button type="button" className="secondary" disabled={busy} onClick={onReject}>✗ Lükka tagasi</button>
        </div>
      )}
    </li>
  );
}
