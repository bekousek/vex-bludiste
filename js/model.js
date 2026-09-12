/* VEX Bludiště – datový model desky
 * Deska se skládá z dlaždic 3x3 políčka. V každém políčku může být nejvýš jeden prvek.
 * Nový prvek se přidá jednoduše zápisem do tabulky ITEMS + kresbou ikony v js/icons.js.
 */
(function () {
  var VEX = (window.VEX = window.VEX || {});

  var TILE = 3;          // políček na dlaždici
  var MAX_TILES = 8;     // rozumný strop, aby se to dalo vytisknout

  /* Směry: 0 = nahoru, 1 = doprava, 2 = dolů, 3 = doleva */
  var DIRS = [
    { dx: 0, dy: -1, cz: 'nahoru' },
    { dx: 1, dy: 0, cz: 'doprava' },
    { dx: 0, dy: 1, cz: 'dolů' },
    { dx: -1, dy: 0, cz: 'doleva' }
  ];

  /* Registr prvků.
   *   rot    – prvek má natočení (0..3)
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
    mred: { label: 'Červené pole', group: 'znacky', hint: 'Barevná značka podle vlastního zadání.', legend: 'barevná značka' },
    mgreen: { label: 'Zelené pole', group: 'znacky', hint: 'Barevná značka podle vlastního zadání.', legend: 'barevná značka' },
    mblue: { label: 'Modré pole', group: 'znacky', hint: 'Barevná značka podle vlastního zadání.', legend: 'barevná značka' }
  };

  var GROUPS = [
    { id: 'trasa', label: 'Trasa' },
    { id: 'prekazky', label: 'Překážky' },
    { id: 'ukoly', label: 'Úkoly' },
    { id: 'znacky', label: 'Barevné značky' }
  ];

  function createBoard(tx, ty) {
    return { v: 1, tx: tx || 2, ty: ty || 2, title: '', cells: {} };
  }

  function cols(b) { return b.tx * TILE; }
  function rows(b) { return b.ty * TILE; }
  function key(c, r) { return c + ',' + r; }

  function inside(b, c, r) {
    return c >= 0 && r >= 0 && c < cols(b) && r < rows(b);
  }

  function get(b, c, r) { return b.cells[key(c, r)] || null; }

  function set(b, c, r, item) {
    if (!inside(b, c, r)) return;
    if (!item) delete b.cells[key(c, r)];
    else b.cells[key(c, r)] = item;
  }

  /** Položí prvek; u unikátních prvků nejdřív odstraní ten starý. */
  function place(b, c, r, type, dir) {
    if (!inside(b, c, r)) return false;
    var def = ITEMS[type];
    if (!def) return false;
    if (def.unique) {
      var old = findFirst(b, type);
      if (old) set(b, old.c, old.r, null);
    }
    set(b, c, r, def.rot ? { t: type, d: dir | 0 } : { t: type });
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

  /** Prvky použité na desce – pro legendu. */
  function usedTypes(b) {
    var seen = {}, out = [];
    for (var k in b.cells) {
      var t = b.cells[k].t;
      if (!seen[t] && ITEMS[t]) { seen[t] = 1; out.push(t); }
    }
    out.sort(function (a, z) { return Object.keys(ITEMS).indexOf(a) - Object.keys(ITEMS).indexOf(z); });
    return out;
  }

  /** Ořízne prvky mimo desku (po zmenšení). Vrací počet ztracených prvků. */
  function trim(b) {
    var lost = 0;
    for (var k in b.cells) {
      var p = k.split(',');
      if (!inside(b, +p[0], +p[1])) { delete b.cells[k]; lost++; }
    }
    return lost;
  }

  function countOutside(b, tx, ty) {
    var n = 0;
    for (var k in b.cells) {
      var p = k.split(',');
      if (+p[0] >= tx * TILE || +p[1] >= ty * TILE) n++;
    }
    return n;
  }

  function clone(b) { return JSON.parse(JSON.stringify(b)); }

  function isEmpty(b) { return Object.keys(b.cells).length === 0; }

  VEX.model = {
    TILE: TILE, MAX_TILES: MAX_TILES, DIRS: DIRS, ITEMS: ITEMS, GROUPS: GROUPS,
    createBoard: createBoard, cols: cols, rows: rows, key: key, inside: inside,
    get: get, set: set, place: place, findFirst: findFirst, findAll: findAll,
    tasks: tasks, usedTypes: usedTypes, trim: trim, countOutside: countOutside,
    clone: clone, isEmpty: isEmpty
  };
})();
