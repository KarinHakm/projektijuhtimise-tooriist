# Kasutusstsenaarium

Näide: turismiettevõte tellib portaali „Explore Estonia“. Projektijuht kasutab tööriista kahel kohtumisel.

## 1. Avakohtumine kliendiga (umbes 30 minutit)

1. **Projekt.** Projektijuht vajutab avalehel „+ Loo projekt“, kirjutab nime ja lühikirjelduse. Projekt avaneb kohe.
2. **Idee ühe lausega.** Klient ütleb: „Tahame portaali, kus külastaja avastab Eesti sihtkohti, koostab reisiplaani ja broneerib ekskursiooni.“ Projektijuht kirjutab selle vestlusesse.
3. **Täpsustavad küsimused.** AI küsib, kes on kasutajad ja kas ekskursiooni eest makstakse veebis. Klient vastab nuppudega, „Muu (kirjutan ise)“ või „Jäta vahele“.
4. **Rollid.** AI pakub rollid. Klient jätab alles „Külastaja“ ja „Reisikorraldaja“. Igal sammul saab nuppude asemel kirjutada ka oma sõnadega (nt „lisa ka giid“) – AI teeb uue ettepaneku, mis rakendub alles kinnitusel.
5. **Lood.** AI pakub lugusid kaartidena külastaja põhitöövoo järjekorras. Klient lükkab ühe tagasi, muudab ühte ja vajutab „Lisa valitud“.
6. **Millest alustada.** AI soovitab põhjendusega alustada näiteks ekskursiooni broneerimistaotlusest. Klient nõustub või valib ise.
7. **Kriteeriumid ja mockup.** AI pakub kriteeriumid ja vaate kavandi. Klient kinnitab ✓, muudab ✎ või eemaldab ✗. Rakendus hoiatab hinnanguliste sõnade ja mitme tingimuse eest.
8. **Kooskõla.** Kui kriteerium nõuab midagi, mida mockup'is pole (nt teadet „Broneerimistaotlus saadetud“), näitab rakendus hoiatust. Projektijuht arutab selle kliendiga läbi.
9. **Kliendi täpsustus.** Klient ütleb: „Broneeringus peab olema osalejate arv.“ Eelvaade näitab enne → pärast; projektijuht valib „Rakenda“, „Muuda“ või „Loobu“. Muutub ainult see lugu.
10. **Eksimus.** Kui midagi läks valesti, võtab „Võta tagasi viimane muudatus“ viimase muudatuse tagasi.
11. **Lõpp.** Etappide riba näitab tehtut, „Mida teeme edasi?“ pakub järgmist sammu.

## 2. Hilisem backlog'i ülevaatus

1. Projektijuht avab projekti. Vestlus, lood, kriteeriumid ja mockup'id on alles ning rakendus pakub jätkamise sammu.
2. „Vaata backlog üle“: AI ja kood leiavad liiga suured, kattuvad, Connextra vormita, mockup'ita või kontrollimatute kriteeriumidega lood. Iga leiu juures on [Rakenda] [Muuda] [Ignoreeri]; jagamisel ja ühendamisel on eelvaade kriteeriumide jaotusega.
3. Käsitsi saab lugu muuta, jagada, kattuvaks märkida, ühendada, ↑/↓ järjestada ja MVP joont paigutada – ka siis, kui AI pole kättesaadav.
4. Ebaselgele loole lisatakse avatud küsimus; lugu saab staatuse „Vajab täpsustamist“ ega saa „Valmis arenduseks“ enne, kui valmisoleku definitsioon on täidetud.

## Näidis (`npm run demo`)

Projekt „Explore Estonia“ on käsitsi koostatud ja märgitud „Näidis“. Sammud 1–8 on tehtud; ootel on lisalood (samm 5) ja kliendi täpsustus (samm 9). `npm run demo:ai` avab sama näidise töötava AI-ga.
