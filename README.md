# Projektijuhtimise tööriist

AI-põhine veebirakendus, mis aitab projektijuhil koos kliendiga muuta umbmäärase idee kasutajalugude backlog'iks. TAK25 koolitöö.

> Minimaalne README (lugu L01). Täiendatakse lõplikult loos L30.
> Arenduse plaan: [docs/backlog.md](docs/backlog.md). AI-teenuse valik ja piirangud: [docs/ai-piirangud.md](docs/ai-piirangud.md).

## Nõuded

- Node.js 22.22 või uuem (`node -v`)
- npm

## Paigaldus

```bash
npm install
cp .env.example .env
```

`.env` faili ei lisata git'i. Praeguses etapis ei pea seal midagi muutma.

## Käivitamine

```bash
npm run dev
```

Ava brauseris http://localhost:5175. Server töötab pordil 3001 ja Vite suunab `/api` päringud sinna.

Kui port 5175 või 3001 on hõivatud, annab käivitus vea. Serveri porti saab muuta failis `.env` (`PORT`).
## Testid

```bash
npm test
```
