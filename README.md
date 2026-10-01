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
   - Näidises on üks projekt **„Spordiklubi veeb“** (märk **„Näidis“**). Selles on valmis idee ja vestlus (2 täpsustavat küsimust, vastused, kokkuvõte), 2 rolli, 4 lugu backlog'is, valitud alustamise lugu „liikmeks astumise taotlus“, selle 3 vastuvõtukriteeriumi ja kinnitatud mockup (versioon 1).
   - **Ettevalmistatud, mitte AI vastus:** kogu näidise sisu on käsitsi koostatud. Rakenduses on see märgitud lühikese sildiga **„Näidis“** (projekti nimi, vestluse sõnumid, lugude ja täpsustuse ettepanek; sildi vihje „Käsitsi koostatud näidisandmed, mitte AI vastus“). Näidisest lisatud lugude ja kriteeriumide päritolu on „Käsitsi lisatud“.
   - **Mida saab päriselt teha (ilma AI-ta, salvestub):**
     1. lugude ootel ettepanekus lugu ✎ muuta, ✗ tagasi lükata, märkeruute muuta ja „Lisa valitud“ – lood lisanduvad backlog'i;
     2. backlog'i lugusid ↑/↓ järjestada ja prioriteedi juures valida teine alustamise lugu („Vali teine lugu“);
     3. kriteeriume mockup'i elementidega siduda („Seo ise“) ja kooskõla üle vaadata („Kinnitan: vaatasin mockup'i versiooni … ja kriteeriumid üle“);
     4. kliendi täpsustuse ootel ettepanekus („taotluses peab olema ka telefoninumber“) näha eelvaadet enne → pärast ning „Rakenda“, „Muuda“ või „Loobu“. Rakendamine muudab ainult alustamise lugu: lisandub kriteerium ja mockup'i versioon 2; soovitus teisele loole on ainult tekst;
     5. F5 või serveri taaskäivitus – kõik tehtu on alles; etappide riba ja „Mida teeme edasi?“ näitavad jätkamise kohta.
   - **Teadlik kooskõlahoiatus:** 3. kriteerium nõuab kinnitusteadet, mida mockup'is ei ole. Rakendus näitab hoiatust „pole vastet“. See on kontrollimist vajav vihje, mitte automaatne otsus – kasutaja otsustab (lisab elemendi, seob ise või kinnitab ülevaatuse).
   - ⚠ **Iga `npm run demo` käivitus taastab näidise algseisu – kõik näidises tehtud muudatused kaovad.** Näidis on eraldi failis `data/demo.db`; päris andmebaasi `data/app.db` see ei puuduta.
   - Näidisrežiimis on AI välja lülitatud: AI nupud (nt „Alusta“, „Paku veel lugusid“, „Küsi AI-lt uus soovitus“, „Koosta muudatusettepanek“) annavad teate „AI ei ole serveris seadistatud“. Uut projekti saab luua, aga selle vestlus vajab AI-d.
   - Kasutusstsenaarium: [docs/kasutusstsenaarium.md](docs/kasutusstsenaarium.md).
5. **Proovi päris AI-ga (valikuline):** vaja on oma tasuta Hetzneri tokenit (https://experiments.hetzner.com → **Create API Token**).
   - Windows (PowerShell): `Copy-Item .env.example .env` ja seejärel `notepad .env`
   - macOS/Linux: `cp .env.example .env` ja ava `.env` tekstiredaktoris
   - Kirjuta reale tokeni väärtus: `HETZNER_INFERENCE_TOKEN=...`, salvesta ja käivita `npm run dev`. Serveri logis peab olema `AI: seadistatud`.
   - Üks AI samm võtab tavaliselt 16–110 sekundit.
   - Ilma `.env` failita töötab `npm run dev` samuti, aga ilma AI-ta (projektid ja tühi andmebaas `data/app.db`).

Kui port 5175 või 3001 on hõivatud, annab käivitus vea – sulge teine programm, mis neid porte kasutab.

### Seis 01.10.2026: mis töötab ja mis puudub

- **Töötab:** projektide loomine ja loend (etapiseisuga); idee ühe lausega → AI täpsustavad küsimused valikunuppudega, „Muu (kirjutan ise)“ ja „Jäta vahele“ → kokkuvõte; rollid (valik, lisamine, eemaldamine); AI lood kaartidena happy path'i järjekorras (muutmine, tagasilükkamine, valik); backlog ja ↑/↓ järjestamine; AI prioriteedisoovitus põhjendusega ja oma valik; alustamise loo kriteeriumid (✓/✎/✗, kontrollitavuse hoiatus) ja mockup komponentide loendist; kliendi täpsustus eelvaatega enne → pärast (Rakenda / Muuda / Loobu), mis muudab ainult valitud lugu; kriteeriumide ja mockup'i kooskõla vihjed koos kasutaja ülevaatusega; etappide riba ja „Mida teeme edasi?“; andmed säilivad serveri taaskäivitusel.
- **Osaliselt:** järgmise sammu valikud on ainult uusima AI väljundi juures; etappe saab vahele jätta ainult osaliselt; vabatekst ainult idee, „Muu“ vastuse ja kliendi täpsustusena; mockup'i vanemaid versioone hoitakse, aga nende juurde tagasi minna ei saa.
- **Puudub:** lugude käsitsi lisamine, muutmine ja kustutamine; MVP joon; staatuse muutmine, Definition of Ready ja avatud küsimused; tagasivõtmine; uue vaate loomine promptist; groomimine (jagamine, ühendamine, AI ülevaatus). Detailid: [docs/backlog.md](docs/backlog.md), piirangud: [docs/ai-piirangud.md](docs/ai-piirangud.md).

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
