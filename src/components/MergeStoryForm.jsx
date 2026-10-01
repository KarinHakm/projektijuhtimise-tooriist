import { useState } from 'react';
import { composeTitle } from '../../shared/story-format.js';
import StoryFields from './StoryFields.jsx';

// Kahe loo käsitsi ühendamine (L26). Kasutaja valib teise loo; säilitatav on vaikimisi backlog'is eespool olev lugu.
// Kõik kriteeriumid on vaikimisi valitud (ka duplikaadid); märkimata kriteerium eemaldatakse ja eelvaade nimetab selle
// koos kaduva seosega. Kui mõlemal lool on mockup'i versioonid, ühendamist ei tehta.
// initialUnchecked: ainult renderdustestide jaoks (rakenduses on vaikimisi kõik kriteeriumid valitud).
export default function MergeStoryForm({ story, stories, info = null, roles = [], busy = false, error = null, initialUnchecked = [], onPick, onSubmit, onCancel }) {
  const number = (id) => stories.findIndex((s) => s.id === id) + 1;
  const others = stories.filter((s) => s.id !== story.id);
  const [partner, setPartner] = useState(info ? (info.keepId === story.id ? info.removeId : info.keepId) : '');

  const pick = (otherId) => {
    setPartner(otherId);
    if (!otherId) return;
    const [keep, remove] = number(story.id) < number(otherId) ? [story.id, otherId] : [otherId, story.id];
    onPick(keep, remove);
  };

  return (
    <div className="story-form merge-form">
      <p className="split-form__title">Ühenda lugu {number(story.id)} teise looga</p>
      <label htmlFor={`uhenda-${story.id}`}>Teine lugu</label>
      <select id={`uhenda-${story.id}`} value={partner} disabled={busy} onChange={(e) => pick(Number(e.target.value) || '')}>
        <option value="">— vali lugu —</option>
        {others.map((s) => <option key={s.id} value={s.id}>{number(s.id)}. {s.title}</option>)}
      </select>
      {info && <MergeDetails key={`${info.keepId}-${info.removeId}`} info={info} stories={stories} number={number} roles={roles} busy={busy} error={error} initialUnchecked={initialUnchecked}
        onSwap={() => onPick(info.removeId, info.keepId)} onSubmit={onSubmit} />}
      {error && !info && <p className="error" role="alert">{error.message}</p>}
      <div className="actions">
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>Tühista</button>
      </div>
    </div>
  );
}

function MergeDetails({ info, stories, number, roles, busy, error, initialUnchecked, onSwap, onSubmit }) {
  const keep = stories.find((s) => s.id === info.keepId);
  const remove = stories.find((s) => s.id === info.removeId);
  const [value, setValue] = useState({ role: keep.role, rolePhrase: keep.rolePhrase, want: keep.want, soThat: keep.soThat, size: keep.size, touchesView: keep.touchesView });
  const [checked, setChecked] = useState(() => info.criteria.map((c) => c.id).filter((id) => !initialUnchecked.includes(id))); // vaikimisi kõik valitud
  const label = (c) => `K${info.criteria.indexOf(c) + 1}`;
  const byId = new Map(info.criteria.map((c) => [c.id, c]));

  if (info.blocked) {
    return (
      <p className="error merge-blocked" role="alert">
        Lugude {number(info.keepId)} ja {number(info.removeId)} ühendamine pole praegu võimalik, sest mõlemal lool on mockup'i versioonid
        ({info.mockups.keep} ja {info.mockups.remove}) ja mõlema ajaloo turvaline ühendamine puudub. Teisi lugusid saab ühendada.
      </p>
    );
  }

  const removedCriteria = info.criteria.filter((c) => !checked.includes(c.id));
  const lostLinks = info.criteria.filter((c) => checked.includes(c.id) && c.linkLabel && !c.linkSurvives);
  const title = value.rolePhrase && value.want && value.soThat ? composeTitle(value) : '(täida väljad)';
  const mvp = info.mvp;
  const toggle = (id) => setChecked((all) => (all.includes(id) ? all.filter((x) => x !== id) : [...all, id]));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ withId: info.removeId, story: value, keepCriteria: info.criteria.filter((c) => checked.includes(c.id)).map((c) => c.id) }); }} noValidate>
      <p className="merge-form__keep">
        Säilib lugu {number(info.keepId)} („{keep.title}“). Lugu {number(info.removeId)} ühendatakse sellesse ja selle rida eemaldatakse.{' '}
        <button type="button" className="link-button" onClick={onSwap} disabled={busy}>Säilita hoopis lugu {number(info.removeId)}</button>
      </p>
      <section className="split-part split-part--second" aria-label="Ühendatud loo sõnastus">
        <p className="split-form__part">Ühendatud loo sõnastus</p>
        <StoryFields idBase={`uhenda-lugu-${info.keepId}`} value={value} onChange={setValue} roles={roles} stories={stories} busy={busy}
          invalidField={error?.field?.startsWith('story.') ? error.field.slice(6) : null} />
      </section>

      {info.criteria.length > 0 && (
        <fieldset className="split-assign">
          <legend>Kriteeriumid (märgitud jäävad alles)</legend>
          {info.criteria.map((c) => (
            <label key={c.id} className="merge-criterion">
              <input type="checkbox" checked={checked.includes(c.id)} onChange={() => toggle(c.id)} disabled={busy} />
              <span>
                <strong>{label(c)}</strong> (lugu {number(c.from === 'keep' ? info.keepId : info.removeId)}) {c.text}
                {c.duplicateWith.length > 0 && <span className="tag tag--dup">duplikaat: sama tekst kui {c.duplicateWith.map((id) => label(byId.get(id))).join(', ')}</span>}
                <span className="merge-criterion__link">
                  {c.linkLabel ? `Seos: ${c.linkLabel}${c.linkSurvives ? '' : ' – eemaldatakse ühendamisel (mockup ei jää alles)'}` : 'Seos mockup\'iga puudub'}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <div className="split-preview" aria-live="polite">
        <p className="split-preview__title">Eelvaade – pärast kinnitamist</p>
        <p><strong>Ühendatud lugu (kohal {info.resultPosition}):</strong> {title}</p>
        <ul>
          <li>Kriteeriumid: alles jääb {checked.length}, eemaldatakse {removedCriteria.length}.</li>
          {removedCriteria.map((c) => (
            <li key={c.id} className="merge-preview__removed">
              Eemaldatakse {label(c)} „{c.text}“{c.duplicateWith.length ? ' (duplikaat)' : ''} – {c.linkLabel ? `koos sellega kaob seos „${c.linkLabel}“` : 'sellel polnud mockup\'i seost'}.
            </li>
          ))}
          {lostLinks.map((c) => <li key={c.id}>{label(c)} jääb alles, aga selle seos „{c.linkLabel}“ eemaldatakse (selle loo mockup ei jää alles).</li>)}
          <li>Küsimused: {info.questions.length ? `kõik ${info.questions.length} jäävad ühendatud loole${info.questions.some((q) => !q.resolvedAt) ? '; avatud küsimuse tõttu saab lugu staatuse „Vajab täpsustamist“' : ''}.` : 'küsimusi pole.'}</li>
          <li>Mockup: {info.mockups.from ? `loo ${number(info.mockups.from === 'keep' ? info.keepId : info.removeId)} ${info.mockups[info.mockups.from]} versiooni jäävad ühendatud loole muutmata kujul.` : 'kummalgi lool pole mockup\'i.'}</li>
          {info.pendingProposals > 0 && <li>Ootel ettepanekud ({info.pendingProposals}) lükatakse tagasi – need koostati ühendamiseelse seisu põhjal.</li>}
          {info.focus && <li>Alustamise lugu on ühendatud lugu{info.focus === 'remove' ? ` (alustamise lugu oli lugu ${number(info.removeId)})` : ''}.</li>}
          {mvp.count !== null && (mvp.keepAbove || mvp.removeAbove) && (
            <li>MVP joon: ühendatud lugu on joone kohal{mvp.keepAbove && mvp.removeAbove ? '; joone kohal on ühe loo võrra vähem' : ''}.</li>
          )}
          <li>
            Teiste lugude sisu ei muutu{number(info.removeId) < stories.length ? '; eemaldatava loo järel olevad lood nihkuvad ühe koha võrra ettepoole' : ' ega järjekord muutu'}.
            {' '}Loo {number(info.removeId)} („{remove.title}“) rida kustutatakse. Tagasivõtmist veel pole.
          </li>
        </ul>
      </div>
      {error && <p className="error" role="alert">{error.message}</p>}
      <div className="actions">
        <button type="submit" disabled={busy}>{busy ? 'Ühendan…' : 'Ühenda'}</button>
      </div>
    </form>
  );
}
