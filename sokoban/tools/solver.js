'use strict';
// Push-optimal Sokoban BFS solver.
// Level format: '#' wall, ' ' floor, '$' box, '.' goal, '*' box-on-goal,
//               '@' player, '+' player-on-goal, '-' outside (treated as wall).

function parse(text) {
  const rows = text.replace(/\n+$/, '').split('\n');
  const H = rows.length, W = Math.max(...rows.map(r => r.length));
  const wall = new Uint8Array(W * H);
  const goal = new Uint8Array(W * H);
  const boxes = [];
  let player = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = rows[y][x] || '-';
      const i = y * W + x;
      if (c === '#' || c === '-') wall[i] = 1;
      if (c === '.' || c === '*' || c === '+') goal[i] = 1;
      if (c === '$' || c === '*') boxes.push(i);
      if (c === '@' || c === '+') player = i;
    }
  }
  if (player < 0) throw new Error('no player');
  return { W, H, wall, goal, boxes: boxes.sort((a, b) => a - b), player };
}

// Corner deadlock: box on non-goal cell with two perpendicular walls.
function cornerDead(L, i) {
  if (L.goal[i]) return false;
  const { W, wall } = L;
  const u = wall[i - W], d = wall[i + W], l = wall[i - 1], r = wall[i + 1];
  return (u && l) || (u && r) || (d && l) || (d && r);
}

// Dead-square analysis: alive(c) = a box at c could still reach some goal
// (pushes on otherwise-empty board). Push into a dead square is never useful.
function aliveSquares(L) {
  const { W, H, wall, goal } = L;
  const N = W * H;
  const DIRS = [-W, W, -1, 1];
  const alive = new Uint8Array(N);
  const q = [];
  for (let i = 0; i < N; i++) if (goal[i]) { alive[i] = 1; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const t = q[h];
    for (const d of DIRS) {
      const f = t - d;            // box from f pushed to t needs player at f-d
      if (f - d < 0 || f - d >= N) continue;
      if (wall[f] || wall[f - d] || alive[f]) continue;
      alive[f] = 1; q.push(f);
    }
  }
  return alive;
}

// Freeze deadlock: after moving box from `from` to `to`, is `to` frozen
// (blocked on both axes, treating blocked-both-axes neighbor boxes recursively
// as walls) while not on goal — or does it freeze a neighbor off-goal?
function freezeDead(L, boxSet, from, to) {
  const { W, wall, goal } = L;
  const tmp = boxSet;         // caller's current box set; simulate move
  tmp[from] = 0; tmp[to] = 1;
  const memo = new Map();
  function frozenAxis(i, d, visiting) {
    const a = i - d, b = i + d;
    if (wall[a] || wall[b]) return true;
    if (tmp[a] && frozenBox(a, visiting)) return true;
    if (tmp[b] && frozenBox(b, visiting)) return true;
    return false;
  }
  function frozenBox(i, visiting) {
    if (visiting.has(i)) return true;           // cycle => treat as frozen
    if (memo.has(i)) return memo.get(i);
    visiting.add(i);
    const r = frozenAxis(i, 1, visiting) && frozenAxis(i, W, visiting);
    visiting.delete(i);
    memo.set(i, r);
    return r;
  }
  let bad = false;
  if (frozenBox(to, new Set()) && !goal[to]) bad = true;
  if (!bad) {
    // also check direct neighbors that may have become frozen off-goal
    for (const d of [-W, W, -1, 1]) {
      const nb = to + d;
      if (tmp[nb] && !goal[nb]) {
        memo.clear();
        if (frozenBox(nb, new Set())) { bad = true; break; }
      }
    }
  }
  tmp[to] = 0; tmp[from] = 1;
  return bad;
}

// Per-cell reachable-goal bitmask: goalMask[c] = set of goals a box at c could
// still reach (pushes on otherwise-empty board). Sound over-approximation.
function goalMasks(L) {
  const { W, H, wall, goal } = L;
  const N = W * H;
  const DIRS = [-W, W, -1, 1];
  const gid = new Int32Array(N).fill(-1);
  const glist = [];
  for (let i = 0; i < N; i++) if (goal[i]) { gid[i] = glist.length; glist.push(i); }
  const NG = glist.length;
  const masks = new Array(N).fill(0n);
  for (let g = 0; g < NG; g++) {
    const bit = 1n << BigInt(g);
    const seen = new Uint8Array(N);
    const q = [glist[g]];
    seen[glist[g]] = 1;
    for (let h = 0; h < q.length; h++) {
      const t = q[h];
      masks[t] |= bit;
      for (const d of DIRS) {
        const f = t - d;
        if (f - d < 0 || f - d >= N) continue;
        if (seen[f] || wall[f] || wall[f - d]) continue;
        seen[f] = 1; q.push(f);
      }
    }
  }
  return { masks, NG };
}

// Bitmask bipartite matching: can every box be assigned a distinct goal from its mask?
function hasPerfectMatching(ms, NG) {
  const n = ms.length;
  const matchGoal = new Array(NG).fill(-1);   // goal -> box
  function aug(b, visited) {
    let m = ms[b];
    while (m) {
      const low = m & -m;
      const g = bitIndex(low);
      m ^= low;
      if (visited[g]) continue;
      visited[g] = 1;
      if (matchGoal[g] === -1 || aug(matchGoal[g], visited)) { matchGoal[g] = b; return true; }
    }
    return false;
  }
  for (let b = 0; b < n; b++) {
    const visited = new Uint8Array(NG);
    if (!aug(b, visited)) return false;
  }
  return true;
}
const BIT_IDX = new Map();
for (let i = 0; i < 64; i++) BIT_IDX.set(1n << BigInt(i), i);
function bitIndex(low) {
  const v = BIT_IDX.get(low);
  if (v !== undefined) return v;
  let i = 0n, x = low;
  while (x > 1n) { x >>= 1n; i++; }
  return Number(i);
}

function solve(L, opts = {}) {
  const { W, H, wall, goal } = L;
  const N = W * H;
  const DIRS = [-W, W, -1, 1];
  const alive = aliveSquares(L);
  const { masks: gmask, NG } = goalMasks(L);
  const boxSet = new Uint8Array(N);
  const boxSetR = new Uint8Array(N);

  function regionAndMin(boxes, start) {
    boxSetR.fill(0);
    for (const b of boxes) boxSetR[b] = 1;
    const seen = new Uint8Array(N);
    const q = [start];
    seen[start] = 1;
    let mn = start;
    for (let h = 0; h < q.length; h++) {
      const p = q[h];
      if (p < mn) mn = p;
      for (const d of DIRS) {
        const t = p + d;
        if (!seen[t] && !wall[t] && !boxSetR[t]) { seen[t] = 1; q.push(t); }
      }
    }
    return { seen, mn };
  }

  const solved = boxes => boxes.every(b => goal[b]);
  const key = (boxes, mn) => boxes.join(',') + '|' + mn;

  const start = { boxes: L.boxes.slice(), player: L.player };
  const r0 = regionAndMin(start.boxes, start.player);
  const dist = new Map();
  const parent = opts.solution ? new Map() : null;
  const k0 = key(start.boxes, r0.mn);
  dist.set(k0, 0);
  if (parent) parent.set(k0, null);
  let frontier = [{ boxes: start.boxes, mn: r0.mn, seen: r0.seen, k: k0 }];
  let pushes = 0, expanded = 0;

  while (frontier.length) {
    const next = [];
    for (const st of frontier) {
      expanded++;
      if (solved(st.boxes)) return finish(st, pushes);
      boxSet.fill(0);
      for (const b of st.boxes) boxSet[b] = 1;
      for (let bi = 0; bi < st.boxes.length; bi++) {
        const b = st.boxes[bi];
        for (const d of DIRS) {
          const from = b - d, to = b + d;           // player at `from` pushes box to `to`
          if (wall[to] || boxSet[to] || wall[from] || boxSet[from]) continue;
          if (!st.seen[from]) continue;
          if (!alive[to] || cornerDead(L, to)) continue;
          if (freezeDead(L, boxSet, b, to)) continue;
          const nb = st.boxes.slice();
          nb[bi] = to;
          nb.sort((a, z) => a - z);
          if (!hasPerfectMatching(nb.map(c => gmask[c]), NG)) continue;
          const r = regionAndMin(nb, b);            // player ends where the box was
          const k = key(nb, r.mn);
          if (dist.has(k)) continue;
          dist.set(k, pushes + 1);
          if (parent) parent.set(k, { pk: st.k, box: b, dir: d, playerBefore: from });
          next.push({ boxes: nb, mn: r.mn, seen: r.seen, k });
        }
      }
      st.seen = null;
    }
    frontier = next;
    pushes++;
    if (opts.maxPushes && pushes > opts.maxPushes) return { pushes: -1, states: dist.size, note: 'maxPushes exceeded' };
  }
  return { pushes: -1, states: dist.size, note: 'unsolvable' };

  function finish(st, p) {
    const res = { pushes: p, states: dist.size, expanded };
    if (parent) {
      const steps = [];
      let k = st.k;
      while (parent.get(k)) {
        const e = parent.get(k);
        steps.push(e);
        k = e.pk;
      }
      steps.reverse();
      res.steps = steps;   // each: {playerBefore, box, dir}
    }
    return res;
  }
}

// Recover full move sequence (walking + pushes) as LURD for animation.
function fullMoves(L, steps) {
  const { W, wall } = L;
  const N = W * L.H;
  const DIRS = { [-W]: 'u', [W]: 'd', [-1]: 'l', [1]: 'r' };
  const DL = [-W, W, -1, 1];
  let boxes = new Set(L.boxes);
  let player = L.player;
  let out = '';
  for (const s of steps) {
    // walk player -> s.playerBefore
    if (player !== s.playerBefore) {
      const prev = new Int32Array(N).fill(-2);
      prev[player] = -1;
      const q = [player];
      for (let h = 0; h < q.length && prev[s.playerBefore] === -2; h++) {
        const p = q[h];
        for (const d of DL) {
          const t = p + d;
          if (prev[t] === -2 && !wall[t] && !boxes.has(t)) { prev[t] = p; q.push(t); }
        }
      }
      if (prev[s.playerBefore] === -2) throw new Error('walk failed');
      const path = [];
      for (let c = s.playerBefore; prev[c] !== -1; c = prev[c]) path.push(c);
      path.reverse();
      let cur = player;
      for (const c of path) { out += DIRS[c - cur]; cur = c; }
      player = s.playerBefore;
    }
    // push
    out += DIRS[s.dir].toUpperCase();
    boxes.delete(s.box);
    boxes.add(s.box + s.dir);
    player = s.box;
  }
  return out;
}

module.exports = { parse, solve, fullMoves };

if (require.main === module) {
  const fs = require('fs');
  const L = parse(fs.readFileSync(process.argv[2], 'utf8'));
  const t = Date.now();
  const r = solve(L, { solution: true });
  console.log(JSON.stringify({ pushes: r.pushes, states: r.states, ms: Date.now() - t, note: r.note }));
  if (r.steps) console.log('moves:', fullMoves(L, r.steps));
}
