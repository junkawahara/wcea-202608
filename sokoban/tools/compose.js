'use strict';
// Compose the *intended* solution of the N-room chain for arbitrary N.
// Method: extract each room's macro-move push templates (set = 11 pushes,
// clear = 5 pushes) from the exhaustively verified N=2 optimum below, plan
// the macro sequence (Dijkstra over room-state bits), then replay the
// templates translated by the room pitch, recomputing player walks by BFS.
// Applied to N=2 this reproduces the exhaustive optimum move for move; for
// N>=3 the result is a machine-checked upper bound (conjectured optimal).
//   node compose.js <N> [levelOut] [solOut]
const fs = require('fs');
const { parse } = require('./solver.js');
const { build } = require('./thesis_chain.js');

// push-optimal solution of the N=2 chain, found by exhaustive search
// (solver.js) and independently replay-verified: 49 pushes, 486 moves.
const SOL2 = 'rrruRldddrdDlddrUrrdrrddrrrruulDuruulDlluuruuluuuRldddrddlluluRddrddrrrddlUdrddlUllluulldlDlddrUrrdddllllllluuuuuuuuuuuurrrururrdLddRdrruLddrrruuLuuururrdLddrrruRldddrdDlddrUrrdrrddrrrruulDuruulDlluuruuluuuRldddrddlluluRddrddrrrddlUdrddlUllluulldlDlddrUrrdddlllllllllllllllllluuuuuuuuuuuurrruRldddrdDlddrUrrdrrddrrrruulDuruulDlluuruuluuuRldddrddlluluRddrddrrrddlUdrddlUllluulldlDlddrUrrdddllllllluuuuuuuuuuuurrrururrdLddRdrruLddrrruuLuuururrdLddrrrururrdLddRdrruLddrrruuLuuururrdLddrrrR';

const XL = 3, PITCH = 11;

function extractPushes(L, moves) {
  const W = L.W, D = { u: -W, d: W, l: -1, r: 1 };
  let p = L.player;
  const boxes = new Set(L.boxes);
  const out = [];
  for (const ch of moves) {
    const d = D[ch.toLowerCase()];
    const t = p + d;
    if (L.wall[t]) throw new Error('wall hit');
    if (boxes.has(t)) {
      const t2 = t + d;
      if (L.wall[t2] || boxes.has(t2)) throw new Error('bad push');
      boxes.delete(t); boxes.add(t2);
      out.push({ cell: t, dir: ch.toLowerCase() });
    }
    p = t;
  }
  return out;
}

// Extract set/clear/cap templates from the N=2 optimum. A room's set (exits
// at B) and its following clear (re-entered at A) fuse into one run of
// consecutive same-room pushes when no other room is pushed in between; the
// last room's runs are always clean, so they provide the templates, and every
// room's push stream is then checked to be an alternation of the two.
function templates() {
  const N = 2;
  const L = parse(build(N));
  const ann = extractPushes(L, SOL2).map(p => {
    const row = Math.floor(p.cell / L.W), col = p.cell % L.W;
    const cap = col >= XL + PITCH * (N - 1) + 12;
    const room = cap ? 'cap' : Math.min(N - 1, Math.floor((col - XL) / PITCH));
    const rel = col - (XL + PITCH * (cap ? N - 1 : room));
    return { room, row, rel, dir: p.dir };
  });
  const blocks = [];
  for (const a of ann) {
    const last = blocks[blocks.length - 1];
    if (last && last.room === a.room) last.pushes.push(a);
    else blocks.push({ room: a.room, pushes: [a] });
  }
  const sig = ps => ps.map(p => p.row + ',' + p.rel + ',' + p.dir).join(' ');
  const lastRoom = blocks.filter(b => b.room === N - 1);
  if (lastRoom.length !== 2) throw new Error('expected 2 clean blocks for last room');
  if (blocks[blocks.length - 1].room !== 'cap') throw new Error('last block is not cap');
  const tpl = {
    set: { pushes: lastRoom[0].pushes, sig: sig(lastRoom[0].pushes) },
    clear: { pushes: lastRoom[1].pushes, sig: sig(lastRoom[1].pushes) },
    cap: { pushes: blocks[blocks.length - 1].pushes },
  };
  for (let k = 0; k < N; k++) {
    const stream = ann.filter(a => a.room === k);
    let i = 0, want = 'set';
    while (i < stream.length) {
      const t = tpl[want];
      if (sig(stream.slice(i, i + t.pushes.length)) !== t.sig)
        throw new Error('room ' + k + ' deviates from ' + want + ' template at push ' + i);
      i += t.pushes.length;
      want = want === 'set' ? 'clear' : 'set';
    }
    if (want !== 'set') throw new Error('room ' + k + ' ends mid-cycle');
  }
  return tpl;
}

// Minimum-cost macro plan: state = (set-bits, standing at A_{pos+1}).
function macroPlan(N, setLen, clearLen) {
  const key = (m, p) => m * N + p;
  const dist = new Map([[key(0, 0), 0]]), prev = new Map();
  const pq = [[0, 0, 0]];
  let best = Infinity, bestEnd = null;
  while (pq.length) {
    let bi = 0;
    for (let i = 1; i < pq.length; i++) if (pq[i][0] < pq[bi][0]) bi = i;
    const [c, m, p] = pq.splice(bi, 1)[0];
    if (c > dist.get(key(m, p))) continue;
    const relax = (m2, p2, cost, act) => {
      const k2 = key(m2, p2);
      if (cost < (dist.get(k2) ?? Infinity)) {
        dist.set(k2, cost); prev.set(k2, [m, p, act]); pq.push([cost, m2, p2]);
      }
    };
    if (!(m & (1 << p))) relax(m | (1 << p), 0, c + setLen, ['set', p]);
    else if (p < N - 1) relax(m & ~(1 << p), p + 1, c + clearLen, ['clear', p]);
    else if (c + clearLen + 1 < best) { best = c + clearLen + 1; bestEnd = [m, p]; }
  }
  const plan = [['clear', N - 1]];
  for (let cur = key(bestEnd[0], bestEnd[1]); prev.has(cur); ) {
    const [pm, pp, act] = prev.get(cur);
    plan.unshift(act);
    cur = key(pm, pp);
  }
  plan.push(['cap', N - 1]);
  return { plan, cost: best };
}

function realize(L, plan, tpl) {
  const W = L.W, D = { u: -W, d: W, l: -1, r: 1 };
  let p = L.player;
  const boxes = new Set(L.boxes);
  const out = [];
  const walkTo = target => {
    if (p === target) return;
    const prev = new Map([[p, null]]);
    const q = [p];
    for (let h = 0; h < q.length && !prev.has(target); h++) {
      for (const d of ['u', 'd', 'l', 'r']) {
        const t = q[h] + D[d];
        if (L.wall[t] || boxes.has(t) || prev.has(t)) continue;
        prev.set(t, [q[h], d]); q.push(t);
      }
    }
    if (!prev.has(target)) throw new Error('walk unreachable');
    const path = [];
    for (let c = target; prev.get(c); c = prev.get(c)[0]) path.unshift(prev.get(c)[1]);
    out.push(...path);
    p = target;
  };
  for (const [type, room] of plan) {
    const base = XL + PITCH * room;
    for (const push of tpl[type].pushes) {
      const cell = push.row * W + base + push.rel;
      if (!boxes.has(cell)) throw new Error('no box at expected cell (' + type + ' room ' + room + ')');
      const d = D[push.dir], to = cell + d;
      if (L.wall[to] || boxes.has(to)) throw new Error('push blocked');
      walkTo(cell - d);
      boxes.delete(cell); boxes.add(to);
      out.push(push.dir.toUpperCase());
      p = cell;
    }
  }
  if (![...boxes].every(b => L.goal[b])) throw new Error('not solved');
  return out.join('');
}

const N = Number(process.argv[2] || 3);
const tpl = templates();
const { plan, cost } = macroPlan(N, tpl.set.pushes.length, tpl.clear.pushes.length);
const lvl = build(N);
const moves = realize(parse(lvl), plan, tpl);
const pushes = (moves.match(/[A-Z]/g) || []).length;
if (pushes !== cost || cost !== 16 * 2 ** N - 15) throw new Error('push count mismatch');
if (process.argv[3]) fs.writeFileSync(process.argv[3], lvl);
if (process.argv[4]) fs.writeFileSync(process.argv[4], moves);
else if (!process.argv[3]) console.log(moves);
console.error(JSON.stringify({ N, pushes, moves: moves.length, formula: 16 * 2 ** N - 15 }));
