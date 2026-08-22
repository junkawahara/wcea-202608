# 検証ツール(本物の倉庫番で 2ᴺ 手)

`real.html` のレベルと最短手数を再現・検証するための Node.js スクリプト。

- `thesis_room.js` — 反復単位となる部屋(Potma 2018 の Fig. を復元した 12×16 盤面)。
- `thesis_chain.js` — 部屋を N 個連結したレベルを生成。`node thesis_chain.js 2 out.txt`
- `solver.js` — 押し最適の全数探索ソルバー(死にマス・凍結・角詰み・ホール条件の健全な枝刈りつき)。
  `node solver.js out.txt` で最短押し手数と解(LURD)を出力。
- `replay.js` — 解の合法性を独立に検証。`node replay.js out.txt <LURD文字列>`

検証済みの値: N=1 → 17 押し、N=2 → 49 押し(いずれも 16·2ᴺ−15 に一致)。
