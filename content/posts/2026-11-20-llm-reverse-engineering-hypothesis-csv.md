---
title: "エージェントのデバッグで、仮説を CSV に書かせる指示書"
date: 2026-11-20T07:34:20+09:00
slug: "2026-11-20-llm-reverse-engineering-hypothesis-csv"
categories: ["トレンド"]
tags: ["エージェントスキル", "デバッグ", "リバースエンジニアリング"]
---
ファームウェアや古いアプリのバイナリをコーディングエージェントに解析させている人のブログ、[LLM assisted reverse engineering](https://www.slowchronicle.com/posts/llm-assisted-reverse-engineering)（2026-11-18）を読みました。20 年ほど手でリバースエンジニアリングをやってきた著者が、この 6 か月のやり方をまとめたものです。逆アセンブルは私の専門外ですが、エージェントが行き詰まったときの扱い方は、普段のデバッグにそのまま持ち込めそうでした。

## 調べたことを全部ファイルに書かせる

著者は、わかったことを逐一 Markdown に書くようエージェントに指示しています。理由は 3 つ挙がっています。自分の理解のため、コンパクションや別エージェントへの引き継ぎで道筋を見失わないため、エージェント自身が堂々巡りしにくくなるため、です。

行き詰まったときの指示も具体的です。「別の方法で」では足りず、xref をたどって詰まったなら「バイナリ内の文字列から追って」と言う、という例が書かれています。

## 仮説を 1 つずつ CSV に書かせるスキル

著者はこの考えを [hypothesis-debugging](https://github.com/ioma8/hypothesis-debugging) というスキルにして公開しています。[SKILL.md](https://raw.githubusercontent.com/ioma8/hypothesis-debugging/main/skills/hypothesis-debugging/SKILL.md) を読むと、流れはこうです。

```mermaid
flowchart LR
  A["仕組みを読む"] --> B["仮説を 1 つ立てる"]
  B --> C["CSV に仮説を書く"]
  C --> D["実験を 1 つ実行"]
  D --> E["結論を CSV に書く"]
  E -->|"未解決"| A
  E -->|"原因を証明"| F["報告して終わる"]
```

CSV の列は hypothesis, test, conclusion, notes。conclusion は proved / disproved / need more info のどれかで、実験の前に仮説の行を書き、空の conclusion は実験のあとに埋めます。同時に 2 つの仮説を試さない、コードを直す前に仮説を書く、という禁止事項も並んでいます。

README は、エージェントのデバッグが迷走する様子をこう書いています。原因の近くまで行ってから新しい情報で方向を変え、3 つ試す頃にはコンテキストが膨らんで、何を否定済みか忘れる。

この中で私が目を留めたのは `disproved` の行です。否定された仮説は、コードにも差分にも残りません。長いセッションでコンパクションが入ると「それはもう試した」も一緒に消えて、同じ実験をもう一度やることになります。CSV に 1 行あれば、それは防げます。

SKILL.md には、読んでいる途中でバグらしいものを見つけても、それは観察であって仮説ではない、という注意もあります。「ここだ」と見えた時点で直し始めず、なぜ期待と実際がずれるのかを言葉にして試してからにしろ、という意味です。私が自分のデバッグを思い返すと、人間でも同じことをやりがちです。

## 試すなら

スキルを入れなくても、原因不明のバグを調べさせるときに次の指示を足せば同じことができます。

```text
仮説を 1 つ立てるたびに HYPOTHESES.csv に hypothesis,test,conclusion,notes の行を追記し、
実験の結果が出るまで次の仮説に進まないこと。否定された仮説も消さないこと。
```

ブログにもリポジトリにも、この方法の効果を測った数字はありません。私も試していないので、効くかどうかは長めのデバッグで一度やってみないとわかりません。著者の「何年もかかったものが数か月でできた」という成果も自己申告です。Hacker News の[投稿](https://news.ycombinator.com/item?id=50553225)は、私が見た時点ではコメントがなく、追試や反論はまだ出ていませんでした。

## 出典

- [LLM assisted reverse engineering](https://www.slowchronicle.com/posts/llm-assisted-reverse-engineering)（ioma8、2026-11-18）
- [Hacker News の投稿](https://news.ycombinator.com/item?id=50553225)
- [hypothesis-debugging（リポジトリ）](https://github.com/ioma8/hypothesis-debugging) と [SKILL.md](https://raw.githubusercontent.com/ioma8/hypothesis-debugging/main/skills/hypothesis-debugging/SKILL.md)
