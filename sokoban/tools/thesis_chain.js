'use strict';
const fs = require('fs');
const { ROOM } = require('./thesis_room.js');
// Chain N rooms (Potma's construction): rooms overlap by 1 column at the A/C
// corridor (row 4). External B-corridor at row 16 links every room's B exit and
// the start riser (left). Final dead-end box+goal after the last room's C exit.
function build(N) {
  const RW = 12, RH = 16, PITCH = 11, XL = 3;
  const W = XL + PITCH * N + 1 + 4;
  const H = RH + 2;
  const g = [];
  for (let y = 0; y < H; y++) g.push(new Array(W).fill('#'));
  for (let k = 0; k < N; k++) {
    const x0 = XL + PITCH * k;
    for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
      const c = ROOM[y][x] || '#';
      // overlap column: open wins (corridor at row4)
      if (g[y][x0 + x] === ' ' || g[y][x0 + x] === '$') continue;
      g[y][x0 + x] = c;
    }
  }
  // left cap: riser col1 rows 4..16, connector (2,4)
  for (let y = 4; y <= 16; y++) g[y][1] = ' ';
  g[4][2] = ' ';
  // B corridor row16: from riser to below last room's B shaft (x = XL+PITCH*(N-1)+5)
  const bEnd = XL + PITCH * (N - 1) + 5;
  for (let x = 1; x <= bEnd; x++) g[16][x] = ' ';
  // ensure each room's B shaft (col5, row15) opens into row16 (it does: g[15][x0+5]=' ')
  // right cap: corridor + box + goal
  const xe = XL + PITCH * (N - 1) + 11;   // last room's right edge column (c11)
  g[4][xe + 1] = ' ';
  g[4][xe + 2] = '$';
  g[4][xe + 3] = '.';
  // player on the riser
  g[4][1] = '@';
  // goals: every room box sits on its goal -> mark '*'
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] === '$' && !(y === 4 && x === xe + 2)) g[y][x] = '*';
  return g.map(r => r.join('')).join('\n');
}
const N = Number(process.argv[2] || 1);
const t = build(N);
const out = process.argv[3];
if (out) { fs.writeFileSync(out, t); console.error('wrote ' + out); }
else console.log(t);
