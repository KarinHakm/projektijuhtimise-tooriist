// Lühike märk käsitsi koostatud näidisandmetele (npm run demo). Täpsustus on vihjes ja README-s.
export const DEMO_TITLE = 'Käsitsi koostatud näidisandmed, mitte AI vastus';

export default function DemoTag() {
  return <span className="tag tag--demo" title={DEMO_TITLE}>Näidis</span>;
}
