import { CARDS } from '../../shared/stage.js';

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)';

// Järgmise sammu nupp: kerib olemasoleva kaardi ja tegevuseni, paneb fookuse ja tõstab kaardi korraks esile.
// Ei käivita ühtegi tegevust ega AI-kutset.
export function goToStep({ card, focus }) {
  const cardEl = document.getElementById(CARDS[card]);
  if (!cardEl) return;
  let target = focus ? cardEl.querySelector(focus) : null;
  if (target && !target.matches(FOCUSABLE)) target = target.querySelector(FOCUSABLE);
  (target ?? cardEl).scrollIntoView({ behavior: 'smooth', block: target ? 'center' : 'start' });
  (target ?? cardEl).focus({ preventScroll: true });
  cardEl.classList.remove('card--highlight');
  void cardEl.offsetWidth; // käivitab esiletõstu animatsiooni uuesti
  cardEl.classList.add('card--highlight');
  setTimeout(() => cardEl.classList.remove('card--highlight'), 1600);
}
