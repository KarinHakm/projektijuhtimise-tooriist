import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { importJsx } from './helpers/jsx.js';

// Avaleht renderdatakse võltsandmetega HTML-iks. Klõpsamist ei testita.
let ProjectListView, progressText;
before(async () => {
  ({ ProjectListView, progressText } = await importJsx('src/pages/ProjectList.jsx'));
});

const stages = (statuses) => ['idee', 'rollid', 'lood', 'prioriteedid', 'kriteeriumid', 'tapsustused', 'groomimine']
  .map((key, i) => ({ key, label: key, status: statuses[i] }));
const P101 = {
  id: 101, name: 'TESTKOOPIA A – Lisa kõik', description: 'L06 brauserikatse võltsandmetega.', createdAt: '2026-10-01T06:00:00.000Z',
  progress: { stages: stages(['skipped', 'done', 'done', 'done', 'done', 'done', 'not_built']), lastDone: 'Täpsustused', next: null,
    nextStep: 'Sisesta uus kliendi täpsustus (valikuline)', allBuiltDone: true, storyCount: 4 },
};
const NEW = {
  id: 7, name: 'Uus', description: '', createdAt: '2026-10-01T06:00:00.000Z',
  progress: { stages: stages(['next', 'blocked', 'blocked', 'blocked', 'blocked', 'blocked', 'not_built']), lastDone: null, next: 'Idee',
    nextStep: 'Kirjelda projekti idee', allBuiltDone: false, storyCount: 0 },
};
const DEMO = { ...NEW, id: 8, name: 'Näidis: Linnaraamatukogu e-teenus' };
const render = (props) => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(ProjectListView, { onOpenForm: () => {}, ...props })))
  .replace(/<!-- -->/g, '');

test('pealkiri, selgitus ja „+ Loo projekt“ nupp, mis avab vormi samal lehel', () => {
  const html = render({ projects: [P101] });
  assert.match(html, /<h1 class="home__title">Projektid<\/h1><p class="home__lead">Kirjelda kliendi idee – AI aitab/);
  assert.match(html, /<button type="button" class="home__create" aria-expanded="false" aria-controls="uus-projekt">\+ Loo projekt<\/button>/);
  const open = render({ projects: [P101], formOpen: true, form: createElement('section', { id: 'uus-projekt' }, 'VORM') });
  assert.doesNotMatch(open, /\+ Loo projekt/);
  assert.match(open, /<section id="uus-projekt">VORM<\/section>/);
});

test('terve kaart on üks link; „Ava →“ on ainult visuaalne tekst, kaardi sees pole teist linki ega nuppu', () => {
  const html = render({ projects: [P101, NEW] });
  const cards = [...html.matchAll(/<li><a class="project-card" href="([^"]+)"[^>]*>(.*?)<\/a><\/li>/g)];
  assert.deepEqual(cards.map((c) => c[1]), ['/projects/101', '/projects/7']);
  for (const [, , inner] of cards) {
    assert.doesNotMatch(inner, /<a |<button/);
    assert.match(inner, /<span class="project-card__open" aria-hidden="true">Ava →<\/span>/);
  }
});

test('kaardi hierarhia ja etapiseis tekstina; täpid on ainult visuaalsed', () => {
  const html = render({ projects: [P101] });
  assert.match(html, /<span class="project-card__name">TESTKOOPIA A – Lisa kõik<\/span>.*<span class="project-card__desc">L06 brauserikatse võltsandmetega\.<\/span>.*<span class="stage-dots" aria-hidden="true">.*<span class="project-card__stage">Viimati läbitud: Täpsustused · Järgmine samm: Sisesta uus kliendi täpsustus \(valikuline\)<\/span>.*<span class="project-card__meta">4 lugu · Loodud 1\.10\.2026<\/span>/);
  assert.equal((html.match(/class="stage-dot /g) ?? []).length, 7);
  assert.equal(progressText(NEW.progress), 'Alustamata · Järgmine samm: Kirjelda projekti idee');
});

test('tühi seis: selgitus ja „+ Loo esimene projekt“; laadimine ja viga', () => {
  const html = render({ projects: [] });
  assert.match(html, /<div class="empty-state"><p class="empty-state__title">Projekte veel ei ole\.<\/p>.*<button type="button" aria-controls="uus-projekt">\+ Loo esimene projekt<\/button><\/div>/);
  assert.match(render({ projects: null }), /Laadin…/);
  assert.match(render({ projects: null, loadError: 'Serveriga ei saa ühendust.' }), /Projekte ei saanud laadida: Serveriga ei saa ühendust\./);
});

test('õnnestunud loomise järel avatakse loodud projekt', () => {
  const src = readFileSync('src/pages/ProjectList.jsx', 'utf8');
  assert.match(src, /const created = await createProject\(\{ name, description \}\);\n\s*navigate\(`\/projects\/\$\{created\.id\}`\);/);
});

test('näidisprojektil on nime asemel eesliite „Näidis:“ kohal lühike märk „Näidis“ (vihjega)', () => {
  const html = render({ projects: [DEMO] });
  assert.match(html, /<span class="project-card__name">Linnaraamatukogu e-teenus<span class="tag tag--demo" title="Käsitsi koostatud näidisandmed, mitte AI vastus">Näidis<\/span><\/span>/);
  assert.doesNotMatch(render({ projects: [P101] }), /tag--demo/);
});
