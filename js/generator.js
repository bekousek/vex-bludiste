/* VEX Bludiště – automatický generátor.
 *
 * Generátor nesází prvky náhodně. Postup je vždy stejný:
 *   1) start na kraji pole, robot kouká dovnitř
 *   2) cíl daleko od startu (nikdy ne vedle)
 *   3) nakreslí se "páteř" – smysluplná cesta s dostatkem zatáček
 *   4) hvězdičky a další úkoly se pověsí na odbočky z páteře, aby se muselo zajíždět
 *   5) překážky se sypou přednostně do přímé spojnice start–cíl, aby robot musel objíždět
 *   6) jednosměrky se položí jen tam, kde bludiště zůstane řešitelné
 *   7) hotová deska se vyřeší a zkontroluje; když je nudná nebo neřešitelná, zahodí se
 *
 * Vše počítá jen s políčky, která na desce opravdu jsou – zvládne tedy i tvar L,
 * okruh s dírou uprostřed a podobně.
 */
(function () {
  var VEX = (window.VEX = window.VEX || {});
  var M = VEX.model, S = VEX.solver;
  var DIRS = M.DIRS;

  var PRESET = {
    easy: { wallRatio: 0.13, minTurns: 2, oneways: 1, stars: 1, detour: 2, branch: 1 },
    medium: { wallRatio: 0.20, minTurns: 3, oneways: 2, stars: 2, detour: 2, branch: 1 },
    hard: { wallRatio: 0.27, minTurns: 4, oneways: 3, stars: 3, detour: 4, branch: 2 }
  };

  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(a) { return a[rnd(a.length)]; }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function manhattan(a, b) { return Math.abs(a.c - b.c) + Math.abs(a.r - b.r); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function dirOf(a, b) {
    for (var d = 0; d < 4; d++) if (a.c + DIRS[d].dx === b.c && a.r + DIRS[d].dy === b.r) return d;
    return -1;
  }

  function countTurns(path, startDir) {
    var t = 0, prev = startDir;
    for (var i = 1; i < path.length; i++) {
      var d = dirOf(path[i - 1], path[i]);
      if (d !== prev) t++;
      prev = d;
    }
    return t;
  }

  /** Náhodná cesta bez křížení ze startu do cíle, s minimem zatáček. */
  function randomPath(W, exists, start, goal, startDir, minLen, maxLen, minTurns, budget) {
    var seen = {}, path = [], steps = 0, found = null;

    function dfs(c, r) {
      if (steps++ > budget) return true;          // došel rozpočet, končíme
      var k = c + ',' + r;
      seen[k] = 1; path.push({ c: c, r: r });
      if (c === goal.c && r === goal.r) {
        if (path.length - 1 >= minLen && countTurns(path, startDir) >= minTurns) {
          found = path.slice();
          seen[k] = 0; path.pop();
          return true;
        }
      } else if (path.length - 1 < maxLen) {
        var order = shuffle([0, 1, 2, 3]);
        for (var i = 0; i < 4; i++) {
          var d = order[i], nc = c + DIRS[d].dx, nr = r + DIRS[d].dy;
          if (!exists(nc, nr) || seen[nc + ',' + nr]) continue;
          if (dfs(nc, nr)) return true;
        }
      }
      seen[k] = 0; path.pop();
      return false;
    }

    dfs(start.c, start.r);
    return found;
  }

  /** Odbočka z páteře – vrátí koncové políčko pro úkol a obsadí chodbičku. */
  function addBranch(exists, used, spine, maxLen) {
    var idx = shuffle(spine.map(function (_, i) { return i; }));
    for (var a = 0; a < idx.length; a++) {
      var i = idx[a];
      if (i === 0 || i === spine.length - 1) continue;
      var base = spine[i];
      var dirs = shuffle([0, 1, 2, 3]);
      for (var b = 0; b < 4; b++) {
        var d = dirs[b], len = 1 + rnd(maxLen), ok = true, cells = [], c = base.c, r = base.r;
        for (var k = 0; k < len; k++) {
          c += DIRS[d].dx; r += DIRS[d].dy;
          if (!exists(c, r) || used[c + ',' + r]) { ok = false; break; }
          cells.push({ c: c, r: r });
        }
        if (!ok || !cells.length) continue;
        cells.forEach(function (p) { used[p.c + ',' + p.r] = 1; });
        return cells[cells.length - 1];
      }
    }
    return null;
  }

  /** Políčka na kraji pole – mají aspoň jednoho chybějícího souseda. */
  function borderCells(cells, exists) {
    var out = [];
    cells.forEach(function (p) {
      var openIn = [], d;
      for (d = 0; d < 4; d++) {
        if (exists(p.c + DIRS[d].dx, p.r + DIRS[d].dy)) openIn.push(d);
      }
      if (openIn.length < 4 && openIn.length > 0) out.push({ c: p.c, r: p.r, dirs: openIn });
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

  /* Zavřela by zeď na tomhle políčku plný čtverec 2x2 zdí? Takové bloky dělají
   * z desky mrtvou plochu, zatímco linka zdí vedle sebe je v pořádku. */
  var DIAG = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  function makesSolidBlock(board, c, r) {
    for (var i = 0; i < 4; i++) {
      var dx = DIAG[i][0], dy = DIAG[i][1];
      if (isWall(board, c + dx, r) && isWall(board, c, r + dy) && isWall(board, c + dx, r + dy)) return true;
    }
    return false;
  }

  /* Zdi mají tvořit linky a samostatné překážky, ne mrtvou plochu. Poznáme ji
   * tak, že některá zeď má tři a více zdí kolem sebe – to už není linka, ale masa. */
  function hasWallMass(board, cells) {
    for (var i = 0; i < cells.length; i++) {
      var p = cells[i];
      if (!isWall(board, p.c, p.r)) continue;
      if (wallNeighbours(board, p.c, p.r) >= 3) return true;
    }
    return false;
  }

  function attempt(o, relax) {
    var board = M.boardFromTiles(o.tiles);
    var W = M.cols(board), H = M.rows(board);
    var exists = function (c, r) { return M.inside(board, c, r); };

    var cells = [], c, r;
    for (r = 0; r < H; r++) {
      for (c = 0; c < W; c++) if (exists(c, r)) cells.push({ c: c, r: r });
    }
    var N = cells.length;
    if (N < 6) return null;

    var p = PRESET[o.difficulty] || PRESET.medium;
    var span = Math.round(Math.sqrt(N) * 2);          // typický rozměr pole
    var minTurns = Math.max(1, Math.min(p.minTurns - relax, Math.floor(span / 3)));
    var needDetour = Math.max(0, p.detour - relax * 2);

    var borders = borderCells(cells, exists);
    if (!borders.length) return null;
    var bs = pick(borders);
    var start = { c: bs.c, r: bs.r, d: pick(bs.dirs) };

    // cíl dostatečně daleko – hranici přizpůsobíme tvaru pole
    var dists = cells.map(function (q) { return manhattan(start, q); });
    var maxDist = Math.max.apply(null, dists);
    var minDist = clamp(Math.round(span * 0.5) - relax, 3, maxDist);

    var cands = cells.filter(function (q) { return manhattan(start, q) >= minDist; });
    if (!cands.length) return null;
    cands.sort(function (a, z) { return manhattan(start, z) - manhattan(start, a); });
    var finish = pick(cands.slice(0, Math.max(3, Math.ceil(cands.length * 0.5))));

    var spine = randomPath(W, exists, start, finish, start.d,
      minDist, Math.min(N - 1, minDist * 2 + 6), minTurns, 40000);
    if (!spine) return null;

    var used = {};
    spine.forEach(function (q) { used[q.c + ',' + q.r] = 1; });

    // úkoly na odbočkách
    var taskTypes = [];
    var i;
    if (o.stars) for (i = 0; i < (o.starCount || p.stars); i++) taskTypes.push('star');
    if (o.sound) taskTypes.push('sound');
    if (o.light) taskTypes.push('light');

    var taskCells = [];
    for (i = 0; i < taskTypes.length; i++) {
      var cell = addBranch(exists, used, spine, p.branch + 1);
      if (!cell) {                       // není kam odbočit – dej úkol na páteř
        var freeSpine = spine.slice(1, spine.length - 1).filter(function (q) {
          return !taskCells.some(function (tc) { return tc.c === q.c && tc.r === q.r; });
        });
        if (!freeSpine.length) continue;
        cell = pick(freeSpine);
      }
      taskCells.push({ c: cell.c, r: cell.r, t: taskTypes[i] });
    }

    // ---- stavba desky ----
    M.place(board, start.c, start.r, 'start', { d: start.d });
    M.place(board, finish.c, finish.r, 'finish');
    taskCells.forEach(function (t) {
      if ((t.c === start.c && t.r === start.r) || (t.c === finish.c && t.r === finish.r)) return;
      M.place(board, t.c, t.r, t.t);
    });

    // zdi – nejdřív do přímé spojnice start–cíl, aby robot musel objíždět
    var bx0 = Math.min(start.c, finish.c), bx1 = Math.max(start.c, finish.c);
    var by0 = Math.min(start.r, finish.r), by1 = Math.max(start.r, finish.r);
    var inBox = [], outBox = [];
    cells.forEach(function (q) {
      if (used[q.c + ',' + q.r] || M.get(board, q.c, q.r)) return;
      (q.c >= bx0 && q.c <= bx1 && q.r >= by0 && q.r <= by1 ? inBox : outBox).push(q);
    });
    var order = shuffle(inBox).concat(shuffle(outBox));
    var wantWalls = Math.min(
      Math.round(N * (p.wallRatio + (relax ? -0.03 : 0))),
      Math.floor(N * 0.45),
      order.length
    );
    // Zdi klademe rozptýleně: nejdřív jen tam, kde ještě žádná zeď nestojí vedle.
    // Teprve když jich je málo, povolíme těsnější sousedství. Jinak vznikne
    // jeden velký slepý blok, který sežere půlku desky.
    var done = 0, limit;
    for (limit = 1; limit <= 3 && done < wantWalls; limit++) {
      for (i = 0; i < order.length && done < wantWalls; i++) {
        var q = order[i];
        if (M.get(board, q.c, q.r)) continue;
        if (wallNeighbours(board, q.c, q.r) >= limit) continue;
        if (makesSolidBlock(board, q.c, q.r)) continue;
        M.place(board, q.c, q.r, 'wall');
        done++;
      }
    }
    if (hasWallMass(board, cells)) return null;

    if (!S.solve(board).ok) return null;

    // Šipku klademe na políčko, kterým robot podle řešení opravdu projíždí rovně,
    // a to ve směru jízdy. Tím má jednosměrka smysl a bludiště zůstane řešitelné.
    var wantOne = o.oneway ? Math.max(0, p.oneways - relax) : 0;
    var placed = 0, guard = 0;
    while (placed < wantOne && guard++ < wantOne + 3) {
      var cur = S.solve(board);
      if (!cur.ok) break;
      var owCands = [];
      for (i = 1; i < cur.path.length - 1; i++) {
        var d1 = dirOf(cur.path[i - 1], cur.path[i]), d2 = dirOf(cur.path[i], cur.path[i + 1]);
        if (d1 < 0 || d1 !== d2) continue;                 // jen rovný průjezd
        var q2 = cur.path[i];
        if (M.get(board, q2.c, q2.r)) continue;            // políčko musí být volné
        owCands.push({ c: q2.c, r: q2.r, d: d1 });
      }
      if (!owCands.length) break;
      shuffle(owCands);
      var stuck = true;
      for (i = 0; i < owCands.length && i < 6; i++) {
        var ow = owCands[i];
        M.place(board, ow.c, ow.r, 'oneway', { d: ow.d });
        if (S.solve(board, { quick: true }).ok) { placed++; stuck = false; break; }
        M.set(board, ow.c, ow.r, null);
      }
      if (stuck) break;
    }

    // ---- závěrečná kontrola kvality ----
    var full = S.solve(board);
    if (!full.ok) return null;

    var bare = M.clone(board);
    M.tasks(bare).forEach(function (t) { M.set(bare, t.c, t.r, null); });
    var direct = S.solve(bare);
    if (!direct.ok) return null;

    var md = manhattan(start, finish);
    var walls = M.findAll(board, function (it) { return it.t === 'wall'; }).length;
    var freeRatio = 1 - walls / N;

    var minStraight = relax ? md : md + (o.difficulty === 'easy' ? 0 : 2);
    var checks =
      full.turns >= minTurns &&
      direct.steps >= minStraight &&
      freeRatio >= 0.5 &&
      full.cost <= 4 * span + 14 &&
      (taskCells.length === 0 || full.cost - direct.cost >= needDetour);

    if (!checks) return null;

    return {
      board: board,
      info: {
        steps: full.steps, turns: full.turns, cost: full.cost,
        detour: full.cost - direct.cost,
        walls: walls, tasks: full.taskCount
      }
    };
  }

  /** Vygeneruje bludiště do zadaného tvaru. Vrací {board, info} nebo null. */
  function generate(opts) {
    var t0 = Date.now(), best = null;
    for (var i = 0; i < 400; i++) {
      var relax = i > 150 ? (i > 280 ? 2 : 1) : 0;
      var res = attempt(opts, relax);
      if (res) { best = res; break; }
      if (Date.now() - t0 > 2500) break;
    }
    return best;
  }

  VEX.generator = { generate: generate, PRESET: PRESET };
})();
