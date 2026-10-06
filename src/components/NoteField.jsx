import { useEffect, useState } from 'react';

export const NOTE_MAX = 500;

// Vabatekst sammu juures („Või kirjuta oma sõnadega“). Tekst läheb sama sammu olemasolevasse AI päringusse;
// tulemus on ootel ettepanek, mida kasutaja kinnitab, muudab või lükkab tagasi. replaces = ootel ettepanek on olemas.
export function NoteFieldView({ card, text, replaces, busy = false, disabled = false, onChange, onSubmit }) {
  const id = `note-${card}`;
  return (
    <form className="note-field" data-note={card} noValidate onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <label htmlFor={id}>Või kirjuta oma sõnadega</label>
      <textarea id={id} rows={2} maxLength={NOTE_MAX} value={text} onChange={(e) => onChange(e.target.value)} disabled={busy || disabled} />
      <p className="muted">
        {replaces
          ? 'AI koostab uue ettepaneku, mis asendab praeguse ootel ettepaneku. Midagi ei rakendata enne sinu kinnitust.'
          : 'AI koostab ettepaneku sinu teksti järgi. Midagi ei rakendata enne sinu kinnitust.'}
      </p>
      <button type="submit" className="secondary" disabled={busy || disabled || !text.trim()}>{busy ? 'AI koostab…' : 'Saada AI-le'}</button>
    </form>
  );
}

// onSend(note) → Promise<boolean>: true, kui ettepanek tuli (väli tühjendatakse). Viga näitab paneel ise.
// „Mida teeme edasi?“ võib välja eeltäita sündmusega pjt:note { card, note }.
export default function NoteField({ card, replaces, disabled, onSend }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onNote = (e) => { if (e.detail?.card === card) setText(e.detail.note ?? ''); };
    window.addEventListener('pjt:note', onNote);
    return () => window.removeEventListener('pjt:note', onNote);
  }, [card]);
  async function submit() {
    const note = text.trim();
    if (!note) return;
    setBusy(true);
    try {
      if (await onSend(note)) setText('');
    } finally {
      setBusy(false);
    }
  }
  return <NoteFieldView card={card} text={text} replaces={replaces} busy={busy} disabled={disabled} onChange={setText} onSubmit={submit} />;
}
