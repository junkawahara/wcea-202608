# パズルページ集

ブラウザで遊べるパズルのドリルページ集です。GitHub Pages で公開しています。

**→ [パズルページ一覧](https://junkawahara.github.io/wcea-202608/)**

## 収録ページ

- **[虫食い「虫食い算」ドリル](https://junkawahara.github.io/wcea-202608/mushikuizan/mushikuizan2.html)** —
  黒い穴に数字を書きこんで、残った □ の虫食い算の答えがちょうど 1 通りに決まるようにするパズル(池田洋介さん考案)。
- **[虫食い算ドリル](https://junkawahara.github.io/wcea-202608/mushikuizan/mushikuizan.html)** —
  ふつうの虫食い算のドリル。
- **[IQ Flow ドリル](https://junkawahara.github.io/wcea-202608/iqflow/iqflow.html)** —
  SmartGames「IQ Flow」(Raf Peeters 作、2026)の練習ページ。ピースを盤の縁のみぞから波の向きにスライドさせて 5×5 グリッドを埋める。
- **[指数手数の倉庫番](https://junkawahara.github.io/wcea-202608/sokoban/)** —
  倉庫番の最短手数が盤面サイズの指数になる仕組み(二進カウンタ/グレイ符号型ガジェット)を、触って確かめるインタラクティブ解説。
- **[本物の倉庫番で 2ᴺ 手](https://junkawahara.github.io/wcea-202608/sokoban/real.html)** —
  通常ルールの倉庫番そのもので最短手数が 16·2ᴺ−15 になるレベル族(Hoffman–Potma 構成)。プレイ可能で、N=1,2 は押し最適の全数探索で厳密検証済み。

## リポジトリ構成

- `index.html` — トップページ(上のページへのリンク集)
- `mushikuizan/` — 虫食い算ドリル
- `iqflow/` — IQ Flow のドリルと Node.js 製ソルバー(詳細は [iqflow/README.md](iqflow/README.md))
- `sokoban/` — 指数手数の倉庫番のインタラクティブ解説

`main` ブランチに push すると GitHub Actions が自動で GitHub Pages にデプロイします。
