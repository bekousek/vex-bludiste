/* VEX Bludiště – přibližný model toho, co robot AIM vidí ze startu.
 *
 * Kamera AI Vision pozná sudy, míček a AprilTagy. Zorné pole pro sudy je
 * podle VEX STEM Labs asi 73°. Tenhle model počítá jen geometrii: objekt je
 * vidět, když leží ve výseči a nic mu nestojí v cestě. Skutečná kamera se
 * chová jinak podle světla, vzdálenosti a úhlu, takže jde o pomůcku
 * k plánování maker „turn until found“, ne o simulaci.
 */
(function () {
  var VEX = (window.VEX = window.VEX || {});
  var M = VEX.model;

  var STEP = 0.05;    // jak hustě se vzorkuje přímá viditelnost (v políčkách)

  function norm(a) {
    a = ((a % 360) + 360) % 360;
    return a > 180 ? a - 360 : a;
  }

  /** Úhel k bodu měřený od svislice po směru hodinových ručiček (0 = nahoru). */
  function angleTo(dx, dy) {
    return norm(Math.atan2(dx, -dy) * 180 / Math.PI);
  }

  function blocking(b, c, r) {
    if (!M.inside(b, c, r)) return true;
    var it = M.get(b, c, r);
    var def = it && M.ITEMS[it.t];
    return !!(def && def.blocks);
  }

  /** Je mezi středy políček volno? Políčko s objektem samo o sobě nevadí. */
  function clearLine(b, from, to) {
    var dx = to.c - from.c, dy = to.r - from.r;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1e-6) return true;
    var steps = Math.ceil(len / STEP);
    for (var i = 1; i < steps; i++) {
      var t = i / steps;
      var c = Math.floor(from.c + dx * t + 0.5);
      var r = Math.floor(from.r + dy * t + 0.5);
      if (c === from.c && r === from.r) continue;
      if (c === to.c && r === to.r) continue;
      if (blocking(b, c, r)) return false;
    }
    return true;
  }

  /** Prvky, které kamera umí poznat: náklad a AprilTagy. */
  function seenTypes(b) {
    return M.findAll(b, function (it) {
      var def = M.ITEMS[it.t];
      return !!def && (def.cargo || it.t === 'tag');
    });
  }

  /**
   * Co robot vidí ze startu.
   * Vrací { ok, reason, from, dir, fov, items:[{ c, r, item, bearing, visible, why }] }.
   */
  function look(b) {
    var st = M.findFirst(b, 'start');
    if (!st) return { ok: false, reason: 'Na desce chybí START.' };

    var fov = M.robot(b).fov || 73;
    var dir = st.item.d | 0;
    var from = { c: st.c, r: st.r };
    var half = fov / 2;

    var items = seenTypes(b).map(function (o) {
      var bearing = norm(angleTo(o.c - st.c, o.r - st.r) - dir * 90);
      var inside = Math.abs(bearing) <= half + 1e-9;
      var open = inside && clearLine(b, from, { c: o.c, r: o.r });
      return {
        c: o.c, r: o.r, item: o.item,
        bearing: Math.round(bearing),
        visible: inside && open,
        why: !inside ? 'mimo zorné pole' : (open ? '' : 'zakryté')
      };
    });

    items.sort(function (a, z) { return Math.abs(a.bearing) - Math.abs(z.bearing); });
    return { ok: true, from: from, dir: dir, fov: fov, items: items };
  }

  VEX.aimvision = { look: look, angleTo: angleTo, clearLine: clearLine };
})();
