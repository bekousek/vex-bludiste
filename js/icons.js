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

    mred: function () { return '<rect x="22" y="22" width="56" height="56" rx="8" fill="' + C.red + '"/>'; },
    mgreen: function () { return '<circle cx="50" cy="50" r="28" fill="' + C.green + '"/>'; },
    mblue: function () { return '<circle cx="50" cy="50" r="28" fill="' + C.blue + '"/>'; }
  };

  /** Vykreslí ikonu prvku do čtverce 100x100. */
  function draw(item) {
    var f = ICONS[item && item.t];
    return f ? f(item) : '';
  }

  /** Samostatná SVG ikona (paleta, legenda). */
  function standalone(type, dir, size) {
    var s = size || 44;
    return '<svg class="ico" viewBox="0 0 100 100" width="' + s + '" height="' + s +
      '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      draw({ t: type, d: dir | 0 }) + '</svg>';
  }

  VEX.icons = { draw: draw, standalone: standalone, colors: C, starPath: starPath };
})();
