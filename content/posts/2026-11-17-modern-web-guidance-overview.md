---
title: "Chrome チームの Modern Web Guidance を入れると、コーディングエージェントの HTML/CSS はどう変わるか"
date: 2026-11-17T01:15:43+09:00
slug: "2026-11-17-modern-web-guidance-overview"
categories: ["tips"]
tags: ["Modern Web Guidance", "コーディングエージェント", "スキル"]
---
エージェントにダイアログを作らせると、開閉の状態を JavaScript で持ち、フェードアウトのために `setTimeout` を挟んだコードが出てくることがあります。いまの CSS なら `@starting-style` と数行の transition で済む場面です。Chrome チームの [Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance) は、モデルがこういう古い書き方に寄る癖を、スキルで補おうとするものです。[1.0 が 11 月 10 日に出た](https://developer.chrome.com/blog/modern-web-guidance-v1)ので、中身を読んで CLI も動かしてみました。

## 仕組み

Web 機能ごとに書かれた短いガイドが 200 本あまりあり、エージェントは CLI の `search` でやりたいことの文章から候補を探し、`retrieve` で本文を取ってコンテキストに入れます。[README](https://github.com/GoogleChrome/modern-web-guidance) によると検索は端末内の TensorFlow.js モデルで動き、API キーも通信も要りません。常駐するスキル本体は約 234 トークンと小さく、ガイドは必要になった分だけ引かれます。

テレメトリを切って（README では `DISABLE_TELEMETRY=1`）、空のディレクトリで試しました。

```sh
DISABLE_TELEMETRY=1 npx -y modern-web-guidance@latest search "animate a dialog modal backdrop"
```

返ってきたのは `animate-to-from-top-layer`、`light-dismiss-a-dialog`、`prevent-page-scroll-under-modal-dialog`、`dialog` など 10 件ほどの ID と 1 行の説明です。「make images load faster」だと先頭は `optimize-image-priority` でした。API 名を知らなくても候補が出ます。

```sh
DISABLE_TELEMETRY=1 npx -y modern-web-guidance@latest retrieve animate-to-from-top-layer
```

こちらは約 10 KB・244 行のファイルに書き出されました。実装手順、コード例、MANDATORY / DO NOT の箇条書き、ブラウザ対応の順です。読んでいて目を引いたのは、「`transition` の短縮形に `allow-discrete` を入れると、古いブラウザは宣言ごと無視するので別行で書く」のような、知らないと踏む落とし穴が DO NOT として入っていることです。`prefers-reduced-motion` への配慮は、後付けの注意ではなくコード例の最初から組み込まれています。対応状況の節には Baseline の日付とブラウザごとの最小バージョンがあり、`overlay` は Chrome と Edge だけで Firefox と Safari は未対応、とまで書いてあります。何を使ってよいかを、エージェントが対応方針と照らして決められる材料になっています。

## 効果の数字

README の eval 表では、Claude Code（sonnet-5-5）で、ガイドなし 56% からガイドあり 88%（10 月 19 日、171 課題）です。Codex や Antigravity でも +20〜30 ポイントほどの差が並びます。note は自社の Next.js コードで 180 回試して 61% から 94%、MetaMask は PR レビューボットとして使い、約 480 PR のうち 64 件にコメントして 43 件が直されたと、発表記事にあります。これらはすべて Chrome 側か導入企業の報告で、私は自分のコードでは試していません。採点の作りは、正解デモは 100% 通り悪い例は 100% 落ちるよう校正し、差が小さいガイドは「モデルがもう知っている」として削る、という方式です。

## 使い方

新規に書かせるときは、普通に頼めばスキルが起動します。既存コードには 1.0 で入った modernization ワークフローがあり、HTML・CSS・JavaScript・`package.json` を静的解析して置き換え候補を出します。発表記事は、対象パターンを絞った最初の版だと書いています。この 2 つは、私は動かしていません。

3 つめは[学習用の使い方](https://developer.chrome.com/blog/beyond-code-generation)で、1.0 のスキルはガイドを使った返答の末尾に「Modern Web Guidance」の節を付けさせます。どのガイド ID を使い、どの API で何を防いだかが並ぶ形です。スキルは入れても効いたのかどうかが見えにくいので、根拠を毎回出力させるのは、他のスキルにも使える手だと私は思います。

## 入れる前に

テレメトリは、インストール数、呼び出したエージェント名、ガイド ID、エージェントが作った検索クエリを集めます（生のプロンプトは対象外と README にあります）。また、ガイドはコードの書き方を指示するだけで、動かして確かめはしません。agent-browser の[解説ページ](https://agent-browser.dev/modern-web-guidance)も、フォーカスが保持されるかなどは実行しないとわからないと書いていて、発表記事は Chrome DevTools for agents との併用を勧めています。

## 出典

- [GoogleChrome/modern-web-guidance（README）](https://github.com/GoogleChrome/modern-web-guidance)
- [Modern Web Guidance 1.0 発表記事](https://developer.chrome.com/blog/modern-web-guidance-v1)
- [Beyond code generation: Using Modern Web Guidance for continuous developer learning](https://developer.chrome.com/blog/beyond-code-generation)
- [Modern Web Guidance | agent-browser](https://agent-browser.dev/modern-web-guidance)
- [Modern Web Guidance | Chrome for Developers](https://developer.chrome.com/docs/modern-web-guidance)
