# Projektijuhtimise tööriist

AI-põhine veebirakendus, mis aitab projektijuhil koos kliendiga muuta umbmäärase idee kasutajalugude backlog'iks. TAK25 koolitöö.

> Arenduse backlog, järjestuse põhjendus ja MVP joon: [docs/backlog.md](docs/backlog.md). AI-teenuse valik ja piirangud: [docs/ai-piirangud.md](docs/ai-piirangud.md).

## Õpetajale: kiirjuhend (Windows, macOS, Linux)

1. Paigalda [Node.js](https://nodejs.org) LTS-versioon. Kontrolli terminalis: `node -v` peab näitama vähemalt `v22.22`.
2. Klooni repositoorium (`git clone https://github.com/KarinHakm/projektijuhtimise-tooriist.git`) või paki projekt lahti ning ava selle kaustas terminal (Windowsis PowerShell: kaustas Shift + paremklõps → „Ava PowerShelli aken siin“ või „Open in Terminal“).
3. Paigalda sõltuvused:
   ```
   npm install
   ```
4. **Proovi ilma AI-ta näidisandmetega:**
   ```
   npm run demo
   ```
   Ava brauseris http://localhost:5175. Peatamiseks vajuta terminalis Ctrl+C.
   - Näidises on üks projekt **„Explore Estonia“** (märk **„Näidis“**) – Eesti sihtkohtade avastamine, reisiplaan ja ekskursioonide broneerimine. Selles on valmis idee ja vestlus (2 täpsustavat küsimust, vastused, kokkuvõte), 2 rolli (Külastaja, Reisikorraldaja), 4 lugu backlog'is, valitud alustamise lugu „ekskursiooni broneerimistaotlus“, selle 3 vastuvõtukriteeriumi ja kinnitatud mockup (versioon 1).
   - **Ettevalmistatud, mitte AI vastus:** kogu näidise sisu on käsitsi koostatud. Rakenduses on see märgitud lühikese sildiga **„Näidis“** (projekti nimi, vestluse sõnumid, lugude ja täpsustuse ettepanek; sildi vihje „Käsitsi koostatud näidisandmed, mitte AI vastus“). Näidisest lisatud lugude ja kriteeriumide päritolu on „Käsitsi lisatud“.
   - **Mida saab päriselt teha (ilma AI-ta, salvestub):**
     1. lugude ootel ettepanekus lugu ✎ muuta, ✗ tagasi lükata, märkeruute muuta ja „Lisa valitud“ – lood lisanduvad backlog'i;
     2. backlog'i lugusid ↑/↓ järjestada, MVP joont liigutada (näidises on see kolme loo all) ja prioriteedi juures valida teine alustamise lugu („Vali teine lugu“);
     3. kriteeriume mockup'i elementidega siduda („Seo ise“) ja kooskõla üle vaadata („Kinnitan: vaatasin mockup'i versiooni … ja kriteeriumid üle“);
     4. kliendi täpsustuse ootel ettepanekus („broneeringus peab olema osalejate arv“) näha eelvaadet enne → pärast ning „Rakenda“, „Muuda“ või „Loobu“. Rakendamine muudab ainult alustamise lugu: lisandub kriteerium ja mockup'i versioon 2; soovitus teisele loole on ainult tekst;
     5. F5 või serveri taaskäivitus – kõik tehtu on alles; etappide riba ja „Mida teeme edasi?“ näitavad jätkamise kohta.
   - **Teadlik kooskõlahoiatus:** 3. kriteerium nõuab teadet „Broneerimistaotlus saadetud“, mida mockup'is ei ole. Rakendus näitab hoiatust „pole vastet“. See on kontrollimist vajav vihje, mitte automaatne otsus – kasutaja otsustab (lisab elemendi, seob ise või kinnitab ülevaatuse).
   - ⚠ **Iga `npm run demo` käivitus taastab näidise algseisu – kõik näidises tehtud muudatused kaovad.** Näidis on eraldi failis `data/demo.db`; päris andmebaasi `data/app.db` see ei puuduta.
   - `npm run demo` režiimis on AI välja lülitatud (AI-ga sama näidis: `npm run demo:ai`, vt samm 5): AI nupud (nt „Alusta“, „Paku veel lugusid“, „Küsi AI-lt uus soovitus“, „Koosta muudatusettepanek“) annavad teate „AI ei ole serveris seadistatud“. Uut projekti saab luua, aga selle vestlus vajab AI-d.
   - Kasutusstsenaarium: [docs/kasutusstsenaarium.md](docs/kasutusstsenaarium.md).
5. **Proovi päris AI-ga (Claude Code, API-võtit pole vaja):** rakendus kasutab serveri arvutis **sisse logitud Claude Code'i** (`claude`) ja sinu Claude'i tellimust. Mudeliks on seadistatud `sonnet` (`CLAUDE_MODEL`); täpset mudeli versiooni rakendus ei logi.
   1. Kontrolli, et käsk on olemas: `claude --version` (näitab versiooni; AI päringut ei tehta).
   2. Kontrolli sisselogimist: käivita terminalis `claude`. Kui see küsib sisselogimist, logi sisse oma Claude'i kontoga (tellimuse sisselogimine, mitte API-võti). Sisselogitud sessioonis näitab `/status` kontot ja sisselogimise viisi. Välju käsuga `/exit`.
   3. Käivita rakendus:
      - `npm run demo:ai` – sama „Explore Estonia“ näidis, AI nupud töötavad (näidis taastatakse algseisu);
      - või `npm run dev` – oma tühi andmebaas `data/app.db`, alusta „+ Loo projekt“.
   4. Serveri logis peab olema rida `AI: Claude Code CLI, mudel sonnet (sisselogimist kontrollitakse esimese AI päringu ajal)`.
   5. Kui midagi on puudu, näitab rakendus AI nupu juures selget teadet ja käsitsi saab edasi töötada:
      - „Claude Code ei ole serveri arvutis sisse logitud …“ → tee samm 2;
      - „Claude'i tellimuse kasutuslimiit on praegu täis …“ → proovi hiljem (kui aeg on teada, näidatakse ligikaudset ooteaega);
      - „Serveri arvutis ei leitud Claude Code'i …“ → paigalda Claude Code või määra `.env` failis `CLAUDE_COMMAND` täielik tee.
   - **Mida AI näeb ja teeb:** iga AI samm on üks `claude -p` päring (vigase vastuse korral kõige rohkem üks kordus). Claude'i tööriistad (failide lugemine, käsud, veeb), MCP-serverid ja kohandused on keelatud; see töötab tühjas ajutises kaustas ega uuri projekti faile. Vajalik projekti kontekst saadetakse päringus. Päringu sisu ega AI vastust serveri logisse ei kirjutata.
   - Kui keskkonnas on `ANTHROPIC_API_KEY`, ei anta seda Claude'ile edasi – kasutatakse alati tellimuse sisselogimist. Päringud lähevad tellimuse kasutuslimiidi arvelt.
   - **Windows:** server käivitab `claude` ilma shellita. npm-iga paigaldatud `claude.cmd` nii ei käivitu – kasuta Claude Code'i natiivset paigaldust (`claude.exe`) või määra `.env` failis `CLAUDE_COMMAND` täielik tee. Windowsis ei ole seda proovitud.

Kui port 5175 või 3001 on hõivatud, annab käivitus vea – sulge teine programm, mis neid porte kasutab.

### Lõppseis 06.10.2026: mis töötab, mis jäi pooleli ja teadaolevad piirangud

- **Töötab:** projektide loomine ja loend (etapiseisuga); idee ühe lausega → AI täpsustavad küsimused valikunuppudega, „Muu (kirjutan ise)“ ja „Jäta vahele“ → kokkuvõte; rollid (valik, lisamine, eemaldamine); AI lood kaartidena happy path'i järjekorras (muutmine, tagasilükkamine, valik); backlog ja ↑/↓ järjestamine; lugude käsitsi lisamine, muutmine, kustutamine (kinnitusega), iga loo vastuvõtukriteeriumide käsitsi lisamine, muutmine ja kinnitusega kustutamine backlog'i paneelis (ka AI-ta, DoR uueneb kohe), jagamine kaheks ja kahe loo ühendamine eelvaatega (töötab ilma AI-ta); kahe loo märkimine kattuvaks (märge püsib, otsused „Ühenda“, „Eemalda lugu“ või „Pole kattuv“); „Võta tagasi viimane muudatus“ – kõik backlog'i muudatused, nii käsitsi kui ka AI ettepanekust rakendatud (lood, kriteeriumid, mockup'i kinnitamine ja taastamine, kliendi täpsustus, staatus, küsimused, MVP joon, alustamise lugu, jagamine, ühendamine, uus vaade); püsib pärast värskendamist ja serveri taaskäivitust; AI prioriteedisoovitus põhjendusega ja oma valik; alustamise loo kriteeriumid (✓/✎/✗, kontrollitavuse hoiatus) ja mockup komponentide loendist; lool võib olla mitu mockup'i (vaadet), igaühel oma versioonid, taastamine ja kriteeriumide seosed (kliendi täpsustus muudab praegu ainult vaadet 1); uus vaade AI promptist („Kirjelda uut vaadet“ → eelvaade mockup'i, loo ja kriteeriumidega → Lisa / Muuda / Loobu; lisab uue loo või olemasolevale loole uue vaate); AI kriteeriumide enesekontroll (mittekontrollitav AI kriteerium sõnastatakse ühe automaatse päringuga ümber, server kontrollib tulemuse uuesti, kasutaja näeb „AI parandas“ või parandamata kriteeriumi hoiatust); kliendi täpsustus eelvaatega enne → pärast (Rakenda / Muuda / Loobu), mis muudab ainult valitud lugu; kriteeriumide ja mockup'i kooskõla vihjed koos kasutaja ülevaatusega; etappide riba seitsme etapiga (sh Groomimine), etapi vahelejätmine ja tagasiminek (püsivad), „Mida teeme edasi?“ iga nähtava AI väljundi järel ja projekti avamisel jätkamine aktiivsest etapist; MVP joon backlog'is; backlog'i ülevaatus leidudega [Rakenda]/[Muuda]/[Ignoreeri] (koodi kontrollid töötavad ka AI-ta); liiga suure loo AI jagamine kriteeriumide jaotuse, kattuvushoiatuse ja tagasivõtmisega; kattuvate lugude AI ühendamine korduste eelvaate ja tagasivõtmisega; loo staatus, valmisoleku definitsioon (DoR) ja avatud küsimused backlog'is („Valmis arenduseks“ ainult DoR-i täitmisel); vabatekst („Või kirjuta oma sõnadega“) rollide, lugude, prioriteedi ning kriteeriumide ja mockup'i juures – AI tõlgendab teksti projekti seisu järgi ja annab uue ootel ettepaneku, mis asendab senise ootel ettepaneku ning jõuab backlog'i alles kasutaja kinnitusel; „Mida teeme edasi?“ all saab oma sõnadega kirjutada, AI valib ühe lubatud sammu ja märkuse, kasutaja läheb sinna ise nupuga (andmeid ei muudeta); andmed säilivad serveri taaskäivitusel.
- **Osaliselt:** järgmise sammu valikud on ainult uusima AI väljundi juures; AI kriteeriumid, mockup ja versiooni taastamine on alustamise loo jaoks (teise loo jaoks vali prioriteedi juures teine alustamise lugu); kliendi täpsustus muudab ainult loo vaadet 1; tagasi saab võtta ainult viimase muudatuse – kui pärast seda küsiti uus AI ettepanek või lükati see tagasi, on nupp keelatud ja põhjus nähtav; rolle ja vestlust tagasi ei võeta; vabateksti on päris AI-ga proovitud kahes voos (lood ja „Mida teeme edasi?“), rollide, prioriteedi ning kriteeriumide ja mockup'i vabateksti ainult võlts-AI-ga automaattestides; kriteeriumide ja mockup'i kooskõla kontroll on sõnapõhine vihje, mitte tähenduse kontroll (vt [docs/backlog.md](docs/backlog.md) L23); kliendi täpsustuse eelvaade ei näita kriteeriumi seose muutust ega hoiata „muudetud, aga tekst sama“ ning „Muuda“ ei luba mockup'i käsitsi muuta (L11).
- **Puudub:** jagamine korraga rohkem kui kaheks (osa saab uuesti jagada); kahe mockup'iga loo ühendamine; lohistamine (õpetaja nõue on „järjestada (nt lohistades)“ – järjestamine käib nuppudega ↑/↓).
- **Proovimata:** Windows; puhtast kloonist käivitamine teises arvutis; vastuvõtukatse täielik läbimäng päris AI-ga ja demo kestuse mõõtmine (L35). Detailid: [docs/backlog.md](docs/backlog.md), AI piirangud: [docs/ai-piirangud.md](docs/ai-piirangud.md).

## Nõuded

- Node.js 22.22 või uuem (`node -v`)
- npm
- AI jaoks (valikuline): Claude Code (`claude`), mis on sisse logitud Claude'i tellimusega – vt kiirjuhendi samm 5

## Paigaldus

```bash
npm install
cp .env.example .env
```

`.env` faili ei lisata git'i. Rakendus töötab ka ilma AI-ta (`AI_PROVIDER=off` või kui Claude Code puudub / pole sisse logitud): projektide ja backlog'i haldus toimib ning AI funktsioonid annavad eestikeelse veateate. AI seadistamine on kirjeldatud allpool.

## Käivitamine

```bash
npm run dev
```

Ava brauseris http://localhost:5175. Server töötab pordil 3001 ja Vite suunab `/api` päringud sinna.

Kui port 5175 või 3001 on hõivatud, annab käivitus vea. Serveri porti saab muuta failis `.env` (`PORT`); Vite suunab `/api` päringud samale pordile. Kui `PORT` on seatud ka terminalis, kehtib terminali väärtus.

## Andmed

Andmed salvestatakse SQLite faili `data/app.db`. Fail ja kaust luuakse esimesel käivitusel automaatselt ning neid ei lisata git'i. Asukohta saab muuta failis `.env` (`DATABASE_PATH`).

Node näitab käivitusel hoiatust `ExperimentalWarning: SQLite is an experimental feature`. See on ootuspärane, sest rakendus kasutab Node'i sisseehitatud `node:sqlite` moodulit.

## AI-teenuse seadistamine

Vaikimisi kasutab rakendus **Claude Code CLI-d** (serveri arvutis sisse logitud kasutaja tellimus, mudel Sonnet; vt kiirjuhendi samm 5). Kõik AI päringud käivad läbi serveri; brauser ei suhtle AI-ga otse. Teenuse valik ja teadaolevad piirangud: [docs/ai-piirangud.md](docs/ai-piirangud.md).

| Muutuja `.env` failis | Tähendus |
|---|---|
| `PORT` | Serveri port, vaikimisi `3001` (Vite suunab `/api` päringud sinna) |
| `DATABASE_PATH` | SQLite andmebaasi fail, vaikimisi `./data/app.db` (`npm run demo` kasutab alati `data/demo.db`) |
| `AI_PROVIDER` | `claude-cli` (vaikimisi) või `off` (AI välja lülitatud, nagu `npm run demo`) |
| `CLAUDE_MODEL` | Claude'i mudel, vaikimisi `sonnet` |
| `CLAUDE_COMMAND` | Käsk või täielik tee, vaikimisi `claude` |
| `AI_TIMEOUT_MS` | Ühe AI-ülesande ajalimiit millisekundites, vaikimisi `150000` |

### Ühenduse kontroll (smoke-test)

```bash
npm run ai:smoke
```

Käsk saadab valitud AI-teenusele (vaikimisi Claude Code CLI) **täpselt ühe** väikese fikseeritud päringu (kordust ei tehta, andmebaasi ei avata) ja kuvab ainult tulemuse, kestuse, väljundtokenite arvu ja skeemi kontrolli, näiteks:

```
AI smoke-test: tulemus=ok | kestus=2294 ms | väljundtokeneid=21 | skeem=korras
```

Vea korral on `tulemus` üks koodidest `not_logged_in`, `usage_limit`, `cli_missing`, `not_configured`, `timeout`, `unavailable` või `invalid_response` koos eestikeelse selgitusega; lõpukood on siis 1. **NB!** `npm run ai:smoke` on päris AI päring (tellimuse kasutuslimiidi arvelt).

## Testid

```bash
npm test
```

Automaattestid kasutavad ajutisi andmebaase ja võlts-AI-d: päris AI-d ei kutsuta ning `data/` kausta ei puututa. Brauserikontrollid ja päris AI katsed on kirjas iga loo all failis [docs/backlog.md](docs/backlog.md).
