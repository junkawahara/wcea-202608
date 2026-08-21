#!/usr/bin/env node
/*
 * IQ Flow 全数調査: 8 ピースによる 5x5 の全パッキングを列挙し、
 *   - 挿入口の条件(静的)で除外される数
 *   - スライド順序まで含めて実現可能な数
 *   - 実現可能な配置の最短手数の分布
 * を集計する。
 */
'use strict';
const {
  completePackings,
  staticFeasible,
  solveOrdering,
  renderGoal,
} = require('./iqflow.js');

const t0 = Date.now();
const packings = completePackings({});
console.log(`全パッキング数: ${packings.length}`);

let dead = 0;
const achievable = [];
const lenHist = new Map();
let done = 0;
for (const goal of packings) {
  done++;
  if (done % 1000 === 0) {
    console.error(`  ... ${done}/${packings.length} (${Date.now() - t0} ms)`);
  }
  if (!staticFeasible(goal).ok) { dead++; continue; }
  const res = solveOrdering(goal);
  if (res.solvable) {
    achievable.push({ goal, len: res.moves.length });
    lenHist.set(res.moves.length, (lenHist.get(res.moves.length) || 0) + 1);
  }
}

console.log(`挿入口の条件で即棄却: ${dead}`);
console.log(`静的には可能だが順序が組めない: ${packings.length - dead - achievable.length}`);
console.log(`実現可能: ${achievable.length}`);
console.log('最短手数の分布:');
for (const [len, n] of [...lenHist].sort((a, b) => a[0] - b[0])) {
  console.log(`  ${len} 手: ${n} 配置`);
}
const maxLen = Math.max(...achievable.map((a) => a.len));
console.log(`\n最短手数が最大 (${maxLen} 手) の配置の例:`);
for (const a of achievable.filter((x) => x.len === maxLen).slice(0, 3)) {
  console.log(renderGoal(a.goal).replace(/^/gm, '  '));
  console.log();
}
console.log(`所要時間: ${Date.now() - t0} ms`);
