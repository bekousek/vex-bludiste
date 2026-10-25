/* VEX Bludiště – datový model desky
 * Deska je sada dlaždic 3x3 políčka, poskládaná do libovolného tvaru
 * (obdélník, písmeno L, okruh s dírou uprostřed…). V každém políčku
 * může být nejvýš jeden prvek.
 * Nový prvek se přidá zápisem do tabulky ITEMS + kresbou ikony v js/icons.js.
 * Deska patří jednomu robotovi (VEX 123 / GO, nebo VEX AIM) – podle toho
 * se liší paleta prvků, řešitel i generátor.
 */
(function () {
  var VEX = (window.VEX = window.VEX || {});

  var TILE = 3;          // políček na dlaždici
  var MAX_TILES = 8;     // strop na šířku i výšku, aby se to dalo vytisknout
  var MAX_TAG = 4;       // AprilTagy v sadě AIM mají ID 0 až 4
  var MAX_JOBS = 5;      // víc úkolů doručení už se nevejde do zadání ani do hlavy

  /* Roboti. Rozměry pole jsou schválně na jednom místě.
   *   tile   – políček na dlaždici
   *   cellMm – kolik milimetrů měří jedno políčko (krok Button Coding)
   *   fov    – zorné pole kamery ve stupních */
  var ROBOTS = {
    v123: { id: 'v123', label: 'VEX 123 / GO', tile: 3 },
    aim: { id: 'aim', label: 'VEX AIM', tile: 3, cellMm: 100, fov: 73 }
  };
  var DEFAULT_ROBOT = 'v123';

  function robotId(b) {
    var r = typeof b === 'string' ? b : b && b.robot;
    return ROBOTS[r] ? r : DEFAULT_ROBOT;
  }
  function robot(b) { return ROBOTS[robotId(b)]; }
  function isAim(b) { return robotId(b) === 'aim'; }
  function cellMm(b) { return robot(b).cellMm || 0; }
  /** Vzdálenost v milimetrech za daný počet políček. */
  function mm(b, cells) { return Math.round(cellMm(b) * cells); }

  /* Směry: 0 = nahoru, 1 = doprava, 2 = dolů, 3 = doleva */
  var DIRS = [
    { dx: 0, dy: -1, cz: 'nahoru' },
    { dx: 1, dy: 0, cz: 'doprava' },
    { dx: 0, dy: 1, cz: 'dolů' },
    { dx: -1, dy: 0, cz: 'doleva' }
  ];

  /* Tvary a barvy pro prvek „vlastní tvar“ */
  var SHAPES = [
    { id: 'circle', label: 'Kolečko' },
    { id: 'square', label: 'Čtverec' },
    { id: 'triangle', label: 'Trojúhelník' },
    { id: 'diamond', label: 'Kosočtverec' },
    { id: 'hexagon', label: 'Šestiúhelník' },
    { id: 'heart', label: 'Srdce' }
  ];

  var COLORS = [
    { id: 'red', label: 'Červená', hex: '#e0262c' },
    { id: 'orange', label: 'Oranžová', hex: '#ef7d16' },
    { id: 'yellow', label: 'Žlutá', hex: '#ffc61e' },
    { id: 'green', label: 'Zelená', hex: '#2fa84f' },
    { id: 'blue', label: 'Modrá', hex: '#2a6fd6' },
    { id: 'purple', label: 'Fialová', hex: '#8e44ad' },
    { id: 'brown', label: 'Hnědá', hex: '#8a5a2b' },
    { id: 'black', label: 'Černá', hex: '#2b2b2b' }
  ];

  /* Náklad robota AIM. "en" je název, kterým se objekt jmenuje v blocích VEXcode AIM. */
  var CARGO = [
    { id: 'orange', label: 'oranžový sud', en: 'orange barrel' },
    { id: 'blue', label: 'modrý sud', en: 'blue barrel' },
    { id: 'ball', label: 'míček', en: 'ball' }
  ];

  function cargoById(id) {
    for (var i = 0; i < CARGO.length; i++) if (CARGO[i].id === id) return CARGO[i];
    return CARGO[0];
  }

  function shapeById(id) {
    for (var i = 0; i < SHAPES.length; i++) if (SHAPES[i].id === id) return SHAPES[i];
    return SHAPES[0];
  }
  function colorById(id) {
    for (var i = 0; i < COLORS.length; i++) if (COLORS[i].id === id) return COLORS[i];
    return COLORS[0];
  }

  /* Registr prvků.
   *   rot    – prvek má natočení (0..3)
   *   num    – prvek má číslo 0..MAX_TAG (volí se v tlačítku prvku)
   *   custom – prvek má volbu tvaru a barvy
   *   unique – na desce smí být jen jeden
   *   blocks – políčko je neprůjezdné
   *   task   – robot na políčku musí něco udělat (generátor to zahrne do trasy)
   *   cargo  – náklad robota AIM, robot ho sebere vjetím na políčko
   *   group  – zařazení v paletě
   *   robots – pro které roboty prvek platí (chybí = pro všechny)
   */
  var ITEMS = {
    start: {
      label: 'Start', group: 'trasa', rot: true, unique: true,
      hint: 'Odkud robot vyjíždí. Šipka ukazuje, kam je otočený.',
      legend: 'start robota'
    },
    finish: {
      label: 'Cíl', group: 'trasa', unique: true,
      hint: 'Kam má robot dojet.',
      legend: 'cíl'
    },
    wall: {
      label: 'Zákaz vjezdu', group: 'prekazky', blocks: true,
      hint: 'Sem robot nesmí vjet.',
      legend: 'zákaz vjezdu'
    },
    oneway: {
      label: 'Jednosměrka', group: 'prekazky', rot: true, robots: ['v123'],
      hint: 'Přes políčko se smí projet jen ve směru šipky.',
      legend: 'přejezd pouze tímto směrem'
    },
    star: {
      label: 'Hvězdička', group: 'ukoly', task: true, robots: ['v123'],
      hint: 'Hvězdičku musí robot cestou sebrat.',
      legend: 'hvězdička k sebrání'
    },
    orange: {
      label: 'Oranžový sud', group: 'naklad', robots: ['aim'], cargo: 'orange',
      hint: 'Náklad. Robot ho sebere, jakmile na políčko vjede.',
      legend: 'oranžový sud'
    },
    blue: {
      label: 'Modrý sud', group: 'naklad', robots: ['aim'], cargo: 'blue',
      hint: 'Náklad. Robot ho sebere, jakmile na políčko vjede.',
      legend: 'modrý sud'
    },
    ball: {
      label: 'Míček', group: 'naklad', robots: ['aim'], cargo: 'ball', kick: true,
      hint: 'Náklad, který se dá kopnout do branky.',
      legend: 'míček'
    },
    tag: {
      label: 'AprilTag', group: 'naklad', robots: ['aim'], num: true, blocks: true,
      hint: 'Zastávka nebo branka s AprilTagem. Robot u ní zastaví na sousedním políčku.',
      legend: 'zastávka s AprilTagem'
    },
    sound: {
      label: 'Zvuk', group: 'ukoly', task: true,
      hint: 'Tady musí robot vydat zvuk.',
      legend: 'zahraj zvuk'
    },
    light: {
      label: 'Světlo', group: 'ukoly', task: true,
      hint: 'Tady se musí robot rozsvítit.',
      legend: 'rozsviť se'
    },
    shape: {
      label: 'Vlastní tvar', group: 'znacky', custom: true,
      hint: 'Značka podle vlastního zadání – vyber si tvar a barvu.',
      legend: 'vlastní značka'
    },
    own: {
      label: 'Moje ikona', group: 'vlastni', icon: true,
      hint: 'Obrázek, který sis sám nahrál.',
      legend: 'vlastní obrázek'
    }
  };

  var GROUPS = [
    { id: 'trasa', label: 'Trasa' },
    { id: 'prekazky', label: 'Překážky' },
    { id: 'naklad', label: 'Náklad a zastávky' },
    { id: 'ukoly', label: 'Úkoly' },
    { id: 'znacky', label: 'Značka' },
    { id: 'vlastni', label: 'Moje ikony' }
  ];

  /** Platí prvek pro tohoto robota? Prvek bez seznamu platí pro všechny. */
  function itemFits(type, who) {
    var def = ITEMS[type];
    if (!def) return false;
    return !def.robots || def.robots.indexOf(robotId(who)) >= 0;
  }

  /** Klíče prvků pro daného robota, v pořadí registru. */
  function itemsFor(who) {
    return Object.keys(ITEMS).filter(function (k) { return itemFits(k, who); });
  }

  /** Skupiny palety, ve kterých daný robot něco má. */
  function groupsFor(who) {
    var keys = itemsFor(who);
    return GROUPS.filter(function (g) {
      if (g.id === 'vlastni') return true;
      return keys.some(function (k) { return ITEMS[k].group === g.id; });
    });
  }

  /* ---------- dlaždice ---------- */

  function tileKey(x, y) { return x + ',' + y; }
  function hasTile(b, x, y) { return !!b.tiles[tileKey(x, y)]; }

  function tileList(b) {
    var out = [];
    for (var k in b.tiles) {
      var p = k.split(',');
      out.push({ x: +p[0], y: +p[1] });
    }
    return out;
  }

  function tileCount(b) { return Object.keys(b.tiles).length; }

  function extent(b) {
    var mx = 0, my = 0;
    for (var k in b.tiles) {
      var p = k.split(',');
      if (+p[0] > mx) mx = +p[0];
      if (+p[1] > my) my = +p[1];
    }
    return { mx: mx, my: my };
  }

  /** Posune dlaždice i políčka tak, aby tvar začínal na 0,0. */
  function normalize(b) {
    var minx = Infinity, miny = Infinity, k, p;
    for (k in b.tiles) {
      p = k.split(',');
      if (+p[0] < minx) minx = +p[0];
      if (+p[1] < miny) miny = +p[1];
    }
    if (minx === Infinity) { b.tiles = { '0,0': 1 }; return; }
    if (!minx && !miny) return;
    var nt = {}, nc = {};
    for (k in b.tiles) { p = k.split(','); nt[tileKey(+p[0] - minx, +p[1] - miny)] = 1; }
    for (k in b.cells) { p = k.split(','); nc[(+p[0] - minx * TILE) + ',' + (+p[1] - miny * TILE)] = b.cells[k]; }
    b.tiles = nt; b.cells = nc;
  }

  /** Je tvar plný obdélník? (jen pro popisek velikosti) */
  function isRect(b) {
    var e = extent(b);
    return tileCount(b) === (e.mx + 1) * (e.my + 1);
  }

  function createBoard(tx, ty, who) {
    var b = { v: 2, tiles: {}, cells: {}, title: '', robot: robotId(who), jobs: [] };
    for (var y = 0; y < (ty || 2); y++) {
      for (var x = 0; x < (tx || 2); x++) b.tiles[tileKey(x, y)] = 1;
    }
    return b;
  }

  function boardFromTiles(tiles, who) {
    var b = { v: 2, tiles: {}, cells: {}, title: '', robot: robotId(who), jobs: [] };
    for (var k in tiles) if (tiles[k]) b.tiles[k] = 1;
    normalize(b);
    return b;
  }

  /* ---------- políčka ---------- */

  function cols(b) { return (extent(b).mx + 1) * TILE; }
  function rows(b) { return (extent(b).my + 1) * TILE; }
  function key(c, r) { return c + ',' + r; }

  /** Existuje políčko? (leží na některé položené dlaždici) */
  function inside(b, c, r) {
    if (c < 0 || r < 0) return false;
    return hasTile(b, Math.floor(c / TILE), Math.floor(r / TILE));
  }

  function cellCount(b) { return tileCount(b) * TILE * TILE; }

  function get(b, c, r) { return b.cells[key(c, r)] || null; }

  function set(b, c, r, item) {
    if (!inside(b, c, r)) return;
    if (!item) delete b.cells[key(c, r)];
    else b.cells[key(c, r)] = item;
  }

  /** Sestaví prvek podle registru – vezme jen ta pole, která prvek opravdu má. */
  function makeItem(type, opts) {
    var def = ITEMS[type];
    if (!def) return null;
    var it = { t: type };
    opts = opts || {};
    if (def.rot) it.d = (opts.d | 0) & 3;
    if (def.num) it.n = Math.max(0, Math.min(MAX_TAG, opts.n | 0));
    if (def.custom) {
      it.s = shapeById(opts.s).id;
      it.col = colorById(opts.col).id;
    }
    if (def.icon) it.ico = String(opts.ico || '').slice(0, 40);
    return it;
  }

  /** Položí prvek; u unikátních prvků nejdřív odstraní ten starý. */
  function place(b, c, r, type, opts) {
    if (!inside(b, c, r)) return false;
    var it = makeItem(type, opts);
    if (!it) return false;
    if (ITEMS[type].unique) {
      var old = findFirst(b, type);
      if (old) set(b, old.c, old.r, null);
    }
    set(b, c, r, it);
    return true;
  }

  function findFirst(b, type) {
    for (var k in b.cells) {
      if (b.cells[k].t === type) {
        var p = k.split(',');
        return { c: +p[0], r: +p[1], item: b.cells[k] };
      }
    }
    return null;
  }

  function findAll(b, pred) {
    var out = [];
    for (var k in b.cells) {
      var it = b.cells[k];
      if (pred(it)) {
        var p = k.split(',');
        out.push({ c: +p[0], r: +p[1], item: it });
      }
    }
    out.sort(function (a, z) { return a.r - z.r || a.c - z.c; });
    return out;
  }

  function tasks(b) {
    return findAll(b, function (it) { return ITEMS[it.t] && ITEMS[it.t].task; });
  }

  /* ---------- náklad, zastávky a úkoly robota AIM ---------- */

  /** Všechna políčka s nákladem daného druhu (na desce můžou být tři sudy). */
  function cargoCells(b, cargo) {
    return findAll(b, function (it) {
      var def = ITEMS[it.t];
      return !!def && def.cargo === cargo;
    });
  }

  /** Políčko s AprilTagem daného čísla, nebo null. */
  function tagCell(b, n) {
    var all = findAll(b, function (it) { return it.t === 'tag' && (it.n | 0) === (n | 0); });
    return all.length ? all[0] : null;
  }

  /** Čísla tagů položených na desce, vzestupně. */
  function tagNumbers(b) {
    var seen = {}, out = [];
    findAll(b, function (it) { return it.t === 'tag'; }).forEach(function (t) {
      var n = t.item.n | 0;
      if (!seen[n]) { seen[n] = 1; out.push(n); }
    });
    return out.sort(function (a, z) { return a - z; });
  }

  function jobs(b) { return (b && b.jobs) || []; }

  function makeJob(kind, cargo, tag) {
    return {
      kind: kind === 'kick' ? 'kick' : 'deliver',
      cargo: cargoById(cargo).id,
      tag: Math.max(0, Math.min(MAX_TAG, tag | 0))
    };
  }

  function jobText(job) {
    var c = cargoById(job.cargo);
    return job.kind === 'kick'
      ? 'Kopni ' + c.label + ' do branky ' + job.tag
      : 'Doruč ' + c.label + ' na zastávku ' + job.tag;
  }

  function sameJob(a, z) {
    return a.kind === z.kind && a.cargo === z.cargo && a.tag === z.tag;
  }

  function addJob(b, kind, cargo, tag) {
    var job = makeJob(kind, cargo, tag);
    var list = jobs(b);
    if (list.length >= MAX_JOBS) return false;
    if (list.some(function (j) { return sameJob(j, job); })) return false;
    b.jobs = list.concat([job]);
    return true;
  }

  function removeJob(b, i) {
    var list = jobs(b).slice();
    if (i < 0 || i >= list.length) return false;
    list.splice(i, 1);
    b.jobs = list;
    return true;
  }

  /** Dá se úkol na téhle desce vůbec splnit? (náklad i zastávka musí ležet na desce) */
  function jobOk(b, job) {
    return !!tagCell(b, job.tag) && cargoCells(b, job.cargo).length > 0;
  }

  /** Zahodí úkoly, kterým na desce chybí náklad nebo zastávka. Vrací počet zahozených. */
  function validJobs(b) {
    var list = jobs(b);
    var keep = list.filter(function (j) { return jobOk(b, j); });
    b.jobs = keep;
    return list.length - keep.length;
  }

  /** Řádky legendy podle toho, co na desce opravdu je.
   * Vlastní značky se rozepíšou na každý použitý tvar a barvu zvlášť. */
  function legendItems(b) {
    var order = Object.keys(ITEMS), seen = {}, out = [];
    for (var k in b.cells) {
      var it = b.cells[k], def = ITEMS[it.t];
      if (!def) continue;
      var id = def.custom ? it.t + ':' + it.s + ':' + it.col
        : def.icon ? it.t + ':' + it.ico
          : def.num ? it.t + ':' + (it.n | 0) : it.t;
      if (seen[id]) continue;
      seen[id] = 1;
      var text = def.legend;
      if (def.num) text = def.legend + ' ' + (it.n | 0);
      if (def.icon && window.VEX.userIcons) text = window.VEX.userIcons.nameOf(it.ico) || def.legend;
      out.push({ item: it, text: text, sort: order.indexOf(it.t) });
    }
    out.sort(function (a, z) { return a.sort - z.sort; });
    return out;
  }

  /** Prvky použité na desce – pro legendu. */
  function usedTypes(b) {
    var seen = {}, out = [], order = Object.keys(ITEMS);
    for (var k in b.cells) {
      var t = b.cells[k].t;
      if (!seen[t] && ITEMS[t]) { seen[t] = 1; out.push(t); }
    }
    out.sort(function (a, z) { return order.indexOf(a) - order.indexOf(z); });
    return out;
  }

  /** Zahodí prvky, které leží mimo položené dlaždice. Vrací počet ztracených. */
  function trim(b) {
    var lost = 0;
    for (var k in b.cells) {
      var p = k.split(',');
      if (!inside(b, +p[0], +p[1])) { delete b.cells[k]; lost++; }
    }
    return lost;
  }

  /** Kolik prvků by se ztratilo, kdyby deska měla zadané dlaždice. */
  function countOutsideTiles(b, tiles) {
    var n = 0;
    for (var k in b.cells) {
      var p = k.split(',');
      var tk = tileKey(Math.floor(+p[0] / TILE), Math.floor(+p[1] / TILE));
      if (!tiles[tk]) n++;
    }
    return n;
  }

  /** Vymění tvar desky a ořízne prvky mimo něj. */
  function setTiles(b, tiles) {
    var nt = {};
    for (var k in tiles) if (tiles[k]) nt[k] = 1;
    if (!Object.keys(nt).length) return false;
    b.tiles = nt;
    normalize(b);
    trim(b);
    return true;
  }

  function clone(b) { return JSON.parse(JSON.stringify(b)); }

  function isEmpty(b) { return Object.keys(b.cells).length === 0; }

  VEX.model = {
    TILE: TILE, MAX_TILES: MAX_TILES, MAX_TAG: MAX_TAG, MAX_JOBS: MAX_JOBS,
    DIRS: DIRS, ITEMS: ITEMS, GROUPS: GROUPS,
    ROBOTS: ROBOTS, DEFAULT_ROBOT: DEFAULT_ROBOT,
    robotId: robotId, robot: robot, isAim: isAim, cellMm: cellMm, mm: mm,
    itemFits: itemFits, itemsFor: itemsFor, groupsFor: groupsFor,
    CARGO: CARGO, cargoById: cargoById,
    cargoCells: cargoCells, tagCell: tagCell, tagNumbers: tagNumbers,
    jobs: jobs, makeJob: makeJob, jobText: jobText, addJob: addJob,
    removeJob: removeJob, jobOk: jobOk, validJobs: validJobs,
    SHAPES: SHAPES, COLORS: COLORS, shapeById: shapeById, colorById: colorById,
    createBoard: createBoard, boardFromTiles: boardFromTiles,
    tileKey: tileKey, hasTile: hasTile, tileList: tileList, tileCount: tileCount,
    extent: extent, normalize: normalize, isRect: isRect, setTiles: setTiles,
    cols: cols, rows: rows, key: key, inside: inside, cellCount: cellCount,
    get: get, set: set, place: place, makeItem: makeItem,
    findFirst: findFirst, findAll: findAll, tasks: tasks, usedTypes: usedTypes,
    legendItems: legendItems,
    trim: trim, countOutsideTiles: countOutsideTiles, clone: clone, isEmpty: isEmpty
  };
})();
