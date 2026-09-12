/* VEX Bludiště – knihovna vlastních ikon.
 *
 * Ikony leží jen v prohlížeči (localStorage) toho počítače, na kterém se nahrály.
 * Nic se neposílá na server, nic se nikam nepřihlašuje a o počítači se nikde
 * nic neukládá. navigator.storage.persist() je jen prosba prohlížeči, aby data
 * nezahazoval, když dojde místo.
 *
 * Přežije: nový panel i okno, zavření prohlížeče, restart počítače.
 * Nepřežije: vymazání dat stránek, anonymní okno, jiný prohlížeč nebo profil,
 *            jiný počítač a taky přechod na jinou doménu.
 * Proto je vedle toho export do souboru – ten přežije všechno.
 */
(function () {
  var VEX = (window.VEX = window.VEX || {});

  var KEY = 'vex-bludiste-icons-v1';
  var MAX_ICONS = 24;
  var MAX_FILE = 4 * 1024 * 1024;   // 4 MB vstupní soubor
  var MAX_SRC = 260000;             // znaků data URL na jednu ikonu
  var BOX = 256;                    // na kolik pixelů zmenšíme fotky

  var lib = read();

  /* ---------- úložiště ---------- */

  function looksOk(i) {
    return i && typeof i === 'object' &&
      typeof i.id === 'string' && i.id &&
      typeof i.src === 'string' && /^data:image\/(png|svg\+xml);/.test(i.src) &&
      i.src.length <= MAX_SRC;
  }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      var a = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(a)) return [];
      return a.filter(looksOk).slice(0, MAX_ICONS).map(function (i) {
        return { id: i.id, name: String(i.name || 'Ikona').slice(0, 24), src: i.src };
      });
    } catch (e) { return []; }
  }

  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(lib)); return true; }
    catch (e) { return false; }
  }

  /** Poprosí prohlížeč, ať data nemaže při nedostatku místa. */
  function keepLong(cb) {
    cb = cb || function () { };
    if (!navigator.storage || !navigator.storage.persist) return cb(false);
    try {
      navigator.storage.persisted().then(function (already) {
        if (already) return cb(true);
        navigator.storage.persist().then(cb, function () { cb(false); });
      }, function () { cb(false); });
    } catch (e) { cb(false); }
  }

  /* ---------- čtení knihovny ---------- */

  function list() { return lib.slice(); }
  function get(id) {
    for (var i = 0; i < lib.length; i++) if (lib[i].id === id) return lib[i];
    return null;
  }
  function src(id) { var x = get(id); return x ? x.src : null; }
  function nameOf(id) { var x = get(id); return x ? x.name : ''; }
  function count() { return lib.length; }

  function newId() {
    return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /** Vloží hotovou ikonu. Vrací {ok, id, error}. */
  function add(name, dataUrl) {
    if (lib.length >= MAX_ICONS) return { ok: false, error: 'Víc než ' + MAX_ICONS + ' vlastních ikon se nevejde. Nějakou nejdřív smaž.' };
    var icon = { id: newId(), name: String(name || 'Ikona').slice(0, 24), src: dataUrl };
    if (!looksOk(icon)) return { ok: false, error: 'Obrázek je moc velký nebo v nepodporovaném formátu.' };
    lib.push(icon);
    if (!write()) {
      lib.pop();
      return { ok: false, error: 'V prohlížeči už není místo. Smaž nějakou ikonu, nebo si je ulož do souboru.' };
    }
    keepLong();
    return { ok: true, id: icon.id };
  }

  function remove(id) {
    lib = lib.filter(function (x) { return x.id !== id; });
    write();
  }

  /** Přidá ikony z načteného souboru nebo odkazu, pokud je ještě nemáme. */
  function merge(icons) {
    if (!icons) return 0;
    var added = 0;
    Object.keys(icons).forEach(function (id) {
      if (get(id) || lib.length >= MAX_ICONS) return;
      var i = icons[id];
      var icon = { id: id, name: String(i && i.name || 'Ikona').slice(0, 24), src: i && i.src };
      if (!looksOk(icon)) return;
      lib.push(icon);
      added++;
    });
    if (added) write();
    return added;
  }

  /** Ikony použité na desce – pro uložení do souboru a do odkazu. */
  function usedBy(board) {
    var out = null;
    for (var k in board.cells) {
      var it = board.cells[k];
      if (it.t !== 'own' || !it.ico) continue;
      var icon = get(it.ico);
      if (!icon) continue;
      out = out || {};
      out[icon.id] = { name: icon.name, src: icon.src };
    }
    return out;
  }

  /* ---------- nahrávání souboru ---------- */

  function baseName(file) {
    return (file.name || 'ikona').replace(/\.[^.]+$/, '').slice(0, 24) || 'Ikona';
  }

  /** Z SVG vyhodíme skripty a odkazy, které by mohly něco spouštět. */
  function cleanSVG(text) {
    var doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    var root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return null;
    var bad = root.querySelectorAll('script, foreignObject, iframe, a, use[*|href^="http"], image[*|href^="http"]');
    Array.prototype.forEach.call(bad, function (n) { n.parentNode.removeChild(n); });
    var all = root.querySelectorAll('*');
    [root].concat(Array.prototype.slice.call(all)).forEach(function (n) {
      Array.prototype.slice.call(n.attributes || []).forEach(function (a) {
        var an = a.name.toLowerCase(), av = String(a.value || '');
        if (an.indexOf('on') === 0 || /javascript:/i.test(av)) n.removeAttribute(a.name);
      });
    });
    if (!root.getAttribute('viewBox') && root.getAttribute('width') && root.getAttribute('height')) {
      root.setAttribute('viewBox', '0 0 ' + parseFloat(root.getAttribute('width')) + ' ' + parseFloat(root.getAttribute('height')));
    }
    return new XMLSerializer().serializeToString(root);
  }

  function svgDataUrl(text) {
    var bytes = new TextEncoder().encode(text), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return 'data:image/svg+xml;base64,' + btoa(bin);
  }

  /** Zmenší rastrový obrázek, ať se vejde do úložiště. */
  function shrink(url, cb) {
    var img = new Image();
    img.onload = function () {
      var k = Math.min(1, BOX / Math.max(img.width || BOX, img.height || BOX));
      var w = Math.max(1, Math.round((img.width || BOX) * k));
      var h = Math.max(1, Math.round((img.height || BOX) * k));
      var cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      try { cb(cv.toDataURL('image/png')); } catch (e) { cb(null); }
    };
    img.onerror = function () { cb(null); };
    img.src = url;
  }

  /** Zpracuje nahraný soubor. cb(dataUrl, chyba) */
  function fromFile(file, cb) {
    if (!file) return cb(null, 'Soubor se nepodařilo přečíst.');
    if (file.size > MAX_FILE) return cb(null, 'Obrázek je moc velký, vyber menší než 4 MB.');

    var isSvg = /svg/i.test(file.type) || /\.svg$/i.test(file.name);
    var fr = new FileReader();
    fr.onerror = function () { cb(null, 'Soubor se nepodařilo přečíst.'); };

    if (isSvg) {
      fr.onload = function () {
        var clean = cleanSVG(String(fr.result));
        if (!clean) return cb(null, 'Tenhle SVG soubor se nepodařilo načíst.');
        var url = svgDataUrl(clean);
        if (url.length > MAX_SRC) return cb(null, 'SVG je moc složité. Zkus jednodušší obrázek nebo PNG.');
        cb(url, null);
      };
      fr.readAsText(file);
    } else {
      fr.onload = function () {
        shrink(String(fr.result), function (png) {
          if (!png) return cb(null, 'Z tohohle souboru se obrázek udělat nedá.');
          if (png.length > MAX_SRC) return cb(null, 'Obrázek je i po zmenšení moc velký.');
          cb(png, null);
        });
      };
      fr.readAsDataURL(file);
    }
  }

  /* ---------- záloha do souboru ---------- */

  function exportAll() { return { app: 'vex-bludiste-ikony', v: 1, icons: lib.slice() }; }

  function importAll(data) {
    if (!data || !Array.isArray(data.icons)) return { ok: false, error: 'Tohle není soubor s ikonami.' };
    var map = {};
    data.icons.forEach(function (i) { if (i && i.id) map[i.id] = { name: i.name, src: i.src }; });
    var n = merge(map);
    return { ok: true, added: n };
  }

  VEX.userIcons = {
    list: list, get: get, src: src, nameOf: nameOf, count: count,
    add: add, remove: remove, merge: merge, usedBy: usedBy,
    fromFile: fromFile, baseName: baseName, keepLong: keepLong,
    exportAll: exportAll, importAll: importAll, MAX_ICONS: MAX_ICONS
  };
})();
