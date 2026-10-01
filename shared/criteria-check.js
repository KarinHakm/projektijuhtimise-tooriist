// Vastuvõtukriteeriumi kontrollitavuse reegel (L18), ühine serverile ja brauserile.
// Kriteerium peab olema üks lihtne tingimus, millele saab vastata jah või ei.

export const CRITERION_MAX = 200;

// Hinnangulised sõnad: nende täitmist ei saa jah/ei vastusega kontrollida. Loend on ainult siin.
export const SUBJECTIVE_WORDS = [
  'kasutajasõbralik', 'kiire', 'kiiresti', 'lihtne', 'lihtsalt', 'mugav', 'mugavalt', 'intuitiivne',
  'selge', 'selgelt', 'ilus', 'kaasaegne', 'meeldiv', 'arusaadav', 'efektiivne', 'sujuv',
];
// Sidesõnad, mis ühendavad tavaliselt mitu tingimust ühte kriteeriumisse.
export const JOINING_WORDS = ['ja', 'ning', 'või'];

export const cleanCriterion = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

const words = (text) => cleanCriterion(text).toLocaleLowerCase('et').split(/[^\p{L}\p{N}-]+/u).filter(Boolean);

// Tagastab hoiatused kujul { word, message }; tühi loend = kriteerium on kontrollitav.
export function checkCriterion(text) {
  const found = words(text);
  const warnings = [];
  for (const w of SUBJECTIVE_WORDS) {
    if (found.some((f) => f === w || f.startsWith(w))) {
      warnings.push({ word: w, message: `Hinnanguline sõna „${w}“ – seda ei saa jah/ei vastusega kontrollida.` });
    }
  }
  for (const w of JOINING_WORDS) {
    if (found.includes(w)) warnings.push({ word: w, message: `Sõna „${w}“ ühendab ilmselt mitu tingimust – jaga need eraldi kriteeriumideks.` });
  }
  return warnings;
}
