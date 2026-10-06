# AI-teenus ja teadaolevad piirangud

## Kasutusel olev teenus: Claude Code CLI, alates 01.10.2026

| | |
|---|---|
| Teenus | Claude Code CLI (`claude -p`), mille server käivitab ilma shellita |
| Mudel | seadistatud `sonnet` (`CLAUDE_MODEL`); täpset mudeli versiooni rakendus ei logi |
| Autentimine | serveri arvutis **sisse logitud kasutaja Claude'i tellimus**; API-võtit ei kasutata (`ANTHROPIC_API_KEY` ei anta CLI-le edasi) |
| Õigused | tööriistad keelatud (failid, käsud, veeb), MCP-serverid ja kohandused välja lülitatud, sessiooni ei salvestata, töökaust on tühi ajutine kaust; projekti kontekst saadetakse päringus |
| Kontroll | vastus peab vastama etapi JSON-skeemile ja reeglitele; vigase vastuse korral üks kordus |
| Kulu | eraldi makset ei ole; päringud lähevad tellimuse kasutuslimiidi arvelt |
| Veateated | sisselogimata (`not_logged_in`), kasutuslimiit (`usage_limit`), käsk puudub (`cli_missing`), aegumine (`timeout`) |

Põhjus: õpetaja soovitusel ei pea õpilased AI eest eraldi maksma ja õpetajal on Claude Code olemas.

### Esimene päris AI-katse rakenduses (01.10.2026)

| | |
|---|---|
| Andmed | `npm run demo` näidise koopia (scratchpad); `data/demo.db` ja `data/app.db` jäid muutmata (kontrollsummad enne ja pärast samad) |
| Samm | Prioriteet → „Küsi AI-lt uus soovitus“, kasutaja vajutas ühe korra |
| AI-kutseid | 1 (õnnestus esimesel katsel, kordust ei olnud) |
| Kestus | 6,4 s |
| Väljundtokeneid | 230 |
| Tulemus | vastus läbis JSON-skeemi ja reeglite kontrolli; rakendus kuvas soovituse koos põhjendusega ning valikutega „Nõus, alustame sellest“ ja „Valin ise teise“ |

Serveri logis oli ainult ohutu rida (ülesanne, tulemus, kestus, tokenid); päringu sisu ega AI vastust ei logitud.

### Vabateksti katsed rakenduses (06.10.2026)

`npm run demo:ai` näidisandmebaas (`data/demo.db`); `data/app.db` jäi puutumata. Arendaja tegi sammud brauseris, kestus on serveri logist.

| Voog | Sisend | AI-kutseid | Kestus | Tulemus |
|---|---|---|---|---|
| Vabatekst lugude juures | „lisa lood proovitreeningu kohta“ | 1 (õnnestus esimesel katsel) | 9,1 s | uus ootel ettepanek (8 lugu) asendas näidisettepaneku; nähtavad lood käsitlesid proovitreeningut töövoo järjekorras ja saatetekst kirjeldas tõlgendust; backlog jäi muutmata kuni kinnituseni |
| „Mida teeme edasi?“ vabatekst | „tahan rollidesse treeneri“ | 1 (õnnestus esimesel katsel) | 5,8 s | AI valis sammu „Ava etapp „Rollid““ ja märkuse „Lisa rollide hulka treener.“; nupp viis rollide kaardile ja kirjutas märkuse välja; rollid ja muud andmed jäid muutmata |

**Praeguse teenusega proovimata:** täpsustavad küsimused, rollide ettepanek, kriteeriumid ja mockup, kliendi täpsustus, backlog'i ülevaatus, uus vaade promptist ning rollide, prioriteedi ja kriteeriumide vabatekst. Kolm katset ei ole piisav, et hinnata kvaliteeti ega kiirust; kogu vastuvõtukatse töövoo aeg mõõdetakse loos L35.

## Teadaolevad AI piirangud

### Praeguse teenusega (Claude Code CLI)

Kolmes dokumenteeritud katses (vt ülal) vastus läbis skeemi ja reeglite kontrolli esimesel katsel ning uusi sisulisi vigu ei täheldatud. Sellest ei saa järeldada, et allolevaid piiranguid praegusel mudelil ei ole – need on kontrollimata. Mudelist sõltumata kehtib: kood kontrollib vastuse struktuuri ja reegleid (skeem, Connextra vorm, kontrollitavuse sõnad, lubatud lood ja sammud), mitte tähendust; iga ettepanek vajab inimese kinnitust.

### Varasema mudeliga täheldatud (`Qwen3.8-27B`, kuni 01.10.2026)

> Allolevad tähelepanekud on tehtud **varasema mudeliga**. Kas need kehtivad ka praegusele teenusele, on kontrollimata.

1. **Vastamisaeg kõigub palju.** Proovides kestis üks päring 16–110 sekundit. Õpetaja demo vajab vähemalt viit AI päringut, mis tähendab mõõdetud aegadega kokku umbes 2,5–4 minutit ootamist.
2. **(Ainult varasem teenus.) Mõtlemisrežiim pidi olema välja lülitatud.** Sisselülitatud mõtlemine kulutas lugude päringus kogu 4096-tokenise piiri ja vastus jäi tühjaks. Hetzneri dokumentatsioon ei maini `enable_thinking` sätet. Mõju on näha vaid kaudselt: `reasoning_content` puudus ja väljundtokeneid oli vähem.
3. **Eesti keeles esineb vigu.**
   - Kasu vormis „et **sain** …“ („et saaksin“ asemel) oli viies loos kuuest.
   - Kirjavead: „Liikmepakettid“, „Põhjpakett“.
   - Katkine lause: „…treeningute arvu, et valida makseperiood, et valida…“.
4. **Kasu kordab mõnikord tegevust (ringjas kasu).** Näiteks „luua konto, et luua kasutajakonto“ või „teha makse, et maksta“.
5. **Kriteeriumi viide võib olla vale või muutuda vaikselt.**
   - Kriteerium nupu kohta viitas kogu kaardile.
   - Täpsustuse proovis muutus „keep“-märgisega kriteeriumi viide ilma teatamata (see parandas vea, aga oleks jäänud nägemata).
   - Viidatud id olemasolu ei tõenda, et element näitab seda, mida kriteerium nõuab.
6. **Toimingu märgised ei ole alati täpsed.** Kriteerium oli märgitud „modify“, kuigi tekst ei muutunud.
7. **Mudel vaatab lugu üksikult, mitte kogu backlog'i taustal.** Liiga suure loo jagamisel tekkis uus lugu, mis oli sõna-sõnalt sama kui olemasolev lugu.
8. **(Varasem teenus.) Skeemi jõustamine ei olnud kinnitatud.** Claude CLI-ga antakse skeem `--json-schema` kaudu; server kontrollib vastust igal juhul ise. API võttis `json_schema` vastu ja kõik mõtlemiseta vastused vastasid skeemile. Kas skeemi jõustatakse genereerimise ajal, ei ole dokumenteeritud.
9. **(Ainult varasem teenus.) Teenus oli eksperimentaalne.** Hetzner ei garanteeri jõudlust ega kättesaadavust ja ei soovita seda tootmiskeskkonnas kasutada. Hetzneri blogi järgi tõusis käivitusjärgsel suure nõudluse perioodil p99 vastamisaeg ligi 10 minutini.
10. **Kirjavead jõuavad kaartidele** (rakenduses, L06). Näiteks „soovin **sada** taotluse kinnitust“ ja „näha **liikmepakete**“. Vormingureeglid kontrollivad lause ülesehitust, mitte õigekirja. Arendaja parandas need käsitsi ✎ Muuda kaudu enne backlog'i lisamist.
11. **Saatetekst võib mainida kinnitamata rolli** (rakenduses, L06). Lugude ettepaneku saatetekst ütles „…fookuses potentsiaalsetel liikmetel ja **treeneritel**“, kuigi rolli „Treener“ ei olnud kinnitatud.
    - See ei olnud kinnitamata rolliga kaart: kõigi 7 kaardi rollid olid kinnitatud rollid.
    - Kaartide rolle kontrollitakse skeemis ja serveris, saateteksti ei kontrollita.
12. **„et“-kõrvallause hoiatus kontrollib ainult tegevuse välja.** Kui kasu väljas on eraldi „et“-kõrvallause, hoiatust ei tule. Näiteks algne „…, et saaksin olla kindel, **et** minu taotlus on saadetud“ andis pealkirja kahe „et“ sõnaga.
13. **Nõrk või ebaloogiline põhjendus** (rakenduses, L08). Prioriteedisoovitus põhjendas loo valikut nii: „Ilma võimaluseta esitada taotlust ei saa kasutada kinnitust ega näha tunniplaani“ – tunniplaani vaatamine taotlust ei eelda. Soovitus on ainult ettepanek; otsuse teeb inimene („Valin ise teise“).
14. **Pinnapealsed kriteeriumid** (rakenduses, L09). AI kriteeriumid olid kujul „Kasutaja näeb sisestusvälja 'Eesnimi'“ – formaalselt kontrollitavad, kuid ei kirjelda, mida loo täitmine peab tagama.
15. **AI väide ei vasta tegelikule muudatusele** (rakenduses, L11). Täpsustuse vastuses kirjutas AI, et lisas kinnitusteate, kuid uues mockup'is seda elementi ei olnud. Eelvaade arvutatakse koodis, seega oli puudumine näha. L23 kooskõlavihje annab sellisel juhul hoiatuse „pole vastet“, kui kriteeriumi sõna mockup'is ei esine.
16. **Numbrilised viited olid nihkes** (rakenduses, L23). Kui AI pidi viitama mockup'i elemendile järjekorranumbriga (0 = esimene), loendas see 1-st: üks viide osutas olematule elemendile ja teine valele (e-posti välja kriteerium nupule). Rakendus kasutab nüüd tekstiviiteid ja seob ainult ühese vaste korral.
17. **AI hinnang „ei puuduta vaadet“ võib olla vale** (rakenduses, L23). Kinnitusteadet nõudva kriteeriumi kohta hindas AI, et see ei puuduta vaadet, ja jättis teate mockup'ist välja. AI hinnang hoiatust ei kustuta; selle otsustab kasutaja.

## Rakenduse teadaolevad piirangud (mitte AI)

- **✎ muudatused enne backlog'i lisamist ei ole püsivad** (L06). Lugude ettepanekus tehtud muudatused on ainult brauseri vahelehe mälus.
  - Serverisse jõuavad need alles nupuga „Lisa valitud“ või „Lisa kõik backlog'i“.
  - F5 või vahelehe sulgemine kaotab muudatused ja kaardid laaditakse uuesti AI originaaliga. Ootel ettepanek ise jääb alles.
- **Järgmise sammu valikud ainult uusima AI väljundi juures** (L13). Õpetaja nõue on 1–4 valikut iga AI vastuse lõpus; rakenduses on need ainult uusima AI väljundi kaardil ja etappide paneelis. Valikud tuletab kood andmetest, AI neid ei koosta.
- **Etappe saab vahele jätta ainult osaliselt** (L14). Etapid sõltuvad üksteisest, vahele saab jätta ainult valikulise „Täpsustused“; nuppu „Jäta vahele“ ei ole ja Groomimist pole.
- **AI sõltub serveri arvuti Claude Code'ist.** Kui `claude` puudub, pole sisse logitud või tellimuse kasutuslimiit on täis, annavad AI nupud eestikeelse teate ja käsitsi saab edasi töötada. Windowsis ei ole Claude CLI käivitamist proovitud (vt README).

## Mida see rakenduse jaoks tähendab

- **Ükski AI ettepanek ei muuda backlog'i ilma inimese kinnituseta.** Iga ettepaneku juures on ✎ Muuda.
- **Server valideerib iga vastuse** JSON-skeemi ja reeglite järgi (L02, L12, L18, L28, L29) ja teeb vajaduse korral ühe korduspäringu.
- **Eelvaade arvutatakse koodis** ja näitab ka viidete muutusi (L11).
- **Sisulist kooskõla ei märgita automaatselt kinnitatuks** (L23).
- **Promptides on eeskujud** („et saaksin …“) ja ringja kasu keeld (L06). See vähendab vigu, aga ei kaota neid.
- **Jagamise ja ühendamise tulemust võrreldakse ülejäänud backlog'iga** (L28).

## Ajalugu: varasem arendusteenus (eemaldatud 01.10.2026)

Arenduse alguses kasutati teist AI-teenust. Selle kood ja seadistus on rakendusest eemaldatud; allolev on ainult ajalugu (mõõtmised ja otsused, mis on alles git'i ajaloos).

> **Märkus:** proovide tulemused on saadud **30.09.2026 eraldi proovi skriptidega, mitte rakenduses**. Rakendust sel hetkel veel ei olnud.
> Iga päringutüüpi prooviti **üks kord**, seega tulemuste kõikumist korduval kasutamisel ei ole mõõdetud.
> Rakenduse tegelik töövoo aeg mõõdetakse loos L35.


### Varasem teenus (kuni 01.10.2026)

| | |
|---|---|
| Teenus | Hetzner Experiments Inference API (`https://inference.hetzner.com/api/v1`, OpenAI-ühilduv) |
| Mudel | `Qwen3.8-27B` |
| Olulised sätted | `response_format: json_schema`, `chat_template_kwargs: { enable_thinking: false }`, `temperature: 0.3`, `max_tokens: 4096` |
| Hind | Hetzneri sõnul on teenus tasuta, kuni see on eksperimentaalses staatuses |
| Päringupiir | Hetzneri dokumentatsiooni järgi 10 päringut minutis võtme kohta |
| Andmed | Hetzneri sõnul päringute ja vastuste sisu ei salvestata, säilitatakse ainult kasutuse metaandmed |

Teenus valiti esialgseks arendusvalikuks. Selle kood, seadistus ja juhised eemaldati 01.10.2026.

### Varasemad kaalutud variandid (30.09.2026)

| Variant | Otsus | Põhjus |
|---|---|---|
| Kohalik Ollama + `qwen2.5:7b` | Tagasi lükatud | Arendaja sülearvutis (12 GiB RAM, ainult protsessor) kasvas swap proovi ajal 3,7 GiB võrra. Kiirus oli 6,9 tokenit sekundis. Esimeses vastuses oli nõrk eesti keel ja sisutuid vastusevariante. |
| Gemini API tasuta tase | Ei sobi | Google'i tingimuste järgi tohib EMP-s teistele kasutatavas rakenduses kasutada ainult tasulist teenust. |
| Anthropic API (tasuline) | Ei kasutata | Ei ole proovitud. Valiti Claude Code CLI tellimuse sisselogimisega, mis ei vaja API-võtit ega eraldi makset. |

### Proovide tulemused (Hetzner, `Qwen3.8-27B`)

| Päring | Mõtlemine | Kestus | Väljundtokenid | JSON ja skeem | Sisu |
|---|---|---|---|---|---|
| Täpsustavad küsimused | sees | 36,9 s | 1 298 | OK | 3 asjakohast küsimust, kohati kohmakas keel |
| Lood happy path'i järjekorras | sees | 106,3 s | 4 096 (piir) | **Viga:** vastus tühi | Mõtlemine kulutas kogu tokenipiiri |
| Lood happy path'i järjekorras | väljas | 16,4 s | 784 | OK | 6 lugu õiges järjekorras; keelevead |
| Kriteeriumid ja mockup | väljas | 45,4 s | 846 | OK | 4 kriteeriumist 3 head; 1 vale viide; mockup'is kirjavead |
| Kliendi täpsustus | väljas | **109,9 s** | 1 813 | OK | Täpsustus kaetud, mõju L4-le ja L5-le leitud; loo sõnastus katki |
| Backlog'i ülevaatus | väljas | 31,9 s | 1 146 | OK | Liiga suur lugu ja kattuvad lood leitud; jagamine tekitas uue korduse |

Väljundkiirus kõikus samal päeval **16–48 tokenit sekundis**.

### Rakenduses mõõdetud varasema teenusega (30.09.–01.10.2026)

Erinevalt ülaltoodud proovidest on need tulemused saadud rakenduse enda kaudu, brauserikontrolli käigus (L08–L11 testandmebaasis).

| Lugu | Päring | Katseid | Kestus | Väljundtokenid | Tulemus |
|---|---|---|---|---|---|
| L06 | Lood happy path'i järjekorras | 1 (kordust ei olnud) | 37,8 s | 693 | 7 lugu. Rollid olid ainult kinnitatud rollid. Kahes loos oli kirjaviga (vt piirang 10) |
| L08 | Prioriteedisoovitus | 1 | 9,6 s | 107 | Üks lugu koos põhjendusega; põhjendus loogiliselt nõrk (vt piirang 13) |
| L09, L10 | Kriteeriumid ja mockup | 1 | 12,8 s | 437 | 6 kriteeriumi ja mockup; kriteeriumid pinnapealsed (vt piirang 14) |
| L11 | Kliendi täpsustus | 1 | 12,7 s | 441 | Sünniaja väli eemaldati; väidetud kinnitusteadet mockup'is ei olnud (vt piirang 15) |
| L23 | Kliendi täpsustus numbriliste viidetega | 2 (kordus) | 15,2 s + 12,0 s | 467 + 392 | Mõlemad vastused ei läbinud serveri reegleid; midagi ei salvestatud (tõenäoline põhjus: viited nihkes, vt piirang 16) |
| L23 | Kliendi täpsustus numbriliste viidetega | 1 | 39,1 s | 393 | Viited nihkes (vt piirang 16); kinnitusteadet mockup'is ei olnud |
| L23 | Kliendi täpsustus tekstiviidetega | 1 | 9,2 s | 442 | Kõik kolm seost õiged; kinnitusteate element lisati |

### Tehniline märkus

Arendaja võrgus IPv6 ühendus ei tööta. Node.js-i vaikimisi `fetch` jäi seetõttu ootele ja aegus. Proovides aitas käivitusparameeter `--dns-result-order=ipv4first` koos `--no-network-family-autoselection`-iga. See kehtis ainult varasema HTTP-põhise teenuse kohta; lahendus eemaldati koos teenusega (Claude Code CLI-l on oma võrguühendus).

### Varasema teenuse allikad

- [Hetzner Docs: Inference API](https://docs.hetzner.com/general/company-and-policy/experiments/inference/)
- [Hetzner Docs: Experiments platform](https://docs.hetzner.com/general/company-and-policy/experiments/experiments-platform/)
- [Hetzner blogi: What we learned from our Inference Experiment](https://www.hetzner.com/blog/inference-experiment/)
- [Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms)
