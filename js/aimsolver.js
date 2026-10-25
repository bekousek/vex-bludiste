/* VEX Bludiště – řešitel pro robota VEX AIM.
 *
 * AIM má holonomní podvozek: jede vpřed, vzad, bokem i šikmo a otáčí se
 * nezávisle na směru jízdy. Stejná deska se proto počítá ve třech variantách:
 *   a) buttons – tlačítka: vpřed o políčko, otočka o 90°, akce (Button Coding)
 *   b) blocks  – bloky bez otáčení: souvislá jízda jedním směrem je jeden blok
 *   c) diag    – bloky se šikmou jízdou: navíc úhlopříčky po 45°
 *
 * Úkol „doruč náklad na zastávku“ jsou dva úseky: dojeď k nákladu (robot ho
 * sebere vjetím na políčko, zdarma) a dojeď na políčko sousedící s AprilTagem,
 * kde náklad položí nebo kopne. Počítá se jízda a položení, ne sebrání, a to
 * ve všech třech variantách stejně, takže porovnání měří jen jízdu.
 */
(function () {
  var VEX = (window.VEX = window.VEX || {});
  var M = VEX.model, S = VEX.solver;

  var INF = 1e9;

  /* Směry. 0..3 jsou stejné jako M.DIRS (nahoru, doprava, dolů, doleva),
   * 4..7 úhlopříčky. deg = úhel od svislice po směru hodinových ručiček. */
  var D8 = [
    { dx: 0, dy: -1, deg: 0 },
    { dx: 1, dy: 0, deg: 90 },
    { dx: 0, dy: 1, deg: 180 },
    { dx: -1, dy: 0, deg: 270 },
    { dx: 1, dy: -1, deg: 45 },
    { dx: 1, dy: 1, deg: 135 },
    { dx: -1, dy: 1, deg: 225 },
    { dx: -1, dy: -1, deg: 315 }
  ];

  /* Názvy směrů v blocích VEXcode AIM jsou vůči přední straně robota. */
  var SIDE = ['forward', 'right', 'reverse', 'left'];

  var VARIANTS = [
    { id: 'buttons', label: 'Tlačítka', hint: 'vpřed, otoč, akce', dirs: 4 },
    { id: 'blocks', label: 'Bloky bez otáčení', hint: 'jízda bokem', dirs: 4 },
    { id: 'diag', label: 'Bloky se šikmou jízdou', hint: 'úhlopříčky po 45°', dirs: 8 }
  ];

  var MAX_COMBOS = 120;   // kolik rozdělení nákladu mezi úkoly se ještě zkouší

  function variantById(id) {
    for (var i = 0; i < VARIANTS.length; i++) if (VARIANTS[i].id === id) return VARIANTS[i];
    return VARIANTS[0];
  }

  /* ---------- mřížka ---------- */

  function free(g, c, r) {
    return c >= 0 && r >= 0 && c < g.w && r < g.h && !g.block[r * g.w + c];
  }

  /** Smí robot popojet z (c,r) směrem d? Úhlopříčka nesmí projet rohem zdi. */
  function canGo(g, c, r, d) {
    var nc = c + D8[d].dx, nr = r + D8[d].dy;
    if (!free(g, nc, nr)) return false;
    if (d > 3 && (!free(g, nc, r) || !free(g, c, nr))) return false;
    return true;
  }

  function dirOf(a, b) {
    for (var d = 0; d < 8; d++) {
      if (a.c + D8[d].dx === b.c && a.r + D8[d].dy === b.r) return d;
    }
    return -1;
  }

  /* ---------- varianta a) tlačítka ---------- */

  /** BFS ze stavu (políčko, natočení), s pamětí – stejný stav se počítá jednou. */
  function stateMap(g, cache, st) {
    if (!cache[st]) cache[st] = S.bfs(g, st, true);
    return cache[st];
  }

  function statePath(res, to) {
    if (res.dist[to] < 0) return null;
    var out = [], s = to;
    while (s !== -1) { out.push(s); s = res.prev[s]; }
    return out.reverse();
  }

  /* ---------- varianty b) a c) bloky ---------- */

  /**
   * 0-1 BFS: kolik bloků „move“ stojí cesta z políčka src na každé jiné políčko.
   * Stav je (políčko, směr právě jedoucího úseku). Pokračovat stejným směrem je
   * zdarma, každý nový úsek stojí jeden blok.
   */
  function blockMap(g, src, nd) {
    var size = g.n * nd, d, i;
    var dist = new Int32Array(size).fill(INF);
    var prev = new Int32Array(size).fill(-1);
    var cur = [], nxt = [];

    for (d = 0; d < nd; d++) {
      if (!canGo(g, src.c, src.r, d)) continue;
      var first = ((src.r + D8[d].dy) * g.w + (src.c + D8[d].dx)) * nd + d;
      if (dist[first] > 1) { dist[first] = 1; nxt.push(first); }
    }

    var level = 1;
    while (cur.length || nxt.length) {
      if (!cur.length) { cur = nxt; nxt = []; }
      for (i = 0; i < cur.length; i++) {
        var s = cur[i];
        if (dist[s] !== level) continue;              // stav se mezitím zlepšil
        var cell = (s / nd) | 0, sd = s % nd;
        var c = cell % g.w, r = (cell / g.w) | 0;
        for (d = 0; d < nd; d++) {
          if (!canGo(g, c, r, d)) continue;
          var to = ((r + D8[d].dy) * g.w + (c + D8[d].dx)) * nd + d;
          var cost = level + (d === sd ? 0 : 1);
          if (cost < dist[to]) {
            dist[to] = cost; prev[to] = s;
            if (d === sd) cur.push(to); else nxt.push(to);
          }
        }
      }
      cur = [];
      level++;
    }
    return { dist: dist, prev: prev, src: src, nd: nd, w: g.w };
  }

  /** Nejlevnější stav, kterým se dá dojet na políčko (c,r). */
  function bestState(map, c, r) {
    var cell = r * map.w + c, best = INF, bs = -1;
    for (var d = 0; d < map.nd; d++) {
      var v = map.dist[cell * map.nd + d];
      if (v < best) { best = v; bs = cell * map.nd + d; }
    }
    return { cost: best, state: bs };
  }

  function blockCost(map, c, r) {
    if (c === map.src.c && r === map.src.r) return 0;
    return bestState(map, c, r).cost;
  }

  /** Políčka cesty z map.src na (c,r), nebo null. */
  function blockPath(map, c, r) {
    if (c === map.src.c && r === map.src.r) return [{ c: c, r: r }];
    var b = bestState(map, c, r);
    if (b.cost >= INF) return null;
    var out = [], s = b.state;
    while (s >= 0) {
      var cell = (s / map.nd) | 0;
      out.push({ c: cell % map.w, r: (cell / map.w) | 0 });
      s = map.prev[s];
    }
    out.push({ c: map.src.c, r: map.src.r });
    return out.reverse();
  }

  /* ---------- body na desce ---------- */

  /** Náklad a políčka u zastávky pro každý úkol desky. */
  function legsOf(b, g) {
    var list = M.jobs(b).slice(0, M.MAX_JOBS), out = [], i, d;
    for (i = 0; i < list.length; i++) {
      var job = list[i], no = 'Úkol ' + (i + 1) + ': ';
      var tag = M.tagCell(b, job.tag);
      if (!tag) return { ok: false, reason: no + 'na desce není AprilTag ' + job.tag + '.' };
      var cargo = M.cargoCells(b, job.cargo).filter(function (p) { return free(g, p.c, p.r); });
      if (!cargo.length) {
        return { ok: false, reason: no + 'na desce není ' + M.cargoById(job.cargo).label + '.' };
      }
      var drops = [];
      for (d = 0; d < 4; d++) {
        var c = tag.c + M.DIRS[d].dx, r = tag.r + M.DIRS[d].dy;
        if (free(g, c, r)) drops.push({ c: c, r: r, dir: (d + 2) & 3 });
      }
      if (!drops.length) {
        return { ok: false, reason: no + 'k AprilTagu ' + job.tag + ' se nedá přijet.' };
      }
      out.push({ job: job, tag: tag, cargo: cargo, drops: drops, kick: job.kind === 'kick' });
    }
    return { ok: true, legs: out };
  }

  /** Rozdělení kusů nákladu mezi úkoly – dva úkoly nesmí chtít tentýž sud. */
  function cargoCombos(legs) {
    var out = [], cur = [], used = {};
    (function rec(i) {
      if (out.length >= MAX_COMBOS) return;
      if (i === legs.length) { out.push(cur.slice()); return; }
      var cands = legs[i].cargo;
      for (var j = 0; j < cands.length; j++) {
        var k = cands[j].c + ',' + cands[j].r;
        if (used[k]) continue;
        used[k] = 1; cur.push(cands[j]);
        rec(i + 1);
        cur.pop(); used[k] = 0;
      }
    })(0);
    return out;
  }

  function nodeLayout(legs) {
    var maxQ = 1;
    legs.forEach(function (lg) { if (lg.drops.length > maxQ) maxQ = lg.drops.length; });
    return { per: maxQ * 4, count: Math.max(1, legs.length * maxQ * 4) };
  }

  /* ---------- plánovač pořadí úkolů ---------- */

  /** Varianta a): uzel je (úkol, políčko u zastávky, natočení robota). */
  function planButtons(g, legs, startState, fin, pick, cache) {
    var n = legs.length, lay = nodeLayout(legs), nodes = lay.count;
    var full = (1 << n) - 1;
    var dp = new Float64Array((full + 1) * nodes).fill(INF);
    var par = new Int32Array((full + 1) * nodes).fill(-2);
    var via = new Int32Array((full + 1) * nodes).fill(0);

    function id(i, q, dir) { return i * lay.per + q * 4 + dir; }
    function dirsFor(lg, q) { return lg.kick ? [lg.drops[q].dir] : [0, 1, 2, 3]; }

    /* Cena úseku: ze stavu src pro náklad úkolu j a zastavení v (q, dir).
     * Natočení nad nákladem si vybereme to nejlepší. */
    function leg(src, j, q, dir) {
      var p = pick[j], from = stateMap(g, cache, src).dist;
      var dr = legs[j].drops[q], best = INF, bd = -1;
      for (var d = 0; d < 4; d++) {
        var ps = S.stateIdx(g.w, p.c, p.r, d);
        if (from[ps] < 0) continue;
        var rest = stateMap(g, cache, ps).dist[S.stateIdx(g.w, dr.c, dr.r, dir)];
        if (rest < 0) continue;
        if (from[ps] + rest < best) { best = from[ps] + rest; bd = d; }
      }
      return { cost: best >= INF ? INF : best + 1, via: bd };   // +1 = položení nebo kop
    }

    var i, q, k, dirs, mask, j, q2, k2, dirs2;
    for (i = 0; i < n; i++) {
      for (q = 0; q < legs[i].drops.length; q++) {
        dirs = dirsFor(legs[i], q);
        for (k = 0; k < dirs.length; k++) {
          var one = leg(startState, i, q, dirs[k]);
          if (one.cost >= INF) continue;
          var slot = (1 << i) * nodes + id(i, q, dirs[k]);
          if (one.cost < dp[slot]) { dp[slot] = one.cost; par[slot] = -1; via[slot] = one.via; }
        }
      }
    }

    for (mask = 1; mask <= full; mask++) {
      for (i = 0; i < n; i++) {
        if (!(mask & (1 << i))) continue;
        for (q = 0; q < legs[i].drops.length; q++) {
          dirs = dirsFor(legs[i], q);
          for (k = 0; k < dirs.length; k++) {
            var here = mask * nodes + id(i, q, dirs[k]);
            if (dp[here] >= INF) continue;
            var src = S.stateIdx(g.w, legs[i].drops[q].c, legs[i].drops[q].r, dirs[k]);
            for (j = 0; j < n; j++) {
              if (mask & (1 << j)) continue;
              for (q2 = 0; q2 < legs[j].drops.length; q2++) {
                dirs2 = dirsFor(legs[j], q2);
                for (k2 = 0; k2 < dirs2.length; k2++) {
                  var step = leg(src, j, q2, dirs2[k2]);
                  if (step.cost >= INF) continue;
                  var to = (mask | (1 << j)) * nodes + id(j, q2, dirs2[k2]);
                  if (dp[here] + step.cost < dp[to]) {
                    dp[to] = dp[here] + step.cost;
                    par[to] = here;
                    via[to] = step.via;
                  }
                }
              }
            }
          }
        }
      }
    }

    var best = INF, bestSlot = -1, finDir = -1;
    for (i = 0; i < n; i++) {
      for (q = 0; q < legs[i].drops.length; q++) {
        dirs = dirsFor(legs[i], q);
        for (k = 0; k < dirs.length; k++) {
          var slot2 = full * nodes + id(i, q, dirs[k]);
          if (dp[slot2] >= INF) continue;
          var add = 0, fd = -1;
          if (fin) {
            var fmap = stateMap(g, cache,
              S.stateIdx(g.w, legs[i].drops[q].c, legs[i].drops[q].r, dirs[k])).dist;
            add = INF;
            for (var d2 = 0; d2 < 4; d2++) {
              var v = fmap[S.stateIdx(g.w, fin.c, fin.r, d2)];
              if (v >= 0 && v < add) { add = v; fd = d2; }
            }
            if (add >= INF) continue;
          }
          if (dp[slot2] + add < best) { best = dp[slot2] + add; bestSlot = slot2; finDir = fd; }
        }
      }
    }
    if (bestSlot < 0) return null;

    var order = [], slot3 = bestSlot;
    while (slot3 >= 0) {
      var node = slot3 % nodes;
      var jIdx = (node / lay.per) | 0, rest = node % lay.per;
      order.push({ job: jIdx, q: (rest / 4) | 0, dir: rest % 4, via: via[slot3] });
      slot3 = par[slot3];
    }
    order.reverse();
    return { cost: best, order: order, finDir: finDir };
  }

  /** Varianty b) a c): uzel je (úkol, políčko u zastávky, natočení robota). */
  function planBlocks(g, legs, start, heading, fin, pick, nd, mapOf) {
    var n = legs.length, lay = nodeLayout(legs), nodes = lay.count;
    var full = (1 << n) - 1;
    var dp = new Float64Array((full + 1) * nodes).fill(INF);
    var par = new Int32Array((full + 1) * nodes).fill(-2);

    function id(i, q, h) { return i * lay.per + q * 4 + h; }

    /* Cena úseku: z políčka from s natočením h pro úkol j a zastavení u (q). */
    function leg(from, h, j, q) {
      var p = pick[j];
      var d1 = blockCost(mapOf(from), p.c, p.r);
      if (d1 >= INF) return null;
      var dr = legs[j].drops[q];
      var d2 = blockCost(mapOf(p), dr.c, dr.r);
      if (d2 >= INF) return null;
      var cost = d1 + d2 + 1, nh = h;                                // +1 = položení nebo kop
      if (legs[j].kick && h !== dr.dir) { cost += 1; nh = dr.dir; }  // otočka k brance
      return { cost: cost, h: nh };
    }

    var i, q, mask, j, q2, h;
    for (i = 0; i < n; i++) {
      for (q = 0; q < legs[i].drops.length; q++) {
        var one = leg(start, heading, i, q);
        if (!one) continue;
        var slot = (1 << i) * nodes + id(i, q, one.h);
        if (one.cost < dp[slot]) { dp[slot] = one.cost; par[slot] = -1; }
      }
    }

    for (mask = 1; mask <= full; mask++) {
      for (i = 0; i < n; i++) {
        if (!(mask & (1 << i))) continue;
        for (q = 0; q < legs[i].drops.length; q++) {
          for (h = 0; h < 4; h++) {
            var here = mask * nodes + id(i, q, h);
            if (dp[here] >= INF) continue;
            for (j = 0; j < n; j++) {
              if (mask & (1 << j)) continue;
              for (q2 = 0; q2 < legs[j].drops.length; q2++) {
                var step = leg(legs[i].drops[q], h, j, q2);
                if (!step) continue;
                var to = (mask | (1 << j)) * nodes + id(j, q2, step.h);
                if (dp[here] + step.cost < dp[to]) {
                  dp[to] = dp[here] + step.cost;
                  par[to] = here;
                }
              }
            }
          }
        }
      }
    }

    var best = INF, bestSlot = -1;
    for (i = 0; i < n; i++) {
      for (q = 0; q < legs[i].drops.length; q++) {
        for (h = 0; h < 4; h++) {
          var slot2 = full * nodes + id(i, q, h);
          if (dp[slot2] >= INF) continue;
          var add = 0;
          if (fin) {
            add = blockCost(mapOf(legs[i].drops[q]), fin.c, fin.r);
            if (add >= INF) continue;
          }
          if (dp[slot2] + add < best) { best = dp[slot2] + add; bestSlot = slot2; }
        }
      }
    }
    if (bestSlot < 0) return null;

    var order = [], slot3 = bestSlot;
    while (slot3 >= 0) {
      var node = slot3 % nodes;
      var jIdx = (node / lay.per) | 0, rest = node % lay.per;
      order.push({ job: jIdx, q: (rest / 4) | 0, h: rest % 4 });
      slot3 = par[slot3];
    }
    order.reverse();
    return { cost: best, order: order };
  }

  /* ---------- texty programu ---------- */

  function degNorm(a) {
    a = ((a % 360) + 360) % 360;
    return a > 180 ? a - 360 : a;
  }

  function cmd(text, n) { return { text: text, n: n || 0 }; }

  /** Blok jízdy. Směr i úhel se počítají vůči přední straně robota. */
  function moveText(b, d, len, heading) {
    var dist = M.mm(b, d > 3 ? len * Math.SQRT2 : len);
    if (d < 4) return 'move [' + SIDE[(d - heading + 4) % 4] + '] for ' + dist + ' mm';
    return 'move at angle ' + degNorm(D8[d].deg - heading * 90) + ' degrees for ' + dist + ' mm';
  }

  function turnText(from, to) {
    var delta = (to - from + 4) & 3;
    if (delta === 3) return 'turn [left] for 90 degrees';
    if (delta === 2) return 'turn [right] for 180 degrees';
    return 'turn [right] for 90 degrees';
  }

  /** Varianta a): ze stavů (políčko, natočení) udělá stisky tlačítek. */
  function buttonCommands(g, states, out, cells) {
    var run = 0, i;
    function flush() {
      if (!run) return;
      out.push(cmd('▲ jeď vpřed' + (run > 1 ? ' ×' + run : ''), run));
      run = 0;
    }
    for (i = 1; i < states.length; i++) {
      var a = states[i - 1], z = states[i];
      if ((a >> 2) === (z >> 2)) {
        flush();
        out.push(cmd((((a & 3) + 1) & 3) === (z & 3) ? '► otoč se vpravo' : '◄ otoč se vlevo', 1));
      } else {
        run++;
        var cell = z >> 2;
        cells.push({ c: cell % g.w, r: (cell / g.w) | 0 });
      }
    }
    flush();
  }

  /** Varianty b) a c): ze seznamu políček udělá bloky move. */
  function blockCommands(b, path, heading, out, cells) {
    var dir = -1, run = 0, i;
    function flush() {
      if (run) out.push(cmd(moveText(b, dir, run, heading), 1));
      run = 0;
    }
    for (i = 1; i < path.length; i++) {
      var d = dirOf(path[i - 1], path[i]);
      if (d !== dir) { flush(); dir = d; }
      run++;
      cells.push(path[i]);
    }
    flush();
  }

  /* ---------- jedna varianta od začátku do konce ---------- */

  function runVariant(b, g, variant, legs, startRec, fin) {
    var heading = startRec.item.d | 0;
    var start = { c: startRec.c, r: startRec.r };
    var startState = S.stateIdx(g.w, start.c, start.r, heading);
    var buttons = variant.id === 'buttons';
    var cache = {}, maps = {};

    function mapOf(cell) {
      var k = cell.c + ',' + cell.r;
      if (!maps[k]) maps[k] = blockMap(g, cell, variant.dirs);
      return maps[k];
    }

    var best = null, pick = null;

    if (!legs.length) {                                   // deska bez úkolů, jen dojezd do cíle
      if (buttons) {
        var fd = -1, bestCost = INF, from = stateMap(g, cache, startState).dist;
        for (var d = 0; d < 4; d++) {
          var v = from[S.stateIdx(g.w, fin.c, fin.r, d)];
          if (v >= 0 && v < bestCost) { bestCost = v; fd = d; }
        }
        if (fd < 0) return { ok: false, reason: 'Robot se nemůže dostat do cíle.' };
        best = { cost: bestCost, order: [], finDir: fd };
      } else {
        var cost = blockCost(mapOf(start), fin.c, fin.r);
        if (cost >= INF) return { ok: false, reason: 'Robot se nemůže dostat do cíle.' };
        best = { cost: cost, order: [] };
      }
      pick = [];
    } else {
      var combos = cargoCombos(legs);
      combos.forEach(function (one) {
        var plan = buttons
          ? planButtons(g, legs, startState, fin, one, cache)
          : planBlocks(g, legs, start, heading, fin, one, variant.dirs, mapOf);
        if (plan && (!best || plan.cost < best.cost)) { best = plan; pick = one; }
      });
      if (!best) return { ok: false, reason: 'Robot nemůže splnit všechny úkoly.' };
    }

    /* ---- složení trasy a programu ---- */
    var out = [], cells = [{ c: start.c, r: start.r }], stops = [];
    var curState = startState, curCell = start, h = heading, i;

    for (i = 0; i < best.order.length; i++) {
      var step = best.order[i], lg = legs[step.job];
      var p = pick[step.job], dr = lg.drops[step.q];
      var label = M.cargoById(lg.job.cargo);

      if (buttons) {
        var ps = S.stateIdx(g.w, p.c, p.r, step.via);
        var seg1 = statePath(stateMap(g, cache, curState), ps);
        if (!seg1) return { ok: false, reason: 'Trasu se nepodařilo sestavit.' };
        buttonCommands(g, seg1, out, cells);
        out.push(cmd('seber ' + label.label, 0));
        var ds = S.stateIdx(g.w, dr.c, dr.r, step.dir);
        var seg2 = statePath(stateMap(g, cache, ps), ds);
        if (!seg2) return { ok: false, reason: 'Trasu se nepodařilo sestavit.' };
        buttonCommands(g, seg2, out, cells);
        out.push(cmd(lg.kick ? '▼ kopni ' + label.label : '▼ polož ' + label.label, 1));
        curState = ds;
      } else {
        var path1 = blockPath(mapOf(curCell), p.c, p.r);
        if (!path1) return { ok: false, reason: 'Trasu se nepodařilo sestavit.' };
        blockCommands(b, path1, h, out, cells);
        out.push(cmd('get [' + label.en + ']', 0));
        var path2 = blockPath(mapOf(p), dr.c, dr.r);
        if (!path2) return { ok: false, reason: 'Trasu se nepodařilo sestavit.' };
        blockCommands(b, path2, h, out, cells);
        if (lg.kick && h !== dr.dir) { out.push(cmd(turnText(h, dr.dir), 1)); h = dr.dir; }
        out.push(cmd(lg.kick ? 'kick object' : 'place object', 1));
        curCell = dr;
      }
      stops.push({ c: dr.c, r: dr.r });
    }

    if (fin) {
      if (buttons) {
        var segF = statePath(stateMap(g, cache, curState),
          S.stateIdx(g.w, fin.c, fin.r, best.finDir < 0 ? 0 : best.finDir));
        if (!segF) return { ok: false, reason: 'Trasu se nepodařilo sestavit.' };
        buttonCommands(g, segF, out, cells);
      } else {
        var pathF = blockPath(mapOf(curCell), fin.c, fin.r);
        if (!pathF) return { ok: false, reason: 'Trasu se nepodařilo sestavit.' };
        blockCommands(b, pathF, h, out, cells);
      }
      stops.push({ c: fin.c, r: fin.r });
    }

    var count = 0;
    out.forEach(function (x) { count += x.n; });

    return {
      ok: true,
      id: variant.id,
      label: variant.label,
      hint: variant.hint,
      count: count,
      cost: best.cost,
      commands: out,
      path: cells,
      stops: stops
    };
  }

  /* ---------- veřejné rozhraní ---------- */

  /**
   * Vyřeší desku AIM ve všech třech variantách.
   * Vrací { ok, reason, variants: [a, b, c] }, každá varianta
   * { ok, id, label, count, commands:[{text,n}], path, stops }.
   */
  function solve(b) {
    var st = M.findFirst(b, 'start');
    if (!st) return { ok: false, reason: 'Na desce chybí START.' };

    var g = S.buildGrid(b);
    if (g.block[st.r * g.w + st.c]) {
      return { ok: false, reason: 'Start stojí na zakázaném políčku.' };
    }

    var fiRec = M.findFirst(b, 'finish');
    var fin = fiRec ? { c: fiRec.c, r: fiRec.r } : null;

    var found = legsOf(b, g);
    if (!found.ok) return { ok: false, reason: found.reason };
    if (!found.legs.length && !fin) {
      return { ok: false, reason: 'Zadej aspoň jeden úkol, nebo na desku polož cíl.' };
    }

    var out = [], bad = null;
    VARIANTS.forEach(function (v) {
      var res = runVariant(b, g, v, found.legs, st, fin);
      if (!res.ok && !bad) bad = res.reason;
      out.push(res);
    });

    if (bad) return { ok: false, reason: bad, variants: out };
    return { ok: true, variants: out };
  }

  /** Jen délky programů, bez skládání trasy – pro generátor. */
  function lengths(b) {
    var res = solve(b);
    if (!res.ok) return null;
    return res.variants.map(function (v) { return v.count; });
  }

  function commandsToText(commands) {
    return (commands || []).map(function (x) { return x.text; });
  }

  VEX.aimsolver = {
    VARIANTS: VARIANTS, variantById: variantById,
    solve: solve, lengths: lengths, commandsToText: commandsToText,
    D8: D8, blockMap: blockMap, blockCost: blockCost, free: free, canGo: canGo
  };
})();
