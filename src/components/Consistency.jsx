// Kooskõla kuvamine (L23). Kolm eri asja, mida ei segata:
//   "Seotud: …"   – viide mockup'i elemendile (ja kes selle tegi: AI või sina), neutraalne
//   "Kontrolli: …" – hoiatus, mida inimene peab kontrollima (mitte kindel otsus)
//   punane tekst  – päringu viga (kuvab kutsuja eraldi)
const SOURCE = { ai: 'AI', user: 'sina' };

export function LinkLine({ link }) {
  if (!link) return <p className="consistency-link consistency-link--none">Seos mockup'iga puudub</p>;
  return <p className="consistency-link">Seotud: {link.label} <span className="tag">{SOURCE[link.source] ?? link.source}</span></p>;
}

export function CheckWarnings({ warnings }) {
  return warnings.map((w) => <p key={w.code + w.message} className="consistency-warning">⚠ Kontrolli: {w.message}</p>);
}

// Kasutaja ülevaatuse kinnitus: sinu kinnitus konkreetsele seisule, mitte automaatne tõend.
export function ReviewBox({ consistency, mockupVersion, busy, onReview }) {
  const { review, warningCount } = consistency;
  const at = review?.at ? new Date(review.at).toLocaleString('et-EE') : '';
  return (
    <section className="review-box" aria-labelledby="review-title">
      <h4 id="review-title">Ülevaatus</h4>
      <p className="muted">
        Kinnitus tähendab, et <strong>sina</strong> vaatasid selle loo kriteeriumid ja mockup'i versiooni {mockupVersion ?? '–'} üle.
        See ei ole automaatne tõend täieliku kooskõla kohta. Kinnitus aegub, kui kriteeriumid, viited või mockup muutuvad.
      </p>
      {review?.valid && <p className="review-box__ok">✓ Vaatasid üle: mockup'i versioon {review.mockupVersion}, {at}.</p>}
      {review && !review.valid && (
        <p className="consistency-warning">Varasem ülevaatus (mockup'i versioon {review.mockupVersion}) on aegunud – kriteeriumid, viited või mockup muutusid pärast seda.</p>
      )}
      {!review?.valid && (
        <>
          <p className="muted">Kontrollimist vajavaid hoiatusi: {warningCount}.</p>
          <button type="button" className="secondary" onClick={onReview} disabled={busy || mockupVersion == null}>
            Kinnitan: vaatasin mockup'i versiooni {mockupVersion ?? '–'} ja kriteeriumid üle
          </button>
        </>
      )}
    </section>
  );
}

// L18: AI enesekontrolli märge kriteeriumi juures. mark = { status, from?, warnings } või null.
// rewritten = AI sõnastas mittekontrollitava kriteeriumi ümber; still_untestable / not_checked = algne tekst jäi.
export function SelfCheckNote({ mark }) {
  if (!mark) return null;
  if (mark.status === 'rewritten') {
    return (
      <p className="selfcheck selfcheck--fixed">
        <span className="tag tag--selfcheck">AI parandas</span> Algne: „{mark.from}“{mark.warnings?.length ? ` – ${mark.warnings.join(' ')}` : ''}
      </p>
    );
  }
  if (mark.status === 'still_untestable') return <p className="warning selfcheck">⚠ AI ei suutnud kriteeriumi kontrollitavaks sõnastada – muuda või eemalda see.</p>;
  if (mark.status === 'not_checked') return <p className="warning selfcheck">⚠ Automaatne kontroll jäi tegemata (AI tõrge) – kontrolli kriteerium ise üle.</p>;
  return null;
}
