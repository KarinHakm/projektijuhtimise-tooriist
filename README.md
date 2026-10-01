# Projektijuhtimise tööriist

AI-põhine veebirakendus, mis aitab projektijuhil koos kliendiga muuta umbmäärase idee kasutajalugude backlog'iks. TAK25 koolitöö.

> Minimaalne README (lugu L01). Täiendatakse lõplikult loos L30.
> Arenduse plaan: [docs/backlog.md](docs/backlog.md). AI-teenuse valik ja piirangud: [docs/ai-piirangud.md](docs/ai-piirangud.md).

## Õpetajale: kiirjuhend (Windows, macOS, Linux)

1. Paigalda [Node.js](https://nodejs.org) LTS-versioon. Kontrolli terminalis: `node -v` peab näitama vähemalt `v22.22`.
2. Paki projekt lahti ja ava selle kaustas terminal (Windowsis PowerShell: kaustas Shift + paremklõps → „Ava PowerShelli aken siin“ või „Open in Terminal“).
3. Paigalda sõltuvused:
   ```
   npm install
   ```
4. **Proovi ilma AI tokenita näidisandmetega:**
   ```
   npm run demo
   ```
   Ava brauseris http://localhost:5175. Peatamiseks vajuta terminalis Ctrl+C.
   - Näidises on kaks projekti, mille nimi algab „Näidis:“. Esimeses on vestlus ja rollid valmis ning lugude **näidisettepanek** ootab valikut (✎ Muuda, ✗ Lükka tagasi, märkeruudud, „Lisa valitud“). Teises saab backlog'i lugusid ↑/↓ nuppudega järjestada.
   - **Näidisandmed on käsitsi koostatud, mitte AI vastused.** Rakenduses on need märgitud lühikese sildiga **„Näidis“** (projekti nime, vestluse sõnumite ja lugude ettepaneku juures; sildi vihje: „Käsitsi koostatud näidisandmed, mitte AI vastus“) ja näidisettepanekust lisatud lugude päritolu on „Käsitsi lisatud“.
   - ⚠ **Iga `npm run demo` käivitus taastab näidise algseisu – kõik näidises tehtud muudatused kaovad.** Näidis on eraldi failis `data/demo.db`; päris andmebaasi `data/app.db` see ei puuduta.
   - Näidisrežiimis on AI välja lülitatud: AI nupud („Alusta“, „Paku rolle“, „Paku veel lugusid“, „Paku teistsuguseid“) annavad teate „AI ei ole serveris seadistatud“.
5. **Proovi päris AI-ga (valikuline):** vaja on oma tasuta Hetzneri tokenit (https://experiments.hetzner.com → **Create API Token**).
   - Windows (PowerShell): `Copy-Item .env.example .env` ja seejärel `notepad .env`
   - macOS/Linux: `cp .env.example .env` ja ava `.env` tekstiredaktoris
   - Kirjuta reale tokeni väärtus: `HETZNER_INFERENCE_TOKEN=...`, salvesta ja käivita `npm run dev`. Serveri logis peab olema `AI: seadistatud`.
   - Üks AI samm võtab tavaliselt 16–110 sekundit.
   - Ilma `.env` failita töötab `npm run dev` samuti, aga ilma AI-ta (projektid ja tühi andmebaas `data/app.db`).

Kui port 5175 või 3001 on hõivatud, annab käivitus vea – sulge teine programm, mis neid porte kasutab.

### Seis 01.10.2026: mis töötab ja mis puudub

- **Töötab (L01–L07):** projektide loomine ja loend; idee ühe lausega → AI täpsustavad küsimused valikunuppudega, „Muu (kirjutan ise)“ ja „Jäta vahele“ → kokkuvõte; rollide ettepanek, kinnitamine, lisamine ja eemaldamine; AI lugude ettepanek kaartidena (muutmine, tagasilükkamine, valik, lisamine backlog'i); backlog vestluse kõrval ja ↑/↓ järjestamine; andmed säilivad serveri taaskäivitusel.
- **Veel puudub:** alati nähtav vabateksti väli AI-le kirjutamiseks (praegu saab vabalt kirjutada ainult idee ja „Muu“ vastusena), prioriteedisoovitus, vastuvõtukriteeriumid ja mockup, kliendi täpsustus, järgmise sammu nupud, etappide riba ja groomimine (lood L08 jj, vt [docs/backlog.md](docs/backlog.md)).
- **Teadaolev piirang:** lugude ettepanekus ✎ Muuda kaudu tehtud muudatused kaovad lehe värskendamisel, kui lugu pole veel backlog'i lisatud.

## Nõuded

- Node.js 22.22 või uuem (`node -v`)
- npm

## Paigaldus

```bash
npm install
cp .env.example .env
```

`.env` faili ei lisata git'i. Rakendus töötab ka ilma AI tokenita: projektide haldus toimib ja AI funktsioonid annavad eestikeelse veateate. AI seadistamine on kirjeldatud allpool.

## Käivitamine

```bash
npm run dev
```

Ava brauseris http://localhost:5175. Server töötab pordil 3001 ja Vite suunab `/api` päringud sinna.

Kui port 5175 või 3001 on hõivatud, annab käivitus vea. Serveri porti saab muuta failis `.env` (`PORT`).

## Andmed

Andmed salvestatakse SQLite faili `data/app.db`. Fail ja kaust luuakse esimesel käivitusel automaatselt ning neid ei lisata git'i. Asukohta saab muuta failis `.env` (`DATABASE_PATH`).

Node näitab käivitusel hoiatust `ExperimentalWarning: SQLite is an experimental feature`. See on ootuspärane, sest rakendus kasutab Node'i sisseehitatud `node:sqlite` moodulit.

## AI-teenuse seadistamine

Rakendus kasutab [Hetzner Experiments Inference API](https://docs.hetzner.com/general/company-and-policy/experiments/inference/)-t (mudel `Qwen3.8-27B`). Kõik AI päringud käivad läbi serveri; token ei jõua kunagi brauserisse. Teenuse valik ja teadaolevad piirangud: [docs/ai-piirangud.md](docs/ai-piirangud.md).

| Muutuja `.env` failis | Tähendus |
|---|---|
| `HETZNER_INFERENCE_TOKEN` | API token (saladus, ainult `.env` failis) |
| `HETZNER_MODEL` | Mudeli nimi, vaikimisi `Qwen3.8-27B` |
| `AI_TIMEOUT_MS` | Ühe AI-ülesande ajalimiit millisekundites, vaikimisi `150000` |

### Tokeni lisamine

1. Logi sisse aadressil https://experiments.hetzner.com ja vajuta **Create API Token**.
2. Käivita projekti kaustas oma terminalis järgmine käsk, kleebi token ja vajuta Enter. Sisestatud tokenit ekraanil ei kuvata ja see ei jää käsuajalukku:

   ```bash
   ( umask 077; read -rsp 'Token: ' T || exit 1; echo; [ -n "$T" ] || { echo 'Token on tühi, .env jäi muutmata.' >&2; exit 1; }; { grep -v '^HETZNER_INFERENCE_TOKEN=' .env; printf 'HETZNER_INFERENCE_TOKEN=%s\n' "$T"; } > .env.uus ) && mv .env.uus .env && chmod 600 .env
   ```

   Käsk jätab `.env` faili muud read alles, asendab ainult tokeni rea ja seab failile õigused 600 (loeb ainult sinu kasutaja). Kui vajutad lihtsalt Enterit (või sisestad ainult tühikuid) või katkestad sisestamise (Ctrl+C, Ctrl+D), jääb senine `.env` muutmata.
3. Kontrolli, et `.env` ei lähe git'i: `git check-ignore -v .env` peab näitama `.gitignore` reeglit.
4. Taaskäivita `npm run dev`, sest server loeb `.env` faili ainult käivitusel. Serveri logis peab olema rida `AI: seadistatud` (tokeni väärtust ei logita).

Ära kleebi tokenit vestlustesse, veateadetesse ega ühtegi git'i minevasse faili.

### Ühenduse kontroll (smoke-test)

```bash
npm run ai:smoke
```

Käsk saadab AI-teenusele **täpselt ühe** väikese fikseeritud päringu (kordust ei tehta, andmebaasi ei avata) ja kuvab ainult tulemuse, kestuse, väljundtokenite arvu ja skeemi kontrolli, näiteks:

```
AI smoke-test: tulemus=ok | kestus=2294 ms | väljundtokeneid=21 | skeem=korras
```

Vea korral on `tulemus` üks koodidest `not_configured`, `auth_failed`, `timeout`, `rate_limited`, `unavailable` või `invalid_response` koos eestikeelse selgitusega; lõpukood on siis 1. Hetzneri piirang on 10 päringut minutis tokeni kohta.

Server eelistab võrguühendustes IPv4-t, sest mõnes võrgus IPv6 ühendus AI-teenusega ei tööta.

## Testid

```bash
npm test
```
