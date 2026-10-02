# Arendustöö backlog

AI-põhine projektijuhtimise tööriist · TAK25 · üks arendaja

> **Seis 01.10.2026:** valmis on L01–L06, L09 ja L17. **Pooleli** on L07, L08, L10, L11, L12, L13, L14, L15, L18, L19, L20, L22, L23, L25 ja L26 (mis on proovitud ja mis puudu, on kirjas iga loo all). Ülejäänud lugude staatus on **Plaanitud**.
> Lugu märgitakse **Valmis** alles siis, kui selle kõik kriteeriumid on brauseris läbi proovitud, reeglipõhise loogika kohta on olemas automaattest ja muudatus on commit'itud.

## Arhitektuur (kavandatud, esialgne)

- **Server:** Node.js 22 + Express. Kõik AI päringud käivad läbi serveri.
- **Kasutajaliides:** React (Vite). Mockup'i joonistab rakendus komponentide JSON-ist ise ja HTML-i ei sisestata kuhugi.
- **Andmed:** SQLite fail serveris. Andmed jäävad alles ka pärast serveri taaskäivitust.
- **AI:** Claude Code CLI (`claude -p`, mudel Sonnet) serveri arvutis sisse logitud kasutaja tellimusega; API-võtit ei kasutata (vt [ai-piirangud.md](ai-piirangud.md)).
  - Kuni 01.10.2026 kasutati arenduses teist teenust; see eemaldati, et rakendus töötaks õpetaja olemasoleva Claude Code'iga ilma lisakuluta.
  - AI-kood on kaustas `server/ai/`; korraga on kasutusel üks teenus.
- **Saladused:** repos ega `.env.example` failis ei ole ühtegi saladust; Claude'i sisselogimine jääb serveri arvuti kasutaja kontole. `.env` on `.gitignore`-is.
- **Testid:** automaattestid asendavad AI kutse võltsvastusega. Rakenduses mock-režiimi lülitit ei ole.

## Järjestus ja MVP joon

| # | Lugu | Suurus | Liik | Vastuvõtukatse | Staatus |
|---|---|---|---|---|---|
| L01 | Rakenduse karkass ja püsiv andmebaas | M | Kohustuslik | – | Valmis |
| L02 | Serveripoolne ja valideeritud AI-kiht | M | Kohustuslik | – | Valmis |
| L03 | Projektide loomine ja loend | S | Kohustuslik | 1 | Valmis |
| L04 | Vestluse algus ühest promptist ja täpsustavad küsimused | M | Kohustuslik | 1, 9 | Valmis |
| L05 | Rollid | S | Kohustuslik | 9 | Valmis |
| L06 | Lood happy path'i järjekorras | L | Kohustuslik | 2, 9 | Valmis |
| L07 | Backlog'i vaade ja lihtne järjestamine | S | Kohustuslik | 2, 3 | Pooleli |
| L08 | Prioriteedisoovitus | S | Kohustuslik | 3 | Pooleli |
| L09 | Vastuvõtukriteeriumid valitud loole | M | Kohustuslik | 4, 9 | Valmis |
| L10 | Turvaliselt kuvatav mockup | L | Kohustuslik | 4, 9 | Pooleli |
| L11 | Kliendi täpsustus enne/pärast eelvaatega | L | Kohustuslik | 5, 9 | Pooleli |
| L12 | Server muudab ainult valitud lugu | M | Kohustuslik | 5 | Pooleli |
| L13 | Järgmise sammu pakkumine ja jätkamine samast kohast | M | Kohustuslik | 8 | Tehtud |
| | **═══ MVP JOON ═══** | | | | |
| L35 | Vastuvõtukatse töövoo ajamõõtmine päris rakenduses | S | Kohustuslik | – | Plaanitud |
| L14 | Sammude riba | S | Kohustuslik | – | Tehtud |
| L15 | Käsitsi backlog'i haldus, ka AI tõrke korral | M | Kohustuslik | 6 | Tehtud |
| L16 | Järjestamine lohistades | S | Kohustuslik | 3 | Plaanitud |
| L17 | MVP joon | S | Kohustuslik | – | Valmis |
| L18 | Kriteeriumide kontrollitavuse kontroll | S | Kohustuslik | – | Tehtud |
| L19 | Staatused ja Definition of Ready | M | Kohustuslik | 7 | Pooleli |
| L20 | Täpsustamist vajav lugu ja avatud küsimused | S | Kohustuslik | 7 | Pooleli |
| L21 | Viimase muudatuse tagasivõtmine | M | Kohustuslik | – | Plaanitud |
| L22 | Mockup'i versioonid ja mitu mockup'i loo kohta | S | Kohustuslik | – | Tehtud |
| L23 | Kriteeriumide ja mockup'i kooskõla | M | Kohustuslik | – | Pooleli |
| L24 | Uue vaate loomine promptist | M | Kohustuslik | – | Tehtud |
| L25 | Loo käsitsi jagamine | M | Kohustuslik | – | Pooleli |
| L26 | Kattuvate lugude märkimine ja ühendamine käsitsi | M | Kohustuslik | – | Pooleli |
| L27 | AI ülevaatus ja leiud | L | Kohustuslik | 6 | Tehtud |
| L28 | AI jagamisettepanek eelvaatega | M | Kohustuslik | 6 | Tehtud |
| L29 | AI ühendamisettepanek eelvaatega | M | Kohustuslik | 6 | Tehtud (brauseris kontrollitud) |
| L30 | Esitatavad dokumendid ja demo | M | Kohustuslik | – | Plaanitud |
| L31 | Eksport Markdowni ja CSV-sse | – | Valikuline | – | Plaanitud, kui aega jääb |
| L32 | Kliendile jagatav vaatamislink | – | Valikuline | – | Plaanitud, kui aega jääb |
| L33 | Story map mitme rolli kaupa | – | Valikuline | – | Plaanitud, kui aega jääb |
| L34 | Kõnesisend | – | Valikuline | – | Plaanitud, kui aega jääb |
| L36 | Kriteeriumile osutades tõstetakse mockup'i element esile | – | Valikuline | – | Plaanitud, kui aega jääb |

Backlog'is on **36 lugu**:
- **31 kohustuslikku:** L01–L30 ja L35;
- **5 valikulist:** L31–L34 ja L36. Need on õpetaja loetelust „Lisavõimalused (ei ole kohustuslikud)“.

ID ei ole järjekorranumber. L35 lisati hiljem ja paigutati kohe MVP joone alla.

Veerg „Vastuvõtukatse“ näitab, milliseid õpetaja vastuvõtukatse punkte lugu katab. **Kõik 9 punkti on kaetud kohustuslike lugudega:**
- MVP katab punktid 1–5, 8 ja 9;
- punktid 6 ja 7 tulevad pärast MVP-d kohustuslikes lugudes L15, L19, L20 ja L27–L29.

Ükski vastuvõtukatse punkt ei sõltu valikulisest loost.

Suurus: S = kuni pool päeva, M = umbes päev, L = kaks päeva või rohkem.

### Miks just selline järjekord

1. **L01–L02 tulevad esimesena, sest kõik teised lood sõltuvad neist.** Kui AI vastuste valideerimine on olemas algusest peale, saab iga uus etapp kaitse automaatselt kaasa.
2. **L03–L13 järgivad õpetaja töövoogu:** projekt → küsimus → lood → prioriteet → kriteeriumid ja mockup → täpsustus → jätkamine. Pärast L13 on terviklik töövoog olemas lihtsal kujul, isegi kui kõik edasine jääks tegemata. Andmed on SQLite'is algusest peale, seega on püsivus kohe olemas.
3. **L12 on MVP sees, mitte hilisem täiendus.** Nõue „teisi lugusid ei muudeta“ on hindamises eraldi punkt ja serveripoolse kaitse saab kohe algusest õigesti teha.
4. **L35 tuleb kohe pärast MVP-d.** AI-teenuse proovid näitasid kõikuvat vastamisaega (16–110 s). Enne kui ülejäänud töö sellele teenusele ehitada, tuleb päris rakenduses mõõta, kas vastuvõtukatse töövoog mahub 5–10 minuti sisse.
5. **Seejärel käsitsi haldus (L14–L17).** Nõue, et backlog töötab ka AI tõrke korral, sõltub sellest. Lisaks peab vastuvõtukatse 6 jaoks olema võimalik liiga suurt lugu käsitsi lisada.
6. **Siis kvaliteedireeglid (L18 → L19 → L20).** DoR sõltub kriteeriumide kontrollist ja täpsustamist vajava loo kontroll sõltub DoR-ist.
7. **Siis turvavõrgud (L21–L23).** Tagasivõtmine peab olemas olema enne suuri muudatusi nagu jagamine ja ühendamine.
8. **Groomimine (L25–L29) tuleb viimasena, sest see kasutab kõike eelnevat.** Käsitsi variant tuleb enne AI-varianti, sest AI ettepanek kasutab sama rakendamise loogikat.
9. **Valikulised lisad (L31–L34, L36) tulevad alles pärast L30.** Need ei kata ühtegi vastuvõtukatse punkti.
10. **L30 kasvab kogu aeg kaasa.** README alustatakse L01-ga ja lõpus toimub ainult viimistlus.

---

## Lood ja vastuvõtukriteeriumid

### L01 · Rakenduse karkass ja püsiv andmebaas (M)
*Arendajana soovin töötavat karkassi koos püsiva andmebaasiga, et iga järgmine lugu saaks sellele kohe toetuda.*
- Üks käsk käivitab serveri ja kasutajaliidese.
- Brauseris avaneb avaleht aadressil `localhost`.
- Andmebaasi fail luuakse esimesel käivitusel automaatselt.
- Repos on fail `.env.example`.
- Fail `.env` on kirjas `.gitignore`-is.
- Andmebaasi fail on kirjas `.gitignore`-is.
- Repos on minimaalne `README.md`, mis kirjeldab paigaldamist, `.env` faili loomist ja käivitamist.
- Minimaalse README juhise järgi käivitub rakendus puhtast kloonist.

### L02 · Serveripoolne ja valideeritud AI-kiht (M)
*Projektijuhina soovin, et iga AI vastus oleks serveris kontrollitud, et ma ei näeks kunagi katkist vaadet.*
- Brauser ei suhtle AI-teenusega otse: Network-vahekaardil on ainult päringud oma serverile (`/api/...`).
- Ükski saladus ega AI-teenuse toorveatekst ei esine brauserisse saadetud failides ega serveri vastustes.
- Server saadab iga AI päringuga kaasa etapi JSON-skeemi.
- AI-teenus ei saa projekti faile lugeda ega käske käivitada (Claude Code'i tööriistad on keelatud, kontekst saadetakse päringus).
- Server valideerib iga AI vastuse sama JSON-skeemi järgi.
- Skeemile mittevastava vastuse korral teeb server automaatselt ühe korduspäringu.
- Korduspäringu ajal näeb kasutaja ooteolekut.
- Korduspäring ei salvesta andmebaasi midagi.
- Ükski AI vastus ei salvestu backlog'i enne inimese kinnitust.
- Kui ka kordus ebaõnnestub, näeb kasutaja eestikeelset veateadet.
- Kui ka kordus ebaõnnestub, on veateate juures nupp „Proovi uuesti“.
- Kui AI teenus vastab koodiga 429 (päringupiir), näeb kasutaja teadet, mis ütleb, et tuleb oodata.
- AI päringul on ajalimiit ja selle ületamisel näeb kasutaja veateadet.
- AI päringu kontekst koostatakse andmebaasi hetkeseisust (rollid, lood, kriteeriumid, avatud küsimused).
- Igal AI ettepanekul on unikaalne tunnus.
- Server keeldub juba rakendatud ettepaneku uuesti rakendamisest.
- Rakendamise nupp on päringu ajal keelatud.
- Automaattest kinnitab, et sama ettepaneku kaks rakendamise päringut muudavad andmeid ainult üks kord.
- Automaattestid asendavad AI kutse võltsvastusega ega vaja tokenit.

### L03 · Projektide loomine ja loend (S)
*Projektijuhina soovin luua projekti ja näha oma projektide loendit, et iga kliendi töö oleks eraldi.*
- Projekti saab luua nime ja lühikirjeldusega.
- Tühja nimega projekti ei salvestata.
- Tühja nimega projekti korral näidatakse nime välja juures veateadet.
- Loodud projekt ilmub loendisse.
- Loendis projektile klõpsates avaneb projekti vaade.
- Pärast serveri taaskäivitust on projektide loend alles.

### L04 · Vestluse algus ühest promptist ja täpsustavad küsimused (M)
*Projektijuhina soovin kirjutada kliendi idee ühe lausega ja saada täpsustavad küsimused koos vastusevariantidega, et ma ei peaks teadma, kuidas kasutajalugusid kirjutada.*
- Uue projekti vestlus algab ühe vabatekstilise väljaga.
- Umbmäärase kirjelduse järel esitab AI enne lugude pakkumist 1–3 täpsustavat küsimust.
- Igal küsimusel on vähemalt kaks vastusevarianti nuppudena.
- Igal küsimusel on nupp „Muu (kirjutan ise)“.
- Igal küsimusel on nupp „Jäta vahele“.
- Mitmikvalikuga küsimuses saab valida mitu varianti.
- Mitmikvalikuga küsimuse valikud kinnitatakse ühe nupuga.
- Vabalt kirjutatud vastus salvestatakse vestlusse.
- AI järgmine samm kasutab vabalt kirjutatud vastuse sisu.
- Küsimused ja vastused salvestuvad vestluse ajalukku.
- AI päringu ajal kuvatakse ooteindikaator, mis näitab möödunud sekundeid.

### L05 · Rollid (S)
*Projektijuhina soovin valida AI pakutud kasutajarollide seast, et lood kirjutataks õigete kasutajate vaatest.*
- AI pakub rolle märkeruutudena.
- Kasutaja saab tekstiväljaga rolli lisada.
- Kasutaja saab pakutud rolli eemaldada.
- Kinnitatud rollid salvestatakse projekti juurde.
- AI pakutud lugudes on ainult kinnitatud rollid.

**Kontrollitud 30.09.2026 (projekt „L04 test“):**
- Kinnitatud rollid on „Potentsiaalne liige“ (AI pakutud) ja „Administraator“ (käsitsi lisatud).
- Arendaja nägi brauseris, et L06 kaartidel ja ✎ Muuda rollimenüüs olid ainult need kaks rolli.
- AI saatetekst mainis kinnitamata rolli „treener“. See on eraldi leid, mitte kinnitamata rolliga kaart: ühelgi kaardil seda rolli ei olnud. Vt [ai-piirangud.md](ai-piirangud.md).

### L06 · Lood happy path'i järjekorras (L)
*Projektijuhina soovin näha AI pakutud lugusid põhitöövoo järjekorras ja valida, millised backlog'i lähevad, et esialgne backlog tekiks klõpsudega.*
- AI pakub vähemalt viis lugu kaartidena.
- Kaardid on nummerdatud peamise rolli põhitöövoo järjekorras.
- Iga kaardi pealkiri on kujul „[Rollina] soovin …, et …“.
- Roll, tegevus ja kasu salvestatakse eraldi väljadena.
- Igal kaardil on vaikimisi märgitud märkeruut.
- Igal kaardil on nupp ✎ Muuda, mis avab rolli, tegevuse ja kasu muutmiseks enne backlog'i lisamist.
- Igal kaardil on nupp ✗ Lükka tagasi, mis eemaldab kaardi pakkumisest.
- Tagasi lükatud lugu ei lisata backlog'i ka nupuga [Lisa kõik backlog'i].
- Enne lisamist muudetud loo päritolu on „AI ettepanek, muudetud“.
- Kaartide all on nupud [Lisa kõik backlog'i], [Lisa valitud] ja [Paku teistsuguseid].
- Enne nupuvajutust ei lisandu backlog'i ühtegi lugu.
- „Lisa valitud“ lisab ainult märgitud lood.
- Muutmata kujul lisatud loo päritolu on „AI ettepanek“.
- Lisatud loo staatus on „Idee“.
- Igal lisatud lool on suurus S, M või L.
- Lugude prompt sisaldab näidet, kus kasu on vormis „et saaksin …“.
- Lugude prompt keelab kasu, mis kordab tegevust.
- Server hoiatab, kui tegevuse väli sisaldab eraldi „et“-kõrvallauset.

**Kontrollitud 30.09.2026 (projekt „L04 test“):**
- **AI-kutse:** „Paku lugusid“ tegi ühe päris AI-kutse, mis õnnestus esimesel katsel (37,8 s, 693 väljundtokenit). AI pakkus 7 lugu: 5 peamise rolli ja 2 administraatori lugu.
- **Muutmine enne lisamist:** arendaja parandas brauseris ✎ Muuda kaudu kahe loo kirjavead.
  - Lugu 3: „liikmepakete“ → „liikmepakette“.
  - Lugu 5: „sada“ → „saada“ ja uus kasu.
- **Lisamine:** arendaja lisas lood nupuga „Lisa valitud (7)“.
- **Andmebaas pärast lisamist:**
  - backlog'is on 7 lugu staatusega „Idee“ ja suurustega S/M;
  - lugude 3 ja 5 päritolu on `ai_edited`, ülejäänud viiel `ai`;
  - ettepaneku olek on `applied` ja ootel ettepanekuid ei ole;
  - muud tabelid on samad mis enne L06 skeemiuuendust tehtud varukoopias.
- **Püsivus:** pärast F5 värskendust oli 7 lugu backlog'is alles ja ootel ettepanekut ei kuvatud.
- **Järjekord:**
  - Automaattestid kontrollivad ainult struktuuri: peamise rolli lood on esimesena ja järjest.
  - Sisulise järjekorra hindas arendaja brauseris üldjoontes loogiliseks: tutvumine → hinnad → taotlus → kinnitus.
  - See ei tõenda kogu töövoogu. Näiteks tasumise sammu ettepanekus ei olnud.
- **Nupud:** arendaja nägi brauseris kaartide all nuppe „Lisa kõik backlog'i“, „Lisa valitud“ ja „Paku teistsuguseid“. Neist vajutati ainult nuppu „Lisa valitud“.
- **30.09.2026 seisuga brauseris proovimata** (01.10.2026 katsete tulemused on allpool):
  - ✗ Lükka tagasi vajutamise tulemus: kaart eemaldub pakkumisest;
  - tagasi lükatud loo välistamine nupu „Lisa kõik backlog'i“ korral;
  - „Lisa kõik backlog'i“ vajutamise tulemus: lisanduvad kõik tagasi lükkamata kaardid;
  - märkeruudu eemaldamine enne „Lisa valitud“ vajutamist: märkimata lugu ei lisandu;
  - „Paku teistsuguseid“ vajutamise tulemus: senine ettepanek asendub uuega.

  Neid katavad seni ainult automaattestid (võltsandmetega).
- **Teadaolev piirang:** kui lugu muuta ✎ Muuda kaudu enne backlog'i lisamist, jääb muudatus ainult brauseri vahelehe mällu. F5 või vahelehe sulgemine kaotab muudatuse ja kaardid laaditakse uuesti AI originaaliga. Ootel ettepanek ise jääb alles.

**Kontrollitud 01.10.2026 (eraldi testandmebaas, võltsitud ootel ettepanekud):**
- **Katsekeskkond:**
  - Testandmebaas loodi nullist väljaspool repot (`~/projektijuhtimise-tooriist-testid/2026-10-01_0904_l06/`). Selles on projektid 101–103, kinnitatud rollid „Potentsiaalne liige“ ja „Administraator“ ning igas projektis üks võltsitud ootel ettepanek viie looga.
  - Server töötas selle andmebaasiga ja tühja AI-tokeniga. Enne käivitust tõendati võlts-`.env` failiga, et käsureal antud `DATABASE_PATH` ja tühi token jäävad kehtima ka pärast `.env` laadimist.
  - Päris `data/app.db` ja `app.db-wal` räsid olid pärast katseid samad mis enne. Katse ajal ei hoidnud ükski protsess neid faile avatuna.
- **Võltsandmed:** ettepanekud ei olnud AI vastused, saatetekst oli „VÕLTSANDMED – brauserikatse jaoks, mitte AI vastus.“ Katsed tõendavad kasutajaliidese ja serveri käitumist, **mitte AI sisu**. AI-kutseid ei tehtud.
- **Katse A (projekt 101), kriteeriumid ✗ Lükka tagasi, tagasi lükatud loo välistamine ja „Lisa kõik backlog'i“:**
  - **Arendaja nägi brauseris:**
    - pärast ✗ vajutamist kaart 2 kadus ja tuli teade „Tagasi lükatud: 1“;
    - pärast kaardi 4 märke eemaldamist jäi nupp kujule „Lisa kõik backlog'i (4)“;
    - pärast lisamist ja F5 värskendust oli backlog'is 4 lugu ja lugu 2 puudus.
  - **Andmebaas (ainult lugedes):**
    - backlog'is on 4 lugu: algsed 1, 3, 4 ja 5 järjekorras 1–4;
    - kõigi staatus on „Idee“ ja päritolu `ai`, kõik samast ettepanekust;
    - ettepaneku olek on `applied`.
- **Katse B (projekt 102), kriteerium „Lisa valitud“ lisab ainult märgitud lood:**
  - **Arendaja nägi brauseris:**
    - kui kõik märked olid eemaldatud, oli „Lisa valitud (0)“ keelatud;
    - pärast lugude 1, 3 ja 5 märkimist, lisamist ja F5 värskendust oli backlog'is 3 lugu.
  - **Andmebaas (ainult lugedes):**
    - backlog'is on täpselt algsed lood 1, 3 ja 5;
    - märkimata lood 2 ja 4 ei ole lisatud;
    - ettepaneku olek on `applied`.
- **Katse C (projekt 103), „Paku teistsuguseid“ tõrge ilma AI-tokenita:**
  - **Arendaja nägi brauseris:**
    - tuli teade „AI ei ole serveris seadistatud. Käsitsi saad edasi töötada.“ ja nupp „Proovi uuesti“;
    - kõik 5 kaarti jäid nähtavaks ja lisamisnupud aktiivseks;
    - pärast F5 värskendust oli sama ettepanek alles ja veateadet ei olnud.
  - **Andmebaas ja serverilogi:**
    - projektis 103 on endiselt üks ettepanek (sama id) olekuga `pending` ja backlog on tühi;
    - logis oli `result: not_configured` (1 ms), seega võrgupäringut ei tehtud.
- **Seis pärast 01.10.2026 katseid:**
  - Brauseris on proovitud: ✗ Lükka tagasi, tagasi lükatud loo välistamine „Lisa kõik“ korral, „Lisa kõik backlog'i“, „Lisa valitud“ ja „Paku teistsuguseid“ tõrkeolukord.
  - **Brauseris on proovimata „Paku teistsuguseid“ õnnestunud asendus**, kus senine ettepanek asendub uuega. Seda katab seni ainult automaattest võlts-AI vastusega (`test/stories.test.js`). Brauseris vajab see päris AI-kutset.
- **Automaattestid** (võltsandmed, ilma brauserita):
  - `test/ui-stories.test.js` kontrollib valiku loogikat: „Lisa kõik“ ei lisa tagasi lükatud lugusid ja „Lisa valitud“ lisab ainult märgitud lood.
  - `test/stories.test.js` kontrollib serverit:
    - „Paku teistsuguseid“ õnnestumist võlts-AI vastusega;
    - tõrgete korral jääb senine ettepanek alles;
    - topeltlisamine annab 409.
  - `test/ui-stories-render.test.js` renderdab komponendid staatiliseks HTML-iks ja kontrollib ainult kasutajaliidese olekuid etteantud andmetega:
    - tagasi lükatud kaart puudub pakkumisest, „Lisa kõik backlog'i“ arv seda ei sisalda ja kuvatakse „Tagasi lükatud: 1“;
    - „Lisa valitud“ arv sisaldab ainult märgitud lugusid ja ilma valikuta on nupp keelatud;
    - kui päringut ei käi, on kolm nuppu lubatud;
    - lisamise ajal on kõik nupud ja märkeruudud keelatud;
    - „Paku teistsuguseid“ ajal on nupud keelatud ja senised kaardid nähtavad;
    - ebaõnnestunud „Paku teistsuguseid“ järel on kaardid nähtavad, nupud lubatud ning kuvatakse veateade ja „Proovi uuesti“.

    Renderdustest ei klõpsa nuppe, ei kasuta brauserit ega tõenda õnnestunud asendust.

**Hoiatuse kuvamine, kontrollitud 01.10.2026 (sama testandmebaas, projekt 103, tühi AI-token):**
- **Arendaja nägi brauseris:**
  - kaardi 1 ✎ Muuda kaudu sai tegevuseks „näha tunniplaani, et valida sobiv aeg“;
  - pärast Salvesta kuvati kaardil „et“-kõrvallause ⚠ hoiatus, salvestamine ei olnud keelatud ja kaardil oli silt „muudetud“;
  - pärast F5 värskendust oli kaart 1 jälle algsel kujul ja ootel ettepanek alles (ekraanipilt).
- **Andmebaas (ainult lugedes):** projekti 103 ettepanek on endiselt `pending`, kaardi 1 tegevus serveris on algne ja backlog on tühi. AI-kutseid ei tehtud.
- Brauseris nähtud hoiatus tuli ✎ muutmisest, mitte AI vastusest. Mõlemal juhul kasutatakse sama reeglit (`shared/story-format.js`).

**Miks L06 on „Valmis“:**
- **Brauseris proovitud kriteeriumid:**
  - **30.09.2026, päris AI-kutse:**
    - vähemalt viis nummerdatud kaarti, pealkiri kujul „[Rollina] soovin …, et …“ ja vaikimisi märgitud märkeruut;
    - ✎ Muuda ja päritolu „AI ettepanek, muudetud“;
    - enne nupuvajutust backlog'i midagi ei lisandu;
    - päritolu „AI ettepanek“, staatus „Idee“ ja suurus S/M/L;
    - nuppude „Lisa kõik backlog'i“, „Lisa valitud“ ja „Paku teistsuguseid“ olemasolu.
  - **01.10.2026, võltsitud ettepanekud:**
    - ✗ Lükka tagasi;
    - tagasi lükatud loo välistamine „Lisa kõik“ korral;
    - „Lisa kõik backlog'i“ ja „Lisa valitud“;
    - „Paku teistsuguseid“ tõrge;
    - hoiatuse kuvamine.
- **Ainult automaattestiga kaetud:**
  - **„Paku teistsuguseid“ õnnestunud asendus** (`test/stories.test.js`, võlts-AI vastus). Kriteerium nõuab nupu olemasolu, mitte õnnestunud asendust brauseris, seega ei ole see „Valmis“ reegli järgi kohustuslik brauserikatse. Päris AI-ga ei ole asendust proovitud.
  - **Server lisab hoiatuse AI ettepanekule:** `test/stories.test.js`. AI vastuses ei olnud „et“-kõrvallauset, seega serveri loodud hoiatust brauseris ei nähtud.
  - **Prompti kaks nõuet:** „et saaksin“ näide ja ringja kasu keeld (`test/stories.test.js`). Brauseris neid näha ei saa.
- **Sisuline järjekord:** hindas arendaja brauseris üldjoontes loogiliseks. Kogu töövoogu, näiteks tasumise sammu, see ei tõenda.

### L07 · Backlog'i vaade ja lihtne järjestamine (S)
*Projektijuhina soovin näha backlog'i vestluse kõrval, et näeksin kohe, mida vestlus muutis.*
- Backlog'i paneel on projekti vaates vestluse kõrval.
- Iga rea juures on järjekorranumber, pealkiri, staatus, suurus ja päritolu.
- Backlog uueneb pärast lugude lisamist ilma lehte värskendamata.
- Lugu saab nuppudega ↑ ja ↓ ümber tõsta.
- Muudetud järjekord püsib pärast lehe värskendamist.

**Kontrollitud 01.10.2026 (testandmebaas, projekt 101):**
- **Arendaja nägi brauseris:** backlog vestluse kõrval (lai aken); igal real number, pealkiri, staatus, suurus ja päritolu; ↑/↓ tõstmine ja teade „Lugu tõsteti kohale 3.“; esimese rea ↑ ja viimase rea ↓ olid keelatud; pärast F5 värskendust püsis järjekord.
- **Ainult automaattestiga kaetud:** nuppude keelamine päringu ajal ja veateade (`role="alert"`); server: piirid, teise projekti lugu, `updated_at` ei muutu.
- **Brauseris proovimata:** backlog'i uuenemine ilma lehte värskendamata pärast lugude lisamist; kitsa ekraani paigutus; fookuse säilimine klaviatuuriga.

### L08 · Prioriteedisoovitus (S)
*Projektijuhina soovin AI põhjendatud soovitust, millisest loost alustada, et kliendiga kiiresti kokku leppida.*
- Pärast lugude lisamist küsib AI, milline lugu on kõige olulisem.
- AI soovitab ühe konkreetse loo koos põhjendusega.
- Server kontrollib, et soovitatud lugu on selle projekti backlog'is olemas.
- Soovituse juures on nupud [Nõus, alustame sellest] ja [Valin ise teise].
- „Valin ise teise“ avab backlog'i lugude valiku.
- Valitud lugu saab backlog'is märgi „Alustame sellest“.

**Kontrollitud 01.10.2026 (testandmebaas, projekt 101, üks päris AI-kutse 9,6 s):**
- **Arendaja nägi brauseris:** AI soovitas ühe backlog'i loo koos põhjendusega; nupud „Nõus, alustame sellest“ ja „Valin ise teise“; pärast „Nõus“ said prioriteedi kaart ja backlog'i rida märgi „Alustame sellest“.
- **Ainult automaattestiga kaetud (brauseris proovimata):** „Valin ise teise“ ja lugude valik; teise projekti loo soovituse tagasilükkamine; topeltkinnituse keeld (409); tühja backlog'i korral AI-d ei kutsuta.
- **Sisuline märkus:** AI põhjendus oli loogiliselt nõrk (vt [ai-piirangud.md](ai-piirangud.md)); otsuse teeb inimene.

### L09 · Vastuvõtukriteeriumid valitud loole (M)
*Projektijuhina soovin, et AI pakuks valitud loole kriteeriumid ja et saaksin igaühe kinnitada, muuta või eemaldada, et kriteeriumid oleksid kliendiga kokku lepitud.*
- AI pakub valitud loole 3–6 kriteeriumi.
- Iga kriteeriumi juures on nupud ✓ Nõus, ✎ Muuda ja ✗ Eemalda.
- ✎ avab kriteeriumi teksti samas kohas muutmiseks.
- Kriteeriumide all on nupud [Kinnita kõik] ja [Lisa kriteerium].
- Lool on salvestatud ainult kinnitatud või muudetud kriteeriumid.
- Eemaldatud kriteerium ei ole loo juures salvestatud.

**Kontrollitud 01.10.2026 (testandmebaas, projekt 101, üks päris AI-kutse 12,8 s):**
- **Arendaja nägi brauseris:** AI pakkus 6 kriteeriumi; igaühe juures ✓ Nõus, ✎ Muuda ja ✗ Eemalda; ✎ avas teksti samas kohas; all olid „Kinnita kõik“ ja „Lisa kriteerium“; kinnitati kaks, eemaldati üks, muudeti üks ja vajutati „Salvesta kinnitatud (3)“.
- **Andmebaas (ainult lugedes):** loo juures on täpselt 3 kriteeriumi (kaks `ai`, üks `ai_edited`); eemaldatud ja otsustamata kriteeriume ei salvestatud.
- **Automaattestid:** valiku loogika (eemaldatu ei lähe kaasa ka „Kinnita kõik“ korral), serveri päritolu määramine, renderdus.
- „Kinnita kõik“ ja „Lisa kriteerium“ vajutamist brauseris ei proovitud (nupud on olemas; loogika on automaattestidega kaetud).

### L10 · Turvaliselt kuvatav mockup (L)
*Projektijuhina soovin näha valitud loo lihtsat vaate kavandit kriteeriumide kõrval, et klient saaks lugu visuaalselt kontrollida.*
- AI tagastab mockup'i komponentide loendina JSON-is.
- Server lubab ainult kokkulepitud komponenditüüpe.
- Server lükkab tagasi vastuse, kus on tundmatu komponenditüüp.
- Koodis ei ole `innerHTML`-i.
- Koodis ei ole `dangerouslySetInnerHTML`-i.
- Mockup'i tekstis olev `<script>` kuvatakse tavatekstina.
- Mockup on kriteeriumide kõrval.
- AI pakutud mockup kuvatakse eraldi ettepanekuna nuppudega [Kinnita mockup], [Paku uus] ja [Loobu].
- Kriteeriumide kinnitamine ei kinnita mockup'i.
- Enne kinnitamist ei ole mockup looga seotud.
- Pärast „Loobu“ vajutamist ei salvestata mockup'i.
- Kinnitatud mockup seotakse looga.
- Kinnitatud mockup salvestatakse versioonina 1.

**Kontrollitud 01.10.2026 (testandmebaas, projekt 101):**
- **Arendaja nägi brauseris:** mockup kriteeriumide kõrval eraldi ettepanekuna nuppudega „Kinnita mockup“, „Paku uus“, „Loobu“; „Kinnita mockup“ andis „Kinnitatud, versioon 1“.
- **Andmebaas (ainult lugedes):** kinnitatud mockup on looga seotud versioonina 1; kriteeriumide salvestamine mockup'i ei kinnitanud.
- **Ainult automaattestiga kaetud (brauseris proovimata):** „Paku uus“, „Loobu“, tundmatu komponenditüübi tagasilükkamine, `<script>` kuvamine tavatekstina, `innerHTML`-i ja `dangerouslySetInnerHTML`-i puudumine koodis.

### L11 · Kliendi täpsustus enne/pärast eelvaatega (L)
*Projektijuhina soovin sisestada kliendi täpsustuse ja näha enne rakendamist, mis muutub, et klient saaks muudatuse kinnitada.*
- Valitud loo juures on vabatekstiline väli „Kliendi täpsustus“.
- AI muudatusettepanek võib muuta loo sõnastust, kriteeriume ja mockup'i.
- Uue mockup'i versiooni paneb kokku server.
- Mockup'i muudatuse iga komponendi tüüpi kontrollib server lubatud tüüpide loendi järgi.
- Mockup'i muudatuses ei ole korduvaid komponendi id-sid.
- Mockup'i muudatuses viitab iga `parentId` olemasolevale komponendile.
- Kui mõni serveri kontroll ebaõnnestub, ei rakendata ühtegi ettepaneku osa.
- Kui mõni serveri kontroll ebaõnnestub, näeb kasutaja veateadet.
- Kui mõni serveri kontroll ebaõnnestub, jäävad lugu, kriteeriumid ja mockup muutmata.
- Kui ettepanek on vigane, jääb loo aktiivseks mockup'iks vana versioon.
- **Lühivorm on optimeerimiskavand, mida pole veel päris teenusega proovitud.** AI tagastab mockup'ist ainult lisatud, muudetud ja eemaldatud komponendid. See muudatus peab lühendama proovis A mõõdetud 110 s vastust.
  - Enne kasutuselevõttu tehakse lühivormiga proov.
  - Kui proov ei õnnestu, kasutatakse proovis A töötanud täismockup'i vormi.
  - Lühivormi korral kontrollib server, et iga muudetud või eemaldatud komponent on praeguses mockup'is olemas.
- Eelvaates on „enne“ ja „pärast“ kõrvuti.
- Eelvaade arvutatakse koodis, mitte mudeli kirjelduse põhjal.
- Lisatud, muudetud ja eemaldatud kriteeriumid on eri värviga.
- Eelvaade näitab kriteeriumi mockup'i viite muutust ka siis, kui kriteeriumi tekst jäi samaks.
- Eelvaade hoiatab, kui „muudetud“ kriteeriumi tekst ei muutunud.
- Vana ja uus mockup on kõrvuti.
- Eelvaade ütleb, kas muudatus mõjutab ka teisi lugusid.
- Eelvaate juures on nupud [Rakenda], [Muuda] ja [Loobu].
- „Muuda“ lubab ettepaneku sisu enne rakendamist muuta.
- Pärast „Loobu“ vajutamist on lugu ja mockup muutmata.
- Pärast „Rakenda“ vajutamist on muudatus näha loo kriteeriumides.
- Pärast „Rakenda“ vajutamist on muudatus näha mockup'is.
- Rakendamisel luuakse mockup'ist uus versioon.
- Rakendamisel jääb mockup'i eelmine versioon alles.
- Ettepanek arvestab loo hetkeseisu, sealhulgas käsitsi muudetud kriteeriume.

**Kontrollitud 01.10.2026 (testandmebaas, projekt 101, üks päris AI-kutse 12,7 s):**
- **Arendaja nägi brauseris:** täpsustus „Sünniaega taotluses ei küsita. Pärast taotluse esitamist kuvatakse kinnitusteade.“ → eelvaade (sõnastus enne/pärast, kriteeriumid märgistusega, vana ja uus mockup kõrvuti, „Sünniaeg“ märgitud eemalduvaks) → „Rakenda“ → mockup „Kinnitatud, versioon 2“ ilma sünniaja väljata.
- **Andmebaas (ainult lugedes):** mockup'i versioon 1 on alles ja versioon 2 tekkis; muutus ainult valitud loo `updated_at`.
- **Ainult automaattestiga kaetud (brauseris proovimata):** „Muuda“, „Loobu“, vigase AI vastuse kordus ja veateade, `stale` (lugu muutus pärast ettepanekut).
- **Pooleli:** mockup'i lühivorm (kasutusel täismockup'i vorm); komponentide id-d ja `parentId` (mockup on lame loend); kriteeriumi mockup'i viite muutuse kuvamine (viiteid veel ei ole, vt L23); mockup'i käsitsi muutmine „Muuda“ all; hoiatus „muudetud, aga tekst sama“ – praegu kuvatakse sellist kriteeriumi lihtsalt „Muutmata“.
- **AI vastus oli poolik:** AI kirjutas, et lisas kinnitusteate, kuid uues mockup'is seda ei olnud. Eelvaade näitas seda õigesti (koodis arvutatud), vt L23.

### L12 · Server muudab ainult valitud lugu (M)
*Projektijuhina soovin, et kliendi täpsustus muudaks ainult valitud lugu, et teised kokkulepped ei muutuks kogemata.*
Siin on kaks eri asja, mida ei tohi segi ajada:
- **soovitus teise loo kohta** on ainult tekst, mida näidatakse kasutajale;
- **päring, mis püüab muuta midagi muud peale valitud loo**, lükatakse serveris tagasi tervikuna, mitte ei rakendata osaliselt.

Kriteeriumid:
- Rakendamise päring sisaldab ühe loo tunnust.
- Server muudab andmebaasis ainult selle loo ridu.
- Kõik ühe ettepaneku muudatused salvestatakse ühes transaktsioonis.
- AI mõju teistele lugudele kuvatakse eraldi plokis „Soovitused teistele lugudele“.
- Soovitus teise loo kohta ei sisalda andmemuudatust.
- Soovituse kuvamine ei muuda ühtegi lugu.
- Soovituse juures on nupp, mis avab selle loo jaoks uue täpsustuse. Uus täpsustus läbib sama eelvaate ja kinnituse.
- Rakendamise päring, mis sisaldab andmeid mõne teise loo kohta, lükatakse tagasi veakoodiga.
- Tagasi lükatud rakendamise päring ei salvesta ühtegi muudatust, ka mitte valitud loo osa.
- Automaattest kinnitab, et pärast rakendamist on teiste lugude andmed muutumata.
- Automaattest kinnitab, et teist lugu muutev rakendamise päring ei muuda andmebaasi.

**Kontrollitud 01.10.2026:**
- **Brauseris:** katses AI teisi lugusid ei maininud (plokk „Soovitused teistele lugudele“: „Teisi lugusid see täpsustus ei mõjuta“); andmebaasis jäid projekti 101 teiste lugude ja projekti 102 lugude `updated_at` muutmata.
- **Ainult automaattestiga kaetud (brauseris proovimata):** teise loo tunnusega või teise loo andmeid sisaldav rakendamise päring lükatakse tervikuna tagasi (`other_story`) ja midagi ei salvestata; soovituste kuvamine ei muuda ühtegi rida; teiste lugude read, kriteeriumid ja mockup'id on pärast rakendamist baithaaval samad; „Täpsusta seda lugu“ avab eraldi täpsustusvoo ega muuda alustamise lugu.

### L13 · Järgmise sammu pakkumine ja jätkamine samast kohast (M)
*Projektijuhina soovin, et iga vastus pakuks järgmist sammu ja et projekt jätkuks pärast taasavamist samast kohast, et ma ei jääks kunagi hätta.*
- Iga AI vastus lõpeb 1–4 järgmise sammu nupuga.
- Projekti hetkeetapp salvestatakse andmebaasi.
- Projekti uuesti avamisel on näha kogu vestluse ajalugu.
- Uuesti avamisel pakub rakendus salvestatud etapile vastavaid järgmisi samme.
- Pärast serveri taaskäivitust on backlog alles.
- Pärast serveri taaskäivitust on kriteeriumid alles.
- Pärast serveri taaskäivitust on mockup'id alles.
- Pärast serveri taaskäivitust on vestlus alles.
- Igas vestluse olekus on nähtav vähemalt üks järgmise sammu nupp või sisestusväli.

**Seis 01.10.2026 (L13 osaliselt):**
- **Tehtud:**
  - etapp ja järgmised sammud tuletatakse andmebaasi hetkeseisust (`shared/stage.js`, `GET /api/projects/:id/stage`), eraldi etapivälja ei salvestata; F5 või serveri taaskäivituse järel arvutatakse sama tulemus;
  - plokk „Mida teeme edasi?“ (1–4 nuppu) on etappide paneelis ja **uusima AI väljundi** kaardi lõpus (vestluse AI sõnum või mis tahes AI ettepanek);
  - nupp kerib olemasoleva tegevuseni ja paneb sellele fookuse; AI-kutset nupp ise ei tee („(AI)“ märgiga tegevus käivitub kaardi enda nupuga);
  - eelduseta tegevust nupuna ei pakuta (nt ilma alustamise loota pole kriteeriumide nuppu); Groomimist ei pakuta.
- **Arendaja nägi brauseris (testandmebaas, AI-ta):** projektides 101–103 õiged sildid „Viimati läbitud etapp“ ja „Soovitatud järgmine samm“; plokk „Mida teeme edasi?“ uusima AI väljundi kaardil (101 „Kliendi täpsustus“, 102 ja 103 „Kasutajalood“); 102-s kriteeriumide nuppu ei pakuta; nupp kerib tegevuseni ja paneb fookuse täpsustuse väljale; F5 järel sama seis.
- **Ainult automaattestiga kaetud:** kõik 20 sammu ja nende sihtmärgid; sammude arv 1–4 ja eelduse kontroll kõigis olekute kombinatsioonides; päring ei muuda andmeid ega kutsu AI-d.
- **Seis 02.10.2026 (L13 lõpetatud):**
  - **1–4 valikut iga nähtava AI väljundi järel:** server annab sammud kaardi kaupa (`stepsByCard`): uusim AI väljund, iga ootel AI ettepanek ja vestluse viimane AI sõnum saavad oma ploki „Mida teeme edasi?“, kus kaardi enda sammud on eespool. Vanade, juba vastatud vestlussõnumite ja backlog'i ülevaatuse juures plokki ei ole (ülevaatusel on leidude Rakenda/Muuda/Ignoreeri).
  - **Hetkeetapp on püsiv:** migratsioon v11 lisab `projects.skipped_stages` (vahele jäetud etapid) ja `projects.active_stage` (kus kasutaja viimati oli); soovitatud etapp arvutatakse andmetest ja vahele jäetud etappidest. Projekti avamisel keritakse aktiivse etapi kaardini (lehe kõrguse muutumisel kuni ~2 s uuesti; kasutaja tegevus peatab). AI kontekstis on ka vahele jäetud etapid.
  - **Automaattestid:** sammud kaardi kaupa (1–4, kaardi omad ees, ülevaatusel mitte), püsimine uue rakenduse eksemplariga, migratsioon v5 → v11 andmetega. **Arendaja nägi brauseris (demobaasi koopia):** plokid vestluse, kasutajalugude ja kliendi täpsustuse kaardi järel; uuesti avamisel keris leht aktiivse etapi („Lood“) kaardini.
  - **Piirang:** valikud on navigeerimisnupud olemasolevate tegevuste juurde, mitte AI enda pakutud vastusevariandid.

### ═══════════ MVP JOON ═══════════
Siin on terviklik töövoog olemas: projekt → küsimus → lood → prioriteet → kriteeriumid ja mockup → täpsustus → ainult valitud loo uuendus → jätkamine. Vastuvõtukatse sammud 1–5, 8 ja 9 on sellega läbitavad.

---

### L35 · Vastuvõtukatse töövoo ajamõõtmine päris rakenduses (S)
*Õpilasena soovin mõõta vastuvõtukatse töövoo aega päris rakenduses, et otsustada, kas demo jaoks sobib praegune AI-teenus.*
- Server logib iga AI päringu kestuse.
- Server logib iga AI päringu etapi.
- Server logib iga AI päringu väljundtokenite arvu.
- Vastuvõtukatse sammud 1–5 on läbi tehtud vähemalt kahel eri päeval.
- Iga läbimise kogu AI ooteaeg on dokumenteeritud.
- Mõõtmiste põhjal on kirja pandud, kas valitud AI-teenus (01.10.2026 seisuga Claude Code CLI, Sonnet) sobib demo jaoks.

### L14 · Sammude riba (S)
*Projektijuhina soovin näha protsessi etappe ja nende vahel liikuda, et saaksin etappe vahele jätta või varasema juurde tagasi minna.*
- Ribal on etapid Idee → Rollid → Lood → Prioriteedid → Kriteeriumid ja mockup → Täpsustused → Groomimine.
- Hetkeetapp on esile tõstetud.
- Varasemale etapile klõpsates saab sinna tagasi minna.
- Varasemale etapile minnes andmed ei kao.
- „Jäta vahele“ viib järgmisesse etappi.
- Etapi vahetus salvestub andmebaasi.

**Seis 01.10.2026 (L14 osaliselt):**
- **Tehtud:** riba seitsme etapiga; märked „tehtud ✓“, „soovitatud järgmine“, „saab teha“, „eeldus puudub“ (koos põhjusega), „pole veel tehtud“ (Groomimine) ja „andmed puuduvad“; eraldi read „Viimati läbitud etapp“ ja „Soovitatud järgmine samm“; tehtud või kättesaadava etapi nimele klõpsates kerib leht selle kaardini (tagasiminek, andmed ei muutu).
- **Arendaja nägi brauseris:** riba kõigis kolmes testprojektis (Groomimine hall, eelduseta etapp koos põhjusega), ribalt kaardini kerimine, F5 järel sama seis ja kitsas vaade (suum ~250%: riba murdub ridadesse, külgkerimist pole). Kitsal ekraanil võtab riba palju ruumi – kompaktsem riba on järgmise paigutuse muudatuse osa.
- **Paigutus (01.10.2026):** kompaktne projekti päis (nimi, riba ühel real märkide ✓ ● ○ 🔒 – ! ja numbritega, viimati läbitud etapp, soovitatud järgmine samm ühe nupuga, lahti voldiv „Miks mõni etapp on hall?“ koos vahelejätmise piiranguga, link „Backlog (n)“) jääb kerimisel üles; laial ekraanil tööala vasakul ja backlog paremal, mis jääb kerimisel nähtavale. Alla 1000 px on ribal märgid ja numbrid, nimi ainult soovitatud etapil; alla 600 px kõrguses aknas päis üles kinni ei jää. Arendaja nägi brauseris laia vaadet (projektid A ja B), kitsast vaadet (projekt C, suum ~250%: riba mahub, külgkerimist pole), alla kerides üles jäävat päist ja paremale jäävat backlog'i (projekt C) ning F5 järel sama seisu. Päise soovituse nupp kerib projektis A kaardini „Kliendi täpsustus“: pealkiri jääb päise alt nähtavale ja fookus läheb tekstiväljale. Näidiste ühtset vestlusvoogu ega püsivat vaba teksti välja ei ole – need vajavad eraldi toimimisloogikat.
- **Seis 02.10.2026 (L14 lõpetatud):**
  - **„Jäta vahele“:** päises soovitatud või aktiivse, veel tegemata ja mitte-lukus etapi juures; märgib etapi püsivalt vahele jäetuks (olek „jäeti vahele“, märk »). Eeldusi ega AI route'e see ei leevenda: järgmise etapi lukk jääb ja põhjuse juures on märge, et eeldusetapp jäeti vahele.
  - **Tagasiminek:** ribal etapile klõpsates salvestatakse aktiivne etapp ja vahele jäetud etapp ei ole enam vahele jäetud.
  - **Groomimine on päris etapp** (backlog'i kaart): lukus ilma lugudeta; soovitatud pärast Täpsustusi; „tehtud“, kui backlog'i ülevaatusel pole avatud aegumata leide. Seis loetakse L27 andmetest ainult lugedes, L27–L29 loogikat ei muudetud.
  - **Automaattestid:** vahelejätmine ja lukk, lubatud/keelatud vahelejätmine (409), tagasiminek, Groomimise olekud, backlog muutumata ja AI-d ei kutsuta. **Arendaja nägi brauseris (demobaasi koopia):** Groomimine ● → „Jäta vahele“ → » ka pärast F5 → ribalt tagasi ●; ülevaatus → „Vaata ülevaatuse leiud üle“ → kõik leiud ignoreeritud → ✓.
  - **Brauseris proovimata:** vahelejätmise tõttu lukku jääv järgmine etapp (demos on kõik varasemad etapid tehtud) – kaetud automaattestiga.

### L15 · Käsitsi backlog'i haldus, ka AI tõrke korral (M)
*Projektijuhina soovin lugusid käsitsi lisada, muuta ja kustutada, et saaksin töötada ka siis, kui AI ei ole kättesaadav.*
- Uue loo vormis on roll, tegevus ja kasu eraldi väljadena.
- Loo sõnastust saab muuta.
- Loo suurust saab muuta.
- Loo staatust saab muuta.
- Loo märkusi saab muuta.
- Loo kustutamiseks tuleb see kinnitusdialoogis kinnitada.
- Kriteeriume saab käsitsi lisada, muuta ja kustutada.
- Käsitsi lisatud loo päritolu on „Käsitsi lisatud“.
- Kui AI ei ole kättesaadav (Claude Code puudub, pole sisse logitud või AI on välja lülitatud), töötavad kõik eelnevad toimingud.
- Kui AI ei ole kättesaadav, näitavad AI nupud veateadet.
- AI järgmine vastus kasutab käsitsi muudetud loo uut sõnastust.

**Seis 01.10.2026 (L15 osaliselt):**
- **Tehtud (ilma AI-ta):** backlog'is „+ Lisa lugu“ (roll – kinnitatud rollid soovitusena, aga ka vabatekst –, roll olevas käändes, tegevus, kasu, suurus, „Puudutab vaadet“; sama loo vormi kontroll nagu AI lugudel); uus lugu läheb lõppu ehk MVP joone alla, päritolu „Käsitsi lisatud“. Iga loo juures „✎ Muuda“ (järjekord, staatus ja alustamise lugu jäävad; AI loo muutmisel päritolu „AI ettepanek, muudetud“) ja „Kustuta“. Staatust saab muuta L19 lahtris.
- **Kustutamine (sinu otsused 01.10.2026):** enne on kinnitus, mis loetleb täpselt, mis kaob: kriteeriumid, mockup'i versioonid, küsimused, selle loo ootel ettepanekud (lükatakse tagasi) ja kas tegu on alustamise looga (valik tühjeneb, etapp naaseb „Prioriteedid“). MVP joon nihkub üles, kui lugu oli joone kohal; järjekord tihendatakse. Kustutamine on lõplik (tagasivõtmist L21 pole). Teise loo täpsustuse ettepanek ei näita kustutatud loo kohta soovitust – katkist viidet ei jää.
- **Automaattestid:** lisamine, vigased väljad, muutmine (päritolu, järjekord, staatus, alustamise lugu), teine projekt, alustamise loo kustutamine koos seotud andmete ja ettepanekutega, MVP joon, järjekord. **Arendaja nägi brauseris (demobaas):** lisamine (lugu kohal 5, MVP joone all, „Käsitsi lisatud“), muutmine, kustutamine kinnitusega ja alustamise loo kustutamise hoiatus koos seotud andmete loeteluga. **Leitud ja parandatud:** väljadesse kirjutatud „soovin:“ ja „et:“ (kooloniga) läksid kontrollist läbi ja pealkiri kordas sõnu – reegel tabab nüüd ka kirjavahemärgiga kuju (kehtib ka AI lugudele).
- **Seis 02.10.2026 – kriteeriumide käsitsi haldus (töötab ka AI-ta):** backlog'is iga loo all paneel „Kriteeriumid, valmisolek ja küsimused“, mille esimene plokk „Vastuvõtukriteeriumid“: read päritolu, kontrollitavuse hoiatuse ja mockup'i seosega; ✎ Muuda samal real (märge, et seos jääb alles); Kustuta kinnitusega (seosega kriteeriumi korral on kinnituses seose nimi); „Lisa kriteerium“ koos hoiatusega kirjutamise ajal (`checkCriterion`, salvestamist ei keela). Route'id `POST /stories/:storyId/criteria`, `PUT` ja `DELETE …/criteria/:criterionId`; server kontrollib tühja, üle 200 märgi ja korduva teksti (400), 10 kriteeriumi piiri (409) ja et kriteerium kuulub loole (404); kõik ühes transaktsioonis. Päritolu: käsitsi lisatud „manual“, AI kriteeriumi muutmisel „ai_edited“. Seos jääb muutmisel alles (kooskõla hoiatused arvutatakse uue teksti järgi, ülevaatus aegub), kustutamisel kaob ainult selle kriteeriumi seos; mockup ei muutu. DoR uueneb vastuses kohe; alla 3 kriteeriumi korral staatust ei muudeta, „Valmis arenduseks“ loo valmisolek aegub. Kliendi täpsustuse ootel ettepanek ja ülevaatuse leiud aeguvad olemasoleva loogikaga. AI kriteeriumide ettepaneku rakendamine keeldub (400), kui valik kordab loo olemasolevat kriteeriumi või ületaks 10 piiri; ettepanek jääb ootele. Alustamise loo kaardil muutmisnuppe ei ole. **Automaattestid:** lisamine/muutmine/kustutamine koos DoR-i ja aegumisega, piirangud, seosed ja mockup'i muutumatus, AI rakendamise kaitse, paneeli renderdus. **Arendaja nägi brauseris (demobaasi koopia, AI väljas):** lisamine koos hoiatuse ja DoR-i uuendusega, muutmine samal real (seos alles), kustutamise kinnitus seose nimega, kahe kriteeriumi kustutamine → „Valmis arenduseks – valmisolek aegunud“.
**Pooleli:** „AI järgmine vastus kasutab uut sõnastust“ – AI kontekstis on lood ja kriteeriumid andmebaasist, kuid päris AI-ga proovimata. Eraldi märkuste välja ei tehta: ülesanne nõuab „avatud küsimused või märkused“ ja avatud küsimused on olemas (L20).

### L16 · Järjestamine lohistades (S)
*Projektijuhina soovin lugusid lohistades ümber järjestada, et saaksin kliendiga koos järjekorda kiiresti muuta.*
- Lugu saab lohistades teise kohta tõsta.
- Uus järjekord püsib pärast lehe värskendamist.
- Nupud ↑ ja ↓ jäävad klaviatuuriga kasutamiseks alles.

### L17 · MVP joon (S)
*Projektijuhina soovin backlog'is märkida MVP joone, et oleks näha, mis kuulub esimesse versiooni.*
- MVP joont saab backlog'is lugude vahele paigutada.
- Joonest ülalpool olevad lood on märgisega „MVP“.
- Joone asukoht püsib pärast lehe värskendamist.

**Seis 01.10.2026 (L17):** „Lisa MVP joon“, joone rida backlog'is („↑ Joon üles“, „↓ Joon alla“, „Eemalda joon“), märk „MVP“ joonest ülalpool olevatel lugudel ja „MVP: N lugu“ kokkuvõttes; teade ekraanilugejale, fookus jääb joone nupule. Andmebaasis `projects.mvp_count` (migratsioon v10) – joon on seotud kohaga, mitte looga: loo tõstmisel üle joone jääb joon samale kohale. Kui salvestatud koht on suurem kui lugude arv, kuvatakse see lugude arvuga piiratult; lugemine andmebaasi ei muuda. `npm run demo` näidises on joon kolme loo all. **Automaattestid:** määramine, liigutamine, eemaldamine, vigased väärtused, teine projekt, püsivus pärast taasavamist, piiramine. **Arendaja nägi brauseris (`npm run demo`):** joon kolme loo all, „Joon üles/alla“ koos teatega, keelatud nupp servas, loo tõstmine üle joone (joon jääb paigale), eemaldamine ja uuesti lisamine, F5 järel sama koht. Piiramine (salvestatud koht > lugude arv) on ainult automaattestiga kaetud.

### L18 · Kriteeriumide kontrollitavuse kontroll (S)
*Projektijuhina soovin hoiatust mittekontrollitava kriteeriumi kohta, et iga kriteeriumile saaks vastata jah või ei.*
- Hinnangulist sõna sisaldav kriteerium saab hoiatuse.
- Hinnangusõnade loend (kasutajasõbralik, kiire, lihtne, mugav, intuitiivne, selge jne) on koodis ühes kohas.
- Mitut tingimust ühendav kriteerium („ja“, „ning“, „või“) saab hoiatuse.
- Hoiatus nimetab sõna, mis probleemi tekitas.
- Server kontrollib AI pakutud kriteeriume sama reegliga.
- Reeglit mitte läbiv AI kriteerium saadetakse üks kord AI-le ümbersõnastamiseks.
- Õpetaja tabeli neli mittekontrollitavat näidet saavad automaattestis hoiatuse.
- Õpetaja tabeli neli kontrollitavat näidet ei saa automaattestis hoiatust.

**Seis 01.10.2026 (L18 osaliselt):** hinnangusõnade ja „ja/ning/või“ hoiatus on olemas (`shared/criteria-check.js`, server ja brauser kasutavad sama reeglit; õpetaja tabeli 4 + 4 näidet on automaattestis). 

**Seis 02.10.2026 – AI enesekontroll (L18 lõpetatud):** kui AI vastus on muus mõttes juba kontrollitud ja jõuaks kasutajani, kuid sisaldab `checkCriterion` järgi mittekontrollitavaid kriteeriume, saadab server need **ühe** automaatse päringuga ümbersõnastamiseks (`server/ai/tasks/criteria-fix.js`, `maxAttempts: 1` – kordust ei tehta). Päringus on loo pealkiri, kriteerium, täpne hoiatus ja vajadusel mockup'i element. Server kontrollib uue teksti uuesti: kontrollitav ja mittekorduv tekst asendab algse (märge „AI parandas“ koos algse tekstiga); endiselt vigane tekst jääb algsel kujul nähtavaks hoiatusega „AI ei suutnud kriteeriumi kontrollitavaks sõnastada – muuda või eemalda see“; AI tõrke korral „Automaatne kontroll jäi tegemata“. Tõrge põhiettepanekut ei katkesta. Kaetud on kõik kriteeriume pakkuvad AI ülesanded: kriteeriumide ettepanek (L09), kliendi täpsustus (L11) ja ülevaatuse „kriteeriumid puuduvad“ / „mittekontrollitav“ ettepanekud (L27). Käsitsi muudetud kriteeriumi juures märget ei näidata. Märge on ettepaneku payload'is, migratsiooni pole. **Automaattestid:** AI-kutset pole, kui kõik on kontrollitavad; parandus asendab, vigane või korduv parandus jätab algse; tõrke ja vigase vastuse korral täpselt üks päring; kriteeriumide, täpsustuse ja ülevaatuse route'id; märgete renderdus. **Arendaja nägi brauseris (demobaasi koopia, käsitsi koostatud näidisettepanek, AI väljas):** „AI parandas“ koos algse tekstiga, parandamata kriteeriumi hoiatus koos Muuda/Eemalda, märke kadumine käsitsi muutmisel. **Pooleli:** päris AI-ga katsetamata; hoiatuste erinev taane on teadlik kujunduspisiasi.

### L19 · Staatused ja Definition of Ready (M)
*Projektijuhina soovin, et lugu saaks staatuse „Valmis arenduseks“ ainult siis, kui see vastab valmisoleku definitsioonile, et arendajad saaksid ainult valmis lugusid.*
- Lool on staatused Idee, Vajab täpsustamist, Läbivaadatud ja Valmis arenduseks.
- Loole saab määrata, kas see puudutab vaadet.
- AI pakub „puudutab vaadet“ väärtuse ja kasutaja saab seda muuta.
- Staatust „Valmis arenduseks“ ei saa anda, kui mõni DoR tingimus on täitmata:
  - rolli, tegevuse ja kasu väljad on täidetud;
  - kriteeriume on vähemalt kolm;
  - kõik kriteeriumid läbivad kontrolli L18;
  - vaadet puudutaval lool on mockup;
  - avatud küsimusi ei ole.
- Keeldumisel näitab rakendus iga täitmata tingimust eraldi.
- Server keeldub DoR-ile mittevastavat lugu valmis märkimast ka otse API kaudu.

**Seis 01.10.2026 (L19 osaliselt):**
- **Tehtud:** backlog'i loo all „Valmisolek ja küsimused“: staatuse valik, DoR-i kontrollnimekiri ✓/✗ põhjustega (`shared/dor.js`, sama loogika serveris ja brauseris); „Valmis arenduseks“ on valikus keelatud ja server keeldub (409 koos puuduste loendiga), kui DoR pole täidetud.
- **Hilisem muudatus:** valmisolek arvutatakse iga lugemise ajal. Kui „Valmis arenduseks“ loo DoR hiljem rikutakse (nt kriteerium muutub mittekontrollitavaks), näidatakse „valmisolek aegunud“ ja lugu ei loeta valmis olevaks (`readiness.ready = false`). Staatust automaatselt ei muudeta – kasutaja parandab puuduse või valib uue staatuse. Valitud nii, et ükski muutmise koht (kriteeriumid, seosed, täpsustus, mockup, küsimused) ei saaks kontrolli vahele jätta.
- **Arendaja nägi brauseris (`npm run demo`):** avatud küsimusega loo „Valmis arenduseks“ on valikus hall („DoR pole täidetud“); pärast „Vastatud“ jääb staatus „Vajab täpsustamist“ ja DoR on täidetud; käsitsi valitud „Valmis arenduseks“ salvestub ja on F5 järel alles.
- **Ainult automaattestiga kaetud:** iga DoR tingimus eraldi, serveri 409 keeldumine otse API kaudu, aegumine pärast kriteeriumi muutmist („valmisolek aegunud“), vigased päringud.
- **Pooleli:** „puudutab vaadet“ väärtust ei saa muuta (kõik lood on praegu vaadet puudutavad).

### L20 · Täpsustamist vajav lugu ja avatud küsimused (S)
*Projektijuhina soovin märkida ebaselge loo täpsustamist vajavaks ja lisada sellele küsimuse, et kliendile esitatavad küsimused ei ununeks.*
- Loole saab määrata staatuse „Vajab täpsustamist“.
- Loole saab lisada avatud küsimuse.
- Avatud küsimuse saab märkida lahendatuks.
- Avatud küsimusega lugu ei saa staatust „Valmis arenduseks“.
- Avatud küsimused on AI päringu kontekstis.

**Seis 01.10.2026 (L20 osaliselt):** „Vajab täpsustamist“ saab määrata käsitsi ka ilma küsimuseta; küsimuse lisamine määrab selle staatuse automaatselt; küsimuse saab märkida vastatuks (jääb läbikriipsutatult alles). Vastatuks märkimine staatust ei muuda – „Valmis arenduseks“ määrab kasutaja ise. Andmebaasi migratsioon v9 (tabel `story_questions`). Brauseris nähtud: küsimuse lisamine → „Vajab täpsustamist“, „Vastatud“ → küsimus jääb läbikriipsutatult alles, staatus ei muutu. **Pooleli:** avatud küsimused ei ole veel AI päringu kontekstis; „Vajab täpsustamist“ käsitsi määramine ilma küsimuseta on ainult automaattestiga kaetud.

### L21 · Viimase muudatuse tagasivõtmine (M)
*Projektijuhina soovin viimase muudatuse tagasi võtta, et eksimus kliendi ees ei oleks lõplik.*
- Backlog'is on nupp „Võta tagasi“.
- Nupp tühistab viimase käsitsi muudatuse.
- Nupp tühistab viimase rakendatud AI ettepaneku.
- Nupp tühistab viimase jagamise.
- Nupp tühistab viimase ühendamise.
- Nupu juures on kirjas, milline muudatus tagasi võetakse.
- Tagasivõtmine töötab ka pärast lehe värskendamist.
- Kui tagasi võetavat muudatust ei ole, on nupp keelatud.

### L22 · Mockup'i versioonid ja mitu mockup'i loo kohta (S)
*Projektijuhina soovin näha mockup'i varasemaid versioone ja vajaduse korral mõne taastada, et ükski kliendiga arutatud variant ei kaoks.*
- Mockup'i juures on versioonide loend.
- Loendis on iga versiooni aeg.
- Loendis on iga versiooni muutmise põhjus.
- Iga vana versiooni saab eelvaates avada.
- „Taasta“ loob vanast versioonist uue versiooni.
- Ühtegi versiooni ei kustutata.
- Lugu saab siduda rohkem kui ühe mockup'iga.

**Seis 01.10.2026 (L22 osaliselt):** kinnitatud mockup'id salvestuvad versioonidena (1, 2, …) ja eelmine versioon jääb alles. Mockup'i all on lahti volditav „Varasemad versioonid“ (iga versiooni eelvaade) ja „Taasta see versioon“: taastamine loob **uue** versiooni, vanu ridu ei muudeta; kriteeriumide viited taastatud versiooni elementidele viiakse uuele versioonile, teised viited jäävad aegunuks; kooskõla ülevaatus aegub. Ainult alustamise loo mockup, AI-d ei kasutata. **Automaattestid:** uus versioon, ajalugu muutmata, viited, aegunud ülevaatus, keeldumised (praegune/olematu versioon, teine lugu, teine projekt). **Arendaja nägi brauseris (demobaas):** versioonide loend, versiooni 1 taastamine uue versioonina 3, ajalugu (2 ja 1) alles, telefoninumbri kriteeriumi „pole vastet“ hoiatus ja ülevaatuse soovitus. **Teadaolev piirang:** sama sisuga versiooni (nt juba taastatud v1) saab uuesti taastada – tekib koopia. 

**Seis 02.10.2026 – mitu mockup'i (vaadet) loo kohta:** migratsioon v12 lisab veeru `mockups.view_no` (senised mockup'id on vaade 1). Lool võib olla vaade 1, 2, …, igaühel oma versioonid, ajalugu ja taastamine; taastatud versioon jääb samasse vaatesse. Versiooni number on loo piires ühine kõigile vaadetele (`UNIQUE(story_id, version)` kehtib), seega kriteeriumi seos (`ref_version`) määrab ühemõtteliselt ka vaate – seoseid üle viia polnud vaja. Kooskõla: seos kehtib oma vaate uusima versiooni vastu, „pole vastet“ otsitakse kõigi vaadete elementidest, mitme vaatega on seose sildil „Vaade N · …“ ja ülevaatus arvestab kõigi vaadete versioone (ühe vaatega on tulemus sama mis enne). „Mockup olemas“ (DoR, ülevaatuse leid, etapp, AI kontekst) arvestab ükskõik millist vaadet. „Kriteeriumid ja mockup“ kaardil on vaated pealkirjaga „Vaade N: …“ ja „Seo ise“ valik vaadete kaupa. **Kliendi täpsustus muudab praegu ainult vaadet 1** (märge on lisavaate juures); üle tuleva kriteeriumi seos vaate 2+ elemendiga säilib. Lisavaade tekib L24 eelvaate valikust „Lisavaade olemasolevale loole“. **Automaattestid:** migratsioon v11 → v12 (seosed ja versioonid samad) ja v5 → v12; versioonid ei kattu eri vaadete vahel; kaks vaadet (seosed, sildid, lisavaated vastuses), seos vaate 2 elemendiga, vaate 2 taastamine ei puuduta vaadet 1, täpsustus säilitab vaate 2 seose, renderdus (vaadete pealkirjad, ühine taastamisnumber, grupeeritud valik, aegunud seose õige vaade, ülevaatuse tekst). **Arendaja nägi brauseris (demobaasi koopia, vaade 2 lisatud skriptiga):** kaks vaadet ajalooga, „Vaade 2 · …“ silt, grupeeritud „Seo ise“, vaate 2 taastamine v4 → v6 (vaade 1 jäi v3-le), piirangu märge, ülevaatuse tekst mõlema vaatega. **Teadaolevad piirangud:** taastamisel liiguvad uuele versioonile ainult taastatava versiooni seosed – asendatava versiooni seosed aeguvad ja tuleb uuesti siduda; „Seo ise“ menüüst sama elemendi uuesti valimine aegunud seost ei uuenda (vali vahepeal teine element); salvestatud ülevaatuse rida („Vaatasid üle: mockup'i versioon N“) näitab vaate 1 versiooni.

### L23 · Kriteeriumide ja mockup'i kooskõla (M)
*Projektijuhina soovin, et iga vaadet puudutav kriteerium oleks mockup'is nähtav, et kavand ja kokkulepe ei läheks lahku.*
- Iga vaadet puudutav kriteerium viitab ühele mockup'i elemendile.
- Server kontrollib, et viidatud element on mockup'is olemas.
- Kriteerium, mis nimetab nuppu, peab viitama `button`-tüüpi elemendile.
- Kui see nii ei ole, näitab rakendus hoiatust.
- Kui vaadet puudutaval kriteeriumil ei ole mockup'is vastet, näitab rakendus hoiatust.
- Rakendus ei märgi kriteeriumi ja mockup'i kooskõla kinnitatuks ainult viidatud id olemasolu põhjal.
- Kooskõla kinnitab kasutaja ise.
- Kliendi täpsustuse rakendamisel tehakse viidete kontroll uuesti.

**Seis 01.10.2026: L23 on pooleli (piiratud teostus).** Kontrollitud testandmebaasis, projekt 101.
- **Mis on olemas:**
  - kriteeriumil on viide mockup'i elemendile või märge „ei puuduta vaadet“ koos allikaga (AI või kasutaja); AI viitab elemendile teksti järgi ja server seob ainult ühese vaste korral;
  - kontrollimist vajavad hoiatused („Kontrolli: …“, mitte kindel otsus): pole vastet, põhjendamata interaktiivne element, nuppu nimetav kriteerium mitte-nupul, aegunud viide, võimalik vale AI seos;
  - AI seos ega AI hinnang „ei puuduta vaadet“ ei kustuta hoiatust – seda teeb ainult kasutaja enda seos („Seo ise“ või „Kinnitan selle seose“);
  - mockup'is on kriteeriumide märgised (K1, K2 …);
  - ülevaatuse kinnitus on kasutaja kinnitus konkreetsele seisule (kriteeriumid, viited ja nende allikas, mockup'i versioon), mitte automaatne tõend täieliku kooskõla kohta; see aegub, kui seis muutub.
- **Arendaja nägi brauseris:**
  - projekti 101 vana vastuolu: kinnitusteadet nõudval kriteeriumil „pole vastet“, nupp „Salvesta“ ja väljad „Eesnimi“, „Perekonnanimi“ „põhjendamata“;
  - kliendi täpsustuse eelvaates AI tekstiviited (pärast parandust õigete elementidega) ja nähtav „Eemaldub“ silt;
  - „Seo ise“ ja AI seose kinnitamine („Kinnitan selle seose“), mille järel seose allikas on „sina“;
  - ülevaatuse aegumine pärast mockup'i muutumist (täpsustus) ja pärast seose kinnitamist;
  - hoiatuste arvu värskendumine täpsustuse kaardil pärast seose muutmist (ilma lehte värskendamata).
- **Ainult automaattestiga kaetud (brauseris proovimata):** aegunud sõrmejäljega ülevaatuse keeld (`stale_review`); vigase sidumise tagasilükkamine (olematu element, teise projekti kriteerium, tundmatu liik). Samuti hoiatused „võimalik vale AI seos“ ja „nuppu nimetav kriteerium mitte-nupul“ – katsetes neid olukordi brauseris ette ei tulnud.
- **K3 („… kuvatakse kinnitusteade 'Taotlus on esitatud'“):** hoiatus „pole vastet“ kadus **arendaja käsitsi lisatud seose tõttu**, mitte automaatse semantilise kontrolli tulemusena. Rakendus ei mõista, et tekst „Taotlus on esitatud“ on kinnitusteade; sõnapõhine kontroll otsis sõna „kinnitusteade“.
- **Katses leitud ja parandatud vead:** AI numbrilised viited olid nihkes (mudel loendas 1-st) – asendatud tekstiviidetega; „Eemaldub“ silt jäi nupu alla peitu; täpsustuse kaart näitas vana hoiatuste arvu; AI seost sai kinnitada ainult kahe valikuga.
- **Teadaolevad piirangud:**
  - kood ei hinda seose sisulist õigsust ega mõista tähendust (sünonüümid, ümbersõnastused, „kinnitusteade“ vs „Taotlus on esitatud“);
  - võimaliku vale AI seose hoiatus põhineb sõnatüvedel: see ei taba valet seost, kui kriteerium nimetab seotud elementi muus tähenduses;
  - elemendi sisu (nt „hind eurodes“ vs „30“), paigutust ja nähtavuse tingimusi („pärast vajutamist“) ei kontrollita;
  - kasutaja enda seos kõrvaldab hoiatuse ka siis, kui seos on vale – see on inimese otsus;
  - mockup'i elemendi esiletõst kriteeriumile osutades (valikuline lisavõimalus) ei ole tehtud.

### L24 · Uue vaate loomine promptist (M)
*Projektijuhina soovin kirjeldada uue vaate ühe lausega ja saada korraga mockup'i, loo ja kriteeriumid, et klient näeks ideed kohe.*
- Rakenduses on väli „Kirjelda uut vaadet“.
- AI tagastab ühe vastusena mockup'i, Connextra vormis loo ja kriteeriumid.
- Enne backlog'i lisamist näeb kasutaja eelvaadet nuppudega [Lisa backlog'i], [Muuda] ja [Loobu].
- Backlog'i lisatud lugu on mockup'iga seotud.

**Seis 02.10.2026 (L24 tehtud):** kaart „Uus vaade“ (kriteeriumide kaardi järel) ja väli „Kirjelda uut vaadet“. AI annab ühe vastusega mockup'i (komponentide loend), Connextra vormis loo ja 3–6 kriteeriumi koos viidetega mockup'i elementidele (`server/ai/tasks/new-view.js`; skeem, Connextra, korduste ja komponenditüüpide kontroll, L18 enesekontroll). Ettepanek jääb ootele (`ai_proposals`, `kind = 'new_view'`) – midagi ei salvestata enne kinnitust. Eelvaates on lugu, kriteeriumid seose ja hoiatustega, mockup ning sihtkoha valik; nupud **[Lisa] [Muuda] [Loobu]**. **Lisa** kas (a) loob uue loo backlog'i lõppu (MVP joone alla) koos mockup'i (vaade 1, versioon 1) ja seotud kriteeriumidega või (b) lisab olemasolevale loole **uue vaate** (L22) ja kriteeriumid loo lõppu – loo sõnastust ega vaadet 1 ei muudeta. Vaate number ja versioon arvutatakse serveris rakendamise tehingu sees; klient neid ei määra. **Muuda**: loo väljad ja kriteeriumide tekstid; muudetud kriteeriumi juures vana AI enesekontrolli märget ei näidata (hoiatus arvutatakse uue teksti järgi). Kordus, 10 piir, teise projekti lugu ja topeltrakendamine lükatakse tagasi; AI tõrke korral ettepanekut ei looda. Migratsiooni pole. **Päris AI** nõuab seadistatud AI-teenust (serveri arvutis sisse logitud Claude Code, `AI_PROVIDER=claude-cli`); ilma selleta annab „Paku vaade (AI)“ veateate. **Automaattestid (võlts-AI):** uus lugu, lisavaade (vaade 1 baidi pealt sama), Muuda/päritolu/piirangud/Loobu, AI tõrge ja kordus, eelvaate renderdus. **Arendaja nägi brauseris (käsitsi koostatud näidisettepanek koopias `data/demo-l14.db`, AI väljas):** eelvaade, Muuda märke kadumine, lisavaade 3 olemasolevale loole (vaated 1 ja 2 muutmata), Loobu, uus lugu 5 (MVP joone all, DoR ✓). **Teadaolevad pisiasjad:** suletud „Seo ise“ menüü ei näita mitme vaate korral vaate nime enne menüü avamist; „pole vastet“ on oodatud kooskõla vihje, kui kriteeriumi sõnal pole mockup'is sõnasõnalist vastet. **Pooleli:** päris AI-ga katsetamata; mockup'i käsitsi muuta ei saa.

### L25 · Loo käsitsi jagamine (M)
*Projektijuhina soovin liiga suure loo käsitsi mitmeks jagada, et iga lugu oleks arendatav eraldi.*
- „Jaga“ loob valitud loost kaks või rohkem uut lugu.
- Iga algse loo kriteeriumi saab määrata täpselt ühele uuele loole.
- Uued lood tulevad backlog'is algse loo asemele.
- Jagamise saab tagasi võtta.

**Seis 01.10.2026 (L25 osaliselt):**
- **Tehtud (ilma AI-ta):** backlog'is „✂ Jaga“ jagab loo **kaheks**. Vormis on mõlema osa sõnastus ja suurus; iga kriteerium ja küsimus määratakse osale 1 või 2. Enne kinnitust näitab eelvaade mõlema osa pealkirja ja seda, mis algse looga juhtub.
- **Reeglid (sinu otsused 01.10.2026):** algne lugu jääb osaks 1 (sama id) – mockup'i versioonid, alustamise valik ja prioriteedisoovitus jäävad selle juurde; osa 2 lisatakse kohe osa 1 järele (päritolu „Käsitsi lisatud“; avatud küsimusega osa 2 saab „Vajab täpsustamist“). Osale 2 viidud kriteeriumi mockup'i seos eemaldatakse. Algse loo ootel kriteeriumide, mockup'i ja täpsustuse ettepanekud lükatakse tagasi (eelvaates kirjas). MVP joone kohal olnud loo osa 2 läheb samuti joone kohale. Midagi ei kustutata; teiste lugude sisu ei muutu, järgnevad lood nihkuvad ühe koha võrra.
- **Automaattestid:** jagamise eelvaate andmed, järjekord, teiste lugude muutumatus, kriteeriumide/küsimuste jaotus ja seosed, mockup ja alustamise lugu, ootel ettepanekud, MVP joon, vigased päringud. **Arendaja nägi brauseris (demobaas):** tühja osa 2 keeld (midagi ei salvestatud), eelvaade, alustamise loo jagamine (osa 2 kohal 5, K4 osale 2, mockup ja alustamise valik jäid osale 1, ülevaatus aegus), F5 järel sama seis. **Leitud ja parandatud:** kitsas veerus aeti osa 1 ja osa 2 väljad segi – osad on nüüd eraldi kastides („1 · Algne lugu“ hall, „2 · Uus lugu“ sinine).
- **Pooleli:** jagamine rohkem kui kaheks; algne lugu jääb osaks 1 (kriteerium „uued lood tulevad algse asemele“ on täidetud selles mõttes, et osa 1 + osa 2 on algse kohal); jagamise tagasivõtmine (L21).

### L26 · Kattuvate lugude märkimine ja ühendamine käsitsi (M)
*Projektijuhina soovin märkida kattuvad lood ning need ühendada või ühe eemaldada, et backlog'is ei oleks kordusi.*
- Kaks lugu saab märkida kattuvaks.
- Ühendamise eelvaates on üks lugu.
- Ühendatud loo kriteeriumide loendis ei ole täpseid kordusi.
- Ühendatud lugu saab enne kinnitamist muuta.
- Kattuvatest lugudest ühe saab eemaldada ja teise alles jätta.
- Ühendamise saab tagasi võtta.

**Seis 01.10.2026 (L26 osaliselt):**
- **Tehtud (ilma AI-ta):** backlog'is „⇄ Ühenda“ → teise loo valik; säilib vaikimisi eespool olev lugu („Säilita hoopis …“ vahetab). Ühendatud loo sõnastust ja suurust saab enne kinnitamist muuta. Eelvaade näitab uut pealkirja ja kohta ning kõiki muudatusi andmetes.
- **Reeglid (sinu otsused 01.10.2026):** säilitatava loo ID ja staatus jäävad; ühendatud lugu läheb kahest eespool olevale kohale, eemaldatava rida kustutatakse alles pärast andmete ülekandmist. Alustamise lugu läheb ühendatud loole. MVP: kui vähemalt üks oli joone kohal, on ühendatud lugu joone kohal (mõlema korral joone kohal üks lugu vähem). **Kriteeriumid:** kõik on vaikimisi valitud, ka sama tekstiga kirjed; duplikaadid on märgitud ja iga kirje juures on mockup'i seos; kasutaja võib duplikaadi teadlikult märkimata jätta – eelvaade nimetab selle kirje ja kaduva seose; server rakendab täpselt kinnitatud valiku. Küsimused liiguvad ühendatud loole (avatud küsimuse korral „Vajab täpsustamist“). Ainult ühe loo mockup'i versioonid liiguvad muutmata kujul; teise loo elemendiseosed eemaldatakse nähtavalt. Mõlema loo kriteeriumide/mockup'i/täpsustuse ja eemaldatava loo prioriteedi ootel ettepanekud lükatakse tagasi (eelvaates kirjas).
- **Teadaolev piirang:** kui **mõlemal** lool on mockup'i versioonid, ühendamist ei tehta (vorm ja server keelduvad selge teatega), sest mõlema ajaloo turvaline ühendamine puudub. Teisi lugusid saab ühendada.
- **Automaattestid:** eelvaate andmed (duplikaadid, seosed), säilitatav ID ja koht, täpne kriteeriumide valik, küsimused ja mockup, teiste lugude muutumatus, alustamise lugu, MVP, mockup'i keeld, ootel ettepanekud, vigased päringud. **Arendaja nägi brauseris (demobaas):** loo 5 ühendamine alustamise looga 4 – säilitatav lugu ja eelvaade, märkimata kriteeriumi nimetamine eelvaates, tulemus (lugu 4 jäi alustamise looks, 4 kriteeriumi, mockup v3, backlog'is 4 lugu), F5 järel sama seis. Mõlema mockup'iga lugude keeld on ainult automaattestiga kaetud (demos on mockup ühel lool). **Parandatud:** eelvaade ütles „järgnevad lood nihkuvad“ ka siis, kui eemaldatav (või jagatav) lugu oli viimane.
- **Pooleli:** kattuvaks märkimine eraldi tegevusena; „kriteeriumide loendis ei ole täpseid kordusi“ sõltub kasutaja valikust (duplikaadid on vaikimisi alles ja märgitud); tagasivõtmine (L21).

### L27 · AI ülevaatus ja leiud (L)
*Projektijuhina soovin käivitada AI ülevaatuse, et backlog'i probleemid leitaks enne arendust.*
- Backlog'is on nupp „Vaata backlog üle“.
- Kood leiab lood, mis ei ole Connextra vormis.
- Kood leiab lood, millel pole kriteeriume.
- Kood leiab lood, millel on mittekontrollitav kriteerium.
- Kood leiab vaatelood, millel pole mockup'i.
- AI leiab liiga suured lood (mitu rolli, mitu eraldi tegevust või palju kriteeriume).
- AI leiab sisuliselt kattuvad lood.
- Igal leiul on probleem, põhjendus ja konkreetne ettepanek.
- Iga leiu juures on nupud [Rakenda], [Muuda] ja [Ignoreeri].
- Ülevaatuse käivitamine ei muuda backlog'i.
- Pärast „Ignoreeri“ vajutamist on backlog muutumata.
- Iga viie leiutüübi kohta on automaattest, milles on meelega vigane lugu.
- Meelega lisatud liiga suur lugu tuleb leiuna välja.

**Seis 02.10.2026:** backlog'is on nupp „Vaata backlog üle“. Kood leiab tüübid 1–4 (vorm, kriteeriumid puuduvad, mittekontrollitav kriteerium, vaatelool pole mockup'i) ka ilma AI-ta; AI annab neile parandused ning leiab liiga suured ja kattuvad lood. Ülevaatus salvestatakse `ai_proposals` tabelisse (`kind = 'review'`), migratsiooni pole. **Rakenda / Muuda:** vorm → uus sõnastus; kriteeriumid puuduvad → kriteeriumide lisamine; mittekontrollitav → kriteeriumi asendamine; mockup puudub → AI soovitus „märgi mitte-vaatelooks“ või „lisa küsimus „Vajab mockup'i““ on kaardil enne rakendamist näha (AI-ta otsust ei tehta, kasutaja valib „Muuda“ all); liiga suur → olemasolev jagamisvorm (L25) AI osadega; kattuvad → olemasolev ühendamisvorm (L26). Leid märgitakse rakendatuks alles pärast vormis kinnitamist. Pärast ülevaatust muutunud loo leid on aegunud ja seda ei rakendata. AI-le saadetakse projekti nimi, vestlus, rollid, lood koos staatuse, suuruse, kriteeriumide, avatud küsimuste ja mockup'i olemasoluga ning koodi leiud; mockup'i sisu ja pooleli ettepanekuid ei saadeta. AI tõrke korral kuvatakse koodi leiud ja märge, et liiga suuri ja kattuvaid lugusid ei kontrollitud. **Automaattestid:** kõik kuus leiutüüpi meelega vigastest lugudest (võlts-AI), backlog muutumata pärast käivitamist ja „Ignoreeri“, Rakenda/Muuda, vigase AI viite väljajätmine, AI-ta režiim, aegunud leid, jagamise järel märkimine, paneeli renderdus. **Arendaja nägi brauseris (demobaasi koopia, AI väljas, 02.10.2026):** koodi leiud, „Muuda“ → „Vajab mockup'i“ küsimus ja staatus, „Ignoreeri“ backlog'i muutmata, kerimine esimese leiuni, „Mida teeme edasi?“ nupp viib ülevaatusnupu juurde. **Pooleli:** päris AI-ga katsetamata; `npm run demo` näidisülevaatust pole (AI-ta ülevaatus töötab koodi leidudega).

### L28 · AI jagamisettepanek eelvaatega (M)
*Projektijuhina soovin näha AI jagamisettepanekut koos jaotatud kriteeriumidega, et saaksin selle enne rakendamist üle vaadata.*
- Eelvaates on uued lood ja igaühe kriteeriumid.
- Server kontrollib, et iga algne kriteerium on täpselt ühes uues loos.
- Eelvaade hoiatab, kui uus lugu kattub mõne olemasoleva looga.
- Pärast „Rakenda“ vajutamist asendatakse algne lugu uutega.
- „Muuda“ lubab lugusid ja kriteeriumide jaotust enne rakendamist muuta.
- Jagamise saab tagasi võtta.

**Seis 02.10.2026:** AI jagamisettepanek tuleb ainult L27 ülevaatuse leiust „Liiga suur lugu“ (eraldi AI-kutset ega nuppu pole). AI annab kahe osa tegevuse ja kasu ning kriteeriumide id-d kummalegi osale; server kontrollib, et iga algne kriteerium on **täpselt ühes** osas (puuduv, kahes osas või teise loo kriteerium → ettepanek jäetakse välja, leid jääb). Leiu kaardil on eelvaade: mõlema osa pealkiri ja kriteeriumid, mis algse looga juhtub (küsimused, mockup, alustamise lugu, MVP, ootel ettepanekud). **Rakenda** jagab kohe (sama `splitStory` loogika mis L25; osa 1 = algne lugu sama id-ga, osa 2 kohe järel); **Muuda** avab jagamisvormi AI osade ja jaotusega, mida saab muuta. **Kattuvus:** kood võrdleb sama rolli lugude tegevuse sõnade 4-tähelisi algusi (`shared/overlap.js`, käänete tõttu) ja hoiatab, kui ühiseid algusi on vähemalt kaks (ühesõnalise tegevuse korral üks); lühikesed erineva algusega sünonüümid (nt „trenni“ ja „treeningule“) võivad jääda märkamata; hoiatus „Võimalik kattuvus looga N“ on eelvaates ja vormis, jagamist see ei keela. **Tagasivõtmine (ainult ülevaatuse kaudu tehtud jagamine, migratsioonita):** enne jagamist salvestatakse leiu juurde algse loo seis; „Võta jagamine tagasi“ taastab loo samale kohale koos kriteeriumide järjestuse ja mockup'i seostega, küsimuste, staatuse, MVP joone ja alustamise looga ning eemaldab osa 2. Kui kumbki osa (sõnastus, staatus, koht, kriteeriumid, küsimused, mockup) või alustamise valik on pärast jagamist muutunud, keeldutakse ilma osalise taastamiseta. Jagamisel tagasi lükatud ootel ettepanekuid ei taastata. **Automaattestid:** AI jaotus eelvaates ja rakendamisel, vigase jaotuse väljajätmine (kolm juhtu), täpne tagasivõtmine, keeldumine muudetud osa korral, eelvaate renderdus koos kattuvushoiatusega. **Arendaja nägi brauseris (demobaasi koopia käsitsi näidisülevaatusega, 02.10.2026):** eelvaade, „Muuda“ vorm AI jaotusega, Rakenda, tagasivõtmine (andmed taastusid täpselt), kattuvushoiatus ainult kattuva osa juures (esialgne 5-täheline reegel ei märganud „hindu“/„hindadega“, 4-täheline üksiku ühise sõnaga andis valehoiatuse – parandatud). **Pooleli:** päris AI-ga katsetamata; käsitsi jagamist (L25) tagasi võtta ei saa (L21).

### L29 · AI ühendamisettepanek eelvaatega (M)
*Projektijuhina soovin näha kahe kattuva loo ühendamise ettepanekut, et backlog'is ei oleks sama nõuet kaks korda.*
- Eelvaates on ühendatud lugu ja ühendatud kriteeriumide loend.
- Server kontrollib, et iga algne kriteerium on kas ühendatud loendis või korduseks märgitud.
- Korduseks märgitud kriteeriumid on eelvaates eraldi näha koos tekstiga.
- Server lükkab tagasi ettepaneku, mis viitab olematule loole.
- Pärast „Rakenda“ vajutamist asendab ühendatud lugu mõlemad algsed lood.
- Ühendamise saab tagasi võtta.

**Seis 02.10.2026:** AI ühendamisettepanek tuleb ainult L27 ülevaatuse leiust „Kattuvad lood“ (eraldi nuppu ega AI-kutset pole). AI annab ühendatud loo tegevuse ja kasu (säilitatava loo rolliga) ning mõlema loo iga kriteeriumi kohta „keep“ või „duplicate“ koos `duplicateOf`; kriteeriumide teksti ei muudeta ega liideta. Server kontrollib, et iga algne kriteerium on täpselt üks kord ja kordus viitab alles jäävale kriteeriumile; olematule loole viitav või vigase jaotusega ettepanek jäetakse välja (leid jääb, „Muuda“ avab tühja vormi). Leiu kaardil on eelvaade: ühendatud loo pealkiri ja koht, alles jäävad kriteeriumid ning eraldi plokk „Korduseks märgitud – eemaldatakse“ mõlema tekstiga (eemaldatav ja säiliv), küsimused, mockup, kaduvad elemendiseosed, alustamise lugu, MVP, ootel ettepanekud. **Rakenda** ühendab kohe L26 loogikaga (säilitatava loo id ja staatus, avatud küsimuse korral „Vajab täpsustamist“, koht eespool olev, vaadet puudutav kui kumbki puudutas). Mockup ainult ühel lool ei takista – see säilib ja teise loo elemendiseosed eemaldatakse nähtavalt; mõlemal → keeldumine. **Muuda** avab ühendamisvormi AI sõnastusega; AI kordused on märkimata sildiga „AI: sisuline kordus“, kasutaja saab need tagasi märkida; ühendada saab ainult leiu kaht lugu. Rakendamisel kontrollitakse uuesti, et mõlemad lood on olemas ja leid pole aegunud (pealkirjad ning kriteeriumide id-d ja tekstid samad). **Tagasivõtmine (ainult ülevaatuse kaudu tehtud ühendamine, migratsioonita):** kui ühendatud lugu (sõnastus, staatus, kriteeriumid, küsimused, mockup), lugude järjekord, MVP joon ja alustamise lugu pole pärast ühendamist muutunud, taastatakse mõlemad lood samade id-dega koos kriteeriumide (ka eemaldatud), järjekorra, seoste, küsimuste, mockup'i, staatuste, MVP joone ja alustamise looga; muidu keeldutakse ilma osalise taastamiseta. Ootel ettepanekuid ei taastata. **Automaattestid:** ettepaneku järgi ühendamine (kordus eemaldatud, mockup ühelt loolt koos seosega, küsimus, alustamise lugu, MVP), täpne tagasivõtmine, vigane jaotus (kolm juhtu), mõlema mockup'i keeld, keeldumine muudetud loo korral, eelvaate renderdus korduste plokiga. **Arendaja nägi brauseris (demobaasi koopia käsitsi näidisülevaatusega, 02.10.2026):** eelvaade koos korduste plokiga (mõlemad tekstid), „Muuda“ vorm AI sõnastuse ja märkimata kordusega, korduse eemaldamise tühistamine (eemaldatakse 1 → 0), Rakenda (4 lugu, uus sõnastus, „Vajab täpsustamist“), tagasivõtmine (lood, kriteeriumid, küsimused, mockup'id ja projekti väljad identsed ühendamiseelse seisuga). **Ainult automaattestiga kaetud:** vigase jaotuse väljajätmine, mõlema mockup'i keeld, mockup'i ja seose kaasatulek ühelt loolt, keeldumine muudetud loo korral. **Pooleli:** päris AI-ga katsetamata; käsitsi ühendamist (L26) tagasi võtta ei saa (L21).

### L30 · Esitatavad dokumendid ja demo (M)
*Õpilasena soovin täielikku esituspaketti, et õpetaja saaks töö käivitada ja hinnata.*
- L01 minimaalne README on lõplikult täiendatud.
- README-s on käivitusjuhis.
- README-s on keskkonnamuutujate selgitus.
- README-s on testide käivitamise juhis.
- README juhise järgi käivitub lõplik rakendus puhtast kloonist.
- Kasutusstsenaarium on eraldi failis `docs/kasutusstsenaarium.md`.
- Kasutusstsenaarium mahub ühele leheküljele (kuni ~450 sõna).
- Kasutusstsenaarium kirjeldab kasutust kliendiga avakohtumisel.
- Kasutusstsenaarium kirjeldab kasutust hilisemal backlog'i ülevaatusel.
- Backlog on repositooriumis koos järjestuse põhjenduse ja MVP joonega.
- Repositooriumis on ülevaade: mis töötab, mis jäi pooleli ja millised on teadaolevad AI piirangud.
- Demo stsenaarium läbib ülesandes nõutud sammud kuni 10 minutiga.
- Git'i ajaloos on iga valmis loo kohta vähemalt üks commit.

### L31–L34, L36 · Valikulised lisad, kui aega jääb
Õpetaja loetelu „Lisavõimalused (ei ole kohustuslikud)“. Neid alustatakse alles pärast L30. Vastuvõtukriteeriumid kirjutatakse enne alustamist.
- **L31:** eksport Markdowni ja CSV-sse.
- **L32:** kliendile jagatav vaatamislink.
- **L33:** story map mitme rolli kaupa.
- **L34:** kõnesisend.
- **L36:** kriteeriumile osutades tõstetakse mockup'is vastav element esile. Selle aluseks on L23 viited.

---

## Vastavus õpetaja nõuetega

### Põhifunktsioonid

| Õpetaja nõue | Lugu | Kuidas brauseris kontrollida |
|---|---|---|
| Põhimõte: AI juhib, inimene otsustab; iga ettepanekut saab muuta või tagasi lükata | L06, L09, L10, L11, L24, L27 | Muuda üht AI pakutud lugu enne lisamist ja lükka üks tagasi. Loobu mockup'ist ja täpsustusest ning veendu, et backlog ei muutunud. |
| 1. Projekti loomine ja loend | L03 | Loo projekt ja veendu, et see on loendis. |
| 1. Projekti juurde salvestatakse kõik andmed ja etapp; andmed säilivad | L01, L13 | Peata server, käivita uuesti ja ava projekt: kõik on alles. |
| 1. Jätkamine samast kohast | L13 | Katkesta töö kriteeriumide etapis ja ava projekt uuesti: pakutakse kriteeriumide jätkamist. |
| 2. Algus ühest promptist | L04 | Uue projekti ainus sisend on üks tekstiväli. |
| 2. 1–3 küsimust, „Muu“ ja „Jäta vahele“ | L04 | Sisesta umbmäärane lause ja vaata nuppe. |
| 2. Rollid: vali, lisa, eemalda | L05 | Lisa roll „Treener“, eemalda üks ja vaata, et lugudes on ainult kinnitatud rollid. |
| 2. Lood happy path'i järjekorras ja valik | L06 | Kaardid on nummerdatud. Eemalda üks märge ja kasuta „Lisa valitud“. |
| 2. Prioriteedi küsimine ja soovitus | L08 | Soovitus koos põhjendusega ja kaks valikunuppu on näha. |
| 2. Järgmine samm 1–4 valikuga | L13 | Iga AI vastuse all on 1–4 nuppu. |
| 2. Nähtavad etapid, vahelejätmine ja tagasiminek | L14 | Klõpsa ribal varasemale etapile ja kasuta „Jäta vahele“. |
| 2. Vabatekst on alati lubatud | L04, L05 | Kirjuta nuppude asemel „lisa ka treener“ ja vaata, kas treener ilmub rollidesse. |
| 2. AI arvestab projekti tegelikku seisu | L02, L15 | Muuda lugu käsitsi, küsi AI-lt ettepanekut ja vaata, kas ta kasutab uut sõnastust. |
| 2. Struktureeritud vastus, valideerimine ja kordus | L02 | Automaattest võltsitud vigase vastusega; brauseris on näha veateade ja nupp „Proovi uuesti“. |
| 3. Loo väljad | L06, L15, L19, L20 | Ava loo detailvaade ja veendu, et kõik väljad on olemas. |
| 3. Käsitsi haldus ka AI tõrke korral | L15 | Käivita `npm run demo` (AI välja lülitatud) ja lisa, muuda ning kustuta lugu. |
| 3. Järjestamine lohistades | L16 | Lohista lugu teise kohta ja värskenda lehte. |
| 3. MVP joon | L17 | Paiguta joon ja värskenda lehte. |
| 3. Definition of Ready | L18, L19, L23 | Proovi lugu kahe kriteeriumiga valmis märkida: näed puuduste loendit. |
| 3. Tagasivõtmine | L21 | Kustuta lugu ja kasuta „Võta tagasi“. |
| 4. Mockup loost või promptist | L10, L24 | Vali lugu. Seejärel kirjelda uus vaade ja vaata, kas tekivad kavand, lugu ja kriteeriumid. |
| 4. Turvaline kuvamine | L10 | Automaattest, kus mockup'is on `<script>`-tekst: see kuvatakse tekstina. |
| 4. Kriteeriumide ja mockup'i kooskõla | L23 | Kustuta mockup'ist element, millele kriteerium viitab, ja vaata hoiatust. |
| 4. Täpsustus enne/pärast eelvaatega | L11 | Sisesta täpsustus ning vaata eelvaadet ja nuppe. |
| 4. Teisi lugusid ei muudeta ja server tagab selle | L12 | Pane tähele teise loo muutmisaega. Rakenda täpsustus. Teise loo muutmisaeg on sama. Automaattest saadab teist lugu muutva päringu, mis lükatakse tagasi. |
| 4. Mockup'i versioonid | L22 | Ava versioonide loend, taasta versioon 1 ja vaata, et tekib uus versioon. |
| 5. Käsitsi groomimine | L15, L16, L20, L25, L26 | Jaga, ühenda, järjesta ja märgi lugu täpsustamist vajavaks. |
| 5. AI ülevaatus viie probleemiliigiga | L27 | Lisa meelega vigased lood ja käivita ülevaatus. |
| 5. Jagamise ja ühendamise eelvaade | L28, L29 | Rakenda leid ja vaata kriteeriumide jaotust ning korduseks märgitud kriteeriume. |
| Kriteeriumide reegel: AI enesekontroll ja hoiatus | L18 | Kirjuta kriteeriumiks „Leht on kasutajasõbralik“ ja vaata hoiatust. |
| Tehnika: võti serveris ja `.env.example` | L01, L02 | Otsi DevTools'is tokeni algust: seda ei leidu. |
| Tehnika: püsiv salvestus | L01 | Taaskäivita server. |
| Esitatavad dokumendid | L30 | Repositooriumis on `README.md`, `docs/kasutusstsenaarium.md` (kuni 1 lk), `docs/backlog.md` ja ülevaade (mis töötab, mis jäi pooleli, AI piirangud). |

### Vastuvõtukatse

| Katse | Lood | Kuidas kontrollida |
|---|---|---|
| 1. Uus projekt ja umbmäärane lause → küsimus valikutega | L03, L04 | Sisesta „Spordiklubi tahab veebi…“: tuleb küsimus koos nuppudega. |
| 2. Vähemalt viis lugu happy path'i järjekorras ja klõpsudega backlog'i | L06, L07 | Backlog'is on täpselt märgitud lood ja samas järjekorras. |
| 3. Alustamise soovitus ja järjekorra muutmine | L08, L07, L16 | Nõustu soovitusega ja tõsta lugu ümber. |
| 4. Kriteeriumid ja mockup: kinnita osa, lükka üks tagasi, muuda üht | L09, L10 | Loo detailis on ainult kinnitatud ja muudetud kriteeriumid. |
| 5. Täpsustus → eelvaade → muudatus mockup'is ja loos, teised lood muutumata | L11, L12 | Muudatus on näha mockup'is ja kriteeriumides, teised lood on muutumata. |
| 6. AI ülevaatus leiab probleemi, jagamine või ühendamine eelvaatega | L15, L27, L28, L29 | Lisa liiga suur lugu, käivita ülevaatus ja rakenda jagamine. |
| 7. Täpsustamist vajav lugu ei saa staatust „Valmis arenduseks“ | L19, L20 | Staatuse muutmine on keelatud ja põhjus on nähtav. |
| 8. Taaskäivitus → kõik on alles ja pakutakse sobivat sammu | L13 | Peata server, käivita uuesti ja ava projekt. |
| 9. Sammud 1–5 ilma ühtegi lugu või kriteeriumi nullist kirjutamata | L04–L12 | Läbi sammud ainult nuppude ja ühe täpsustuslausega. |

---

## Nõuded, mis võivad kergesti ununeda

- Uue vaate kirjeldamine promptist (L24) on eraldi nõue, mitte sama mis „mockup loole“.
- „Vaadet puudutav lugu“ vajab eraldi välja (L19), muidu ei tea DoR, millal mockup'i nõuda.
- AI peab oma kriteeriume ise kontrollima (L18). Ainult kasutajale näidatud hoiatusest ei piisa.
- „Jäta vahele“ on nõutud igal küsimusel (L04).
- Täpsustuse mõju teistele lugudele kuvatakse ainult soovitusena. Rakendamise päring, mis püüab muuta midagi peale valitud loo, lükatakse tagasi tervikuna, mitte ei rakendata osaliselt (L12).
- Iga AI ettepanekut (lugu, kriteerium, mockup, täpsustus, ülevaatuse leid) saab enne kinnitamist muuta või tagasi lükata (L06, L09, L10, L11, L24, L27).
- Tagasivõtmine peab katma ka AI ettepanekud, jagamise ja ühendamise (L21).
- Vastuvõtukatse 6 eeldab käsitsi lisamist, seega peab L15 valmis olema enne L27.
- AI ülevaatus peab katma kõik viis leiutüüpi, mitte ainult jagamise ja ühendamise (L27).
- Õpetaja nõuab kuni üheleheküljelist kasutusstsenaariumi: avakohtumine ja hilisem backlog'i ülevaatus. See läheb eraldi faili `docs/kasutusstsenaarium.md` (L30).

## Riskid

| Risk | Maandamine |
|---|---|
| AI-teenuse vastamisaeg võib kõikuda (varasema teenuse proovides 16–110 s; Sonneti esimene katse 6 s) | L35 mõõdab kogu töövoo aja enne demo otsust. Täpsustuse lühivorm (ainult muudatused) on proovimata kavand ja seda proovitakse L11 käigus. Ooteajal kuvatakse ooteindikaator. Varuks on salvestatud demovideo. |
| AI sõltub serveri arvuti Claude Code'i sisselogimisest ja tellimuse kasutuslimiidist | Käsitsi haldus töötab ilma AI-ta (L15); `npm run demo` töötab üldse ilma AI-ta. Sisselogimata ja limiidi olukorras annab rakendus selge teate. |
| AI vastustes on keelevigu ja sisulisi vigu | Iga ettepanek vajab inimese kinnitust. ✎ Muuda on alati olemas. Promptides on eeskujud. Kood kontrollib, mida saab reeglitega kontrollida. |
| Groomimine (L25–L29) on mahukas ja jääb lõppu | Groomimise jaoks on aeg eraldi reserveeritud. Käsitsi ja AI variant kasutavad sama rakendamise loogikat. |
| Tagasivõtmise loogika läheb keeruliseks | Lihtne lahendus: enne iga muudatust salvestatakse mõjutatud lugude koopia. |
| Ulatus kasvab | Valikulised lisad L31–L34 ja L36 tulevad alles pärast L30. |
