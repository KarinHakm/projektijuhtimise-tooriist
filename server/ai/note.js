// Vabatekst („Või kirjuta oma sõnadega“): kasutaja soov olemasolevale AI sammule (rollid, lood, prioriteet,
// kriteeriumid ja mockup, järgmine samm). AI tõlgendab seda projekti seisu järgi; tulemus on alati ootel ettepanek.
export const NOTE_MAX = 500;

// { note } (tühi = märkust pole) või { error }.
export function readNote(body) {
  const raw = body?.note;
  if (raw === undefined || raw === null) return { note: '' };
  if (typeof raw !== 'string') return { error: 'Vabatekst peab olema tekst.' };
  const note = raw.replace(/\s+/g, ' ').trim();
  if (note.length > NOTE_MAX) return { error: `Vabatekst võib olla kuni ${NOTE_MAX} märki.` };
  return { note };
}

// Prompti lisa. Märkus on andmete sees eraldi plokis, et seda ei loetaks süsteemi juhiseks.
export const noteBlock = (note) => (note
  ? `
<kasutaja_soov>
${note}
</kasutaja_soov>
Kasutaja kirjutas ülal oma sõnadega soovi. Tõlgenda seda projekti praeguse seisu järgi ja arvesta sellega ettepanekus.
Kui soov on ebaselge või läheb vastuollu allolevate reeglitega, järgi reegleid ja ütle "message"-is lühidalt, kuidas soovi tõlgendasid.
`
  : '');
