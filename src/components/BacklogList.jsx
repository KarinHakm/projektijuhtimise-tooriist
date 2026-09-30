import { ORIGIN_LABELS, STATUS_LABELS } from '../stories/selection.js';

// Lihtne backlog'i loend (L06): number, pealkiri, staatus, suurus ja päritolu.
// Järjestamine (↑/↓) ja selle püsivus lisanduvad loos L07.
export default function BacklogList({ stories }) {
  if (stories.length === 0) return <p className="muted">Backlog on tühi.</p>;
  return (
    <table className="backlog">
      <thead>
        <tr>
          <th scope="col">Nr</th>
          <th scope="col">Lugu</th>
          <th scope="col">Staatus</th>
          <th scope="col">Suurus</th>
          <th scope="col">Päritolu</th>
        </tr>
      </thead>
      <tbody>
        {stories.map((s) => (
          <tr key={s.id}>
            <td>{s.position}</td>
            <td>{s.title}</td>
            <td>{STATUS_LABELS[s.status] ?? s.status}</td>
            <td>{s.size}</td>
            <td>{ORIGIN_LABELS[s.origin] ?? s.origin}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
