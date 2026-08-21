#!/usr/bin/env node
/*
 * IQ Flow solver — SmartGames「IQ Flow」(Raf Peeters, 2026) のソルバー
 *
 * ルールモデル(公式ルールリーフレット + 設計者ページより):
 *   - 中央 5x5 グリッドを 8 ピースで隙間なく埋める。
 *   - ピースは表面の波の方向にしか滑らせられない(軸は挿入時の回転で決まり、盤上では不変)。
 *   - ピースは盤の縁からスライドインする。上辺は蓋のヒンジで全閉。
 *     左右・下辺も開いている区間(溝)からしか出し入れできない。
 *   - ピースは 5x5 の外周(リング、深さ 1 マス)に一時退避できる。
 *   - 完成形では全ピースが 5x5 内(リングにはみ出し禁止)。
 *
 * 盤面・ピースデータの出典: 公式商品写真(俯瞰の空盤面/完成盤面)と
 * 公式例題(解答 B→ A↑ F← D← H↑ G↑ C→ E→)から読み取り・相互検証済み。
 *
 * モデル上の仮定(実物と要照合):
 *   - リングの深さは 1 マス。リングの外にはみ出したまま静止はできない。
 *   - 盤上での回転は不可。挿入時の向き = 最終的な向き(一時的に別の向きで
 *     挿入してから抜いて入れ直す、という戦略は探索しない)。
 */
'use strict';

//============================ 1. ゲームデータ ============================

const N = 5; // 中央グリッドの一辺

// 各辺の開口部(挿入可能な行/列)。上辺は蓋のため全閉。
const OPEN = {
  left: [0, 3, 4],
  right: [1, 2, 3],
  bottom: [0, 1, 3, 4],
  top: [],
};

// 8 ピース: cells は基準の向きでの形、axis はその向きでの滑り軸
// ('h' = 左右にスライド / 'v' = 上下にスライド)。回転すると軸も一緒に回る。
const PIECE_DEFS = {
  A: { cells: [[0, 0], [0, 1]],                 axis: 'v', color: 'ピンク' },
  B: { cells: [[0, 0], [0, 1]],                 axis: 'h', color: '赤' },
  C: { cells: [[0, 0], [0, 1], [0, 2]],         axis: 'h', color: '紫' },
  D: { cells: [[0, 0], [0, 1], [1, 1]],         axis: 'h', color: '黄' },
  E: { cells: [[0, 0], [0, 1], [1, 0]],         axis: 'h', color: '橙' },
  F: { cells: [[0, 0], [0, 1], [0, 2], [1, 0]], axis: 'h', color: '緑' },
  G: { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], axis: 'v', color: '水色' },
  H: { cells: [[0, 1], [1, 0], [1, 1], [2, 1]], axis: 'v', color: '紺' },
};

// 公式例題(STARTER)。officialSolution は冊子記載の解答手順。
const DEMO_CHALLENGE = {
  name: 'STARTER 公式例題',
  goal: {
    A: [[0, 0], [0, 1]],
    B: [[0, 2], [0, 3]],
    C: [[4, 1], [4, 2], [4, 3]],
    D: [[2, 1], [2, 2], [3, 2]],
    E: [[3, 0], [3, 1], [4, 0]],
    F: [[1, 0], [1, 1], [1, 2], [2, 0]],
    G: [[2, 3], [3, 3], [3, 4], [4, 4]],
    H: [[0, 4], [1, 3], [1, 4], [2, 4]],
  },
  officialSolution: 'B→ A↑ F← D← H↑ G↑ C→ E→',
};

//============================ 2. 幾何ユーティリティ ============================

// 7x7 フレーム: r,c ∈ [-1, 5]。index = (r+1)*7 + (c+1)。ビットは BigInt。
const FR = 7;
const cellBit = (r, c) => 1n << BigInt((r + 1) * FR + (c + 1));

function buildUsableMask(open) {
  let m = 0n;
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) m |= cellBit(r, c);
  for (const r of open.left) m |= cellBit(r, -1);
  for (const r of open.right) m |= cellBit(r, N);
  for (const c of open.bottom) m |= cellBit(N, c);
  for (const c of open.top) m |= cellBit(-1, c);
  return m;
}
const USABLE = buildUsableMask(OPEN);

const normalize = (cells) => {
  const mr = Math.min(...cells.map((x) => x[0]));
  const mc = Math.min(...cells.map((x) => x[1]));
  return cells
    .map(([r, c]) => [r - mr, c - mc])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
};
const cellsKey = (cells) => normalize(cells).map((x) => x.join(',')).join(';');

// 90° 時計回り: (r,c) -> (c, -r)。軸 h<->v。
const rot90 = (cells) => normalize(cells.map(([r, c]) => [c, -r]));

// ピースの回転バリエーション(形+軸で重複除去)
function orientationsOf(def) {
  const out = [];
  let cells = normalize(def.cells);
  let axis = def.axis;
  const seen = new Set();
  for (let k = 0; k < 4; k++) {
    const key = cellsKey(cells) + '|' + axis;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ cells, axis, rot: k * 90 });
    }
    cells = rot90(cells);
    axis = axis === 'h' ? 'v' : 'h';
  }
  return out;
}
const ORIENTATIONS = Object.fromEntries(
  Object.keys(PIECE_DEFS).map((id) => [id, orientationsOf(PIECE_DEFS[id])])
);

// 目標セル集合から (向きの正当性チェック + 滑り軸) を求める
function axisOfGoal(id, cells) {
  const key = cellsKey(cells);
  const hits = ORIENTATIONS[id].filter((o) => cellsKey(o.cells) === key);
  if (hits.length === 0) {
    throw new Error(`ピース ${id} の目標セルが形状と一致しません: ${JSON.stringify(cells)}`);
  }
  const axes = new Set(hits.map((o) => o.axis));
  if (axes.size > 1) throw new Error(`ピース ${id} の軸が一意に決まりません`);
  return hits[0].axis;
}

//============================ 3. 配置(位置)テーブル ============================

// 盤上のピース状態は「最終セル集合を軸方向に d だけずらしたもの」だけを取る。
// (横滑りピースの行/縦滑りピースの列は挿入時に確定し、以後変わらないため)
function buildPlacedPiece(id, goalCells) {
  const axis = axisOfGoal(id, goalCells);
  const base = goalCells.map(([r, c]) => [r, c]);

  const shifted = (d) =>
    axis === 'h' ? base.map(([r, c]) => [r, c + d]) : base.map(([r, c]) => [r + d, c]);
  const maskOf = (cells) => cells.reduce((m, [r, c]) => m | cellBit(r, c), 0n);
  const inFrame = (cells) => cells.every(([r, c]) => r >= -1 && r <= N && c >= -1 && c <= N);

  // 有効な d(全セルが usable)を列挙 — 連続区間になるはず
  const positions = [];
  for (let d = -(N + 1); d <= N + 1; d++) {
    const cells = shifted(d);
    if (!inFrame(cells)) continue;
    const m = maskOf(cells);
    if ((m & ~USABLE) === 0n) positions.push({ d, cells, mask: m });
  }
  for (let i = 1; i < positions.length; i++) {
    if (positions[i].d !== positions[i - 1].d + 1) {
      throw new Error(`ピース ${id}: 有効位置が非連続 (モデル仮定違反)`);
    }
  }
  if (positions.length > 14) throw new Error('位置数が想定を超過');

  const goalIdx = positions.findIndex((p) => p.d === 0);

  // 挿入/除去の掃引マスク: 辺から目標位置までに通過する全マス
  // (静的に usable に収まらない辺からは挿入不可 = null)
  function entryMask(pos, side) {
    let m = 0n;
    if (axis === 'h') {
      if (side !== 'left' && side !== 'right') return null;
      const rows = new Map();
      for (const [r, c] of pos.cells) {
        if (!rows.has(r)) rows.set(r, [c, c]);
        const e = rows.get(r);
        e[0] = Math.min(e[0], c);
        e[1] = Math.max(e[1], c);
      }
      for (const [r, [lo, hi]] of rows) {
        if (side === 'left') for (let c = -1; c <= hi; c++) m |= cellBit(r, c);
        else for (let c = lo; c <= N; c++) m |= cellBit(r, c);
      }
    } else {
      if (side !== 'bottom' && side !== 'top') return null;
      const cols = new Map();
      for (const [r, c] of pos.cells) {
        if (!cols.has(c)) cols.set(c, [r, r]);
        const e = cols.get(c);
        e[0] = Math.min(e[0], r);
        e[1] = Math.max(e[1], r);
      }
      for (const [c, [lo, hi]] of cols) {
        if (side === 'bottom') for (let r = lo; r <= N; r++) m |= cellBit(r, c);
        else for (let r = -1; r <= hi; r++) m |= cellBit(r, c);
      }
    }
    return (m & ~USABLE) === 0n ? m : null;
  }

  const sides = axis === 'h' ? ['left', 'right'] : ['bottom', 'top'];
  for (const pos of positions) {
    pos.entry = {};
    for (const s of sides) pos.entry[s] = entryMask(pos, s);
  }

  // スライドの掃引マスク(位置 p から q まで、両端含む)
  const slide = (p, q) => {
    let m = 0n;
    for (let i = Math.min(p, q); i <= Math.max(p, q); i++) m |= positions[i].mask;
    return m;
  };

  return { id, axis, goalCells: base, positions, goalIdx, sides, slide };
}

//============================ 4. 順序探索 (BFS) ============================

const ARROW = { left: '→', right: '←', bottom: '↑', top: '↓' };

function stateKey(state) {
  let k = 0;
  for (let i = 0; i < state.length; i++) k += state[i] * 16 ** i;
  return k;
}

function occupancyOf(state, pieces) {
  let occ = 0n;
  for (let i = 0; i < state.length; i++) {
    if (state[i] > 0) occ |= pieces[i].positions[state[i] - 1].mask;
  }
  return occ;
}

// state[i] = 0 (手元) / pos+1。全遷移を列挙する。
function* legalMoves(state, pieces, occ) {
  for (let i = 0; i < pieces.length; i++) {
    const pc = pieces[i];
    if (state[i] === 0) {
      // 挿入: 開いている辺から、経路が空いていれば任意の位置に止められる
      for (let q = 0; q < pc.positions.length; q++) {
        const pos = pc.positions[q];
        for (const s of pc.sides) {
          const sw = pos.entry[s];
          if (sw !== null && (sw & occ) === 0n) {
            yield { piece: i, to: q + 1, kind: 'insert', side: s, arrow: ARROW[s], pos };
          }
        }
      }
    } else {
      const p = state[i] - 1;
      const others = occ & ~pc.positions[p].mask;
      // スライド
      for (let q = 0; q < pc.positions.length; q++) {
        if (q === p) continue;
        if ((pc.slide(p, q) & others) === 0n) {
          const arrow =
            pc.axis === 'h' ? (q > p ? '→' : '←') : q > p ? '↓' : '↑';
          yield { piece: i, to: q + 1, kind: 'slide', arrow, pos: pc.positions[q] };
        }
      }
      // 除去(辺の外へ抜く)
      for (const s of pc.sides) {
        const sw = pc.positions[p].entry[s];
        if (sw !== null && (sw & others) === 0n) {
          const arrow = s === 'left' ? '←' : s === 'right' ? '→' : s === 'bottom' ? '↓' : '↑';
          yield { piece: i, to: 0, kind: 'remove', side: s, arrow };
        }
      }
    }
  }
}

function applyMove(state, mv) {
  const s = state.slice();
  s[mv.piece] = mv.to;
  return s;
}

// 空盤面から目標配置までの最短手順を BFS で探索
function solveOrdering(goal, opts = {}) {
  const ids = Object.keys(goal).sort();
  if (ids.length !== 8) throw new Error('目標配置は 8 ピース全ての位置が必要です');
  const covered = new Set();
  for (const id of ids) {
    for (const [r, c] of goal[id]) {
      if (r < 0 || r >= N || c < 0 || c >= N) throw new Error(`${id}: セルが 5x5 の外`);
      const k = r * N + c;
      if (covered.has(k)) throw new Error(`${id}: セル重複 (${r},${c})`);
      covered.add(k);
    }
  }
  if (covered.size !== N * N) throw new Error('目標配置が 5x5 を埋めていません');

  const pieces = ids.map((id) => buildPlacedPiece(id, goal[id]));
  const start = new Array(8).fill(0);
  const goalState = pieces.map((pc) => pc.goalIdx + 1);
  const goalKey = stateKey(goalState);

  const visited = new Map(); // key -> {dist, prevKey, move, state}
  visited.set(stateKey(start), { dist: 0, prevKey: -1, move: null, state: start });
  let frontier = [start];
  let found = null;

  while (frontier.length > 0 && !found) {
    const next = [];
    for (const st of frontier) {
      const occ = occupancyOf(st, pieces);
      const d = visited.get(stateKey(st)).dist;
      for (const mv of legalMoves(st, pieces, occ)) {
        const ns = applyMove(st, mv);
        const nk = stateKey(ns);
        if (visited.has(nk)) continue;
        visited.set(nk, { dist: d + 1, prevKey: stateKey(st), move: { ...mv, id: pieces[mv.piece].id }, state: ns });
        if (nk === goalKey) { found = nk; break; }
        next.push(ns);
      }
      if (found) break;
    }
    frontier = next;
  }

  if (found === null) return { solvable: false, pieces, visited };

  // 経路復元
  const moves = [];
  for (let k = found; visited.get(k).prevKey !== -1; k = visited.get(k).prevKey) {
    moves.unshift(visited.get(k).move);
  }
  return { solvable: true, moves, pieces, visited, goalKey };
}

// 手数の下界: 手元のピース + 最終位置にいないピースは、あと 1 手ずつ必要
function lowerBound(state, pieces) {
  let lb = 0;
  for (let i = 0; i < state.length; i++) {
    if (state[i] !== pieces[i].goalIdx + 1) lb++;
  }
  return lb;
}

// 最短手順の総数と一覧(上限つき)。
// 1 パス目で最短手数を求め、2 パス目は「dist + 下界 <= 最短手数」で
// 枝刈りした層別 BFS で最短経路 DAG を作り、DP で数え上げる。
function enumerateOptimal(goal, limit = 100) {
  const res = solveOrdering(goal);
  if (!res.solvable) return { count: 0, sequences: [], optimalLength: null };
  const pieces = res.pieces;
  const optLen = res.moves.length;
  const goalKey = stateKey(pieces.map((pc) => pc.goalIdx + 1));

  // 2 パス目: 最短経路上にあり得る状態だけを全展開
  const start = new Array(8).fill(0);
  const dist = new Map([[stateKey(start), 0]]);
  let frontier = [start];
  for (let d = 0; d < optLen; d++) {
    const next = [];
    for (const st of frontier) {
      const occ = occupancyOf(st, pieces);
      for (const mv of legalMoves(st, pieces, occ)) {
        const ns = applyMove(st, mv);
        const nk = stateKey(ns);
        if (dist.has(nk)) continue;
        if (d + 1 + lowerBound(ns, pieces) > optLen) continue;
        dist.set(nk, d + 1);
        next.push(ns);
      }
    }
    frontier = next;
  }

  // DAG 上の経路数 DP(ゴールへ向かって)
  const nPaths = new Map([[goalKey, 1]]);
  const countFrom = (state) => {
    const key = stateKey(state);
    if (nPaths.has(key)) return nPaths.get(key);
    const d = dist.get(key);
    let total = 0;
    const occ = occupancyOf(state, pieces);
    for (const mv of legalMoves(state, pieces, occ)) {
      const ns = applyMove(state, mv);
      const nd = dist.get(stateKey(ns));
      if (nd === d + 1) total += countFrom(ns);
    }
    nPaths.set(key, total);
    return total;
  };
  const count = countFrom(start);

  // 一覧は limit 件まで DFS で収集
  const sequences = [];
  const dfs = (state, acc) => {
    if (sequences.length >= limit) return;
    const key = stateKey(state);
    if (key === goalKey) { sequences.push(acc.join(' ')); return; }
    const d = dist.get(key);
    const occ = occupancyOf(state, pieces);
    for (const mv of legalMoves(state, pieces, occ)) {
      const ns = applyMove(state, mv);
      const nk = stateKey(ns);
      if (dist.get(nk) !== d + 1 || !nPaths.get(nk)) continue;
      acc.push(pieces[mv.piece].id + mv.arrow + (mv.kind === 'remove' ? '出' : ''));
      dfs(ns, acc);
      acc.pop();
      if (sequences.length >= limit) return;
    }
  };
  dfs(start, []);
  return { count, sequences, optimalLength: optLen };
}

// 静的な実現可能性チェック: 各ピースの帯(横滑り=行の集合/縦滑り=列の集合)が
// どこかの辺の開口部に完全に含まれていなければ、そのピースは盤に入れない。
function staticFeasible(goal) {
  for (const [id, cells] of Object.entries(goal)) {
    const axis = axisOfGoal(id, cells);
    if (axis === 'h') {
      const rows = [...new Set(cells.map(([r]) => r))];
      const ok =
        rows.every((r) => OPEN.left.includes(r)) ||
        rows.every((r) => OPEN.right.includes(r));
      if (!ok) return { ok: false, reason: `${id}: 行 {${rows}} は左右どちらの開口部にも収まらない` };
    } else {
      const cols = [...new Set(cells.map(([, c]) => c))];
      const ok =
        cols.every((c) => OPEN.bottom.includes(c)) ||
        cols.every((c) => OPEN.top.includes(c));
      if (!ok) return { ok: false, reason: `${id}: 列 {${cols}} は上下どちらの開口部にも収まらない` };
    }
  }
  return { ok: true };
}

// 公式表記 ("B→ A↑ ...") の手順を検証(挿入のみの手順を想定)
function validateInsertSequence(goal, seqStr) {
  const pieces = Object.keys(goal).sort().map((id) => buildPlacedPiece(id, goal[id]));
  const byId = Object.fromEntries(pieces.map((pc, i) => [pc.id, i]));
  const state = new Array(8).fill(0);
  const tokens = seqStr.trim().split(/\s+/);
  const sideOf = { '→': 'left', '←': 'right', '↑': 'bottom', '↓': 'top' };

  for (const tok of tokens) {
    const m = tok.match(/^([A-H])([→←↑↓])$/u);
    if (!m) return { valid: false, reason: `解析不能: ${tok}` };
    const i = byId[m[1]];
    if (i === undefined) return { valid: false, reason: `不明なピース: ${m[1]}` };
    if (state[i] !== 0) return { valid: false, reason: `${m[1]} は挿入済み` };
    const pc = pieces[i];
    const side = sideOf[m[2]];
    const sw = pc.positions[pc.goalIdx].entry[side];
    if (sw === null) return { valid: false, reason: `${tok}: その辺に開口部がない` };
    const occ = occupancyOf(state, pieces);
    if ((sw & occ) !== 0n) return { valid: false, reason: `${tok}: 経路が塞がっている` };
    state[i] = pc.goalIdx + 1;
  }
  if (state.some((s, i) => s !== pieces[i].goalIdx + 1)) {
    return { valid: false, reason: '全ピースが最終位置に達していない' };
  }
  return { valid: true };
}

//============================ 5. パッキング列挙(部分ゴール対応) ============================

// 未指定ピースの詰め方(exact cover)を全列挙し、完全な目標配置の候補を返す
function completePackings(partialGoal) {
  const fixedIds = Object.keys(partialGoal);
  for (const id of fixedIds) {
    if (!PIECE_DEFS[id]) throw new Error(`不明なピース: ${id}`);
    axisOfGoal(id, partialGoal[id]); // 形状チェック
  }
  const freeIds = Object.keys(PIECE_DEFS).filter((id) => !fixedIds.includes(id));

  let fixedMask = 0;
  const bit25 = (r, c) => 1 << (r * N + c);
  for (const id of fixedIds) {
    for (const [r, c] of partialGoal[id]) {
      if (fixedMask & bit25(r, c)) throw new Error('固定ピース同士が重複');
      fixedMask |= bit25(r, c);
    }
  }

  // 空きセルごとの候補配置
  const placements = []; // {pieceIdx, mask, cells}
  freeIds.forEach((id, pi) => {
    for (const o of ORIENTATIONS[id]) {
      const maxR = Math.max(...o.cells.map((x) => x[0]));
      const maxC = Math.max(...o.cells.map((x) => x[1]));
      for (let dr = 0; dr + maxR < N; dr++) {
        for (let dc = 0; dc + maxC < N; dc++) {
          const cells = o.cells.map(([r, c]) => [r + dr, c + dc]);
          let mask = 0;
          for (const [r, c] of cells) mask |= bit25(r, c);
          if ((mask & fixedMask) === 0) placements.push({ pieceIdx: pi, mask, cells });
        }
      }
    }
  });
  const byCell = Array.from({ length: N * N }, () => []);
  for (const pl of placements) {
    const low = 31 - Math.clz32(pl.mask & -pl.mask); // 最下位ビット位置
    byCell[low].push(pl);
  }

  const results = [];
  const chosen = [];
  const FULL = (1 << (N * N)) - 1;
  const dfs = (occ, usedPieces) => {
    if (occ === FULL) {
      const goal = {};
      for (const id of fixedIds) goal[id] = partialGoal[id];
      for (const pl of chosen) goal[freeIds[pl.pieceIdx]] = pl.cells;
      results.push(goal);
      return;
    }
    const free = ~occ & FULL;
    const low = 31 - Math.clz32(free & -free);
    for (const pl of byCell[low]) {
      if (usedPieces & (1 << pl.pieceIdx)) continue;
      if (pl.mask & occ) continue;
      chosen.push(pl);
      dfs(occ | pl.mask, usedPieces | (1 << pl.pieceIdx));
      chosen.pop();
    }
  };
  dfs(fixedMask, 0);
  return results;
}

// EXPERT 形式: 領域(セル集合+波の向き)だけが与えられ、色は伏せられている
function goalsFromRegions(regions) {
  if (regions.length !== 8) throw new Error('領域は 8 個必要です');
  const ids = Object.keys(PIECE_DEFS);
  const candidates = regions.map((reg) => {
    const key = cellsKey(reg.cells);
    return ids.filter((id) =>
      ORIENTATIONS[id].some((o) => cellsKey(o.cells) === key && o.axis === reg.axis)
    );
  });
  const goals = [];
  const used = new Set();
  const assign = (ri, goal) => {
    if (ri === regions.length) { goals.push({ ...goal }); return; }
    for (const id of candidates[ri]) {
      if (used.has(id)) continue;
      used.add(id);
      goal[id] = regions[ri].cells;
      assign(ri + 1, goal);
      delete goal[id];
      used.delete(id);
    }
  };
  assign(0, {});
  return goals;
}

//============================ 6. 表示 ============================

function renderGoal(goal) {
  const g = Array.from({ length: N }, () => Array(N).fill('.'));
  for (const [id, cells] of Object.entries(goal)) {
    for (const [r, c] of cells) g[r][c] = id;
  }
  return g.map((row) => row.join(' ')).join('\n');
}

function renderFrame(state, pieces) {
  // 7x7 フレーム表示: '#'=壁, ':'=開口部(空), '.'=盤内空きマス
  const g = Array.from({ length: FR }, () => Array(FR).fill(' '));
  for (let r = -1; r <= N; r++) {
    for (let c = -1; c <= N; c++) {
      const inRing = r === -1 || r === N || c === -1 || c === N;
      if (!inRing) g[r + 1][c + 1] = '.';
      else g[r + 1][c + 1] = (cellBit(r, c) & USABLE) !== 0n ? ':' : '#';
    }
  }
  for (let i = 0; i < pieces.length; i++) {
    if (state[i] === 0) continue;
    for (const [r, c] of pieces[i].positions[state[i] - 1].cells) {
      g[r + 1][c + 1] = pieces[i].id;
    }
  }
  return g.map((row) => row.join(' ')).join('\n');
}

function describeMoves(moves, pieces, { steps = false } = {}) {
  const sideJa = { left: '左', right: '右', bottom: '下', top: '上' };
  const lines = [];
  let state = new Array(8).fill(0);
  moves.forEach((mv, i) => {
    let desc;
    if (mv.kind === 'insert') {
      const cells = mv.pos.cells.map(([r, c]) => `(${r},${c})`).join('');
      desc = `${sideJa[mv.side]}から挿入 → ${cells}`;
    } else if (mv.kind === 'slide') {
      const cells = mv.pos.cells.map(([r, c]) => `(${r},${c})`).join('');
      desc = `盤上をスライド → ${cells}`;
    } else {
      desc = `${sideJa[mv.side]}へ抜いて盤外へ`;
    }
    lines.push(`${String(i + 1).padStart(2)}. ${mv.id}${mv.arrow}  ${desc}`);
    state = applyMove(state, mv);
    if (steps) lines.push(renderFrame(state, pieces).replace(/^/gm, '      '), '');
  });
  return lines.join('\n');
}

const compactSeq = (moves) =>
  moves.map((mv) => mv.id + mv.arrow + (mv.kind === 'remove' ? '出' : '')).join(' ');

//============================ 7. チャレンジ solve ============================

function solveChallenge(challenge, opts = {}) {
  const t0 = Date.now();
  let goals;
  if (challenge.regions) {
    goals = goalsFromRegions(challenge.regions);
  } else {
    goals = completePackings(challenge.goal || {});
  }
  const solutions = [];
  let staticallyDead = 0;
  for (const goal of goals) {
    if (!staticFeasible(goal).ok) { staticallyDead++; continue; }
    const res = solveOrdering(goal);
    if (res.solvable) solutions.push({ goal, moves: res.moves, pieces: res.pieces });
    if (opts.first && solutions.length > 0) break;
  }
  return {
    name: challenge.name || '(無題)',
    packings: goals.length,
    staticallyDead,
    solutions,
    ms: Date.now() - t0,
  };
}

//============================ 8. CLI ============================

function main(argv) {
  const args = argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const getOpt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
  };
  const file = args.find((a) => !a.startsWith('--') && a !== getOpt('--keep'));

  let challenge;
  if (file) {
    challenge = JSON.parse(require('fs').readFileSync(file, 'utf8'));
  } else {
    challenge = JSON.parse(JSON.stringify(DEMO_CHALLENGE));
  }

  const keep = getOpt('--keep');
  if (keep !== null) {
    const ids = keep.split(',').map((s) => s.trim()).filter(Boolean);
    const g = {};
    for (const id of ids) {
      if (!challenge.goal || !challenge.goal[id]) throw new Error(`--keep: ${id} が目標にない`);
      g[id] = challenge.goal[id];
    }
    challenge = { name: `${challenge.name} (ヒント: ${ids.join(',') || 'なし'})`, goal: g };
  }

  console.log(`【${challenge.name}】`);
  const result = solveChallenge(challenge, { first: flags.has('--first') });
  console.log(
    `パッキング候補: ${result.packings} 通り` +
    ` / 挿入口の条件で即棄却: ${result.staticallyDead} 通り` +
    ` / スライド順まで実現可能: ${result.solutions.length} 通り (${result.ms} ms)`
  );

  for (const sol of result.solutions.slice(0, 5)) {
    console.log('\n最終配置:');
    console.log(renderGoal(sol.goal).replace(/^/gm, '  '));
    console.log(`\n最短手順 (${sol.moves.length} 手): ${compactSeq(sol.moves)}`);
    console.log(describeMoves(sol.moves, sol.pieces, { steps: flags.has('--steps') }));
    if (flags.has('--enumerate')) {
      const en = enumerateOptimal(sol.goal, 100);
      console.log(`\n最短 ${en.optimalLength} 手の手順は全 ${en.count} 通り:`);
      for (const s of en.sequences) console.log('  ' + s);
    }
  }
  if (result.solutions.length > 5) {
    console.log(`\n(実現可能な配置が他に ${result.solutions.length - 5} 件)`);
  }

  // 公式解答が与えられていれば検証
  if (challenge.officialSolution && result.solutions.length === 1) {
    const v = validateInsertSequence(result.solutions[0].goal, challenge.officialSolution);
    console.log(`\n公式解答「${challenge.officialSolution}」の検証: ${v.valid ? 'OK(合法手順)' : 'NG: ' + v.reason}`);
  }
}

if (require.main === module) {
  main(process.argv);
}

module.exports = {
  PIECE_DEFS,
  OPEN,
  DEMO_CHALLENGE,
  ORIENTATIONS,
  solveChallenge,
  solveOrdering,
  enumerateOptimal,
  staticFeasible,
  validateInsertSequence,
  completePackings,
  goalsFromRegions,
  renderGoal,
};
