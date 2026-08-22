# 検証ツール(本物の倉庫番で 2ᴺ 手)

`real.html` のレベルと最短手数を再現・検証するための Node.js スクリプト。

- `thesis_room.js` — 反復単位となる部屋(Potma 2018 の Fig. を復元した 12×16 盤面)。
- `thesis_chain.js` — 部屋を N 個連結したレベルを生成。`node thesis_chain.js 2 out.txt`
- `solver.js` — 押し最適の全数探索ソルバー(死にマス・凍結・角詰み・ホール条件の健全な枝刈りつき)。
  `node solver.js out.txt` で最短押し手数と解(LURD)を出力。
- `replay.js` — 解の合法性を独立に検証。`node replay.js out.txt <LURD文字列>`
- `compose.js` — 任意の N の「構成どおりの解」を合成。検証済みの N=2 最短解から
  部屋ごとの操作テンプレート(セット11押し/クリア5押し)を抽出し、部屋の周期ぶん
  平行移動して組み立てる(プレイヤーの歩きは BFS で再計算)。
  `node compose.js 4 lv4.txt sol4.txt` → 続けて `node replay.js lv4.txt "$(cat sol4.txt)"`

検証済みの値: N=1 → 17 押し、N=2 → 49 押し(全数探索で最短と確定。16·2ᴺ−15 に一致)。
N=3 → 113 押し、N=4 → 241 押し(compose.js の合成解。リプレイ検証済みの上界で、最短と予想。
N=3 は全数探索が状態数約 1,670 万件の上限を超えるため未確定)。
compose.js を N=2 に適用すると全数探索の最短解を一字一句再現する。
