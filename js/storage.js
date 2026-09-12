/* VEX Bludiště – ukládání do prohlížeče, do souboru a do odkazu. */
(function () {
  var VEX = (window.VEX = window.VEX || {});
  var KEY = 'vex-bludiste-v1';

  function toB64(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromB64(b64) {
    var s = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function valid(b) {
    return b && typeof b === 'object' && b.tx > 0 && b.ty > 0 &&
      b.tx <= VEX.model.MAX_TILES && b.ty <= VEX.model.MAX_TILES && typeof b.cells === 'object';
  }

  function sanitize(b) {
    var out = VEX.model.createBoard(b.tx | 0, b.ty | 0);
    out.title = typeof b.title === 'string' ? b.title.slice(0, 60) : '';
    for (var k in b.cells) {
      if (!/^\d+,\d+$/.test(k)) continue;
      var it = b.cells[k];
      if (!it || !VEX.model.ITEMS[it.t]) continue;
      out.cells[k] = VEX.model.ITEMS[it.t].rot ? { t: it.t, d: (it.d | 0) & 3 } : { t: it.t };
    }
    VEX.model.trim(out);
    return out;
  }

  function saveLocal(board) {
    try { localStorage.setItem(KEY, JSON.stringify(board)); } catch (e) { /* plný / zakázaný */ }
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var b = JSON.parse(raw);
      return valid(b) ? sanitize(b) : null;
    } catch (e) { return null; }
  }

  function loadFromHash() {
    var h = location.hash.replace(/^#b=/, '');
    if (!h || h === location.hash) return null;
    try {
      var b = JSON.parse(fromB64(h));
      return valid(b) ? sanitize(b) : null;
    } catch (e) { return null; }
  }

  function shareLink(board) {
    return location.origin + location.pathname + '#b=' + toB64(JSON.stringify(board));
  }

  function safeName(board) {
    var t = (board.title || 'bludiste').trim().toLowerCase()
      .replace(/[áàâä]/g, 'a').replace(/[éěèêë]/g, 'e').replace(/[íìîï]/g, 'i')
      .replace(/[óòôö]/g, 'o').replace(/[úůùûü]/g, 'u').replace(/[ý]/g, 'y')
      .replace(/[č]/g, 'c').replace(/[ď]/g, 'd').replace(/[ň]/g, 'n').replace(/[ř]/g, 'r')
      .replace(/[š]/g, 's').replace(/[ť]/g, 't').replace(/[ž]/g, 'z')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return (t || 'bludiste');
  }

  function download(name, mime, content) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function downloadJSON(board) {
    download(safeName(board) + '.json', 'application/json', JSON.stringify(board, null, 2));
  }

  function readFile(file, cb) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var b = JSON.parse(fr.result);
        cb(valid(b) ? sanitize(b) : null);
      } catch (e) { cb(null); }
    };
    fr.onerror = function () { cb(null); };
    fr.readAsText(file);
  }

  /** Vyrenderuje SVG desky do PNG a stáhne. */
  function downloadPNG(board, svgMarkup, scale) {
    var img = new Image();
    var k = scale || 2;
    var vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svgMarkup);
    var vw = vb ? +vb[1] : 800, vh = vb ? +vb[2] : 800;
    var svg = svgMarkup
      .replace(/<g class="hits">[\s\S]*?<\/g>\s*<\/svg>/, '</svg>')
      .replace('<svg ', '<svg width="' + Math.round(vw * k) + '" height="' + Math.round(vh * k) + '" ');
    var blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    img.onload = function () {
      var cv = document.createElement('canvas');
      cv.width = Math.round(vw * k); cv.height = Math.round(vh * k);
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob(function (png) {
        download(safeName(board) + '.png', 'image/png', png);
        URL.revokeObjectURL(url);
      });
    };
    img.onerror = function () { URL.revokeObjectURL(url); alert('Obrázek se nepodařilo vytvořit.'); };
    img.src = url;
  }

  VEX.storage = {
    saveLocal: saveLocal, loadLocal: loadLocal, loadFromHash: loadFromHash,
    shareLink: shareLink, downloadJSON: downloadJSON, readFile: readFile,
    downloadPNG: downloadPNG, sanitize: sanitize, valid: valid
  };
})();
