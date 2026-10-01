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
