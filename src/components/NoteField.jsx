import { useChatTarget } from '../chat/bus.js';

export const NOTE_MAX = 500;

// Vabatekst sammu juures (L37: ühe vestluse kast). Sammul eraldi tekstikasti pole – tekst tuleb vestluse alt
// (ChatComposer) ja läheb sama sammu olemasolevasse AI päringusse; tulemus on ootel ettepanek, mida kasutaja
// kinnitab, muudab või lükkab tagasi. onSend(note) → Promise<boolean>: true, kui ettepanek tuli.
export default function NoteField({ card, disabled, onSend }) {
  useChatTarget(card, !disabled, onSend);
  return null;
}
