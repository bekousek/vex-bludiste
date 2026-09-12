/* VEX Bludiště – propojení ovládání s modelem. */
(function () {
  var VEX = window.VEX;
  var M = VEX.model, R = VEX.render, I = VEX.icons, S = VEX.solver, G = VEX.generator, ST = VEX.storage, P = VEX.printing;

  var $ = function (id) { return document.getElementById(id); };

  var state = {
    board: null,
    tool: 'wall',
    dir: 1,
    undo: [],
    redo: [],
    solution: null,
    difficulty: 'medium'
  };

  var ERASER_ICON =
    '<svg class="ico" viewBox="0 0 100 100" width="44" height="44" aria-hidden="true">' +
    '<g transform="rotate(-35 50 50)">' +
    '<rect x="26" y="20" width="48" height="38" rx="7" fill="#f26d6d" stroke="#b03c3c" stroke-width="4"/>' +
    '<rect x="26" y="52" width="48" height="26" rx="7" fill="#f4f4f4" stroke="#8d8d8d" stroke-width="4"/>' +
    '</g></svg>';

  /* ---------------- paleta ---------------- */

  function buildTools() {
    var host = $('tools'), html = '';
    M.GROUPS.forEach(function (grp) {
      var ids = Object.keys(M.ITEMS).filter(function (k) { return M.ITEMS[k].group === grp.id; });
      if (!ids.length) return;
      html += '<div class="tool-group"><h3>' + grp.label + '</h3><div class="tool-grid">';
      ids.forEach(function (id) {
        var def = M.ITEMS[id];
        html += '<button type="button" class="tool" data-tool="' + id + '" title="' + def.hint + '">' +
          I.standalone(id, id === 'oneway' ? 1 : 2, 44) +
          '<span>' + def.label + '</span></button>';
      });
      html += '</div></div>';
    });
    html += '<div class="tool-group"><h3>Mazání</h3><div class="tool-grid">' +
      '<button type="button" class="tool" data-tool="erase" title="Smaže obsah políčka.">' +
      ERASER_ICON + '<span>Guma</span></button></div></div>';
    host.innerHTML = html;

    host.addEventListener('click', function (e) {
      var b = e.target.closest('.tool');
      if (b) selectTool(b.dataset.tool);
    });
  }

  function selectTool(id) {
    state.tool = id;
    document.querySelectorAll('.tool').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tool === id);
    });
    var def = M.ITEMS[id];
    $('dirpick').hidden = !(def && def.rot);
    if (def && def.rot && id === 'start') state.dir = state.dir;
    syncDir();
    setHint(id === 'erase'
      ? 'Guma je připravená. Klikni na políčko, které chceš vymazat.'
      : (def ? def.hint + ' Teď klikni na políčko na desce.' : ''));
  }

  function syncDir() {
    document.querySelectorAll('#dirbtns button').forEach(function (b) {
      b.classList.toggle('on', +b.dataset.dir === state.dir);
    });
  }

  function setHint(t) { $('hint').textContent = t; }

  /* ---------------- historie ---------------- */

  function snapshot() {
    state.undo.push(JSON.stringify(state.board));
    if (state.undo.length > 60) state.undo.shift();
    state.redo.length = 0;
    syncHistory();
  }

  function syncHistory() {
    $('btn-undo').disabled = !state.undo.length;
    $('btn-redo').disabled = !state.redo.length;
  }

  function undo() {
    if (!state.undo.length) return;
    state.redo.push(JSON.stringify(state.board));
    state.board = JSON.parse(state.undo.pop());
    afterBoardSwap();
  }

  function redo() {
    if (!state.redo.length) return;
    state.undo.push(JSON.stringify(state.board));
    state.board = JSON.parse(state.redo.pop());
    afterBoardSwap();
  }

  function afterBoardSwap() {
    syncHistory();
    $('title').value = state.board.title || '';
    $('out-tx').textContent = state.board.tx;
    $('out-ty').textContent = state.board.ty;
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
  }

  function updateBadge() {
    var b = state.board;
    $('size-badge').textContent = b.tx + '×' + b.ty + ' dlaždice (' + M.cols(b) + '×' + M.rows(b) + ' políček)';
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

  function applyClick(c, r) {
    var cur = M.get(state.board, c, r);
    if (state.tool === 'erase') {
      if (cur) { M.set(state.board, c, r, null); refreshCell(c, r); }
      return;
    }
    var def = M.ITEMS[state.tool];
    if (!def) return;
    if (cur && cur.t === state.tool) {
      if (def.rot) { cur.d = (cur.d + 1) & 3; state.dir = cur.d; syncDir(); }
      else M.set(state.board, c, r, null);
      refreshCell(c, r);
      return;
    }
    var old = def.unique ? M.findFirst(state.board, state.tool) : null;
    M.place(state.board, c, r, state.tool, state.dir);
    if (old) refreshCell(old.c, old.r);
    refreshCell(c, r);
  }

  function applyPaint(c, r) {
    if (state.tool === 'erase') {
      if (M.get(state.board, c, r)) { M.set(state.board, c, r, null); refreshCell(c, r); }
      return;
    }
    var def = M.ITEMS[state.tool];
    if (!def || def.unique) return;
    var cur = M.get(state.board, c, r);
    if (cur && cur.t === state.tool && (!def.rot || cur.d === state.dir)) return;
    M.place(state.board, c, r, state.tool, state.dir);
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
        if (stroke[k]) return;
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

  /* ---------------- velikost ---------------- */

  function bindSize() {
    document.querySelectorAll('[data-size]').forEach(function (b) {
      b.addEventListener('click', function () {
        var which = b.dataset.size, delta = +b.dataset.delta;
        var tx = state.board.tx, ty = state.board.ty;
        if (which === 'tx') tx += delta; else ty += delta;
        tx = Math.max(1, Math.min(M.MAX_TILES, tx));
        ty = Math.max(1, Math.min(M.MAX_TILES, ty));
        if (tx === state.board.tx && ty === state.board.ty) return;
        var lost = M.countOutside(state.board, tx, ty);
        if (lost && !confirm('Zmenšením pole se smaže ' + lost + ' položených prvků. Pokračovat?')) return;
        snapshot();
        state.board.tx = tx; state.board.ty = ty;
        M.trim(state.board);
        $('out-tx').textContent = tx;
        $('out-ty').textContent = ty;
        clearSolution();
        renderAll();
        changed();
      });
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
          tx: state.board.tx, ty: state.board.ty,
          difficulty: state.difficulty,
          stars: $('gen-stars').checked,
          oneway: $('gen-oneway').checked,
          sound: $('gen-sound').checked,
          light: $('gen-light').checked
        });
        btn.disabled = false;
        btn.textContent = 'Vygenerovat bludiště';
        if (!res) {
          $('gen-note').textContent = 'Na tak malém poli se nepodařilo vymyslet rozumné bludiště. Zkus větší pole nebo lehčí obtížnost.';
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
    }

    dlg.addEventListener('change', syncBlank);

    $('btn-print').addEventListener('click', function () {
      $('blank-tx').value = state.board.tx;
      $('blank-ty').value = state.board.ty;
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
          legend: $('blank-legend').checked
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
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(
          function () { $('save-msg').textContent = 'Odkaz je zkopírovaný. Stačí ho vložit do e-mailu.'; },
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
      html += '<div class="hl-item">' + I.standalone(id, id === 'oneway' ? 1 : 2, 50) +
        '<div><strong>' + def.label + '</strong><span>' + def.hint + '</span></div></div>';
    });
    host.innerHTML = html;
    $('btn-help').addEventListener('click', function () { $('dlg-help').showModal(); });
    document.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () { b.closest('dialog').close(); });
    });
  }

  /* ---------------- start ---------------- */

  function init() {
    var b = ST.loadFromHash() || ST.loadLocal() || M.createBoard(2, 2);
    state.board = b;

    buildTools();
    bindBoard();
    bindSize();
    bindGenerator();
    bindSolver();
    bindPrint();
    bindSave();
    bindHelp();

    $('title').value = b.title || '';
    $('title').addEventListener('input', function () { changed(true); });
    $('out-tx').textContent = b.tx;
    $('out-ty').textContent = b.ty;

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

    $('dirbtns').addEventListener('click', function (e) {
      var b2 = e.target.closest('[data-dir]');
      if (!b2) return;
      state.dir = +b2.dataset.dir;
      syncDir();
    });

    document.addEventListener('keydown', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); undo(); }
      if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); redo(); }
    });

    selectTool(M.findFirst(b, 'start') ? 'wall' : 'start');
    syncHistory();
    renderAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
