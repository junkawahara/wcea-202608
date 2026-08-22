'use strict';
const fs = require('fs');
const { parse } = require('./solver.js');
const L = parse(fs.readFileSync(process.argv[2], 'utf8'));
const moves = process.argv[3];
const W = L.W;
const D = { u: -W, d: W, l: -1, r: 1 };
let p = L.player;
const boxes = new Set(L.boxes);
let pushes = 0;
for (let i = 0; i < moves.length; i++) {
  const ch = moves[i];
  const d = D[ch.toLowerCase()];
  const t = p + d;
  if (L.wall[t]) { console.log('ILLEGAL wall at move', i); process.exit(1); }
  if (boxes.has(t)) {
    const t2 = t + d;
    if (L.wall[t2] || boxes.has(t2)) { console.log('ILLEGAL push at move', i); process.exit(1); }
    boxes.delete(t); boxes.add(t2); pushes++;
    if (ch !== ch.toUpperCase()) { console.log('WARN: lowercase push at', i); }
  }
  p = t;
}
const solved = [...boxes].every(b => L.goal[b]);
console.log(JSON.stringify({ legal: true, solved, pushes, moves: moves.length }));
