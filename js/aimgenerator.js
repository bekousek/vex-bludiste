/* VEX Bludiště – automatický generátor desek pro robota VEX AIM.
 *
 * Postup je vždy stejný:
 *   1) start na kraji pole, robot kouká dovnitř
 *   2) zastávky s AprilTagem u okraje, daleko od startu i od sebe
 *   3) náklad doprostřed pole, ne hned vedle zastávky
 *   4) překážky rozptýleně, nikdy tak, aby náklad zůstal obklopený
 *   5) hotová deska se vyřeší ve všech třech variantách; když není řešitelná
 *      nebo na ní není vidět rozdíl mezi tlačítky a bloky, zahodí se
 */
(function () {
  var VEX = (window.VEX = window.VEX || {});
  var M = VEX.model, A = VEX.aimsolver, AV = VEX.aimvision;
  var DIRS = M.DIRS;

  var PRESET = {
    easy: { jobs: 1, wallRatio: 0, ball: false, gain: 2 },
    medium: { jobs: 2, wallRatio: 0.10, ball: false, gain: 4 },
    hard: { jobs: 3, wallRatio: 0.16, ball: true, gain: 6 }
  };

  var CARGO_ORDER = ['orange', 'blue', 'orange'];

  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(a) { return a[rnd(a.length)]; }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function manhattan(a, b) { return Math.abs(a.c - b.c) + Math.abs(a.r - b.r); }
  function farFromAll(q, list, min) {
    return list.every(function (p) { return manhattan(q, p) >= min; });
  }

  /** Políčka na kraji pole i se směry dovnitř. */
  function borderCells(cells, exists) {
    var out = [];
    cells.forEach(function (p) {
      var open = [], d;
      for (d = 0; d < 4; d++) if (exists(p.c + DIRS[d].dx, p.r + DIRS[d].dy)) open.push(d);
      if (open.length < 4 && open.length > 0) out.push({ c: p.c, r: p.r, dirs: open });
    });
    return out;
  }

  function isWall(board, c, r) {
    var it = M.get(board, c, r);
    return !!it && it.t === 'wall';
  }

  function wallNeighbours(board, c, r) {
    var n = 0;
    for (var d = 0; d < 4; d++) if (isWall(board, c + DIRS[d].dx, r + DIRS[d].dy)) n++;
    return n;
  }

  var DIAG = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  function makesSolidBlock(board, c, r) {
    for (var i = 0; i < 4; i++) {
      var dx = DIAG[i][0], dy = DIAG[i][1];
      if (isWall(board, c + dx, r) && isWall(board, c, r + dy) && isWall(board, c + dx, r + dy)) return true;
    }
    return false;
  }

  /** Kolik volných sousedů políčko má (mimo desku se počítá jako zeď). */
  function openNeighbours(board, exists, c, r) {
    var n = 0;
    for (var d = 0; d < 4; d++) {
      var nc = c + DIRS[d].dx, nr = r + DIRS[d].dy;
      if (!exists(nc, nr)) continue;
      var it = M.get(board, nc, nr);
      if (!it || !(M.ITEMS[it.t] && M.ITEMS[it.t].blocks)) n++;
    }
    return n;
  }

  function attempt(o, relax) {
    var board = M.boardFromTiles(o.tiles, 'aim');
    var exists = function (c, r) { return M.inside(board, c, r); };
    var W = M.cols(board), H = M.rows(board), c, r, i;

    var cells = [];
    for (r = 0; r < H; r++) {
      for (c = 0; c < W; c++) if (exists(c, r)) cells.push({ c: c, r: r });
    }
    var N = cells.length;
    if (N < 12) return null;

    var p = PRESET[o.difficulty] || PRESET.medium;
    var span = Math.round(Math.sqrt(N) * 2);
    var wantJobs = Math.max(1, p.jobs - (relax > 1 ? 1 : 0));
    var withBall = p.ball && o.ball !== false;
    var wallRatio = o.walls === false ? 0 : Math.max(0, p.wallRatio - relax * 0.04);

    var borders = borderCells(cells, exists);
    if (borders.length < wantJobs + 1) return null;

    /* ---- start ---- */
    var bs = pick(borders);
    var start = { c: bs.c, r: bs.r, d: pick(bs.dirs) };
    M.place(board, start.c, start.r, 'start', { d: start.d });

    /* ---- zastávky u okraje ---- */
    var minApart = Math.max(2, Math.min(4, Math.floor(span / 2) - relax));
    var tags = [];
    shuffle(borders.slice()).forEach(function (q) {
      if (tags.length >= wantJobs) return;
      if (manhattan(q, start) < minApart) return;
      if (!farFromAll(q, tags, minApart)) return;
      tags.push({ c: q.c, r: q.r });
    });
    if (tags.length < wantJobs) return null;

    /* Branka pro míček dostane nulu, zastávky se číslují od jedničky. */
    var jobs = [];
    for (i = 0; i < tags.length; i++) {
      var kick = withBall && i === 0;
      var num = kick ? 0 : i + (withBall ? 0 : 1);
      M.place(board, tags[i].c, tags[i].r, 'tag', { n: num });
      jobs.push({
        kind: kick ? 'kick' : 'deliver',
        cargo: kick ? 'ball' : CARGO_ORDER[i % CARGO_ORDER.length],
        tag: num
      });
    }

    /* ---- náklad doprostřed ---- */
    var inner = shuffle(cells.filter(function (q) {
      if (M.get(board, q.c, q.r)) return false;
      if (manhattan(q, start) < 2) return false;
      return farFromAll(q, tags, 2);
    }));
    var cargoCells = [];
    for (i = 0; i < jobs.length; i++) {
      var spot = null;
      for (var k = 0; k < inner.length; k++) {
        var q2 = inner[k];
        if (M.get(board, q2.c, q2.r)) continue;
        if (!farFromAll(q2, cargoCells, 2)) continue;
        spot = q2; break;
      }
      if (!spot) return null;
      M.place(board, spot.c, spot.r, jobs[i].cargo);
      cargoCells.push(spot);
    }

    /* Jeden sud navíc, ať má kamera co poznávat. Vždy barva, kterou nikdo nehledá. */
    if (o.difficulty === 'hard' && !relax) {
      var wanted = {};
      jobs.forEach(function (j) { wanted[j.cargo] = 1; });
      var spare = ['orange', 'blue'].filter(function (t) { return !wanted[t]; })[0];
      var spot2 = inner.filter(function (q) {
        return !M.get(board, q.c, q.r) && farFromAll(q, cargoCells, 2);
      })[0];
      if (spare && spot2) M.place(board, spot2.c, spot2.r, spare);
    }

    /* ---- překážky ---- */
    var keepFree = {};
    tags.forEach(function (t) {
      for (var d = 0; d < 4; d++) keepFree[(t.c + DIRS[d].dx) + ',' + (t.r + DIRS[d].dy)] = 1;
    });
    var order = shuffle(cells.filter(function (q) {
      return !M.get(board, q.c, q.r) && !keepFree[q.c + ',' + q.r];
    }));
    var wantWalls = Math.min(Math.round(N * wallRatio), Math.floor(N * 0.3), order.length);
    var done = 0, limit;
    for (limit = 1; limit <= 2 && done < wantWalls; limit++) {
      for (i = 0; i < order.length && done < wantWalls; i++) {
        var q3 = order[i];
        if (M.get(board, q3.c, q3.r)) continue;
        if (wallNeighbours(board, q3.c, q3.r) >= limit) continue;
        if (makesSolidBlock(board, q3.c, q3.r)) continue;
        M.place(board, q3.c, q3.r, 'wall');
        // náklad nikdy neuzavřeme do kouta
        var tight = cargoCells.some(function (cc) {
          return openNeighbours(board, exists, cc.c, cc.r) < 2;
        });
        if (tight) { M.set(board, q3.c, q3.r, null); continue; }
        done++;
      }
    }

    /* ---- natočení startu ----
     * Ze všech směrů dovnitř vezmeme ten, ze kterého kamera uvidí nejvíc věcí.
     * Jinak robot kouká podél kraje a náhled „co vidí robot“ je prázdný. */
    if (AV) {
      var bestDir = start.d, bestSeen = -1;
      bs.dirs.forEach(function (d) {
        M.place(board, start.c, start.r, 'start', { d: d });
        var look = AV.look(board);
        var seen = look.ok ? look.items.filter(function (o) { return o.visible; }).length : 0;
        if (seen > bestSeen) { bestSeen = seen; bestDir = d; }
      });
      M.place(board, start.c, start.r, 'start', { d: bestDir });
      start.d = bestDir;
    }

    /* ---- úkoly a kontrola ---- */
    board.jobs = jobs;
    if (M.validJobs(board)) return null;

    var res = A.solve(board);
    if (!res.ok) return null;
    var counts = res.variants.map(function (v) { return v.count; });
    if (counts[2] > counts[1]) return null;          // šikmo nikdy ne hůř než bokem
    if (counts[1] > counts[0]) return null;          // bloky nikdy ne hůř než tlačítka
    if (counts[0] - counts[1] < Math.max(1, p.gain - relax * 2)) return null;
    if (counts[0] > 5 * span + 20) return null;      // program, který se nedá přečíst

    var walls = M.findAll(board, function (it) { return it.t === 'wall'; }).length;
    if (1 - walls / N < 0.6) return null;

    return {
      board: board,
      info: { counts: counts, walls: walls, jobs: jobs.length, variants: res.variants }
    };
  }

  /** Vygeneruje desku AIM do zadaného tvaru. Vrací {board, info} nebo null. */
  function generate(opts) {
    var t0 = Date.now();
    for (var i = 0; i < 400; i++) {
      var relax = i > 150 ? (i > 280 ? 2 : 1) : 0;
      var res = attempt(opts, relax);
      if (res) return res;
      if (Date.now() - t0 > 2500) break;
    }
    return null;
  }

  VEX.aimgenerator = { generate: generate, PRESET: PRESET };
})();
