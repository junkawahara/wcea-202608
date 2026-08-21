#!/usr/bin/env node
// 実現可能な全配置を {g: 25文字の行優先レター列, n: 最短手数} で JSON 出力する
'use strict';
const { completePackings, staticFeasible, solveOrdering } = require('./iqflow.js');

const out = [];
for (const goal of completePackings({})) {
  if (!staticFeasible(goal).ok) continue;
  const res = solveOrdering(goal);
  if (!res.solvable) continue;
  const grid = Array.from({ length: 25 }, () => '?');
  for (const [id, cells] of Object.entries(goal)) {
    for (const [r, c] of cells) grid[r * 5 + c] = id;
  }
  out.push({ g: grid.join(''), n: res.moves.length });
}
out.sort((a, b) => a.n - b.n || (a.g < b.g ? -1 : 1));
console.log(JSON.stringify(out));
