// Lugude ettepaneku valiku loogika ilma Reactita (testitav Node'i testidega).
// Pealkiri ja väljade kontroll tulevad ühisest moodulist, mida kasutab ka server.
import { cleanField, composeTitle, validateStoryText } from '../../shared/story-format.js';

export const SIZES = ['S', 'M', 'L'];

const pick = (s) => ({ role: s.role, rolePhrase: s.rolePhrase, want: s.want, soThat: s.soThat, size: s.size });

// AI ettepanekust valikuloend: kõik lood on vaikimisi märgitud, keegi pole tagasi lükatud.
export function fromProposal(proposal) {
  return proposal.stories.map((s) => ({
    index: s.index,
    original: pick(s),
    draft: pick(s),
    warnings: s.warnings ?? [],
    checked: true,
    rejected: false,
  }));
}

const update = (items, index, fn) => items.map((i) => (i.index === index ? fn(i) : i));

export const toggleChecked = (items, index) => update(items, index, (i) => ({ ...i, checked: !i.checked }));

// ✗ Lükka tagasi: kaart kaob pakkumisest ja seda ei lisata ka "Lisa kõik" nupuga.
export const rejectStory = (items, index) => update(items, index, (i) => ({ ...i, rejected: true, checked: false }));

export const visibleStories = (items) => items.filter((i) => !i.rejected);

// ✎ Muuda → Salvesta. Kontrollib väljad sama mooduliga mis server ja lubab ainult kinnitatud rolle.
// Tagastab { items } või { errors: [{ field, message }] }.
export function saveEdit(items, index, fields, confirmedRoles) {
  const text = validateStoryText(fields);
  const errors = [...text.errors];
  if (!confirmedRoles.includes(fields.role)) errors.push({ field: 'role', message: 'Vali roll kinnitatud rollide seast.' });
  if (!SIZES.includes(fields.size)) errors.push({ field: 'size', message: 'Suurus peab olema S, M või L.' });
  if (errors.length) return { errors };
  const draft = { role: fields.role, ...text.value, size: fields.size };
  return { items: update(items, index, (i) => ({ ...i, draft, warnings: text.warnings.map((w) => w.message) })) };
}

export function isEdited(item) {
  const a = item.draft;
  const b = item.original;
  return a.role !== b.role || a.size !== b.size
    || cleanField(a.rolePhrase) !== cleanField(b.rolePhrase)
    || cleanField(a.want) !== cleanField(b.want)
    || cleanField(a.soThat) !== cleanField(b.soThat);
}

export const storyTitle = (item) => composeTitle(item.draft);

// Serverile saadetav kuju (POST stories/apply). "all" = kõik tagasi lükkamata lood; "selected" = märgitud.
export function buildApply(items, mode) {
  return items
    .filter((i) => !i.rejected && (mode === 'all' || i.checked))
    .map((i) => ({ index: i.index, ...i.draft }));
}

export const ORIGIN_LABELS = { ai: 'AI ettepanek', ai_edited: 'AI ettepanek, muudetud', manual: 'Käsitsi lisatud' };
export const STATUS_LABELS = {
  idee: 'Idee', vajab_tapsustamist: 'Vajab täpsustamist', labivaadatud: 'Läbivaadatud', valmis_arenduseks: 'Valmis arenduseks',
};
