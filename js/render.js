/* VEX Bludiště – vykreslení desky do SVG. */
(function () {
  var VEX = (window.VEX = window.VEX || {});
  var M = VEX.model, I = VEX.icons;

  var CELL = 100;   // vnitřní souřadnice na jedno políčko
  var PAD = 26;     // rám desky kolem políček
  var INSET = 6;    // odsazení rámečku políčka
  var GAP = 15;     // mezera uprostřed každé strany rámečku

  /** Rámeček políčka: zaoblený čtverec přerušený uprostřed každé strany. */
  function framePath(s, r, g) {
    var h = s / 2, q = g / 2;
    return [
      'M' + (h + q) + ' 0 H' + (s - r) + ' A' + r + ' ' + r + ' 0 0 1 ' + s + ' ' + r + ' V' + (h - q),
      'M' + s + ' ' + (h + q) + ' V' + (s - r) + ' A' + r + ' ' + r + ' 0 0 1 ' + (s - r) + ' ' + s + ' H' + (h + q),
      'M' + (h - q) + ' ' + s + ' H' + r + ' A' + r + ' ' + r + ' 0 0 1 0 ' + (s - r) + ' V' + (h + q),
      'M0 ' + (h - q) + ' V' + r + ' A' + r + ' ' + r + ' 0 0 1 ' + r + ' 0 H' + (h - q)
    ].join(' ');
  }

  var FRAME = framePath(CELL - 2 * INSET, 19, GAP);

  function plate(w, h, tx, ty, eco) {
    if (eco) return '';
    var W = w * CELL + 2 * PAD, H = h * CELL + 2 * PAD, s = '', t, i;
    s += '<rect x="1" y="1" width="' + (W - 2) + '" height="' + (H - 2) + '" rx="26" fill="#ededed" stroke="#d8d8d8" stroke-width="2"/>';
    // konektory jako u skládacích podložek
    for (t = 0; t < tx; t++) {
      for (i = 0; i < 2; i++) {
        var x = PAD + t * 3 * CELL + 85 + i * 120;
        s += '<rect x="' + x + '" y="6" width="60" height="13" rx="5" fill="#9b9b9b"/>';
        s += '<rect x="' + x + '" y="' + (H - 19) + '" width="60" height="13" rx="5" fill="#9b9b9b"/>';
      }
    }
    for (t = 0; t < ty; t++) {
      for (i = 0; i < 2; i++) {
        var y = PAD + t * 3 * CELL + 85 + i * 120;
        s += '<rect x="6" y="' + y + '" width="13" height="60" rx="5" fill="#9b9b9b"/>';
        s += '<rect x="' + (W - 19) + '" y="' + y + '" width="13" height="60" rx="5" fill="#9b9b9b"/>';
      }
    }
    return s;
  }

  function seams(w, h, eco) {
    var s = '', i;
    var col = eco ? '#e6e6e6' : '#dcdcdc';
    for (i = 3; i < w; i += 3) {
      s += '<line x1="' + (PAD + i * CELL) + '" y1="' + PAD + '" x2="' + (PAD + i * CELL) +
        '" y2="' + (PAD + h * CELL) + '" stroke="' + col + '" stroke-width="3"/>';
    }
    for (i = 3; i < h; i += 3) {
      s += '<line x1="' + PAD + '" y1="' + (PAD + i * CELL) + '" x2="' + (PAD + w * CELL) +
        '" y2="' + (PAD + i * CELL) + '" stroke="' + col + '" stroke-width="3"/>';
    }
    return s;
  }

  /** Obsah jednoho políčka – rámeček a ikona. */
  function cellContent(item) {
    return '<g transform="translate(' + INSET + ' ' + INSET + ')">' +
      '<rect width="' + (CELL - 2 * INSET) + '" height="' + (CELL - 2 * INSET) + '" rx="22" fill="#fcfcfc"/>' +
      '<path d="' + FRAME + '" fill="none" stroke="#1a1a1a" stroke-width="9" stroke-linecap="round"/></g>' +
      (item ? I.draw(item) : '');
  }

  function cellsLayer(b, w, h) {
    var s = '', c, r;
    for (r = 0; r < h; r++) {
      for (c = 0; c < w; c++) {
        s += '<g id="cell-' + c + '-' + r + '" transform="translate(' +
          (PAD + c * CELL) + ' ' + (PAD + r * CELL) + ')">' +
          cellContent(M.get(b, c, r)) + '</g>';
      }
    }
    return s;
  }

  function hitLayer(w, h) {
    var s = '<g class="hits">', c, r;
    for (r = 0; r < h; r++) {
      for (c = 0; c < w; c++) {
        s += '<rect class="hit" data-c="' + c + '" data-r="' + r + '" x="' + (PAD + c * CELL) +
          '" y="' + (PAD + r * CELL) + '" width="' + CELL + '" height="' + CELL + '" fill="transparent"/>';
      }
    }
    return s + '</g>';
  }

  /** Vrstva s vyřešenou trasou. path = pole políček {c,r}. */
  function solutionLayer(path, stops) {
    if (!path || path.length < 2) return '';
    var pts = path.map(function (p) {
      return (PAD + p.c * CELL + CELL / 2) + ',' + (PAD + p.r * CELL + CELL / 2);
    }).join(' ');
    var s = '<g class="solution-layer" pointer-events="none">';
    s += '<polyline points="' + pts + '" fill="none" stroke="#ffffff" stroke-width="20" stroke-linejoin="round" stroke-linecap="round" opacity="0.75"/>';
    s += '<polyline points="' + pts + '" fill="none" stroke="#1e6fd9" stroke-width="11" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="26 16" opacity="0.95"/>';
    var last = path[path.length - 1], prev = path[path.length - 2];
    var ang = Math.atan2(last.r - prev.r, last.c - prev.c) * 180 / Math.PI;
    s += '<g transform="translate(' + (PAD + last.c * CELL + CELL / 2) + ' ' + (PAD + last.r * CELL + CELL / 2) +
      ') rotate(' + ang + ')"><path d="M-6 -16 L20 0 L-6 16 Z" fill="#1e6fd9"/></g>';
    (stops || []).forEach(function (st, i) {
      var cx = PAD + st.c * CELL + CELL / 2, cy = PAD + st.r * CELL + CELL / 2;
      s += '<g transform="translate(' + (cx + 28) + ' ' + (cy - 28) + ')">' +
        '<circle r="17" fill="#1e6fd9" stroke="#fff" stroke-width="3"/>' +
        '<text y="6" text-anchor="middle" font-size="22" font-weight="700" fill="#fff" font-family="sans-serif">' +
        (i + 1) + '</text></g>';
    });
    return s + '</g>';
  }

  /**
   * Sestaví SVG desky.
   * opts: { eco, solution:[cells], stops:[cells], cssClass }
   */
  function boardSVG(b, opts) {
    opts = opts || {};
    var w = M.cols(b), h = M.rows(b);
    var W = w * CELL + 2 * PAD, H = h * CELL + 2 * PAD;
    return '<svg class="board ' + (opts.cssClass || '') + '" viewBox="0 0 ' + W + ' ' + H +
      '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="deska bludiště">' +
      plate(w, h, b.tx, b.ty, opts.eco) +
      seams(w, h, opts.eco) +
      cellsLayer(b, w, h) +
      solutionLayer(opts.solution, opts.stops) +
      (opts.noHits ? '' : hitLayer(w, h)) +
      '</svg>';
  }

  /** Legenda – jen prvky, které jsou na desce (nebo zadaný seznam). */
  function legendHTML(types) {
    if (!types || !types.length) return '';
    var s = '<div class="legend">';
    types.forEach(function (t) {
      var def = M.ITEMS[t];
      if (!def) return;
      s += '<div class="legend-item">' + I.standalone(t, t === 'oneway' ? 1 : 0, 54) +
        '<span>' + def.legend + '</span></div>';
    });
    return s + '</div>';
  }

  VEX.render = {
    CELL: CELL, PAD: PAD,
    boardSVG: boardSVG,
    cellContent: cellContent,
    solutionLayer: solutionLayer,
    legendHTML: legendHTML
  };
})();
