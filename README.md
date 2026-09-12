# VEX Bludiště

Webová aplikace pro tvorbu bludišť na dlaždicových polích pro roboty **VEX 123** a **VEX GO**.
Učitel si bludiště naklikne, nebo si ho nechá vygenerovat, zkontroluje řešení a vytiskne.

**Aplikace:** https://bekousek.github.io/vex-bludiste/

---

## Co aplikace umí

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

U startu a jednosměrky se natočení vybírá křížovým ovladačem přímo v jejich tlačítku,
u vlastního tvaru se tam stejně vybírá tvar a barva.

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
js/model.js         datový model desky (dlaždice + políčka) a registr prvků
js/icons.js         kresba ikon do čtverce 100×100
js/render.js        vykreslení desky do SVG
js/solver.js        řešitel – nejkratší program přes všechny úkoly do cíle
js/generator.js     automatický generátor bludišť
js/storage.js       ukládání do prohlížeče, souboru a odkazu
js/printing.js      sestavení tiskových stránek
js/app.js           propojení ovládání s modelem
tools/serve.js      malý server jen pro místní zkoušení
```

### Přidání nového prvku

1. Zapsat prvek do tabulky `ITEMS` v `js/model.js`
   (`group`, `label`, `hint`, `legend`; volitelně `rot` pro natočení, `custom` pro volbu
   tvaru a barvy, `unique`, `blocks`, `task`).
2. Doplnit stejný klíč do tabulky `ICONS` v `js/icons.js` – funkce vrací SVG do čtverce 100×100.

Paleta, volby v tlačítku, legenda, nápověda i ukládání se doplní samy.

### Místní spuštění

```bash
node tools/serve.js
```

Pak otevřít <http://localhost:8099>.

## Licence

MIT
