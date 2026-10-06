// Loo väljad (roll, roll olevas käändes, tegevus, kasu, suurus, „Puudutab vaadet“) – ühised loo vormile ja jagamisele.
// value = { role, rolePhrase, want, soThat, size, touchesView }; onChange(uusVäärtus). invalidField = serveri vea väli.
export default function StoryFields({ idBase, value, onChange, roles = [], stories = [], busy = false, invalidField = null }) {
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  // Tuttava rolli valimisel pakutakse sama rolli senist olevakäände kuju.
  const pickRole = (e) => {
    const role = e.target.value;
    const known = stories.find((s) => s.role === role)?.rolePhrase;
    onChange({ ...value, role, rolePhrase: known && !value.rolePhrase ? known : value.rolePhrase });
  };
  const invalid = (field) => (invalidField === field ? true : undefined);
  return (
    <>
      <div className="story-form__row">
        <div>
          <label htmlFor={`${idBase}-role`}>Roll</label>
          <input id={`${idBase}-role`} list={`${idBase}-roles`} value={value.role} onChange={set('role')} onBlur={pickRole} disabled={busy} aria-invalid={invalid('role')} />
          <datalist id={`${idBase}-roles`}>{roles.map((r) => <option key={r} value={r} />)}</datalist>
        </div>
        <div>
          <label htmlFor={`${idBase}-phrase`}>Roll olevas käändes</label>
          <input id={`${idBase}-phrase`} value={value.rolePhrase} onChange={set('rolePhrase')} disabled={busy} placeholder="Nt: Külastajana" aria-invalid={invalid('rolePhrase')} />
        </div>
      </div>
      <label htmlFor={`${idBase}-want`}>soovin …</label>
      <input id={`${idBase}-want`} value={value.want} onChange={set('want')} disabled={busy} placeholder="Nt: sirvida sihtkohti piirkonna järgi" aria-invalid={invalid('want')} />
      <label htmlFor={`${idBase}-sothat`}>et …</label>
      <input id={`${idBase}-sothat`} value={value.soThat} onChange={set('soThat')} disabled={busy} placeholder="Nt: leiaksin huvipakkuva reisisihi" aria-invalid={invalid('soThat')} />
      <div className="story-form__row">
        <div>
          <label htmlFor={`${idBase}-size`}>Suurus</label>
          <select id={`${idBase}-size`} value={value.size} onChange={set('size')} disabled={busy} aria-invalid={invalid('size')}>
            {['S', 'M', 'L'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <label className="story-form__check">
          <input type="checkbox" checked={value.touchesView} onChange={set('touchesView')} disabled={busy} /> Puudutab vaadet (vajab mockup'i)
        </label>
      </div>
    </>
  );
}
