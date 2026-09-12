/* VEX Bludiště – kresba ikon.
 * Každá ikona se kreslí do čtverce 100 x 100 (souřadnice 0..100).
 * Nový prvek = nová funkce v tabulce ICONS pod stejným klíčem jako v ITEMS.
 */
(function () {
  var VEX = (window.VEX = window.VEX || {});

  var C = {
    red: '#e0262c',
    redDark: '#a8161b',
    teal: '#3fa197',
    tealDark: '#22685f',
    gold: '#ffc61e',
    goldDark: '#d69b00',
    green: '#2fa84f',
    greenDark: '#1d7a37',
    blue: '#2a48c6',
    ink: '#141414',
    botGreen: '#8cc63f',
    botGreenDark: '#4f8c17'
  };

  /* hvězda o daném počtu cípů */
  function starPath(cx, cy, rOut, rIn, points) {
    var d = '', i, a, r;
    for (i = 0; i < points * 2; i++) {
      a = (Math.PI / points) * i - Math.PI / 2;
      r = i % 2 === 0 ? rOut : rIn;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(2) + ' ' + (cy + Math.sin(a) * r).toFixed(2) + ' ';
    }
    return d + 'Z';
  }

  /* blokovaná šipka mířící doprava, otočí se kolem středu */
  function arrow(fill, stroke, dir) {
    var d = 'M16 38 H50 V20 L86 50 L50 80 V62 H16 Z';
    return '<g transform="rotate(' + (dir * 90 - 90) + ' 50 50)">' +
      '<path d="' + d + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="3" stroke-linejoin="round"/>' +
      '</g>';
  }

  var ICONS = {
    wall: function () {
      return '<g stroke="' + C.red + '" stroke-width="13" stroke-linecap="round">' +
        '<line x1="20" y1="20" x2="80" y2="80"/><line x1="80" y1="20" x2="20" y2="80"/></g>';
    },

    oneway: function (it) {
      return arrow(C.teal, C.tealDark, (it && it.d) | 0);
    },

    star: function () {
      return '<path d="' + starPath(50, 52, 36, 15.5, 5) + '" fill="' + C.gold +
        '" stroke="' + C.goldDark + '" stroke-width="3" stroke-linejoin="round"/>';
    },

    sound: function () {
      return '<g fill="' + C.ink + '"><path d="M20 40 H36 L54 24 V78 L36 60 H20 Z"/></g>' +
        '<g fill="none" stroke="' + C.ink + '" stroke-width="6" stroke-linecap="round">' +
        '<path d="M64 36 Q74 51 64 66"/><path d="M76 27 Q90 51 76 75"/></g>';
    },

    light: function () {
      return '<g stroke="' + C.goldDark + '" stroke-width="5" stroke-linecap="round">' +
        '<line x1="50" y1="6" x2="50" y2="16"/><line x1="20" y1="18" x2="27" y2="25"/>' +
        '<line x1="80" y1="18" x2="73" y2="25"/><line x1="10" y1="46" x2="20" y2="46"/>' +
        '<line x1="90" y1="46" x2="80" y2="46"/></g>' +
        '<path d="M50 20 a24 24 0 0 1 14 43 v7 h-28 v-7 a24 24 0 0 1 14 -43 Z" fill="' + C.gold +
        '" stroke="' + C.goldDark + '" stroke-width="4" stroke-linejoin="round"/>' +
        '<rect x="38" y="74" width="24" height="7" rx="3" fill="#6b6b6b"/>' +
        '<rect x="41" y="84" width="18" height="7" rx="3" fill="#6b6b6b"/>';
    },

    finish: function () {
      var sq = '', i, j, s = 9;
      for (i = 0; i < 4; i++) {
        for (j = 0; j < 4; j++) {
          if ((i + j) % 2 === 0) {
            sq += '<rect x="' + (30 + j * s) + '" y="' + (18 + i * s) + '" width="' + s + '" height="' + s + '" fill="' + C.ink + '"/>';
          }
        }
      }
      return '<rect x="30" y="18" width="' + s * 4 + '" height="' + s * 4 + '" fill="#fff" stroke="' + C.ink + '" stroke-width="3"/>' +
        sq +
        '<rect x="30" y="18" width="' + s * 4 + '" height="' + s * 4 + '" fill="none" stroke="' + C.ink + '" stroke-width="3"/>' +
        '<line x1="26" y1="14" x2="26" y2="88" stroke="' + C.ink + '" stroke-width="6" stroke-linecap="round"/>';
    },

    start: function (it) {
      var d = (it && it.d) | 0;
      return '<circle cx="50" cy="50" r="40" fill="' + C.botGreen + '" stroke="' + C.botGreenDark + '" stroke-width="5"/>' +
        '<circle cx="50" cy="50" r="28" fill="#f2fadb" stroke="' + C.botGreenDark + '" stroke-width="3"/>' +
        '<g transform="rotate(' + d * 90 + ' 50 50)">' +
        '<path d="M50 26 L64 52 H55 V70 H45 V52 H36 Z" fill="' + C.ink + '"/></g>';
    },

    /* Vlastní nahraný obrázek. Vždy přes <image href="data:…">, takže se
     * případný skript v SVG nikdy nespustí. */
    own: function (it) {
      var lib = window.VEX.userIcons;
      var url = lib && it ? lib.src(it.ico) : null;
      if (!url) {
        return '<g opacity="0.45"><rect x="20" y="20" width="60" height="60" rx="10" fill="none" ' +
          'stroke="#8a8a8a" stroke-width="5" stroke-dasharray="9 7"/>' +
          '<text x="50" y="60" text-anchor="middle" font-size="34" fill="#8a8a8a" font-family="sans-serif">?</text></g>';
      }
      return '<image href="' + url + '" xlink:href="' + url + '" x="14" y="14" width="72" height="72" ' +
        'preserveAspectRatio="xMidYMid meet"/>';
    },

    shape: function (it) {
      var M = window.VEX.model;
      var col = M.colorById(it && it.col).hex;
      var s = M.shapeById(it && it.s).id;
      var body = SHAPE_PATH[s] || SHAPE_PATH.circle;
      return body(col);
    }
  };

  /* Základní tvary pro prvek „vlastní tvar“ – čtverec 100x100. */
  function hexPath(cx, cy, r) {
    var d = '', i, a;
    for (i = 0; i < 6; i++) {
      a = (Math.PI / 3) * i - Math.PI / 2;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(2) + ' ' + (cy + Math.sin(a) * r).toFixed(2) + ' ';
    }
    return d + 'Z';
  }

  function shaped(d, col) {
    return '<path d="' + d + '" fill="' + col + '" stroke="rgba(0,0,0,.28)" stroke-width="2.5" stroke-linejoin="round"/>';
  }

  var SHAPE_PATH = {
    circle: function (col) {
      return '<circle cx="50" cy="50" r="29" fill="' + col + '" stroke="rgba(0,0,0,.28)" stroke-width="2.5"/>';
    },
    square: function (col) {
      return '<rect x="22" y="22" width="56" height="56" rx="7" fill="' + col +
        '" stroke="rgba(0,0,0,.28)" stroke-width="2.5"/>';
    },
    triangle: function (col) { return shaped('M50 18 L80 72 H20 Z', col); },
    diamond: function (col) { return shaped('M50 17 L81 50 L50 83 L19 50 Z', col); },
    hexagon: function (col) { return shaped(hexPath(50, 50, 31), col); },
    heart: function (col) {
      return shaped('M50 81 C13 56 17 29 34 25 C44 22 49 29 50 35 C51 29 56 22 66 25 C83 29 87 56 50 81 Z', col);
    }
  };

  /** Vykreslí ikonu prvku do čtverce 100x100. */
  function draw(item) {
    var f = ICONS[item && item.t];
    return f ? f(item) : '';
  }

  /**
   * Samostatná SVG ikona (paleta, legenda, nápověda).
   * type může být klíč prvku, nebo přímo hotový prvek {t,d,s,col}.
   * opts je číslo (natočení) nebo objekt {d, s, col}.
   */
  function standalone(type, opts, size) {
    var s = size || 44, item;
    if (type && typeof type === 'object') item = type;
    else {
      if (typeof opts === 'number') opts = { d: opts };
      item = window.VEX.model.makeItem(type, opts) || { t: type };
    }
    return '<svg class="ico" viewBox="0 0 100 100" width="' + s + '" height="' + s +
      '" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"' +
      ' aria-hidden="true">' + draw(item) + '</svg>';
  }

  VEX.icons = { draw: draw, standalone: standalone, colors: C, starPath: starPath };
})();
