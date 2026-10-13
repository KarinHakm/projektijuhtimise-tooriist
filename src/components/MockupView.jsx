import { useState } from 'react';

// Mockup'i kuvamine komponentide loendist (L10). Kõik tekstid lähevad Reacti kaudu tekstina,
// seega ka "<script>" kuvatakse tavatekstina; HTML-i ei sisestata kunagi otse.
function Component({ c }) {
  switch (c.type) {
    case 'heading': return <p className="mock-heading">{c.text}</p>;
    case 'text': return <p className="mock-text">{c.text}</p>;
    case 'button': return <span className="mock-button">{c.text}</span>;
    case 'input':
      return (
        <div className="mock-input">
          <span>{c.text}</span>
          <span className="mock-input__box" aria-hidden="true" />
        </div>
      );
    case 'list':
      return (
        <div className="mock-list">
          {c.text && <p className="mock-text">{c.text}</p>}
          <ul>{c.items.map((item, i) => <li key={i}>{item}</li>)}</ul>
        </div>
      );
    case 'image': return <div className="mock-image">Pilt: {c.text}</div>;
    case 'card': return <div className="mock-card">{c.text}</div>;
    default: return null; // tundmatut tüüpi server läbi ei lase
  }
}

// marks (valikuline, L11 eelvaade): iga komponendi kohta true, kui see on lisandunud/eemaldatud; mark = 'added' | 'removed'.
// notes (valikuline, L23): iga komponendi kohta { linkedBy: [kriteeriumi numbrid], warnings: [{ message }] }.
function Notes({ note }) {
  if (!note || (note.linkedBy.length === 0 && note.warnings.length === 0)) return null;
  return (
    <span className="mock-notes">
      {note.linkedBy.length > 0 && <span className="mock-badge">{note.linkedBy.map((n) => `K${n}`).join(', ')}</span>}
      {note.warnings.map((w) => <span key={w.message} className="mock-flag">⚠ Kontrolli: {w.message}</span>)}
    </span>
  );
}

// „Veeb | Mobiil“ (nõudmata lisa): sama komponentide loend kahes raamis. Valik on ainult brauseri olek –
// see ei muuda andmeid, versiooni ega ülevaatust ega tee päringut.
const DEVICES = [{ key: 'web', label: 'Veeb' }, { key: 'mobile', label: 'Mobiil' }];

export function DeviceToggle({ device, onChange }) {
  return (
    <div className="device-toggle" role="group" aria-label="Mockup'i esitus">
      {DEVICES.map((d) => (
        <button key={d.key} type="button" className="device-toggle__button" aria-pressed={device === d.key} onClick={() => onChange(d.key)}>{d.label}</button>
      ))}
    </div>
  );
}

// device (valikuline): 'web' | 'mobile' – kutsuja hoiab valikut ise ja näitab lülitit (nt kriteeriumide ja mockup'i paigutus).
// Ilma selleta on mockup'il oma lüliti, vaikimisi „Veeb“.
export default function MockupView({ mockup, marks = null, mark = null, notes = null, device = null }) {
  const [own, setOwn] = useState('web');
  const shown = device ?? own;
  return (
    <>
      {device === null && <DeviceToggle device={own} onChange={setOwn} />}
      <figure className={`mockup mockup--${shown}`} aria-label={`Mockup: ${mockup.title}`}>
        <figcaption className="mockup__title">{mockup.title}</figcaption>
        <div className="mockup__body">
          {mockup.components.map((c, i) => {
            const body = <><Component c={c} /><Notes note={notes?.[i]} /></>;
            if (marks?.[i]) return <div key={i} className={`mock-mark mock-mark--${mark}`}><span className="mock-mark__label">{mark === 'added' ? 'Lisandub' : 'Eemaldub'}</span>{body}</div>;
            return notes ? <div key={i} className="mock-item">{body}</div> : <Component key={i} c={c} />;
          })}
        </div>
      </figure>
    </>
  );
}
