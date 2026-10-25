# VEX Bludiště

Webová aplikace pro tvorbu bludišť na dlaždicových polích pro roboty **VEX 123**, **VEX GO**
a **VEX AIM**. Učitel si bludiště naklikne, nebo si ho nechá vygenerovat, zkontroluje řešení
a vytiskne.

**Aplikace:** https://bekousek.github.io/vex-bludiste/

---

## Co aplikace umí

- **Dva roboti na jedno kliknutí** – přepínač v hlavičce mění paletu prvků, řešitel i generátor.
  Režim VEX 123 a GO zůstává přesně jako dřív, režim VEX AIM přidává náklad, zastávky
  a porovnání tří způsobů programování (viz níže).
- **Stavba pole z dlaždic** – základ je dlaždice 3×3 políčka. Pole nemusí být obdélník:
  dlaždice se naklikají do jakéhokoli tvaru (písmeno L, okruh s dírou uprostřed, kříž, cikcak),
  až do rozměru 8×8 dlaždic (24×24 políček). Hotové tvary jsou na jedno kliknutí.
- **Pokládání prvků** myší, i tažením přes víc políček najednou.
- **Automatický generátor** bludišť ve třech obtížnostech, který se řídí pevnými pravidly (viz níže).
- **Kontrola řešitelnosti** – aplikace bludiště sama vyřeší a vypíše nejkratší program
  (*Jeď vpřed, Otoč se vlevo, Seber hvězdičku…*) jako klíč pro učitele.
- **Tisk** hotového bludiště s vysvětlivkami, volitelně i s řešením na druhé stránce.
- **Tisk prázdných polí** libovolné velikosti a v libovolném počtu kopií pro práci s tužkou a papírem.
- **Export do PNG**, uložení do souboru a sdílení odkazem.
- Rozdělaná práce se sama ukládá do prohlížeče.
- **Vlastní ikony** – nahraný obrázek (PNG, JPG, SVG) se přidá do palety a pokládá se jako každý jiný prvek.
- Zpět, Vpřed a Vymazat vše jsou po ruce nad deskou.

## Prvky

| Prvek | Význam |
|---|---|
| Start | odkud robot vyjíždí, včetně natočení |
| Cíl | kam má robot dojet |
| Zákaz vjezdu | políčko je neprůjezdné |
| Jednosměrka | políčkem se smí projet jen ve směru šipky |
| Hvězdička | robot ji musí cestou sebrat |
| Zvuk | robot zde musí vydat zvuk |
| Světlo | robot se zde musí rozsvítit |
| Vlastní tvar | značka podle vlastního zadání – 6 tvarů × 8 barev |
| Moje ikony | vlastní nahrané obrázky, ve vysvětlivkách se ukážou pod svým jménem |

U startu a jednosměrky se natočení vybírá křížovým ovladačem přímo v jejich tlačítku,
u vlastního tvaru se tam stejně vybírá tvar a barva.

## Režim VEX AIM

AIM má tři všesměrová kola, takže jede vpřed, vzad, bokem i šikmo, aniž by se otáčel,
a kamerou pozná, co před sebou má. Právě to je na papíře nejhůř vidět, a proto má AIM
vlastní režim.

**Rozměry pole.** Jedno políčko je **100 mm** (krok Button Coding), dlaždice má 3×3 políčka,
tedy 300 mm. Hodnoty jsou na jednom místě v registru `ROBOTS` v `js/model.js`, takže
se dají kdykoli opravit podle skutečného pole.

**Prvky navíc.** Oranžový sud, modrý sud a míček jsou náklad: robot ho sebere tím, že na
políčko vjede. AprilTag (ID 0 až 4, číslo se vybírá v tlačítku prvku) je zastávka nebo branka.
Políčko s tagem je neprůjezdné, robot zastaví na sousedním políčku a náklad položí nebo kopne.

**Úkoly.** K desce patří seznam úkolů typu *Doruč oranžový sud na zastávku 1*. U míčku se
úkol změní na kop do branky. Pořadí úkolů i to, který ze tří sudů robot použije, si řešitel
vybere sám. Úkoly se tisknou do zadání.

**Tři varianty programu.** Tatáž deska se spočítá třikrát a výsledky se ukážou vedle sebe:

| Varianta | Co se počítá |
|---|---|
| Tlačítka | Button Coding na robotu: vpřed o políčko, otočka o 90°, akce. Každý stisk je příkaz. |
| Bloky bez otáčení | Robot se neotáčí a jede i bokem. Souvislá jízda jedním směrem je jeden blok `move`. |
| Bloky se šikmou jízdou | Navíc úhlopříčky po 45° jako `move at angle`. Úhlopříčka měří 141 mm na políčko. |

Sebrání nákladu se nepočítá ve všech třech variantách stejně (robot ho sebere průjezdem),
položení a kop se počítá. Rozdíl v číslech je tedy přesně to, co ušetří holonomní podvozek.
Program se vypisuje názvy bloků VEXcode AIM, u tlačítek šipkami jako na metodických kartách.

**Náhled „co vidí robot“.** Zaškrtnutí nad deskou vykreslí výseč zorného pole ze startu
(asi 73° podle VEX STEM Labs) a u každého objektu napíše přibližný úhel. Zelená znamená
vidím, červená čárkovaná mimo výseč nebo zakryté zdí či tagem. **Je to model geometrie,
ne simulace kamery** – skutečná kamera se chová jinak podle světla, vzdálenosti a úhlu.
Náhled slouží k plánování maker `turn until found` bez robota.

**Generátor pro AIM.** Lehké je jedno doručení bez zdí, střední dvě doručení a pár zdí,
těžké tři úkoly včetně míčku do branky. Zastávky stojí u okraje desky, náklad nikdy nezůstane
obklopený zdmi, start je na okraji a natočí se tak, aby kamera opravdu něco viděla.
Každá deska se před vydáním vyřeší ve všech třech variantách a zahodí se, když řešení
neexistuje nebo když je rozdíl mezi tlačítky a bloky moc malý na to, aby byl vidět.

## Vlastní ikony a kde se ukládají

Nahrané ikony leží jen v `localStorage` prohlížeče na počítači, kde se nahrály. Aplikace je
nikam neposílá, nemá přihlašování a o počítači nic neukládá. Při prvním nahrání požádá přes
`navigator.storage.persist()`, aby prohlížeč data nemazal, když dojde místo na disku.

| Situace | Ikony |
|---|---|
| nový panel nebo okno | zůstanou |
| zavření a znovuotevření prohlížeče | zůstanou |
| vypnutí a zapnutí počítače | zůstanou |
| vymazání historie včetně „cookies a dat stránek“ | zmizí |
| anonymní okno | nevidí je, co se tam přidá, zmizí po zavření |
| jiný prohlížeč, jiný profil, jiný počítač | nevidí je |
| školní počítač, který maže profil po odhlášení | zmizí |
| přestěhování webu na jinou doménu | zmizí (jiná adresa = jiné úložiště) |

Proti všem těmto případům pomáhá **Soubor a odkaz → Uložit ikony do souboru**; ze zálohy se ikony
načtou zpátky na libovolném počítači. Ikony použité na desce se navíc samy přibalí do uloženého
bludiště i do sdíleného odkazu.

Rastrové obrázky se zmenší na 256 px, z SVG se odstraní skripty a obsluhy událostí a na desce se
vždy vykreslují přes `<image>`, takže se z nahraného souboru nic nespustí. Limit je 24 ikon.

## Pravidla generátoru

Generátor nesází prvky náhodně. Každá vygenerovaná deska splňuje:

1. Start leží na kraji pole a robot kouká dovnitř. U tvarů s dírou se za kraj bere i okraj díry.
2. Cíl je od startu dostatečně daleko – nikdy není hned vedle. Hranice se přizpůsobí tvaru pole,
   aby dávala smysl i u úzkého pásu nebo okruhu.
3. Nejdřív se nakreslí „páteř“ – souvislá cesta ze startu do cíle s daným počtem zatáček
   (2 lehké / 3 střední / 4 těžké). Nikdy nejde o rovnou čáru.
4. Úkoly (hvězdičky, zvuk, světlo) visí na odbočkách z páteře, takže se k nim musí zajíždět.
5. Překážky se sypou přednostně do obdélníku mezi startem a cílem, aby byla přímá cesta zaslepená
   a robot musel objíždět.
6. Překážky se kladou **rozptýleně**: nejdřív jen tam, kde vedle ještě žádná nestojí, a nikdy tak,
   aby vznikl plný blok 2×2. Deska pak vypadá jako bludiště s jednotlivými překážkami a linkami,
   ne jako mrtvá plocha. Když se i tak někde slije masa zdí (nějaká zeď má tři a víc zdí kolem sebe),
   deska se zahodí.
7. Jednosměrka se pokládá na políčko, kterým robot podle řešení projíždí rovně, a to ve směru jízdy –
   má tedy smysl a deska zůstane řešitelná.
8. Hotová deska se vyřeší prohledáváním stavů *(políčko, natočení)* a zkontroluje:
   řešení musí existovat, mít dost zatáček, objížďku kvůli překážkám i zajížďku kvůli úkolům,
   nesmí být neúměrně dlouhé a nejméně polovina desky musí zůstat volná.
   Když něco nesedí, deska se zahodí a generuje se znovu (až 400 pokusů, obvykle stačí první).

Generátor pracuje jen s políčky, která na desce opravdu jsou, takže stejná pravidla platí
i pro pole ve tvaru L nebo okruhu.

## Jak je to udělané

Statická stránka bez build kroku – čisté HTML, CSS a JavaScript, žádné závislosti.
Funguje i po stažení a otevření `index.html` z disku, tedy i bez internetu.

```
index.html          rozvržení a dialogy
css/style.css       vzhled aplikace
css/print.css       tiskový výstup (A4, automatická orientace)
js/model.js         datový model desky (dlaždice + políčka), registr prvků a robotů
js/icons.js         kresba ikon do čtverce 100×100
js/usericons.js     knihovna vlastních nahraných ikon (localStorage, záloha do souboru)
js/render.js        vykreslení desky do SVG včetně výseče kamery
js/solver.js        řešitel 123 a GO – nejkratší program přes všechny úkoly do cíle
js/aimsolver.js     řešitel AIM – tlačítka, bloky bez otáčení, bloky se šikmou jízdou
js/aimvision.js     model zorného pole kamery (co robot ze startu vidí)
js/generator.js     automatický generátor bludišť pro 123 a GO
js/aimgenerator.js  automatický generátor desek pro AIM
js/storage.js       ukládání do prohlížeče, souboru a odkazu
js/printing.js      sestavení tiskových stránek
js/app.js           propojení ovládání s modelem
tools/serve.js      malý server jen pro místní zkoušení
tools/checkaim.js   kontrola řešitelů v Node, bez prohlížeče
tools/testboards/   desky, na kterých se kontrola spouští
```

Uložená deska i odkaz nesou navíc `robot` a `jobs`. Starší soubory a odkazy tyhle údaje
nemají a načtou se jako VEX 123 a GO, tedy přesně jako dřív.

### Přidání nového prvku

1. Zapsat prvek do tabulky `ITEMS` v `js/model.js`
   (`group`, `label`, `hint`, `legend`; volitelně `rot` pro natočení, `num` pro číslo 0 až 4,
   `custom` pro volbu tvaru a barvy, `unique`, `blocks`, `task`, `cargo`
   a `robots` pro seznam robotů, kterým prvek patří).
2. Doplnit stejný klíč do tabulky `ICONS` v `js/icons.js` – funkce vrací SVG do čtverce 100×100.

Paleta, volby v tlačítku, legenda, nápověda i ukládání se doplní samy.

### Kontrola bez prohlížeče

```bash
node tools/checkaim.js
```

Načte moduly do malého `window`, vypíše řešení testovacích desek a ohlídá, že šikmá varianta
není delší než jízda bokem a že generátor na každou obtížnost něco vymyslí.

### Místní spuštění

```bash
node tools/serve.js
```

Pak otevřít <http://localhost:8099>.

## Licence

MIT
