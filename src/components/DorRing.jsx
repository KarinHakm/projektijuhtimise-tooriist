// DoR-ring (ainult esitlus): näitab olemasoleva valmisoleku tulemuse (readiness.checks) täidetud tingimuste arvu.
// Uut kontrolli ei tehta – tingimused arvutab shared/dor.js.
export default function DorRing({ checks }) {
  if (!checks?.length) return null;
  const ok = checks.filter((c) => c.ok).length;
  const total = checks.length;
  const label = `Valmisolek: ${ok}/${total} DoR tingimust täidetud`;
  return (
    <span className={ok === total ? 'dor-ring dor-ring--ok' : 'dor-ring'} style={{ '--dor': `${(ok / total) * 100}%` }} role="img" aria-label={label} title={label}>
      <span className="dor-ring__value" aria-hidden="true">{ok}/{total}</span>
    </span>
  );
}
