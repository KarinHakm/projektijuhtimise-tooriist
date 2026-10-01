import { useState } from 'react';
import { composeTitle } from '../../shared/story-format.js';
import StoryFields from './StoryFields.jsx';

// Loo käsitsi lisamise ja muutmise vorm (L15). Töötab ilma AI-ta; kontrolli teeb server (sama reegel mis AI lugudel).
// error = { message, field } serveri vastusest.
export default function StoryForm({ idBase, initial = null, roles = [], stories = [], busy = false, error = null, submitLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    role: initial?.role ?? roles[0] ?? '',
    rolePhrase: initial?.rolePhrase ?? stories.find((s) => s.role === (roles[0] ?? ''))?.rolePhrase ?? '',
    want: initial?.want ?? '',
    soThat: initial?.soThat ?? '',
    size: initial?.size ?? 'M',
    touchesView: initial?.touchesView ?? true,
  }));
  const preview = form.rolePhrase && form.want && form.soThat ? composeTitle(form) : '';

  return (
    <form className="story-form" onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form }); }} noValidate>
      <StoryFields idBase={idBase} value={form} onChange={setForm} roles={roles} stories={stories} busy={busy} invalidField={error?.field ?? null} />
      {preview && <p className="muted story-form__preview">Pealkiri: {preview}</p>}
      {error && <p className="error" role="alert">{error.message}</p>}
      <div className="actions">
        <button type="submit" disabled={busy}>{busy ? 'Salvestan…' : submitLabel}</button>
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>Tühista</button>
      </div>
    </form>
  );
}
