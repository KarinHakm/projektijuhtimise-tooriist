# AI-teenuse valik ja teadaolevad piirangud

> **Oluline:** kõik allpool toodud tulemused on saadud **30.09.2026 eraldi proovi skriptidega, mitte rakenduses**. Rakendust sel hetkel veel ei olnud.
> Iga päringutüüpi prooviti **üks kord**, seega tulemuste kõikumist korduval kasutamisel ei ole mõõdetud.
> Rakenduse tegelik töövoo aeg mõõdetakse loos L35.

## Valitud teenus (esialgne arendusvalik)

| | |
|---|---|
| Teenus | Hetzner Experiments Inference API (`https://inference.hetzner.com/api/v1`, OpenAI-ühilduv) |
| Mudel | `Qwen3.8-27B` |
| Olulised sätted | `response_format: json_schema`, `chat_template_kwargs: { enable_thinking: false }`, `temperature: 0.3`, `max_tokens: 4096` |
| Hind | Hetzneri sõnul on teenus tasuta, kuni see on eksperimentaalses staatuses |
| Päringupiir | Hetzneri dokumentatsiooni järgi 10 päringut minutis võtme kohta |
| Andmed | Hetzneri sõnul päringute ja vastuste sisu ei salvestata, säilitatakse ainult kasutuse metaandmed |

**See ei ole lõplik demo otsus.** Kui päris rakenduses (L35) ei mahu vastuvõtukatse töövoog 5–10 minuti sisse, kaalume ühte kiiremat tasulist API-t.

## Miks mitte muud variandid

| Variant | Otsus | Põhjus |
|---|---|---|
| Kohalik Ollama + `qwen2.5:7b` | Tagasi lükatud | Arendaja sülearvutis (12 GiB RAM, ainult protsessor) kasvas swap proovi ajal 3,7 GiB võrra. Kiirus oli 6,9 tokenit sekundis. Esimeses vastuses oli nõrk eesti keel ja sisutuid vastusevariante. |
| Gemini API tasuta tase | Ei sobi | Google'i tingimuste järgi tohib EMP-s teistele kasutatavas rakenduses kasutada ainult tasulist teenust. |
| Anthropic API (tasuline) | Varuvariant | Ei ole proovitud. Kaalutakse, kui L35 mõõtmised näitavad, et Hetzner on demo jaoks liiga aeglane. |

## Proovide tulemused (Hetzner, `Qwen3.8-27B`)

| Päring | Mõtlemine | Kestus | Väljundtokenid | JSON ja skeem | Sisu |
|---|---|---|---|---|---|
| Täpsustavad küsimused | sees | 36,9 s | 1 298 | OK | 3 asjakohast küsimust, kohati kohmakas keel |
| Lood happy path'i järjekorras | sees | 106,3 s | 4 096 (piir) | **Viga:** vastus tühi | Mõtlemine kulutas kogu tokenipiiri |
| Lood happy path'i järjekorras | väljas | 16,4 s | 784 | OK | 6 lugu õiges järjekorras; keelevead |
| Kriteeriumid ja mockup | väljas | 45,4 s | 846 | OK | 4 kriteeriumist 3 head; 1 vale viide; mockup'is kirjavead |
| Kliendi täpsustus | väljas | **109,9 s** | 1 813 | OK | Täpsustus kaetud, mõju L4-le ja L5-le leitud; loo sõnastus katki |
| Backlog'i ülevaatus | väljas | 31,9 s | 1 146 | OK | Liiga suur lugu ja kattuvad lood leitud; jagamine tekitas uue korduse |

Väljundkiirus kõikus samal päeval **16–48 tokenit sekundis**.

## Teadaolevad AI piirangud

1. **Vastamisaeg kõigub palju.** Proovides kestis üks päring 16–110 sekundit. Õpetaja demo vajab vähemalt viit AI päringut, mis tähendab mõõdetud aegadega kokku umbes 2,5–4 minutit ootamist.
2. **Mõtlemisrežiim peab olema välja lülitatud.** Sisselülitatud mõtlemine kulutas lugude päringus kogu 4096-tokenise piiri ja vastus jäi tühjaks. Hetzneri dokumentatsioon ei maini `enable_thinking` sätet. Mõju on näha vaid kaudselt: `reasoning_content` puudus ja väljundtokeneid oli vähem.
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
8. **Skeemi jõustamine ei ole kinnitatud.** API võttis `json_schema` vastu ja kõik mõtlemiseta vastused vastasid skeemile. Kas skeemi jõustatakse genereerimise ajal, ei ole dokumenteeritud.
9. **Teenus on eksperimentaalne.** Hetzner ei garanteeri jõudlust ega kättesaadavust ja ei soovita seda tootmiskeskkonnas kasutada. Hetzneri blogi järgi tõusis käivitusjärgsel suure nõudluse perioodil p99 vastamisaeg ligi 10 minutini.

## Mida see rakenduse jaoks tähendab

- **Ükski AI ettepanek ei muuda backlog'i ilma inimese kinnituseta.** Iga ettepaneku juures on ✎ Muuda.
- **Server valideerib iga vastuse** JSON-skeemi ja reeglite järgi (L02, L12, L18, L28, L29) ja teeb vajaduse korral ühe korduspäringu.
- **Eelvaade arvutatakse koodis** ja näitab ka viidete muutusi (L11).
- **Sisulist kooskõla ei märgita automaatselt kinnitatuks** (L23).
- **Promptides on eeskujud** („et saaksin …“) ja ringja kasu keeld (L06). See vähendab vigu, aga ei kaota neid.
- **Jagamise ja ühendamise tulemust võrreldakse ülejäänud backlog'iga** (L28).

## Tehniline märkus

Arendaja võrgus IPv6 ühendus ei tööta. Node.js-i vaikimisi `fetch` jäi seetõttu ootele ja aegus. Proovides aitas käivitusparameeter `--dns-result-order=ipv4first` koos `--no-network-family-autoselection`-iga. Rakenduses lahendatakse see L02 käigus. Lahendus dokumenteeritakse README-s.

## Allikad

- [Hetzner Docs: Inference API](https://docs.hetzner.com/general/company-and-policy/experiments/inference/)
- [Hetzner Docs: Experiments platform](https://docs.hetzner.com/general/company-and-policy/experiments/experiments-platform/)
- [Hetzner blogi: What we learned from our Inference Experiment](https://www.hetzner.com/blog/inference-experiment/)
- [Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms)
