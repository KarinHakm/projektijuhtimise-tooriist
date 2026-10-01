import { SIZES } from '../stories/selection.js';

// Backlog'i järjestamise abifunktsioonid (L07). Puhtad funktsioonid, testitavad ilma brauserita.

// Lugude arv suuruse kaupa, nt { S: 2, M: 5, L: 0 }.
export function sizeCounts(stories) {
  const counts = Object.fromEntries(SIZES.map((size) => [size, 0]));
  for (const s of stories) if (s.size in counts) counts[s.size] += 1;
  return counts;
}

// Esimest lugu ei saa üles ega viimast alla tõsta.
export const canMove = (index, length, direction) => (direction === 'up' ? index > 0 : index < length - 1);

// Pärast tõstet jääb fookus sama suuna nupule; kui lugu jõudis äärde, siis vastasnupule.
// Tagastab 'up', 'down' või null (lugu puudub või on ainuke).
export function focusAfterMove(stories, storyId, direction) {
  const index = stories.findIndex((s) => s.id === storyId);
  if (index === -1) return null;
  if (canMove(index, stories.length, direction)) return direction;
  const other = direction === 'up' ? 'down' : 'up';
  return canMove(index, stories.length, other) ? other : null;
}

export const movedMessage = (stories, storyId) => `Lugu tõsteti kohale ${stories.findIndex((s) => s.id === storyId) + 1}.`;
