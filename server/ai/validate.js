import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: true });
const compiled = new WeakMap();

// Kontrollib andmeid JSON-skeemi järgi. Veateadetes on ainult asukoht ja reegel,
// mitte andmete sisu, et need oleks ohutud logida.
export function validateAgainst(schema, data) {
  let validate = compiled.get(schema);
  if (!validate) {
    validate = ajv.compile(schema);
    compiled.set(schema, validate);
  }
  if (validate(data)) return { valid: true, errors: [] };
  const errors = validate.errors.map((e) => `${e.instancePath || '/'} ${e.keyword}`);
  return { valid: false, errors };
}
