/* Kontrola řešitelů bez prohlížeče:  node tools/checkaim.js
 *
 * Moduly jsou psané pro stránku (IIFE nad window.VEX), takže si tu vyrobíme
 * malé window a skripty do něj načteme. Pak projdeme desky ve složce
 * tools/testboards a vypíšeme, co na nich řešitel spočítá.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const boardsDir = path.join(__dirname, 'testboards');

const sandbox = { window: { VEX: {} }, console, Math, Date, JSON };
vm.createContext(sandbox);
['js/model.js', 'js/solver.js', 'js/aimsolver.js', 'js/aimvision.js',
  'js/storage.js', 'js/generator.js', 'js/aimgenerator.js']
  .forEach(function (f) {
    const file = path.join(root, f);
    if (!fs.existsSync(file)) return;
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: f });
  });

const VEX = sandbox.window.VEX;
const M = VEX.model;

let failed = 0;

function fail(msg) {
  failed++;
  console.log('   CHYBA: ' + msg);
}

function showAim(board, name) {
  const res = VEX.aimsolver.solve(board);
  console.log('\n== ' + name + ' (AIM) ==');
  (M.jobs(board) || []).forEach(function (j, i) {
    console.log('   úkol ' + (i + 1) + ': ' + M.jobText(j));
  });
  if (!res.ok) { fail(res.reason); return; }
  const counts = res.variants.map(function (v) { return v.count; });
  res.variants.forEach(function (v) {
    console.log('   ' + v.label.padEnd(26) + v.count + ' příkazů');
    v.commands.forEach(function (c) {
      console.log('        ' + (c.n ? String(c.n) : '-').padStart(2) + '  ' + c.text);
    });
    if (v.count !== v.cost) fail(v.label + ': plán říká ' + v.cost + ', program má ' + v.count);
  });
  if (counts[2] > counts[1]) fail('šikmá varianta má víc příkazů než jízda bokem');
  if (counts[1] > counts[0] + 1) fail('bloky jsou delší než tlačítka');
}

function show123(board, name) {
  const res = VEX.solver.solve(board);
  console.log('\n== ' + name + ' (123) ==');
  if (!res.ok) { fail(res.reason); return; }
  console.log('   ' + res.cost + ' příkazů (' + res.steps + '× vpřed, ' + res.turns + '× otočka)');
  console.log('   ' + VEX.solver.commandsToText(res.commands).join(' | '));
}

/* ---- deska poskládaná rovnou tady, ať je na čem ověřovat i bez souborů ---- */
function demoBoard() {
  const b = M.createBoard(2, 2, 'aim');
  M.place(b, 2, 5, 'start', { d: 0 });
  M.place(b, 2, 2, 'orange');
  M.place(b, 0, 0, 'tag', { n: 1 });
  M.addJob(b, 'deliver', 'orange', 1);
  return b;
}

showAim(demoBoard(), 'ukázka z kódu');

if (fs.existsSync(boardsDir)) {
  fs.readdirSync(boardsDir).filter(function (f) { return /\.json$/.test(f); }).sort()
    .forEach(function (f) {
      const raw = JSON.parse(fs.readFileSync(path.join(boardsDir, f), 'utf8'));
      const board = VEX.storage ? VEX.storage.sanitize(raw) : raw;
      if (M.isAim(board)) showAim(board, f); else show123(board, f);
    });
}

/* ---- generátor: každá vygenerovaná deska musí jít vyřešit ---- */
if (VEX.aimgenerator) {
  console.log('\n== generátor AIM ==');
  ['easy', 'medium', 'hard'].forEach(function (diff) {
    [[2, 2], [3, 2]].forEach(function (size) {
      const tiles = {};
      for (let y = 0; y < size[1]; y++) for (let x = 0; x < size[0]; x++) tiles[x + ',' + y] = 1;
      let ok = 0, best = null;
      for (let i = 0; i < 5; i++) {
        const res = VEX.aimgenerator.generate({ tiles: tiles, difficulty: diff, walls: true, ball: true });
        if (!res) continue;
        const check = VEX.aimsolver.solve(res.board);
        if (!check.ok) { fail(diff + ' ' + size.join('x') + ': deska nejde vyřešit'); continue; }
        ok++;
        best = res.info.counts;
      }
      console.log('   ' + diff.padEnd(7) + size.join('x') + ' dlaždic: ' +
        ok + ' z 5 desek' + (best ? ', naposledy ' + best.join(' / ') + ' příkazů' : ''));
      if (!ok) fail(diff + ' ' + size.join('x') + ': generátor nic nevymyslel');
    });
  });
}

console.log(failed ? '\n' + failed + '× chyba' : '\nVšechno sedí.');
process.exit(failed ? 1 : 0);
