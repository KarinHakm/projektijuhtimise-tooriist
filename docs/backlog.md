# Arendustöö backlog

AI-põhine projektijuhtimise tööriist · TAK25 · üks arendaja

> **Seis 01.10.2026:** valmis on L01, L02, L03, L04 ja L05. L06 on **Pooleli**: brauseris on proovimata „Paku teistsuguseid“ õnnestunud asendus. Ülejäänud lugude staatus on **Plaanitud**.
> Lugu märgitakse **Valmis** alles siis, kui selle kõik kriteeriumid on brauseris läbi proovitud, reeglipõhise loogika kohta on olemas automaattest ja muudatus on commit'itud.

## Arhitektuur (kavandatud, esialgne)

- **Server:** Node.js 22 + Express. Kõik AI päringud käivad läbi serveri.
- **Kasutajaliides:** React (Vite). Mockup'i joonistab rakendus komponentide JSON-ist ise ja HTML-i ei sisestata kuhugi.
- **Andmed:** SQLite fail serveris. Andmed jäävad alles ka pärast serveri taaskäivitust.
- **AI:** Hetzner Experiments Inference API, mudel `Qwen3.8-27B`, mõtlemine välja lülitatud.
  - See on **esialgne arendusvalik, mitte lõplik demo otsus** (vt [ai-piirangud.md](ai-piirangud.md)).
  - Kogu AI-kood tuleb ühte serverifaili. Teist AI-teenust ei lisata.
- **Saladused:** token on ainult serveri `.env` failis, mis on `.gitignore`-is. Repos on ainult `.env.example`, kus on muutujate nimed.
- **Testid:** automaattestid asendavad AI kutse võltsvastusega. Rakenduses mock-režiimi lülitit ei ole.

## Järjestus ja MVP joon

| # | Lugu | Suurus | Liik | Vastuvõtukatse | Staatus |
|---|---|---|---|---|---|
| L01 | Rakenduse karkass ja püsiv andmebaas | M | Kohustuslik | – | Valmis |
| L02 | Serveripoolne ja valideeritud AI-kiht | M | Kohustuslik | – | Valmis |
| L03 | Projektide loomine ja loend | S | Kohustuslik | 1 | Valmis |
| L04 | Vestluse algus ühest promptist ja täpsustavad küsimused | M | Kohustuslik | 1, 9 | Valmis |
| L05 | Rollid | S | Kohustuslik | 9 | Valmis |
| L06 | Lood happy path'i järjekorras | L | Kohustuslik | 2, 9 | Pooleli |
| L07 | Backlog'i vaade ja lihtne järjestamine | S | Kohustuslik | 2, 3 | Plaanitud |
| L08 | Prioriteedisoovitus | S | Kohustuslik | 3 | Plaanitud |
| L09 | Vastuvõtukriteeriumid valitud loole | M | Kohustuslik | 4, 9 | Plaanitud |
| L10 | Turvaliselt kuvatav mockup | L | Kohustuslik | 4, 9 | Plaanitud |
| L11 | Kliendi täpsustus enne/pärast eelvaatega | L | Kohustuslik | 5, 9 | Plaanitud |
| L12 | Server muudab ainult valitud lugu | M | Kohustuslik | 5 | Plaanitud |
| L13 | Järgmise sammu pakkumine ja jätkamine samast kohast | M | Kohustuslik | 8 | Plaanitud |
| | **═══ MVP JOON ═══** | | | | |
| L35 | Vastuvõtukatse töövoo ajamõõtmine päris rakenduses | S | Kohustuslik | – | Plaanitud |
| L14 | Sammude riba | S | Kohustuslik | – | Plaanitud |
| L15 | Käsitsi backlog'i haldus, ka AI tõrke korral | M | Kohustuslik | 6 | Plaanitud |
| L16 | Järjestamine lohistades | S | Kohustuslik | 3 | Plaanitud |
| L17 | MVP joon | S | Kohustuslik | – | Plaanitud |
| L18 | Kriteeriumide kontrollitavuse kontroll | S | Kohustuslik | – | Plaanitud |
| L19 | Staatused ja Definition of Ready | M | Kohustuslik | 7 | Plaanitud |
| L20 | Täpsustamist vajav lugu ja avatud küsimused | S | Kohustuslik | 7 | Plaanitud |
| L21 | Viimase muudatuse tagasivõtmine | M | Kohustuslik | – | Plaanitud |
| L22 | Mockup'i versioonid ja mitu mockup'i loo kohta | S | Kohustuslik | – | Plaanitud |
| L23 | Kriteeriumide ja mockup'i kooskõla | M | Kohustuslik | – | Plaanitud |
| L24 | Uue vaate loomine promptist | M | Kohustuslik | – | Plaanitud |
| L25 | Loo käsitsi jagamine | M | Kohustuslik | – | Plaanitud |
| L26 | Kattuvate lugude märkimine ja ühendamine käsitsi | M | Kohustuslik | – | Plaanitud |
| L27 | AI ülevaatus ja leiud | L | Kohustuslik | 6 | Plaanitud |
| L28 | AI jagamisettepanek eelvaatega | M | Kohustuslik | 6 | Plaanitud |
| L29 | AI ühendamisettepanek eelvaatega | M | Kohustuslik | 6 | Plaanitud |
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
- Brauseri Network-vahekaardil ei ole ühtegi päringut aadressile `inference.hetzner.com`.
- Hetzneri token ei esine üheski brauserisse saadetud failis.
- Hetzneri token ei esine üheski serveri vastuses.
- Server saadab iga AI päringuga kaasa etapi JSON-skeemi.
- Server saadab iga AI päringuga kaasa sätte, mis mudeli mõtlemise välja lülitab.
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

### L07 · Backlog'i vaade ja lihtne järjestamine (S)
*Projektijuhina soovin näha backlog'i vestluse kõrval, et näeksin kohe, mida vestlus muutis.*
- Backlog'i paneel on projekti vaates vestluse kõrval.
- Iga rea juures on järjekorranumber, pealkiri, staatus, suurus ja päritolu.
- Backlog uueneb pärast lugude lisamist ilma lehte värskendamata.
- Lugu saab nuppudega ↑ ja ↓ ümber tõsta.
- Muudetud järjekord püsib pärast lehe värskendamist.

### L08 · Prioriteedisoovitus (S)
*Projektijuhina soovin AI põhjendatud soovitust, millisest loost alustada, et kliendiga kiiresti kokku leppida.*
- Pärast lugude lisamist küsib AI, milline lugu on kõige olulisem.
- AI soovitab ühe konkreetse loo koos põhjendusega.
- Server kontrollib, et soovitatud lugu on selle projekti backlog'is olemas.
- Soovituse juures on nupud [Nõus, alustame sellest] ja [Valin ise teise].
- „Valin ise teise“ avab backlog'i lugude valiku.
- Valitud lugu saab backlog'is märgi „Alustame sellest“.

### L09 · Vastuvõtukriteeriumid valitud loole (M)
*Projektijuhina soovin, et AI pakuks valitud loole kriteeriumid ja et saaksin igaühe kinnitada, muuta või eemaldada, et kriteeriumid oleksid kliendiga kokku lepitud.*
- AI pakub valitud loole 3–6 kriteeriumi.
- Iga kriteeriumi juures on nupud ✓ Nõus, ✎ Muuda ja ✗ Eemalda.
- ✎ avab kriteeriumi teksti samas kohas muutmiseks.
- Kriteeriumide all on nupud [Kinnita kõik] ja [Lisa kriteerium].
- Lool on salvestatud ainult kinnitatud või muudetud kriteeriumid.
- Eemaldatud kriteerium ei ole loo juures salvestatud.

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
- Mõõtmiste põhjal on kirja pandud otsus, kas jääda Hetzneri juurde või vahetada üks kiirem tasuline teenus.

### L14 · Sammude riba (S)
*Projektijuhina soovin näha protsessi etappe ja nende vahel liikuda, et saaksin etappe vahele jätta või varasema juurde tagasi minna.*
- Ribal on etapid Idee → Rollid → Lood → Prioriteedid → Kriteeriumid ja mockup → Täpsustused → Groomimine.
- Hetkeetapp on esile tõstetud.
- Varasemale etapile klõpsates saab sinna tagasi minna.
- Varasemale etapile minnes andmed ei kao.
- „Jäta vahele“ viib järgmisesse etappi.
- Etapi vahetus salvestub andmebaasi.

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
- Kui AI token on vale, töötavad kõik eelnevad toimingud.
- Kui AI token on vale, näitavad AI nupud veateadet.
- AI järgmine vastus kasutab käsitsi muudetud loo uut sõnastust.

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

### L20 · Täpsustamist vajav lugu ja avatud küsimused (S)
*Projektijuhina soovin märkida ebaselge loo täpsustamist vajavaks ja lisada sellele küsimuse, et kliendile esitatavad küsimused ei ununeks.*
- Loole saab määrata staatuse „Vajab täpsustamist“.
- Loole saab lisada avatud küsimuse.
- Avatud küsimuse saab märkida lahendatuks.
- Avatud küsimusega lugu ei saa staatust „Valmis arenduseks“.
- Avatud küsimused on AI päringu kontekstis.

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

### L24 · Uue vaate loomine promptist (M)
*Projektijuhina soovin kirjeldada uue vaate ühe lausega ja saada korraga mockup'i, loo ja kriteeriumid, et klient näeks ideed kohe.*
- Rakenduses on väli „Kirjelda uut vaadet“.
- AI tagastab ühe vastusena mockup'i, Connextra vormis loo ja kriteeriumid.
- Enne backlog'i lisamist näeb kasutaja eelvaadet nuppudega [Lisa backlog'i], [Muuda] ja [Loobu].
- Backlog'i lisatud lugu on mockup'iga seotud.

### L25 · Loo käsitsi jagamine (M)
*Projektijuhina soovin liiga suure loo käsitsi mitmeks jagada, et iga lugu oleks arendatav eraldi.*
- „Jaga“ loob valitud loost kaks või rohkem uut lugu.
- Iga algse loo kriteeriumi saab määrata täpselt ühele uuele loole.
- Uued lood tulevad backlog'is algse loo asemele.
- Jagamise saab tagasi võtta.

### L26 · Kattuvate lugude märkimine ja ühendamine käsitsi (M)
*Projektijuhina soovin märkida kattuvad lood ning need ühendada või ühe eemaldada, et backlog'is ei oleks kordusi.*
- Kaks lugu saab märkida kattuvaks.
- Ühendamise eelvaates on üks lugu.
- Ühendatud loo kriteeriumide loendis ei ole täpseid kordusi.
- Ühendatud lugu saab enne kinnitamist muuta.
- Kattuvatest lugudest ühe saab eemaldada ja teise alles jätta.
- Ühendamise saab tagasi võtta.

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

### L28 · AI jagamisettepanek eelvaatega (M)
*Projektijuhina soovin näha AI jagamisettepanekut koos jaotatud kriteeriumidega, et saaksin selle enne rakendamist üle vaadata.*
- Eelvaates on uued lood ja igaühe kriteeriumid.
- Server kontrollib, et iga algne kriteerium on täpselt ühes uues loos.
- Eelvaade hoiatab, kui uus lugu kattub mõne olemasoleva looga.
- Pärast „Rakenda“ vajutamist asendatakse algne lugu uutega.
- „Muuda“ lubab lugusid ja kriteeriumide jaotust enne rakendamist muuta.
- Jagamise saab tagasi võtta.

### L29 · AI ühendamisettepanek eelvaatega (M)
*Projektijuhina soovin näha kahe kattuva loo ühendamise ettepanekut, et backlog'is ei oleks sama nõuet kaks korda.*
- Eelvaates on ühendatud lugu ja ühendatud kriteeriumide loend.
- Server kontrollib, et iga algne kriteerium on kas ühendatud loendis või korduseks märgitud.
- Korduseks märgitud kriteeriumid on eelvaates eraldi näha koos tekstiga.
- Server lükkab tagasi ettepaneku, mis viitab olematule loole.
- Pärast „Rakenda“ vajutamist asendab ühendatud lugu mõlemad algsed lood.
- Ühendamise saab tagasi võtta.

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
| 3. Käsitsi haldus ka AI tõrke korral | L15 | Pane `.env`-i vale token, taaskäivita server ja lisa, muuda ning kustuta lugu. |
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
| AI-teenuse vastamisaeg kõigub (proovides 16–110 s) | L35 mõõdab kogu töövoo aja enne demo otsust. Täpsustuse lühivorm (ainult muudatused) on proovimata kavand ja seda proovitakse L11 käigus. Ooteajal kuvatakse ooteindikaator. Varuks on salvestatud demovideo. |
| Hetzneri teenus on eksperimentaalne ja ilma garantiita | Käsitsi haldus peab töötama ilma AI-ta (L15). AI-kood kavandatakse ühte faili, et teenuse vahetus oleks võimalik. Teist teenust ei lisata enne L35 otsust. |
| AI vastustes on keelevigu ja sisulisi vigu | Iga ettepanek vajab inimese kinnitust. ✎ Muuda on alati olemas. Promptides on eeskujud. Kood kontrollib, mida saab reeglitega kontrollida. |
| Groomimine (L25–L29) on mahukas ja jääb lõppu | Groomimise jaoks on aeg eraldi reserveeritud. Käsitsi ja AI variant kasutavad sama rakendamise loogikat. |
| Tagasivõtmise loogika läheb keeruliseks | Lihtne lahendus: enne iga muudatust salvestatakse mõjutatud lugude koopia. |
| Ulatus kasvab | Valikulised lisad L31–L34 ja L36 tulevad alles pärast L30. |
