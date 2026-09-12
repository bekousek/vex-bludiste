/* VEX Bludiště – datový model desky
 * Deska je sada dlaždic 3x3 políčka, poskládaná do libovolného tvaru
 * (obdélník, písmeno L, okruh s dírou uprostřed…). V každém políčku
 * může být nejvýš jeden prvek.
 * Nový prvek se přidá zápisem do tabulky ITEMS + kresbou ikony v js/icons.js.
 */
(function () {
  var VEX = (window.VEX = window.VEX || {});

  var TILE = 3;          // políček na dlaždici
  var MAX_TILES = 8;     // strop na šířku i výšku, aby se to dalo vytisknout

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
   *   custom – prvek má volbu tvaru a barvy
   *   unique – na desce smí být jen jeden
   *   blocks – políčko je neprůjezdné
   *   task   – robot na políčku musí něco udělat (generátor to zahrne do trasy)
   *   group  – zařazení v paletě
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
      label: 'Jednosměrka', group: 'prekazky', rot: true,
      hint: 'Přes políčko se smí projet jen ve směru šipky.',
      legend: 'přejezd pouze tímto směrem'
    },
    star: {
      label: 'Hvězdička', group: 'ukoly', task: true,
      hint: 'Hvězdičku musí robot cestou sebrat.',
      legend: 'hvězdička k sebrání'
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
    }
  };

  var GROUPS = [
    { id: 'trasa', label: 'Trasa' },
    { id: 'prekazky', label: 'Překážky' },
    { id: 'ukoly', label: 'Úkoly' },
    { id: 'znacky', label: 'Značka' }
  ];

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

  function createBoard(tx, ty) {
    var b = { v: 2, tiles: {}, cells: {}, title: '' };
    for (var y = 0; y < (ty || 2); y++) {
      for (var x = 0; x < (tx || 2); x++) b.tiles[tileKey(x, y)] = 1;
    }
    return b;
  }

  function boardFromTiles(tiles) {
    var b = { v: 2, tiles: {}, cells: {}, title: '' };
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
    if (def.custom) {
      it.s = shapeById(opts.s).id;
      it.col = colorById(opts.col).id;
    }
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

  /** Řádky legendy podle toho, co na desce opravdu je.
   * Vlastní značky se rozepíšou na každý použitý tvar a barvu zvlášť. */
  function legendItems(b) {
    var order = Object.keys(ITEMS), seen = {}, out = [];
    for (var k in b.cells) {
      var it = b.cells[k], def = ITEMS[it.t];
      if (!def) continue;
      var id = def.custom ? it.t + ':' + it.s + ':' + it.col : it.t;
      if (seen[id]) continue;
      seen[id] = 1;
      out.push({ item: it, text: def.legend, sort: order.indexOf(it.t) });
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
    TILE: TILE, MAX_TILES: MAX_TILES, DIRS: DIRS, ITEMS: ITEMS, GROUPS: GROUPS,
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
