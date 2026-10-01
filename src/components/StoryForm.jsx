import { useState } from 'react';
import { composeTitle } from '../../shared/story-format.js';

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
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  // Tuttava rolli valimisel pakutakse sama rolli senist olevakäände kuju.
  const pickRole = (e) => {
    const role = e.target.value;
    const known = stories.find((s) => s.role === role)?.rolePhrase;
    setForm((f) => ({ ...f, role, rolePhrase: known && !f.rolePhrase ? known : f.rolePhrase }));
  };
  const invalid = (field) => (error?.field === field ? true : undefined);
  const preview = form.rolePhrase && form.want && form.soThat ? composeTitle(form) : '';

  return (
    <form className="story-form" onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form }); }} noValidate>
      <div className="story-form__row">
        <div>
          <label htmlFor={`${idBase}-role`}>Roll</label>
          <input id={`${idBase}-role`} list={`${idBase}-roles`} value={form.role} onChange={set('role')} onBlur={pickRole} disabled={busy} aria-invalid={invalid('role')} />
          <datalist id={`${idBase}-roles`}>{roles.map((r) => <option key={r} value={r} />)}</datalist>
        </div>
        <div>
          <label htmlFor={`${idBase}-phrase`}>Roll olevas käändes</label>
          <input id={`${idBase}-phrase`} value={form.rolePhrase} onChange={set('rolePhrase')} disabled={busy} placeholder="Nt: Külastajana" aria-invalid={invalid('rolePhrase')} />
        </div>
      </div>
      <label htmlFor={`${idBase}-want`}>soovin …</label>
      <input id={`${idBase}-want`} value={form.want} onChange={set('want')} disabled={busy} placeholder="Nt: näha treeningute nädalakava" aria-invalid={invalid('want')} />
      <label htmlFor={`${idBase}-sothat`}>et …</label>
      <input id={`${idBase}-sothat`} value={form.soThat} onChange={set('soThat')} disabled={busy} placeholder="Nt: saaksin valida sobiva aja" aria-invalid={invalid('soThat')} />
      <div className="story-form__row">
        <div>
          <label htmlFor={`${idBase}-size`}>Suurus</label>
          <select id={`${idBase}-size`} value={form.size} onChange={set('size')} disabled={busy} aria-invalid={invalid('size')}>
            {['S', 'M', 'L'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <label className="story-form__check">
          <input type="checkbox" checked={form.touchesView} onChange={set('touchesView')} disabled={busy} /> Puudutab vaadet (vajab mockup'i)
        </label>
      </div>
      {preview && <p className="muted story-form__preview">Pealkiri: {preview}</p>}
      {error && <p className="error" role="alert">{error.message}</p>}
      <div className="actions">
        <button type="submit" disabled={busy}>{busy ? 'Salvestan…' : submitLabel}</button>
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>Tühista</button>
      </div>
    </form>
  );
}
