/* VEX Bludiště – řešitel.
 * Robot stojí na políčku a je natočený jedním ze 4 směrů.
 * Jeden příkaz = popojet o políčko vpřed, nebo se otočit o 90 stupňů.
 * Hledá se nejkratší program: start -> všechny úkoly (v nejlepším pořadí) -> cíl.
 */
(function () {
  var VEX = (window.VEX = window.VEX || {});
  var M = VEX.model;
  var DIRS = M.DIRS;

  function stateIdx(w, c, r, d) { return ((r * w + c) << 2) | d; }

  /** Smí robot projet políčkem směrem d? */
  function passes(item, d) {
    if (!item) return true;
    if (item.t === 'wall') return false;
    if (item.t === 'oneway') return item.d === d;
    return true;
  }

  function buildGrid(b) {
    var w = M.cols(b), h = M.rows(b), n = w * h;
    var block = new Uint8Array(n);      // 1 = zákaz vjezdu nebo mimo desku
    var way = new Int8Array(n).fill(-1); // směr jednosměrky, -1 = žádná
    var c, r;
    // políčka mimo položené dlaždice jsou pro robota stejná jako zeď
    for (r = 0; r < h; r++) {
      for (c = 0; c < w; c++) if (!M.inside(b, c, r)) block[r * w + c] = 1;
    }
    for (var k in b.cells) {
      var p = k.split(','); c = +p[0]; r = +p[1];
      var it = b.cells[k];
      if (c >= w || r >= h) continue;
      var i = r * w + c;
      if (it.t === 'wall') block[i] = 1;
      else if (it.t === 'oneway') way[i] = it.d | 0;
    }
    return { w: w, h: h, n: n, block: block, way: way };
  }

  function canStep(g, c, r, nc, nr, d) {
    if (nc < 0 || nr < 0 || nc >= g.w || nr >= g.h) return false;
    var from = r * g.w + c, to = nr * g.w + nc;
    if (g.block[to]) return false;
    if (g.way[from] >= 0 && g.way[from] !== d) return false;
    if (g.way[to] >= 0 && g.way[to] !== d) return false;
    return true;
  }

  /** BFS přes stavy (políčko, natočení). Každá hrana stojí 1 příkaz. */
  function bfs(g, src, wantPrev) {
    var total = g.n * 4;
    var dist = new Int32Array(total).fill(-1);
    var prev = wantPrev ? new Int32Array(total).fill(-1) : null;
    var q = new Int32Array(total), head = 0, tail = 0;
    dist[src] = 0; q[tail++] = src;
    while (head < tail) {
      var s = q[head++], cell = s >> 2, d = s & 3;
      var c = cell % g.w, r = (cell / g.w) | 0, dd = dist[s];
      var i, ns;
      // otočení vlevo / vpravo
      for (i = 0; i < 2; i++) {
        ns = (cell << 2) | ((d + (i ? 1 : 3)) & 3);
        if (dist[ns] < 0) { dist[ns] = dd + 1; if (prev) prev[ns] = s; q[tail++] = ns; }
      }
      // jízda vpřed
      var nc = c + DIRS[d].dx, nr = r + DIRS[d].dy;
      if (canStep(g, c, r, nc, nr, d)) {
        ns = stateIdx(g.w, nc, nr, d);
        if (dist[ns] < 0) { dist[ns] = dd + 1; if (prev) prev[ns] = s; q[tail++] = ns; }
      }
    }
    return { dist: dist, prev: prev };
  }

  function pathBetween(g, from, to) {
    var res = bfs(g, from, true);
    if (res.dist[to] < 0) return null;
    var out = [], s = to;
    while (s !== -1) { out.push(s); s = res.prev[s]; }
    return out.reverse();
  }

  /**
   * Převede řetěz stavů na příkazy. Úkol se hlásí ve chvíli, kdy na políčko
   * robot poprvé přijede – ne až na konci úseku.
   */
  function toCommands(g, states, cellActions, finalText) {
    var cmds = [], cells = [], stops = [], done = {}, i, run = 0, turns = 0, steps = 0;
    function flush() { if (run) { cmds.push({ type: 'move', n: run }); run = 0; } }

    function arrive(c, r) {
      var k = c + ',' + r;
      if (!cellActions[k] || done[k]) return;
      done[k] = 1;
      flush();
      cmds.push({ type: 'act', text: cellActions[k] });
      stops.push({ c: c, r: r });
    }

    var c0 = (states[0] >> 2) % g.w, r0 = ((states[0] >> 2) / g.w) | 0;
    cells.push({ c: c0, r: r0 });
    arrive(c0, r0);

    for (i = 1; i < states.length; i++) {
      var a = states[i - 1], b = states[i];
      if ((a >> 2) === (b >> 2)) {
        flush();
        cmds.push({ type: 'turn', right: (((a & 3) + 1) & 3) === (b & 3) });
        turns++;
      } else {
        run++; steps++;
        var cell = b >> 2, cc = cell % g.w, rr = (cell / g.w) | 0;
        cells.push({ c: cc, r: rr });
        arrive(cc, rr);
      }
    }
    flush();
    if (finalText) cmds.push({ type: 'act', text: finalText });
    return { cmds: cmds, cells: cells, stops: stops, turns: turns, steps: steps };
  }

  var ACTION_TEXT = {
    star: 'Seber hvězdičku',
    sound: 'Zahraj zvuk',
    light: 'Rozsviť se'
  };

  /**
   * Vyřeší desku.
   * Vrací { ok, reason, steps, turns, commands, path, stops, order }
   * opts.quick = jen délka řešení, bez rekonstrukce trasy
   */
  function solve(b, opts) {
    opts = opts || {};
    var st = M.findFirst(b, 'start');
    if (!st) return { ok: false, reason: 'Na desce chybí START.' };
    var fi = M.findFirst(b, 'finish');
    if (!fi) return { ok: false, reason: 'Na desce chybí CÍL.' };

    var g = buildGrid(b);
    if (g.block[st.r * g.w + st.c]) return { ok: false, reason: 'Start stojí na zakázaném políčku.' };

    var tasks = M.tasks(b);
    if (tasks.length > 10) tasks = tasks.slice(0, 10);
    var nt = tasks.length;

    var srcState = stateIdx(g.w, st.c, st.r, (st.item.d | 0));

    // BFS ze startu a ze všech natočení nad úkolovými políčky
    var fromStart = bfs(g, srcState, false).dist;
    var taskDist = [];  // taskDist[j][d] = pole vzdáleností
    for (var j = 0; j < nt; j++) {
      taskDist[j] = [];
      for (var d = 0; d < 4; d++) {
        taskDist[j][d] = bfs(g, stateIdx(g.w, tasks[j].c, tasks[j].r, d), false).dist;
      }
    }

    var INF = 1e9;
    var finCell = { c: fi.c, r: fi.r };

    function finBest(distArr) {
      var best = INF, bd = -1;
      for (var d = 0; d < 4; d++) {
        var v = distArr[stateIdx(g.w, finCell.c, finCell.r, d)];
        if (v >= 0 && v < best) { best = v; bd = d; }
      }
      return { cost: best, dir: bd };
    }

    var result;
    if (nt === 0) {
      var fb = finBest(fromStart);
      if (fb.cost >= INF) return { ok: false, reason: 'Robot se nemůže dostat do cíle.' };
      result = { cost: fb.cost, order: [], dirs: [], finDir: fb.dir };
    } else {
      var full = (1 << nt) - 1;
      var size = (full + 1) * nt * 4;
      var dp = new Float64Array(size).fill(INF);
      var par = new Int32Array(size).fill(-1);
      function key(mask, j, d) { return (mask * nt + j) * 4 + d; }

      for (j = 0; j < nt; j++) {
        for (d = 0; d < 4; d++) {
          var v = fromStart[stateIdx(g.w, tasks[j].c, tasks[j].r, d)];
          if (v >= 0) dp[key(1 << j, j, d)] = v;
        }
      }
      for (var mask = 1; mask <= full; mask++) {
        for (j = 0; j < nt; j++) {
          if (!(mask & (1 << j))) continue;
          for (d = 0; d < 4; d++) {
            var cur = dp[key(mask, j, d)];
            if (cur >= INF) continue;
            for (var k = 0; k < nt; k++) {
              if (mask & (1 << k)) continue;
              var dk = taskDist[j][d];
              for (var d2 = 0; d2 < 4; d2++) {
                var step = dk[stateIdx(g.w, tasks[k].c, tasks[k].r, d2)];
                if (step < 0) continue;
                var nk = key(mask | (1 << k), k, d2);
                if (cur + step < dp[nk]) { dp[nk] = cur + step; par[nk] = j * 4 + d; }
              }
            }
          }
        }
      }
      var best = INF, bj = -1, bd2 = -1, bfin = -1;
      for (j = 0; j < nt; j++) {
        for (d = 0; d < 4; d++) {
          var cur2 = dp[key(full, j, d)];
          if (cur2 >= INF) continue;
          var fbx = finBest(taskDist[j][d]);
          if (fbx.cost >= INF) continue;
          if (cur2 + fbx.cost < best) { best = cur2 + fbx.cost; bj = j; bd2 = d; bfin = fbx.dir; }
        }
      }
      if (best >= INF) return { ok: false, reason: 'Robot nemůže posbírat všechny úkoly a dojet do cíle.' };

      // zpětné složení pořadí
      var order = [], dirs = [], mm = full, jj = bj, ddx = bd2;
      while (true) {
        order.push(jj); dirs.push(ddx);
        var p = par[key(mm, jj, ddx)];
        if (p < 0) break;
        var pj = (p / 4) | 0, pd = p & 3;
        mm = mm & ~(1 << jj);
        jj = pj; ddx = pd;
      }
      order.reverse(); dirs.reverse();
      result = { cost: best, order: order, dirs: dirs, finDir: bfin };
    }

    if (opts.quick) {
      return { ok: true, cost: result.cost, order: result.order, taskCount: nt };
    }

    // ---- rekonstrukce trasy ----
    var legs = [], cur3 = srcState, i2;
    for (i2 = 0; i2 < result.order.length; i2++) {
      var t = tasks[result.order[i2]];
      legs.push(stateIdx(g.w, t.c, t.r, result.dirs[i2]));
    }
    legs.push(stateIdx(g.w, finCell.c, finCell.r, result.finDir < 0 ? 0 : result.finDir));

    var states = [srcState];
    for (i2 = 0; i2 < legs.length; i2++) {
      var seg = pathBetween(g, cur3, legs[i2]);
      if (!seg) return { ok: false, reason: 'Trasu se nepodařilo sestavit.' };
      for (var q2 = 1; q2 < seg.length; q2++) states.push(seg[q2]);
      cur3 = legs[i2];
    }

    var cellActions = {};
    tasks.forEach(function (t) {
      cellActions[t.c + ',' + t.r] = ACTION_TEXT[t.item.t] || 'Splň úkol';
    });

    var out = toCommands(g, states, cellActions, 'Jsi v cíli!');

    return {
      ok: true,
      cost: result.cost,
      steps: out.steps,
      turns: out.turns,
      commands: out.cmds,
      path: out.cells,
      stops: out.stops.concat([finCell]),
      taskCount: nt
    };
  }

  /** Dá se z políčka start dojet na políčko cíl (bez úkolů)? */
  function reachable(b, from, fromDir, to) {
    var g = buildGrid(b);
    var res = bfs(g, stateIdx(g.w, from.c, from.r, fromDir), false);
    for (var d = 0; d < 4; d++) {
      if (res.dist[stateIdx(g.w, to.c, to.r, d)] >= 0) return true;
    }
    return false;
  }

  function commandsToText(cmds) {
    return (cmds || []).map(function (x) {
      if (x.type === 'move') return 'Jeď vpřed' + (x.n > 1 ? ' ' + x.n + '×' : '');
      if (x.type === 'turn') return 'Otoč se ' + (x.right ? 'vpravo' : 'vlevo');
      return x.text;
    });
  }

  VEX.solver = {
    solve: solve, reachable: reachable, buildGrid: buildGrid, bfs: bfs,
    stateIdx: stateIdx, commandsToText: commandsToText, passes: passes
  };
})();
