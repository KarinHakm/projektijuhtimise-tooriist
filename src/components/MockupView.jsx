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

export default function MockupView({ mockup }) {
  return (
    <figure className="mockup" aria-label={`Mockup: ${mockup.title}`}>
      <figcaption className="mockup__title">{mockup.title}</figcaption>
      <div className="mockup__body">
        {mockup.components.map((c, i) => <Component key={i} c={c} />)}
      </div>
    </figure>
  );
}
