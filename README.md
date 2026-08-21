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

## リポジトリ構成

- `index.html` — トップページ(上のページへのリンク集)
- `mushikuizan/` — 虫食い算ドリル
- `iqflow/` — IQ Flow のドリルと Node.js 製ソルバー(詳細は [iqflow/README.md](iqflow/README.md))

`main` ブランチに push すると GitHub Actions が自動で GitHub Pages にデプロイします。
