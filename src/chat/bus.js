import { useEffect, useRef } from 'react';

// Vestluse tekstikast (ChatComposer) ja sammude paneelid suhtlevad brauseri sündmustega, et iga paneel saaks
// kasutada oma olemasolevat AI päringut ja oleku käsitlust (ootel ettepanek, vead, ooteindikaator).
//   pjt:probe   – kast küsib, millised sammud võtavad praegu teksti vastu (detail.available: Set)
//   pjt:send    – kast saadab teksti sammule (detail.card, detail.note); vastuvõtja paneb detail.promise
//   pjt:note    – „Mida teeme edasi?“ tulemus eeltäidab kasti (detail.card, detail.note)
//   pjt:compose – samm palub kasti fookusesse sihtkohaga detail.card (nt „Sisesta kliendi täpsustus“)
//   pjt:targets – sihtkohtade hulk muutus (kast küsib uuesti)

export function probeTargets() {
  const detail = { available: new Set() };
  window.dispatchEvent(new CustomEvent('pjt:probe', { detail }));
  return detail.available;
}

// Tagastab Promise<boolean> (true = ettepanek tuli) või null, kui samm teksti praegu vastu ei võta.
export function sendToTarget(card, note) {
  const detail = { card, note, promise: null };
  window.dispatchEvent(new CustomEvent('pjt:send', { detail }));
  return detail.promise ? Promise.resolve(detail.promise) : null;
}

// Paneel registreerib end sihtkohaks. enabled = kas samm võtab teksti praegu vastu; onSend(note) → Promise<boolean>.
export function useChatTarget(card, enabled, onSend) {
  const send = useRef(onSend);
  send.current = onSend;
  useEffect(() => {
    if (!enabled) return undefined;
    const onProbe = (e) => e.detail.available.add(card);
    const onChat = (e) => { if (e.detail.card === card && !e.detail.promise) e.detail.promise = send.current(e.detail.note); };
    window.addEventListener('pjt:probe', onProbe);
    window.addEventListener('pjt:send', onChat);
    window.dispatchEvent(new CustomEvent('pjt:targets'));
    return () => {
      window.removeEventListener('pjt:probe', onProbe);
      window.removeEventListener('pjt:send', onChat);
      window.dispatchEvent(new CustomEvent('pjt:targets'));
    };
  }, [card, enabled]);
}
