// Näidisprojekti tunneb ära nime algusest "Näidis: " (scripts/demo-data.js). Kasutajale kuvatakse
// nimi ilma eesliiteta ja selle kõrval märk "Näidis".
const PREFIX = 'Näidis: ';

export function splitDemoName(name) {
  return name.startsWith(PREFIX) ? { demo: true, name: name.slice(PREFIX.length) } : { demo: false, name };
}
