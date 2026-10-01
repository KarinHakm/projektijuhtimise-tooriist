import { canMove } from '../backlog/order.js';
import { ORIGIN_LABELS, STATUS_LABELS } from '../stories/selection.js';

// Backlog'i loend (L06, L07): järjekorranumber, pealkiri, staatus, suurus, päritolu ja ↑/↓ nupud.
// buttonRef(id, direction) annab nupu viite, et fookus jääks pärast tõstet samale nupule.
export default function BacklogList({ stories, busy = false, highlightId = null, onMove, buttonRef }) {
  if (stories.length === 0) return <p className="muted">Backlog on tühi.</p>;
  return (
    <ol className="backlog">
      {stories.map((s, i) => {
        const number = i + 1;
        const arrow = (direction, symbol, verb) => (
          <button
            type="button"
            className="icon-button"
            ref={buttonRef?.(s.id, direction)}
            disabled={busy || !canMove(i, stories.length, direction)}
            aria-label={`Tõsta lugu ${number} ${verb}: ${s.title}`}
            onClick={() => onMove(s.id, direction)}
          >
            {symbol}
          </button>
        );
        return (
          <li key={s.id} className={s.id === highlightId ? 'backlog__item backlog__item--moved' : 'backlog__item'}>
            <span className="backlog__number">{number}.</span>
            <div>
              <p className="backlog__title">{s.title}</p>
              <p className="backlog__meta">
                Staatus: {STATUS_LABELS[s.status] ?? s.status} · Suurus: {s.size} · Päritolu: {ORIGIN_LABELS[s.origin] ?? s.origin}
              </p>
            </div>
            {onMove && (
              <div className="backlog__actions">
                {arrow('up', '↑', 'üles')}
                {arrow('down', '↓', 'alla')}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
