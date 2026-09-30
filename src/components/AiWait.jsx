import { useEffect, useState } from 'react';

// Ooteolek AI päringu ajal: näitab möödunud sekundeid, sest vastus võib võtta kuni paar minutit.
// Kasutatakse ka automaatse korduspäringu ajal (server kordab vigase vastuse korral üks kord).
export default function AiWait({ label = 'AI koostab vastust' }) {
  const [started] = useState(() => Date.now());
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [started]);

  return (
    <div className="ai-wait" role="status" aria-live="polite">
      <span className="ai-wait__spinner" aria-hidden="true" />
      <span>{label}… {seconds} s</span>
    </div>
  );
}
