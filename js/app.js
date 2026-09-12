/* VEX Bludiště – propojení ovládání s modelem. */
(function () {
  var VEX = window.VEX;
  var M = VEX.model, R = VEX.render, I = VEX.icons, S = VEX.solver, G = VEX.generator,
    ST = VEX.storage, P = VEX.printing, UI = VEX.userIcons;

  var $ = function (id) { return document.getElementById(id); };

  var state = {
    board: null,
    tool: 'wall',
    dir: 1,
    shape: 'circle',
    color: 'red',
    undo: [],
    redo: [],
    solution: null,
    difficulty: 'medium'
  };

  var DIR_GLYPH = ['▲', '▶', '▼', '◀'];

  var ERASER_ICON =
    '<svg class="ico" viewBox="0 0 100 100" width="44" height="44" aria-hidden="true">' +
    '<g transform="rotate(-35 50 50)">' +
    '<rect x="26" y="20" width="48" height="38" rx="7" fill="#f26d6d" stroke="#b03c3c" stroke-width="4"/>' +
    '<rect x="26" y="52" width="48" height="26" rx="7" fill="#f4f4f4" stroke="#8d8d8d" stroke-width="4"/>' +
    '</g></svg>';

  /* ---------------- paleta ---------------- */

  /* Vlastní ikony mají v paletě vlastní tlačítko, proto je jejich nástroj
   * zapsaný jako "own:<id ikony>". */
  function toolType(id) { return id.indexOf('own:') === 0 ? 'own' : id; }
  function toolIco(id) { return id.indexOf('own:') === 0 ? id.slice(4) : ''; }

  /** Volby, které se objeví přímo v tlačítku prvku, když je vybraný. */
  function toolOptions(id) {
    var def = M.ITEMS[toolType(id)];
    if (!def) return '';
    if (def.rot) {
      // křížový ovladač – velká tlačítka, hned je vidět, kam co míří
      return '<div class="tool-opts dirs">' + DIR_GLYPH.map(function (g, d) {
        return '<button type="button" class="opt d' + d + (d === state.dir ? ' on' : '') +
          '" data-opt="dir" data-val="' + d + '" title="' + M.DIRS[d].cz + '">' + g + '</button>';
      }).join('') + '</div>';
    }
    if (def.custom) {
      var s = '<div class="tool-opts custom"><span class="opt-label">Tvar</span><div class="opt-row shapes">';
      s += M.SHAPES.map(function (sh) {
        return '<button type="button" class="opt shape' + (sh.id === state.shape ? ' on' : '') +
          '" data-opt="shape" data-val="' + sh.id + '" title="' + sh.label + '">' +
          I.standalone({ t: 'shape', s: sh.id, col: state.color }, null, 26) + '</button>';
      }).join('');
      s += '</div><span class="opt-label">Barva</span><div class="opt-row colors">';
      s += M.COLORS.map(function (cl) {
        return '<button type="button" class="opt swatch' + (cl.id === state.color ? ' on' : '') +
          '" data-opt="color" data-val="' + cl.id + '" title="' + cl.label +
          '" style="background:' + cl.hex + '"></button>';
      }).join('');
      return s + '</div></div>';
    }
    return '';
  }

  function toolIcon(id) {
    if (id === 'erase') return ERASER_ICON;
    if (id === 'shape') return I.standalone({ t: 'shape', s: state.shape, col: state.color }, null, 44);
    if (toolType(id) === 'own') return I.standalone({ t: 'own', ico: toolIco(id) }, null, 44);
    var def = M.ITEMS[id];
    return I.standalone(id, def && def.rot ? state.dir : 0, 44);
  }

  function escAttr(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function buildTools() {
    var host = $('tools'), html = '';
    M.GROUPS.forEach(function (grp) {
      if (grp.id === 'vlastni') { html += ownGroup(); return; }
      var ids = Object.keys(M.ITEMS).filter(function (k) {
        return M.ITEMS[k].group === grp.id && !M.ITEMS[k].icon;
      });
      if (!ids.length) return;
      html += '<div class="tool-group"><h3>' + grp.label + '</h3><div class="tool-grid">';
      ids.forEach(function (id) { html += toolCard(id); });
      html += '</div></div>';
    });
    html += '<div class="tool-group"><h3>Mazání</h3><div class="tool-grid">' +
      toolCard('erase') + '</div></div>';
    host.innerHTML = html;
    syncIconsNote();

    host.addEventListener('click', function (e) {
      var del = e.target.closest('.tool-del');
      if (del) { deleteIcon(del.closest('.tool').dataset.tool); return; }

      if (e.target.closest('.tool-add')) { $('icon-input').click(); return; }

      var opt = e.target.closest('.opt');
      if (opt) {
        var card = opt.closest('.tool');
        if (opt.dataset.opt === 'dir') state.dir = +opt.dataset.val;
        if (opt.dataset.opt === 'shape') state.shape = opt.dataset.val;
        if (opt.dataset.opt === 'color') state.color = opt.dataset.val;
        selectTool(card.dataset.tool);
        return;
      }
      var main = e.target.closest('.tool-main');
      if (main) selectTool(main.closest('.tool').dataset.tool);
    });
  }

  /** Skupina s nahranými ikonami a tlačítkem pro přidání další. */
  function ownGroup() {
    var s = '<div class="tool-group"><h3>Moje ikony</h3><div class="tool-grid" id="own-grid">';
    UI.list().forEach(function (ic) { s += toolCard('own:' + ic.id); });
    s += '<button type="button" class="tool tool-add" title="Přidej si vlastní obrázek (PNG, JPG nebo SVG).">' +
      '<span class="tool-add-plus">+</span><span>Nahrát ikonu</span></button>';
    return s + '</div></div>';
  }

  function toolCard(id) {
    var type = toolType(id);
    var def = M.ITEMS[type];
    var own = type === 'own';
    var label = id === 'erase' ? 'Guma' : own ? UI.nameOf(toolIco(id)) : def.label;
    var hint = id === 'erase' ? 'Smaže obsah políčka.' : own ? label : def.hint;
    var wide = def && def.custom ? ' tool-wide' : '';
    var on = state.tool === id;
    return '<div class="tool' + wide + (on ? ' on' : '') + '" data-tool="' + escAttr(id) + '">' +
      '<button type="button" class="tool-main" title="' + escAttr(hint) + '">' +
      toolIcon(id) + '<span>' + escAttr(label) + '</span></button>' +
      (own ? '<button type="button" class="tool-del" title="Smazat tuhle ikonu">&times;</button>' : '') +
      (on ? toolOptions(id) : '') + '</div>';
  }

  /** Překreslí jen kartu daného prvku (kvůli náhledu tvaru a natočení). */
  function refreshToolCard(id) {
    var el = document.querySelector('.tool[data-tool="' + id + '"]');
    if (!el) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = toolCard(id);
    el.replaceWith(tmp.firstElementChild);
  }

  function selectTool(id) {
    var prev = state.tool;
    state.tool = id;
    if (prev !== id) refreshToolCard(prev);
    refreshToolCard(id);
    document.querySelectorAll('.tool').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tool === id);
    });
  }

  /* ---------------- vlastní ikony ---------------- */

  function syncIconsNote() {
    var n = UI.count();
    $('icons-note').textContent = n
      ? n + ' z ' + UI.MAX_ICONS + ' vlastních ikon. Uložené jsou jen v tomhle prohlížeči – zálohu najdeš v Soubor a odkaz.'
      : 'Můžeš si nahrát vlastní obrázek (PNG, JPG nebo SVG) a používat ho jako prvek.';
  }

  function rebuildOwnGroup() {
    var grid = $('own-grid');
    if (!grid) return;
    var tmp = document.createElement('div');
    tmp.innerHTML = ownGroup();
    grid.replaceWith(tmp.querySelector('#own-grid'));
    syncIconsNote();
  }

  function addIconFile(file) {
    UI.fromFile(file, function (dataUrl, err) {
      if (err) { alert(err); return; }
      var suggested = UI.baseName(file);
      var name = prompt('Jak se má ikona jmenovat? (ukáže se ve vysvětlivkách)', suggested);
      if (name === null) name = suggested;
      var res = UI.add(name.trim() || suggested, dataUrl);
      if (!res.ok) { alert(res.error); return; }
      rebuildOwnGroup();
      selectTool('own:' + res.id);
    });
  }

  function deleteIcon(toolId) {
    var ico = toolIco(toolId);
    var used = M.findAll(state.board, function (it) { return it.t === 'own' && it.ico === ico; });
    var msg = used.length
      ? 'Ikona „' + UI.nameOf(ico) + '“ je na desce ' + used.length + '× použitá. Smazat ji i z desky?'
      : 'Opravdu smazat ikonu „' + UI.nameOf(ico) + '“?';
    if (!confirm(msg)) return;
    if (used.length) {
      snapshot(true);
      used.forEach(function (u) { M.set(state.board, u.c, u.r, null); });
      clearSolution();
      renderAll();
      changed();
    }
    UI.remove(ico);
    if (state.tool === toolId) state.tool = 'wall';
    rebuildOwnGroup();
    selectTool(state.tool);
  }

  function bindIcons() {
    $('icon-input').addEventListener('change', function (e) {
      var f = e.target.files[0];
      e.target.value = '';
      if (f) addIconFile(f);
    });

    $('btn-icons-save').addEventListener('click', function () {
      if (!UI.count()) { $('save-msg').textContent = 'Zatím nemáš žádnou vlastní ikonu.'; return; }
      ST.downloadIcons();
      $('save-msg').textContent = 'Ikony jsou uložené do souboru vex-moje-ikony.json.';
    });

    $('btn-icons-load').addEventListener('click', function () { $('icons-file').click(); });

    $('icons-file').addEventListener('change', function (e) {
      var f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      ST.readJSON(f, function (data) {
        var res = UI.importAll(data);
        if (!res.ok) { $('save-msg').textContent = res.error; return; }
        rebuildOwnGroup();
        renderAll();
        $('save-msg').textContent = res.added
          ? 'Přidáno ' + res.added + ' ikon.'
          : 'Všechny ikony ze souboru už tu byly.';
      });
    });
  }

  /* ---------------- historie ---------------- */

  /* keepIcons: do zálohy přibalí i obrázky vlastních ikon z desky. Potřeba před
   * smazáním ikony – jinak by Zpět vrátil prvky na desku, ale místo obrázku otazník. */
  function snapshot(keepIcons) {
    state.undo.push(JSON.stringify(keepIcons ? ST.withIcons(state.board) : state.board));
    if (state.undo.length > 60) state.undo.shift();
    state.redo.length = 0;
    syncHistory();
  }

  /** Vrátí do knihovny ikony přibalené v obnovené záloze. */
  function takeIcons() {
    if (!state.board.icons) return;
    UI.merge(state.board.icons);
    delete state.board.icons;
  }

  function syncHistory() {
    $('btn-undo').disabled = !state.undo.length;
    $('btn-redo').disabled = !state.redo.length;
  }

  function undo() {
    if (!state.undo.length) return;
    state.redo.push(JSON.stringify(state.board));
    state.board = JSON.parse(state.undo.pop());
    takeIcons();
    afterBoardSwap();
  }

  function redo() {
    if (!state.redo.length) return;
    state.undo.push(JSON.stringify(state.board));
    state.board = JSON.parse(state.redo.pop());
    takeIcons();
    afterBoardSwap();
  }

  function afterBoardSwap() {
    syncHistory();
    $('title').value = state.board.title || '';
    syncSizeInputs();
    rebuildOwnGroup();          // načtená deska mohla přinést vlastní ikony
    renderAll();
    changed(true);
  }

  /* ---------------- deska ---------------- */

  function renderAll() {
    $('board-wrap').innerHTML = R.boardSVG(state.board, {
      solution: state.solution ? state.solution.path : null,
      stops: state.solution ? state.solution.stops : null
    });
    updateBadge();
    renderTilemap();
  }

  function updateBadge() {
    var b = state.board, e = M.extent(b), n = M.tileCount(b);
    var txt = M.isRect(b)
      ? (e.mx + 1) + '×' + (e.my + 1) + ' dlaždice (' + M.cols(b) + '×' + M.rows(b) + ' políček)'
      : n + ' dlaždic · ' + M.cellCount(b) + ' políček';
    $('size-badge').textContent = txt;
  }

  function syncSizeInputs() {
    var e = M.extent(state.board);
    $('out-tx').textContent = e.mx + 1;
    $('out-ty').textContent = e.my + 1;
  }

  function refreshCell(c, r) {
    var el = document.getElementById('cell-' + c + '-' + r);
    if (el) el.innerHTML = R.cellContent(M.get(state.board, c, r));
  }

  function clearSolution() {
    if (!state.solution) return;
    state.solution = null;
    var l = document.querySelector('.solution-layer');
    if (l) l.remove();
    $('solution').hidden = true;
  }

  function changed(skipSolutionClear) {
    if (!skipSolutionClear) clearSolution();
    state.board.title = $('title').value;
    ST.saveLocal(state.board);
  }

  /* ---------------- pokládání prvků ---------------- */

  function toolOpts() {
    return { d: state.dir, s: state.shape, col: state.color, ico: toolIco(state.tool) };
  }

  function sameAsTool(cur) {
    var type = toolType(state.tool);
    if (!cur || cur.t !== type) return false;
    var def = M.ITEMS[type];
    if (def.rot) return cur.d === state.dir;
    if (def.custom) return cur.s === state.shape && cur.col === state.color;
    if (def.icon) return cur.ico === toolIco(state.tool);
    return true;
  }

  function applyClick(c, r) {
    var cur = M.get(state.board, c, r);
    if (state.tool === 'erase') {
      if (cur) { M.set(state.board, c, r, null); refreshCell(c, r); }
      return;
    }
    var type = toolType(state.tool);
    var def = M.ITEMS[type];
    if (!def) return;
    if (cur && cur.t === type) {
      if (def.rot && cur.d === state.dir) {          // druhý klik na šipku = otočí se
        state.dir = (cur.d + 1) & 3;
        M.set(state.board, c, r, M.makeItem(type, toolOpts()));
        refreshToolCard(state.tool);
        refreshCell(c, r);
        return;
      }
      if (sameAsTool(cur)) {                          // druhý klik na stejný prvek = smaže se
        M.set(state.board, c, r, null);
        refreshCell(c, r);
        return;
      }
    }
    var old = def.unique ? M.findFirst(state.board, type) : null;
    M.place(state.board, c, r, type, toolOpts());
    if (old) refreshCell(old.c, old.r);
    refreshCell(c, r);
  }

  function applyPaint(c, r) {
    if (state.tool === 'erase') {
      if (M.get(state.board, c, r)) { M.set(state.board, c, r, null); refreshCell(c, r); }
      return;
    }
    var type = toolType(state.tool);
    var def = M.ITEMS[type];
    if (!def || def.unique) return;
    if (sameAsTool(M.get(state.board, c, r))) return;
    M.place(state.board, c, r, type, toolOpts());
    refreshCell(c, r);
  }

  /** Políčka mezi dvěma body – aby rychlé tažení nepřeskakovalo. */
  function lineCells(a, b) {
    var out = [], dx = Math.abs(b.c - a.c), dy = Math.abs(b.r - a.r);
    var sx = a.c < b.c ? 1 : -1, sy = a.r < b.r ? 1 : -1;
    var err = dx - dy, c = a.c, r = a.r, guard = 0;
    while ((c !== b.c || r !== b.r) && guard++ < 500) {
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; c += sx; }
      if (e2 < dx) { err += dx; r += sy; }
      out.push({ c: c, r: r });
    }
    return out;
  }

  function bindBoard() {
    var wrap = $('board-wrap');
    var painting = false, stroke = null, lastCell = null;

    function cellFrom(el) {
      if (!el || !el.classList || !el.classList.contains('hit')) return null;
      return { c: +el.dataset.c, r: +el.dataset.r };
    }

    wrap.addEventListener('contextmenu', function (e) {
      var p = cellFrom(e.target);
      if (!p) return;
      e.preventDefault();
      if (M.get(state.board, p.c, p.r)) {
        snapshot();
        M.set(state.board, p.c, p.r, null);
        refreshCell(p.c, p.r);
        changed();
      }
    });

    wrap.addEventListener('pointerdown', function (e) {
      if (e.button === 2) return;
      var p = cellFrom(e.target);
      if (!p) return;
      e.preventDefault();
      snapshot();
      clearSolution();
      stroke = {};
      stroke[p.c + ',' + p.r] = 1;
      lastCell = p;
      applyClick(p.c, p.r);
      changed(true);
      painting = true;
      if (wrap.setPointerCapture) { try { wrap.setPointerCapture(e.pointerId); } catch (err) { } }
    });

    wrap.addEventListener('pointermove', function (e) {
      if (!painting) return;
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var p = cellFrom(el);
      if (!p) return;
      var run = lastCell ? lineCells(lastCell, p) : [p];
      lastCell = p;
      var touched = false;
      run.forEach(function (q) {
        var k = q.c + ',' + q.r;
        if (stroke[k] || !M.inside(state.board, q.c, q.r)) return;
        stroke[k] = 1;
        applyPaint(q.c, q.r);
        touched = true;
      });
      if (touched) changed(true);
    });

    function stop() { painting = false; stroke = null; lastCell = null; }
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  /* ---------------- tvar pole ---------------- */

  var PRESETS = {
    L: ['0,0', '0,1', '0,2', '1,2', '2,2'],
    ring: ['0,0', '1,0', '2,0', '0,1', '2,1', '0,2', '1,2', '2,2'],
    cross: ['1,0', '0,1', '1,1', '2,1', '1,2'],
    zigzag: ['0,0', '1,0', '1,1', '2,1', '2,2', '3,2']
  };

  /** Mřížka dlaždic – kolem tvaru je vždy jedna řada volných míst k přidání. */
  function renderTilemap() {
    var b = state.board, e = M.extent(b), max = M.MAX_TILES;
    var growX = e.mx + 1 < max, growY = e.my + 1 < max;
    var x0 = growX ? -1 : 0, x1 = growX ? e.mx + 1 : e.mx;
    var y0 = growY ? -1 : 0, y1 = growY ? e.my + 1 : e.my;
    var html = '';
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        var on = M.hasTile(b, x, y);
        html += '<button type="button" class="slot' + (on ? ' on' : '') +
          '" data-tx="' + x + '" data-ty="' + y + '" title="' +
          (on ? 'Ubrat dlaždici' : 'Přidat dlaždici') + '"></button>';
      }
    }
    var map = $('tilemap');
    map.style.gridTemplateColumns = 'repeat(' + (x1 - x0 + 1) + ', 1fr)';
    map.innerHTML = html;
  }

  function applyTiles(tiles, askOnLoss) {
    var lost = M.countOutsideTiles(state.board, tiles);
    if (lost && askOnLoss &&
      !confirm('Změnou tvaru se smaže ' + lost + ' položených prvků. Pokračovat?')) return false;
    snapshot();
    M.setTiles(state.board, tiles);
    clearSolution();
    syncSizeInputs();
    renderAll();
    changed();
    return true;
  }

  function bindShape() {
    $('tilemap').addEventListener('click', function (e) {
      var s = e.target.closest('.slot');
      if (!s) return;
      var x = +s.dataset.tx, y = +s.dataset.ty;
      var tiles = {};
      for (var k in state.board.tiles) tiles[k] = 1;
      var key = M.tileKey(x, y);
      if (tiles[key]) {
        if (M.tileCount(state.board) <= 1) return;   // aspoň jedna dlaždice musí zůstat
        delete tiles[key];
        applyTiles(tiles, true);
      } else {
        tiles[key] = 1;
        applyTiles(tiles, false);
      }
    });

    document.querySelectorAll('[data-size]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var e = M.extent(state.board);
        var tx = e.mx + 1, ty = e.my + 1;
        if (btn.dataset.size === 'tx') tx += +btn.dataset.delta; else ty += +btn.dataset.delta;
        tx = Math.max(1, Math.min(M.MAX_TILES, tx));
        ty = Math.max(1, Math.min(M.MAX_TILES, ty));
        var tiles = {};
        for (var y = 0; y < ty; y++) for (var x = 0; x < tx; x++) tiles[x + ',' + y] = 1;
        applyTiles(tiles, true);
      });
    });

    $('presets').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-preset]');
      if (!btn) return;
      var list = PRESETS[btn.dataset.preset];
      if (!list) return;
      var tiles = {};
      list.forEach(function (k) { tiles[k] = 1; });
      applyTiles(tiles, true);
    });
  }

  /* ---------------- generátor ---------------- */

  function bindGenerator() {
    $('difficulty').addEventListener('click', function (e) {
      var b = e.target.closest('[data-diff]');
      if (!b) return;
      state.difficulty = b.dataset.diff;
      document.querySelectorAll('#difficulty button').forEach(function (x) {
        x.classList.toggle('on', x === b);
      });
    });

    $('btn-generate').addEventListener('click', function () {
      var btn = $('btn-generate');
      btn.disabled = true;
      btn.textContent = 'Generuji…';
      $('gen-note').textContent = '';
      setTimeout(function () {
        var res = G.generate({
          tiles: state.board.tiles,
          difficulty: state.difficulty,
          stars: $('gen-stars').checked,
          oneway: $('gen-oneway').checked,
          sound: $('gen-sound').checked,
          light: $('gen-light').checked
        });
        btn.disabled = false;
        btn.textContent = 'Vygenerovat bludiště';
        if (!res) {
          $('gen-note').textContent = 'V tomhle tvaru se nepodařilo vymyslet rozumné bludiště. Zkus větší pole nebo lehčí obtížnost.';
          return;
        }
        snapshot();
        var title = state.board.title;
        state.board = res.board;
        state.board.title = title;
        clearSolution();
        renderAll();
        changed();
        var i = res.info;
        $('gen-note').textContent = 'Hotovo: nejkratší řešení má ' + i.cost + ' příkazů (' +
          i.steps + '× vpřed, ' + i.turns + '× otočení), překážek: ' + i.walls + '.';
      }, 30);
    });
  }

  /* ---------------- řešení ---------------- */

  function bindSolver() {
    $('btn-check').addEventListener('click', function () {
      var sol = S.solve(state.board);
      var box = $('solution');
      box.hidden = false;
      if (!sol.ok) {
        state.solution = null;
        var l = document.querySelector('.solution-layer');
        if (l) l.remove();
        box.className = 'solution bad';
        box.innerHTML = '<strong>Bludiště zatím nejde vyřešit.</strong><p>' + sol.reason + '</p>';
        return;
      }
      state.solution = sol;
      box.className = 'solution good';
      var cmds = S.commandsToText(sol.commands);
      box.innerHTML = '<strong>Bludiště je řešitelné.</strong>' +
        '<p>Nejkratší program má <b>' + sol.cost + ' příkazů</b> – ' +
        sol.steps + '× jeď vpřed a ' + sol.turns + '× otoč se.</p>' +
        '<details><summary>Ukázat celý program</summary><ol class="cmds">' +
        cmds.map(function (t) { return '<li>' + t + '</li>'; }).join('') +
        '</ol></details>';
      renderAll();
    });
  }

  /* ---------------- tisk, obrázek, uložení ---------------- */

  function bindPrint() {
    var dlg = $('dlg-print');

    function syncBlank() {
      var blank = dlg.querySelector('input[value="blank"]').checked;
      $('blank-opts').classList.toggle('off', !blank);
      $('print-solution').disabled = blank;
      var same = $('blank-same').checked;
      ['blank-tx', 'blank-ty'].forEach(function (id) { $(id).disabled = same; });
    }

    dlg.addEventListener('change', syncBlank);

    $('btn-print').addEventListener('click', function () {
      var e = M.extent(state.board);
      $('blank-tx').value = e.mx + 1;
      $('blank-ty').value = e.my + 1;
      $('blank-same').checked = !M.isRect(state.board);
      syncBlank();
      dlg.showModal();
    });

    dlg.addEventListener('close', function () {
      if (dlg.returnValue !== 'print') return;
      var mode = dlg.querySelector('input[name="printmode"]:checked').value;
      P.run({
        mode: mode,
        board: state.board,
        eco: $('print-eco').checked,
        solution: $('print-solution').checked && mode === 'board',
        blank: {
          tx: Math.max(1, Math.min(M.MAX_TILES, +$('blank-tx').value || 2)),
          ty: Math.max(1, Math.min(M.MAX_TILES, +$('blank-ty').value || 2)),
          copies: Math.max(1, Math.min(20, +$('blank-copies').value || 1)),
          legend: $('blank-legend').checked,
          sameShape: $('blank-same').checked
        }
      });
    });

    $('btn-png').addEventListener('click', function () {
      var svg = R.boardSVG(state.board, {
        noHits: true,
        solution: state.solution ? state.solution.path : null,
        stops: state.solution ? state.solution.stops : null
      });
      ST.downloadPNG(state.board, svg, 2);
    });
  }

  function bindSave() {
    var dlg = $('dlg-save');
    $('btn-save').addEventListener('click', function () { $('save-msg').textContent = ''; dlg.showModal(); });

    $('btn-download').addEventListener('click', function () {
      ST.downloadJSON(state.board);
      $('save-msg').textContent = 'Soubor byl uložen do složky Stažené soubory.';
    });

    $('btn-upload').addEventListener('click', function () { $('file-input').click(); });

    $('file-input').addEventListener('change', function (e) {
      var f = e.target.files[0];
      if (!f) return;
      ST.readFile(f, function (b) {
        if (!b) { $('save-msg').textContent = 'Soubor se nepodařilo přečíst.'; return; }
        snapshot();
        state.board = b;
        afterBoardSwap();
        $('save-msg').textContent = 'Načteno.';
        dlg.close();
      });
      e.target.value = '';
    });

    $('btn-link').addEventListener('click', function () {
      var url = ST.shareLink(state.board);
      history.replaceState(null, '', '#b=' + url.split('#b=')[1]);
      // vlastní ikony jedou v odkazu s sebou, takže může být hodně dlouhý
      var longWarn = url.length > 8000
        ? ' Pozor, kvůli vlastním ikonám je odkaz hodně dlouhý – některé e-maily ho zalomí. Radši pošli soubor.'
        : '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(
          function () { $('save-msg').textContent = 'Odkaz je zkopírovaný. Stačí ho vložit do e-mailu.' + longWarn; },
          function () { $('save-msg').textContent = 'Odkaz je v adresním řádku prohlížeče – zkopíruj ho odtud.'; }
        );
      } else {
        $('save-msg').textContent = 'Odkaz je v adresním řádku prohlížeče – zkopíruj ho odtud.';
      }
    });
  }

  function bindHelp() {
    var host = $('help-legend'), html = '';
    Object.keys(M.ITEMS).forEach(function (id) {
      var def = M.ITEMS[id];
      if (def.icon) return;                 // vlastní ikony jsou u každého jiné
      html += '<div class="hl-item">' + I.standalone(id, id === 'oneway' ? 1 : 2, 50) +
        '<div><strong>' + def.label + '</strong><span>' + def.hint + '</span></div></div>';
    });
    host.innerHTML = html;
    $('btn-help').addEventListener('click', function () { $('dlg-help').showModal(); });
    document.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () { b.closest('dialog').close(); });
    });
    // klik mimo okno dialog zavře
    document.querySelectorAll('dialog').forEach(function (d) {
      d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    });
  }

  /* ---------------- start ---------------- */

  function init() {
    var b = ST.loadFromHash() || ST.loadLocal() || M.createBoard(2, 2);
    state.board = b;
    state.tool = M.findFirst(b, 'start') ? 'wall' : 'start';

    buildTools();
    bindBoard();
    bindShape();
    bindGenerator();
    bindSolver();
    bindPrint();
    bindSave();
    bindIcons();
    bindHelp();

    $('title').value = b.title || '';
    $('title').addEventListener('input', function () { changed(true); });
    syncSizeInputs();

    $('btn-undo').addEventListener('click', undo);
    $('btn-redo').addEventListener('click', redo);
    $('btn-clear').addEventListener('click', function () {
      if (M.isEmpty(state.board)) return;
      if (!confirm('Opravdu vymazat všechny prvky z desky?')) return;
      snapshot();
      state.board.cells = {};
      clearSolution();
      renderAll();
      changed();
    });

    document.addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); undo(); }
      if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); redo(); }
    });

    syncHistory();
    renderAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
