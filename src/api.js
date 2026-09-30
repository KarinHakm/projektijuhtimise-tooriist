// Kõik päringud käivad oma serveri /api kaudu, mitte otse välistesse teenustesse.
export async function getHealth() {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
