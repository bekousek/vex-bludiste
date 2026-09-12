/* VEX Bludiště – příprava tiskových stránek. */
(function () {
  var VEX = (window.VEX = window.VEX || {});
  var M = VEX.model, R = VEX.render, S = VEX.solver;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function setPageOrientation(landscape) {
    var el = document.getElementById('page-style');
    if (!el) {
      el = document.createElement('style');
      el.id = 'page-style';
      document.head.appendChild(el);
    }
    el.textContent = '@page { size: A4 ' + (landscape ? 'landscape' : 'portrait') + '; margin: 10mm; }';
  }

  function page(inner, cls) {
    return '<section class="p-page ' + (cls || '') + '">' + inner + '</section>';
  }

  /* Tisková plocha A4 po 10mm okrajích, zmenšená o hlavičku a legendu. */
  var A4 = { long: 277, short: 190 }, HEAD_MM = 26, LEGEND_MM = 50;

  /** Nastaví desce pevný rozměr v mm, aby se vždy vešla na stránku. */
  function fitted(svg, landscape, withLegend) {
    var m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
    if (!m) return svg;
    var vw = +m[1], vh = +m[2];
    var availW = (landscape ? A4.long : A4.short) - (withLegend ? LEGEND_MM : 0);
    var availH = (landscape ? A4.short : A4.long) - HEAD_MM;
    var k = Math.min(availW / vw, availH / vh);
    return svg.replace('<svg ', '<svg style="width:' + (vw * k).toFixed(1) +
      'mm;height:' + (vh * k).toFixed(1) + 'mm" ');
  }

  function head(title, sub) {
    return '<header class="p-head"><h1>' + esc(title || 'Bludiště') + '</h1>' +
      (sub ? '<p>' + esc(sub) + '</p>' : '') + '</header>';
  }

  function body(svg, legend) {
    return '<div class="p-body' + (legend ? '' : ' p-body-wide') + '">' +
      '<div class="p-board">' + svg + '</div>' +
      (legend ? '<aside class="p-legend"><h2>Vysvětlivky</h2>' + legend + '</aside>' : '') +
      '</div>';
  }

  function commandsHTML(sol) {
    var list = S.commandsToText(sol.commands);
    var s = '<ol class="p-cmds">';
    list.forEach(function (t) { s += '<li>' + esc(t) + '</li>'; });
    return s + '</ol>';
  }

  /**
   * Sestaví obsah #print-root.
   * opts: { mode:'board'|'blank', board, eco, solution(bool), blank:{tx,ty,copies,legend} }
   */
  function build(opts) {
    var root = document.getElementById('print-root');
    var html = '';

    if (opts.mode === 'blank') {
      var bt = opts.blank;
      var blank = bt.sameShape && opts.board
        ? M.boardFromTiles(opts.board.tiles)
        : M.createBoard(bt.tx, bt.ty);
      var be = M.extent(blank);
      var landscape = be.mx >= be.my;
      var legend = bt.legend ? R.legendHTML(['wall', 'oneway', 'star', 'sound', 'finish', 'start']) : '';
      var svg = fitted(R.boardSVG(blank, { eco: opts.eco, noHits: true }), landscape, !!legend);
      setPageOrientation(landscape);
      for (var i = 0; i < bt.copies; i++) {
        html += page(
          head('Bludiště', 'Jméno: ______________________     Třída: __________') +
          body(svg, legend)
        );
      }
    } else {
      var b = opts.board;
      var land = M.cols(b) >= M.rows(b);
      var legend2 = R.legendHTML(M.legendItems(b));
      var svg2 = fitted(R.boardSVG(b, { eco: opts.eco, noHits: true }), land, !!legend2);
      setPageOrientation(land);
      html += page(head(b.title || 'Bludiště', 'Jméno: ______________________     Třída: __________') + body(svg2, legend2));

      if (opts.solution) {
        var sol = S.solve(b);
        if (sol.ok) {
          var svg3 = fitted(R.boardSVG(b, { eco: opts.eco, noHits: true, solution: sol.path, stops: sol.stops }), land, true);
          html += page(
            head('Řešení – ' + (b.title || 'Bludiště'),
              sol.steps + '× jeď vpřed, ' + sol.turns + '× otoč se, celkem ' + sol.cost + ' příkazů') +
            '<div class="p-body">' +
            '<div class="p-board">' + svg3 + '</div>' +
            '<aside class="p-legend"><h2>Program</h2>' + commandsHTML(sol) + '</aside>' +
            '</div>',
            'p-solution'
          );
        }
      }
    }

    root.innerHTML = html;
  }

  function run(opts) {
    build(opts);
    document.body.classList.add('printing');
    setTimeout(function () {
      window.print();
      setTimeout(function () { document.body.classList.remove('printing'); }, 300);
    }, 60);
  }

  VEX.printing = { build: build, run: run };
})();
