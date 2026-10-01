// Loo kustutamise kinnitus (L15): loetleb täpselt, mis koos looga kaob või muutub. Kustutamine on lõplik.
export default function DeleteStoryConfirm({ story, impact, busy = false, error = '', onConfirm, onCancel }) {
  const lost = [
    impact.criteria && `${impact.criteria} kriteeriumi`,
    impact.mockupVersions && `${impact.mockupVersions} mockup'i versiooni`,
    impact.questions && `${impact.questions} küsimust`,
  ].filter(Boolean);
  return (
    <div className="delete-confirm" role="alertdialog" aria-labelledby={`kustuta-${story.id}`}>
      <p id={`kustuta-${story.id}`} className="delete-confirm__title">Kustutad loo „{story.title}“?</p>
      <ul>
        {impact.isFocus && <li><strong>See on alustamise lugu.</strong> Alustamise valik tühjeneb; vali prioriteedi juures uus lugu.</li>}
        {lost.length > 0 ? <li>Koos looga kustuvad: {lost.join(', ')}.</li> : <li>Lool pole kriteeriume, mockup'i ega küsimusi.</li>}
        {impact.pendingProposals > 0 && <li>Selle loo ootel ettepanekud ({impact.pendingProposals}) lükatakse tagasi.</li>}
        {impact.aboveMvpLine && <li>Lugu on MVP joone kohal – joon nihkub ühe loo võrra üles.</li>}
        <li>Teiste lugude järjekord jääb samaks. <strong>Tagasivõtmist pole – kustutamine on lõplik.</strong></li>
      </ul>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button type="button" className="danger" onClick={onConfirm} disabled={busy}>{busy ? 'Kustutan…' : 'Kustuta lõplikult'}</button>
        <button type="button" className="secondary" onClick={onCancel} disabled={busy} autoFocus>Tühista</button>
      </div>
    </div>
  );
}
