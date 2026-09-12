/* VEX Bludiště – automatický generátor.
 *
 * Generátor nesází prvky náhodně. Postup je vždy stejný:
 *   1) start na kraji desky, robot kouká dovnitř
 *   2) cíl daleko od startu (nikdy ne vedle)
 *   3) nakreslí se "páteř" – smysluplná cesta s dostatkem zatáček
 *   4) hvězdičky a další úkoly se pověsí na odbočky z páteře, aby se muselo zajíždět
 *   5) překážky se sypou přednostně do přímé spojnice start–cíl, aby robot musel objíždět
 *   6) jednosměrky se položí jen tam, kde bludiště zůstane řešitelné
 *   7) hotová deska se vyřeší a zkontroluje; když je nudná nebo neřešitelná, zahodí se
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
  function randomPath(W, H, start, goal, startDir, minLen, maxLen, minTurns, budget) {
    var seen = new Uint8Array(W * H), path = [], steps = 0, found = null;

    function dfs(c, r) {
      if (steps++ > budget) return true;          // došel rozpočet, končíme
      seen[r * W + c] = 1; path.push({ c: c, r: r });
      if (c === goal.c && r === goal.r) {
        if (path.length - 1 >= minLen && countTurns(path, startDir) >= minTurns) {
          found = path.slice();
          seen[r * W + c] = 0; path.pop();
          return true;
        }
      } else if (path.length - 1 < maxLen) {
        var order = shuffle([0, 1, 2, 3]);
        for (var i = 0; i < 4; i++) {
          var d = order[i], nc = c + DIRS[d].dx, nr = r + DIRS[d].dy;
          if (nc < 0 || nr < 0 || nc >= W || nr >= H) continue;
          if (seen[nr * W + nc]) continue;
          // drobné nasměrování k cíli, ať to nebloudí donekonečna
          if (dfs(nc, nr)) return true;
        }
      }
      seen[r * W + c] = 0; path.pop();
      return false;
    }

    dfs(start.c, start.r);
    return found;
  }

  /** Odbočka z páteře – vrátí koncové políčko pro úkol a obsadí chodbičku. */
  function addBranch(W, H, used, spine, maxLen) {
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
          if (c < 0 || r < 0 || c >= W || r >= H || used[r * W + c]) { ok = false; break; }
          cells.push({ c: c, r: r });
        }
        if (!ok || !cells.length) continue;
        cells.forEach(function (p) { used[p.r * W + p.c] = 1; });
        return cells[cells.length - 1];
      }
    }
    return null;
  }

  function borderStart(W, H) {
    var opts = [], c, r;
    for (c = 0; c < W; c++) { opts.push({ c: c, r: 0, d: 2 }); opts.push({ c: c, r: H - 1, d: 0 }); }
    for (r = 0; r < H; r++) { opts.push({ c: 0, r: r, d: 1 }); opts.push({ c: W - 1, r: r, d: 3 }); }
    return pick(opts);
  }

  /** Volná políčka bez jediného volného souseda zazdíme – vypadá to lépe. */
  function fillPockets(board, W, H) {
    var changed = true;
    while (changed) {
      changed = false;
      for (var r = 0; r < H; r++) {
        for (var c = 0; c < W; c++) {
          var it = M.get(board, c, r);
          if (it) continue;
          var free = 0;
          for (var d = 0; d < 4; d++) {
            var nc = c + DIRS[d].dx, nr = r + DIRS[d].dy;
            if (nc < 0 || nr < 0 || nc >= W || nr >= H) continue;
            var n = M.get(board, nc, nr);
            if (!n || n.t !== 'wall') free++;
          }
          if (free === 0) { M.set(board, c, r, { t: 'wall' }); changed = true; }
        }
      }
    }
  }

  function attempt(o, relax) {
    var W = o.tx * 3, H = o.ty * 3, N = W * H;
    var p = PRESET[o.difficulty] || PRESET.medium;

    var minDist = clamp(Math.round((W + H) * 0.5), 3, W + H - 2);
    var minTurns = Math.max(1, Math.min(p.minTurns - relax, Math.floor((W + H) / 3)));
    var needDetour = Math.max(0, p.detour - relax * 2);

    var start = borderStart(W, H);

    // cíl dostatečně daleko
    var cands = [];
    for (var r = 0; r < H; r++) {
      for (var c = 0; c < W; c++) {
        var dd = manhattan(start, { c: c, r: r });
        if (dd >= minDist) cands.push({ c: c, r: r, d: dd });
      }
    }
    if (!cands.length) return null;
    cands.sort(function (a, z) { return z.d - a.d; });
    var finish = pick(cands.slice(0, Math.max(3, Math.ceil(cands.length * 0.5))));

    var spine = randomPath(W, H, start, finish, start.d,
      minDist, Math.min(N - 1, minDist * 2 + 6), minTurns, 40000);
    if (!spine) return null;

    var used = new Uint8Array(N);
    spine.forEach(function (q) { used[q.r * W + q.c] = 1; });

    // úkoly na odbočkách
    var taskTypes = [];
    if (o.stars) for (var i = 0; i < (o.starCount || p.stars); i++) taskTypes.push('star');
    if (o.sound) taskTypes.push('sound');
    if (o.light) taskTypes.push('light');

    var taskCells = [];
    for (i = 0; i < taskTypes.length; i++) {
      var cell = addBranch(W, H, used, spine, p.branch + 1);
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
    var board = M.createBoard(o.tx, o.ty);
    M.place(board, start.c, start.r, 'start', start.d);
    M.place(board, finish.c, finish.r, 'finish');
    taskCells.forEach(function (t) {
      if ((t.c === start.c && t.r === start.r) || (t.c === finish.c && t.r === finish.r)) return;
      M.place(board, t.c, t.r, t.t);
    });

    // zdi – nejdřív do přímé spojnice start–cíl, aby robot musel objíždět
    var bx0 = Math.min(start.c, finish.c), bx1 = Math.max(start.c, finish.c);
    var by0 = Math.min(start.r, finish.r), by1 = Math.max(start.r, finish.r);
    var inBox = [], outBox = [];
    for (r = 0; r < H; r++) {
      for (c = 0; c < W; c++) {
        if (used[r * W + c]) continue;
        if (M.get(board, c, r)) continue;
        (c >= bx0 && c <= bx1 && r >= by0 && r <= by1 ? inBox : outBox).push({ c: c, r: r });
      }
    }
    var order = shuffle(inBox).concat(shuffle(outBox));
    var wantWalls = Math.min(
      Math.round(N * (p.wallRatio + (relax ? -0.03 : 0))),
      Math.floor(N * 0.45),
      order.length
    );
    for (i = 0; i < wantWalls; i++) M.place(board, order[i].c, order[i].r, 'wall');
    fillPockets(board, W, H);

    // ---- kontrola po zdech ----
    var sol = S.solve(board);
    if (!sol.ok) return null;

    // ---- jednosměrky ----
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
        var q = cur.path[i];
        if (M.get(board, q.c, q.r)) continue;              // políčko musí být volné
        owCands.push({ c: q.c, r: q.r, d: d1 });
      }
      if (!owCands.length) break;
      shuffle(owCands);
      var stuck = true;
      for (i = 0; i < owCands.length && i < 6; i++) {
        var ow = owCands[i];
        M.place(board, ow.c, ow.r, 'oneway', ow.d);
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
    var freeRatio = 1 - M.findAll(board, function (it) { return it.t === 'wall'; }).length / N;

    var minStraight = relax ? md : md + (o.difficulty === 'easy' ? 0 : 2);
    var checks =
      full.turns >= minTurns &&
      direct.steps >= minStraight &&
      freeRatio >= 0.5 &&
      full.cost <= 3 * (W + H) + 14 &&
      (taskCells.length === 0 || full.cost - direct.cost >= needDetour);

    if (!checks) return null;

    return {
      board: board,
      info: {
        steps: full.steps, turns: full.turns, cost: full.cost,
        detour: full.cost - direct.cost,
        walls: M.findAll(board, function (it) { return it.t === 'wall'; }).length,
        tasks: full.taskCount
      }
    };
  }

  /** Vygeneruje bludiště. Vrací {board, info} nebo null, když to nevyšlo. */
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
