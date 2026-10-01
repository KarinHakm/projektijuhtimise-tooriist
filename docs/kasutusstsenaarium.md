# Kasutusstsenaarium

Näide: spordiklubi tellib veebi. Projektijuht kasutab tööriista kahel kohtumisel. Kirjeldus vastab rakenduse praegusele seisule. Mis veel puudub, on kirjas lõpus.

## 1. Avakohtumine kliendiga (umbes 30 minutit)

1. **Projekt.** Projektijuht vajutab avalehel „+ Loo projekt“ ning kirjutab nime „Spordiklubi veeb“ ja lühikirjelduse. Projekt avaneb kohe.
2. **Idee ühe lausega.** Klient ütleb: „Tahame veebi, kus saab treeningutega tutvuda ja liikmeks astuda.“ Projektijuht kirjutab selle lause vestlusesse.
3. **Täpsustavad küsimused.** AI küsib näiteks, kes on kasutajad ja kas liikmetasu makstakse veebis. Klient vastab valikunuppudega. Kui sobivat varianti pole, kasutab ta „Muu (kirjutan ise)“ või „Jäta vahele“. AI teeb kokkuvõtte.
4. **Rollid.** AI pakub rollid. Klient jätab alles „Külastaja“ ja „Administraator“ ning lisab vajadusel ise uue rolli.
5. **Lood.** AI pakub lugusid kaartidena külastaja põhitöövoo järjekorras. Klient lükkab ühe tagasi, muudab ühe sõnastust ja vajutab „Lisa valitud“. Lood on backlog'is ja paremal näha.
6. **Millest alustada.** AI soovitab põhjendusega, millise looga alustada, näiteks liikmeks astumise taotlusega. Klient nõustub või valib ise teise loo.
7. **Kriteeriumid ja mockup.** AI pakub valitud loole vastuvõtukriteeriumid ja vaate kavandi. Klient kinnitab kriteeriume ✓, muudab neid ✎ või eemaldab ✗. Rakendus hoiatab hinnanguliste sõnade („kiire“, „lihtne“) ja mitme tingimuse eest. Mockup'i kinnitamine on eraldi samm.
8. **Kooskõla.** Kui kriteerium nõuab midagi, mida mockup'is pole (näiteks kinnitusteadet), näitab rakendus hoiatust. See on vihje, mitte otsus. Projektijuht arutab selle kliendiga läbi, seob kriteeriumi elemendiga või kinnitab ülevaatuse.
9. **Kliendi täpsustus.** Klient ütleb: „Taotluses peab olema ka telefoninumber.“ AI koostab muudatusettepaneku ja projektijuht näitab eelvaadet enne → pärast. Seejärel valib ta „Rakenda“, „Muuda“ või „Loobu“. Rakendamine muudab ainult seda lugu. Soovitused teistele lugudele jäävad tekstiks.
10. **Kohtumise lõpp.** Etappide riba näitab, mis on tehtud. „Mida teeme edasi?“ pakub järgmist sammu.

## 2. Hilisem backlog'i ülevaatus

1. Projektijuht avab projekti avalehelt. Kaardil on näha viimati läbitud etapp ja järgmine samm. Vestlus, lood, kriteeriumid ja mockup'id on alles ka pärast serveri taaskäivitust.
2. Ta järjestab lood ↑/↓ nuppudega ümber ja valib vajadusel uue alustamise loo.
3. Ebaselge loo juures lisab ta avatud küsimuse (näiteks „Klient täpsustab maksevõimalused“). Lugu saab staatuse „Vajab täpsustamist“. Staatust „Valmis arenduseks“ saab anda alles siis, kui valmisoleku definitsiooni (DoR) kõik tingimused on täidetud, ja selle otsuse teeb projektijuht ise.
4. Järgmise loo jaoks küsib ta kriteeriumid ja mockup'i ning kordab täpsustuse sammu.

**Veel puudub** (vt [backlog.md](backlog.md)):
- lugude käsitsi lisamine, muutmine ja kustutamine;
- MVP joon;
- tagasivõtmine;
- groomimine: jagamine, ühendamine ja AI ülevaatus.

Seepärast ei saa backlog'i ülevaatust praegu lõpuni teha.

## Näidis ilma AI-ta (`npm run demo`)

Projekt „Spordiklubi veeb“ on käsitsi koostatud ja märgitud „Näidis“. Selles on sammud 1–8 juba tehtud. Ootel on kaks näidisettepanekut:
- lisalood (samm 5);
- kliendi täpsustus (samm 9).

Neid saab päriselt otsustada ja tulemus salvestub. AI nupud annavad näidisrežiimis teate, et AI ei ole seadistatud.
