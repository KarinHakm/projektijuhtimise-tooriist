// Kasutajaloo tekstivälju ja pealkirja reegel. Kasutavad nii server kui ka brauser, et reeglid ei läheks lahku.
//
// Väljad:
//   rolePhrase – roll olevas käändes, nt "Potentsiaalse liikmena" (lõpeb "-na", ei sisalda sõna "soovin")
//   want       – tegevus ILMA algava "soovin"-ita, nt "näha liikmepakette ja nende hindu"
//   soThat     – kasu ILMA algava "et"-ita, nt "saaksin valida endale sobiva paketi"
// Pealkiri (ainus reegel): "{RolePhrase} soovin {want}, et {soThat}."
// Sõnad "soovin" ja ", et" lisab ainult see mall; väljades neid olla ei tohi.

export const FIELD_MAX = { rolePhrase: 60, want: 200, soThat: 200 };

const LABELS = { rolePhrase: 'Roll olevas käändes', want: 'Tegevus', soThat: 'Kasu' };

// Kärbib tühikud ja eemaldab lõpust kirjavahemärgid, et mall ei tekitaks "..", ",," vms.
export function cleanField(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().replace(/[\s.,;:]+$/u, '');
}

const capitalize = (s) => (s ? s[0].toLocaleUpperCase('et') + s.slice(1) : s);

export function composeTitle({ rolePhrase, want, soThat }) {
  return `${capitalize(cleanField(rolePhrase))} soovin ${cleanField(want)}, et ${cleanField(soThat)}.`;
}

// Kontrollib välju. Tagastab { value, errors, warnings }; errors ja warnings on [{ field, message }].
// Vead tähendavad tagasilükkamist; hoiatused kuvatakse, aga ei takista.
export function validateStoryText(fields) {
  const value = {
    rolePhrase: cleanField(fields?.rolePhrase),
    want: cleanField(fields?.want),
    soThat: cleanField(fields?.soThat),
  };
  const errors = [];
  const warnings = [];
  const error = (field, message) => errors.push({ field, message });

  for (const field of ['rolePhrase', 'want', 'soThat']) {
    if (!value[field]) error(field, `${LABELS[field]} ei tohi olla tühi.`);
    else if (value[field].length > FIELD_MAX[field]) error(field, `${LABELS[field]} võib olla kuni ${FIELD_MAX[field]} märki.`);
  }
  if (value.rolePhrase) {
    if (!/na$/iu.test(value.rolePhrase)) error('rolePhrase', 'Roll peab olema olevas käändes (nt „Külastajana“).');
    if (/(^|\s)soovin(\s|$)/iu.test(value.rolePhrase)) error('rolePhrase', 'Rolli väljas ei tohi olla sõna „soovin“ – see lisatakse automaatselt.');
  }
  // Ka kirjavahemärgiga kuju („soovin:“, „et,“) – vormi sildid „soovin …“ ja „et …“ võivad selleni viia.
  if (/^soovin([\s:,;.–-]|$)/iu.test(value.want)) error('want', 'Tegevus ei tohi alata sõnaga „soovin“ – see lisatakse automaatselt.');
  if (/^et([\s:,;.–-]|$)/iu.test(value.soThat)) error('soThat', 'Kasu ei tohi alata sõnaga „et“ – see lisatakse automaatselt.');

  if (/(^|[\s,])et(\s|$)/iu.test(value.want)) {
    warnings.push({ field: 'want', message: 'Tegevus sisaldab eraldi „et“-kõrvallauset; kasu kuulub välja „Kasu“.' });
  }
  return { value, errors, warnings };
}
