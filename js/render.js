/* VEX Bludiště – vykreslení desky do SVG.
 * Deska se kreslí po dlaždicích, takže zvládne i tvar L, okruh nebo díru uprostřed.
 */
(function () {
  var VEX = (window.VEX = window.VEX || {});
  var M = VEX.model, I = VEX.icons;

  var CELL = 100;   // vnitřní souřadnice na jedno políčko
  var TS = 3 * CELL; // strana dlaždice
  var PAD = 26;     // rám kolem celé desky
  var INSET = 6;    // odsazení rámečku políčka
  var GAP = 15;     // mezera uprostřed každé strany rámečku
  var RX = 16;      // zaoblení dlaždice
  var NUB = 13;     // výška konektoru na okraji

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

  /* Podklad: jedna zaoblená dlaždice na každou položenou dlaždici.
   * Sousedící dlaždice se spojí přemostěním, aby mezi nimi nebyly zářezy.
   * Konektory se kreslí jen na okrajích, které nemají soused, a čouhají ven. */
  function plate(b, eco) {
    if (eco) return '';
    var tiles = M.tileList(b), s = '', i, t, x, y, k;

    for (i = 0; i < tiles.length; i++) {
      t = tiles[i]; x = PAD + t.x * TS; y = PAD + t.y * TS;
      s += '<rect x="' + x + '" y="' + y + '" width="' + TS + '" height="' + TS +
        '" rx="' + RX + '" fill="#ededed" stroke="#dcdcdc" stroke-width="2"/>';
    }
    for (i = 0; i < tiles.length; i++) {
      t = tiles[i]; x = PAD + t.x * TS; y = PAD + t.y * TS;
      if (M.hasTile(b, t.x + 1, t.y)) {
        s += '<rect x="' + (x + TS - RX) + '" y="' + y + '" width="' + (2 * RX) + '" height="' + TS + '" fill="#ededed"/>';
      }
      if (M.hasTile(b, t.x, t.y + 1)) {
        s += '<rect x="' + x + '" y="' + (y + TS - RX) + '" width="' + TS + '" height="' + (2 * RX) + '" fill="#ededed"/>';
      }
    }
    for (i = 0; i < tiles.length; i++) {
      t = tiles[i]; x = PAD + t.x * TS; y = PAD + t.y * TS;
      for (k = 0; k < 2; k++) {
        var off = 85 + k * 120;
        if (!M.hasTile(b, t.x, t.y - 1)) s += nub(x + off, y - NUB, 60, NUB);
        if (!M.hasTile(b, t.x, t.y + 1)) s += nub(x + off, y + TS, 60, NUB);
        if (!M.hasTile(b, t.x - 1, t.y)) s += nub(x - NUB, y + off, NUB, 60);
        if (!M.hasTile(b, t.x + 1, t.y)) s += nub(x + TS, y + off, NUB, 60);
      }
    }
    return s;
  }

  function nub(x, y, w, h) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5" fill="#9b9b9b"/>';
  }

  /** Spáry jen mezi sousedícími dlaždicemi. */
  function seams(b, eco) {
    var tiles = M.tileList(b), s = '', col = eco ? '#e6e6e6' : '#d2d2d2', i, t, x, y;
    for (i = 0; i < tiles.length; i++) {
      t = tiles[i]; x = PAD + t.x * TS; y = PAD + t.y * TS;
      if (M.hasTile(b, t.x + 1, t.y)) {
        s += '<line x1="' + (x + TS) + '" y1="' + y + '" x2="' + (x + TS) + '" y2="' + (y + TS) +
          '" stroke="' + col + '" stroke-width="3"/>';
      }
      if (M.hasTile(b, t.x, t.y + 1)) {
        s += '<line x1="' + x + '" y1="' + (y + TS) + '" x2="' + (x + TS) + '" y2="' + (y + TS) +
          '" stroke="' + col + '" stroke-width="3"/>';
      }
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

  /** Projde jen políčka, která na desce opravdu existují. */
  function eachCell(b, fn) {
    var tiles = M.tileList(b), i, dx, dy;
    for (i = 0; i < tiles.length; i++) {
      for (dy = 0; dy < 3; dy++) {
        for (dx = 0; dx < 3; dx++) fn(tiles[i].x * 3 + dx, tiles[i].y * 3 + dy);
      }
    }
  }

  function cellsLayer(b) {
    var s = '';
    eachCell(b, function (c, r) {
      s += '<g id="cell-' + c + '-' + r + '" transform="translate(' +
        (PAD + c * CELL) + ' ' + (PAD + r * CELL) + ')">' +
        cellContent(M.get(b, c, r)) + '</g>';
    });
    return s;
  }

  function hitLayer(b) {
    var s = '<g class="hits">';
    eachCell(b, function (c, r) {
      s += '<rect class="hit" data-c="' + c + '" data-r="' + r + '" x="' + (PAD + c * CELL) +
        '" y="' + (PAD + r * CELL) + '" width="' + CELL + '" height="' + CELL + '" fill="transparent"/>';
    });
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
   * opts: { eco, solution:[cells], stops:[cells], noHits, cssClass }
   */
  function boardSVG(b, opts) {
    opts = opts || {};
    var e = M.extent(b);
    var W = (e.mx + 1) * TS + 2 * PAD, H = (e.my + 1) * TS + 2 * PAD;
    return '<svg class="board ' + (opts.cssClass || '') + '" viewBox="0 0 ' + W + ' ' + H +
      '" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="deska bludiště">' +
      plate(b, opts.eco) +
      seams(b, opts.eco) +
      cellsLayer(b) +
      solutionLayer(opts.solution, opts.stops) +
      (opts.noHits ? '' : hitLayer(b)) +
      '</svg>';
  }

  /**
   * Legenda. Přijme seznam klíčů prvků, nebo řádky {item, text}
   * z M.legendItems(), aby se vlastní značky vykreslily přesně tak,
   * jak jsou na desce.
   */
  function legendHTML(rows) {
    if (!rows || !rows.length) return '';
    var s = '<div class="legend">';
    rows.forEach(function (row) {
      var item, text;
      if (typeof row === 'string') {
        var def = M.ITEMS[row];
        if (!def) return;
        item = M.makeItem(row, { d: row === 'oneway' ? 1 : 0 });
        text = def.legend;
      } else {
        item = row.item;
        text = row.text;
        // jednosměrku v legendě ukazujeme vždy jako obecné pravidlo doprava
        if (item.t === 'oneway') item = { t: 'oneway', d: 1 };
      }
      s += '<div class="legend-item">' + I.standalone(item, null, 54) +
        '<span>' + text + '</span></div>';
    });
    return s + '</div>';
  }

  VEX.render = {
    CELL: CELL, PAD: PAD, TS: TS,
    boardSVG: boardSVG,
    cellContent: cellContent,
    solutionLayer: solutionLayer,
    legendHTML: legendHTML
  };
})();
