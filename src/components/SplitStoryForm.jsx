import { useState } from 'react';
import { composeTitle } from '../../shared/story-format.js';
import StoryFields from './StoryFields.jsx';

// Loo käsitsi jagamine kaheks (L25). Enne kinnitust on näha mõlema osa pealkiri ja täpne loetelu, mis algse
// looga juhtub. Algne lugu jääb osaks 1 (mockup'i versioonid, alustamise valik); osa 2 lisatakse kohe selle järele.
// info = serveri split-info; error = { message, field }.
export default function SplitStoryForm({ story, info, roles = [], stories = [], busy = false, error = null, onSubmit, onCancel }) {
  const base = { role: story.role, rolePhrase: story.rolePhrase, size: story.size, touchesView: story.touchesView };
  const [first, setFirst] = useState({ ...base, want: story.want, soThat: story.soThat });
  const [second, setSecond] = useState({ ...base, want: '', soThat: '' });
  const [criteriaToSecond, setCriteria] = useState([]);
  const [questionsToSecond, setQuestions] = useState([]);
  const toggle = (setter) => (id, toSecond) => setter((all) => (toSecond ? [...new Set([...all, id])] : all.filter((x) => x !== id)));
  const title = (v) => (v.rolePhrase && v.want && v.soThat ? composeTitle(v) : '(täida väljad)');
  const field = error?.field ?? '';
  const movedLinked = info.criteria.filter((c) => criteriaToSecond.includes(c.id) && c.linked).length;

  const assign = (items, chosen, set, label) => (
    <fieldset className="split-assign">
      <legend>{label}</legend>
      {items.map((item, i) => (
        <div key={item.id} className="split-assign__row">
          <span className="split-assign__text">{label === 'Kriteeriumid' ? `K${i + 1}. ` : ''}{item.text}{item.resolvedAt ? ' (vastatud)' : ''}</span>
          <label><input type="radio" name={`jaga-${story.id}-${label}-${item.id}`} checked={!chosen.includes(item.id)} onChange={() => set(item.id, false)} disabled={busy} /> Osa 1</label>
          <label><input type="radio" name={`jaga-${story.id}-${label}-${item.id}`} checked={chosen.includes(item.id)} onChange={() => set(item.id, true)} disabled={busy} /> Osa 2</label>
        </div>
      ))}
    </fieldset>
  );

  return (
    <form className="story-form split-form" onSubmit={(e) => { e.preventDefault(); onSubmit({ first, second, criteriaToSecond, questionsToSecond }); }} noValidate>
      <p className="split-form__title">Jaga lugu kaheks</p>
      <div className="split-form__parts">
        <section aria-label="Osa 1" className="split-part split-part--first">
          <p className="split-form__part"><span className="split-part__badge">1</span> Algne lugu – muuda sõnastust ainult vajadusel</p>
          <StoryFields idBase={`jaga-${story.id}-1`} value={first} onChange={setFirst} roles={roles} stories={stories} busy={busy}
            invalidField={field.startsWith('first.') ? field.slice(6) : null} />
        </section>
        <section aria-label="Osa 2" className="split-part split-part--second">
          <p className="split-form__part"><span className="split-part__badge">2</span> Uus lugu – täida tegevus ja kasu</p>
          <StoryFields idBase={`jaga-${story.id}-2`} value={second} onChange={setSecond} roles={roles} stories={stories} busy={busy}
            invalidField={field.startsWith('second.') ? field.slice(7) : null} />
        </section>
      </div>
      {info.criteria.length > 0 && assign(info.criteria, criteriaToSecond, toggle(setCriteria), 'Kriteeriumid')}
      {info.questions.length > 0 && assign(info.questions, questionsToSecond, toggle(setQuestions), 'Küsimused')}

      <div className="split-preview" aria-live="polite">
        <p className="split-preview__title">Eelvaade – pärast kinnitamist</p>
        <ol>
          <li><strong>Osa 1:</strong> {title(first)}</li>
          <li><strong>Osa 2:</strong> {title(second)}</li>
        </ol>
        <p className="split-preview__title">Mis algse looga juhtub</p>
        <ul>
          <li>Algne lugu jääb osaks 1 (sama lugu, uus sõnastus). Osa 2 lisatakse kohe selle järele; järgnevad lood nihkuvad ühe koha võrra, nende sisu ei muutu.</li>
          <li>Kriteeriumid: osale 1 jääb {info.criteria.length - criteriaToSecond.length}, osale 2 läheb {criteriaToSecond.length}.
            {movedLinked > 0 && ` Osale 2 viidud ${movedLinked} kriteeriumi seos mockup'iga eemaldatakse (osal 2 mockup'i pole).`}</li>
          {info.mockupVersions > 0 && <li>Mockup'i versioonid ({info.mockupVersions}) jäävad osale 1. Osal 2 mockup'i pole.</li>}
          {info.questions.length > 0 && <li>Küsimused: osale 1 jääb {info.questions.length - questionsToSecond.length}, osale 2 läheb {questionsToSecond.length}.</li>}
          {info.pendingProposals > 0 && <li>Algse loo ootel ettepanekud ({info.pendingProposals}: kriteeriumid, mockup või täpsustus) lükatakse tagasi – need koostati jagamiseelse loo põhjal.</li>}
          {info.isFocus && <li>Alustamise lugu jääb osaks 1.</li>}
          {info.aboveMvpLine && <li>Lugu on MVP joone kohal – ka osa 2 läheb joone kohale (joon nihkub ühe loo võrra alla).</li>}
          <li>Midagi ei kustutata. Tagasivõtmist veel pole.</li>
        </ul>
      </div>
      {error && <p className="error" role="alert">{error.message}</p>}
      <div className="actions">
        <button type="submit" disabled={busy}>{busy ? 'Jagan…' : 'Jaga kaheks'}</button>
        <button type="button" className="secondary" onClick={onCancel} disabled={busy}>Tühista</button>
      </div>
    </form>
  );
}
