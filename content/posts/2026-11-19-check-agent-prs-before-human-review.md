---
title: "エージェントが出した PR を、CI とテストでどこまで絞ってから人間が読むか"
date: 2026-11-19T09:15:35+09:00
slug: "2026-11-19-check-agent-prs-before-human-review"
categories: ["トレンド"]
tags: ["コードレビュー", "コーディングエージェント", "CI"]
---
[前の記事](https://blog.swallowarc.jp/posts/2026-11-19-coding-agents-review-bottleneck/)は、エージェントを入れた会社でレビューが詰まるという論文の紹介でした。詰まりは「PR が増えて待つ」ものと「変更依頼が増えて手戻りする」ものに分けて見られます。では、レビューに回す前に何を機械に確かめさせておけば、人間が読む場所を減らせるのか。今回はそれを調べました。依存方向やテストの通過までは機械に任せられて、仕様の解釈が合っているかは人間に残ります。実装とテストを同じ AI が書くと、そこが一番漏れます。

## 前の記事の数字は、何の時間か

前の記事の数字を使うので、何を測った時間かを確認しておきます。解説記事（[ComplexDiscovery](https://complexdiscovery.com/harvard-researchers-find-ai-coding-agents-shifted-the-bottleneck-to-code-review/)）によると、論文が測ったのは「PR を出してからマージされるまで」で、基準の 7.03 日が 3.45 日（49%）長くなっています。この中にはレビュアーが着手するまでの待ち、レビューそのもの、変更依頼後の手戻り、CI 待ちが全部入っています。人間が実際にレビューに使った時間ではありません。なお、私が開けた[論文の PDF](https://fion.ac/jellyfish.pdf) は 1 月版（500 社）で、この数字を載せている 8 月版（718 社）とは別でした。

この三つ（着手までの待ち、マージまでの総時間、人間の作業時間）は、最後の測り方の話でもう一度出てきます。

## 検証を置く場所

Birgitta Böckeler の [Harness engineering for coding agent users](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html) は、エージェントの外側に置く仕組みを、実行前に方向づける「ガイド」と、実行後に検知して直させる「センサー」に分けています。センサーは、テスト・リンタ・型検査のように決定的で速いものと、AI レビューのように推論を使うものに分かれます。前者は変更のたびに回し、後者は頻度を絞る、という整理です。彼女は、目標は人間の関与をなくすことではなく、人間の入力が最も効く場所に向けることだと書いています。

OpenAI の [Harness engineering](https://openai.com/index/harness-engineering/) は、層の依存方向をカスタムリンタと構造テストで強制し、リンタのエラーメッセージに「どう直すか」を書いてエージェントに読ませていると述べています。エージェントが PR を出す前に自分で直すための工夫です。同じ記事には、3〜7 人のチームが 5 か月で約 1,500 本の PR をマージしたとあります。これは OpenAI が自社の内部ベータ製品について報告した数字です。同じ記事は、マージを塞ぐ検査を最小にする運用を、人間の注意が足りない環境では妥当でも、スループットの低い環境では無責任だと書いています。読む範囲を絞ることと、読まなくてよいことは違うので、この事例をそのまま持ち込むのは危ないと思います。

機械で確かめられることと、人間に残ることを並べるとこうなります。

- 静的解析・型検査: 規約や型の不整合は見える。意図が正しいかは見えない。
- 依存方向の検査: 境界を越えた import は見える。越えてよい理由があるかは見えない。
- 単体・統合テスト: 書かれた期待値どおりに動くかは見える。期待値が仕様に合っているかは見えない。
- 契約テスト: 公開している入出力の形が変わったかは見える。変えてよいかは見えない。

Böckeler も、原因の誤診、不要な機能の追加、指示の取り違えは、どのセンサーでも確実には拾えないと書いています。振る舞いの検証は、AI が生成したテストが緑でカバレッジが高いことに頼る運用が多く、それでは信頼が大きすぎる、という見方です。

### 実装とテストを同じ AI が書くと、誤解も一緒に通る

arXiv のプレプリント [On the risk of coding before testing](https://arxiv.org/html/2607.05139v1) は、この点を調べています。誤った実装を見せてからテストを生成させると、独立にテストを生成した場合より故障の検出率が下がり、要約では 25% に対して 14% でした（私が読んだのは概要・導入・結論で、実験の細部は追っていません）。著者らは、テストが仕様ではなく実装をなぞってしまうことが原因だと説明し、チェーン・オブ・ソートでは変わらなかったと書いています。

手元で小さく再現しました。仕様は「出荷前ならキャンセルできる（支払い済みでも可）」とします。例は私が作ったもので、実際の事故ではありません。実装が「未払いのときだけ」と取り違え、それを見て書かれたテストも同じ解釈をなぞります。

```go
// domain/order.go
func (o Order) CanCancel() bool { return o.Status == Unpaid }
```

```go
// domain/order_test.go（実装を見たあとのテスト）
if (Order{Paid}).CanCancel() {
	t.Error("paid should not be cancellable")
}
```

```sh
go test ./domain -run '^TestCanCancel$' -v
```

```
=== RUN   TestCanCancel
--- PASS: TestCanCancel (0.00s)
PASS
ok  	example.com/shop/domain
```

緑です。次に、仕様の文面だけから起こした表を別ファイルに置きます。

```go
// domain/order_spec_test.go
cases := map[Status]bool{Unpaid: true, Paid: true, Shipped: false}
```

```
--- FAIL: TestCanCancelFromSpec (0.00s)
    order_spec_test.go:10: status=paid: got false, want true
```

分けたのは誰が書いたかではなく、何から起こしたかです。表を同じ AI に書かせても、実装を見せずに仕様の文面だけ渡せば、論文が問題にした依存はかなり切れるはずですが、これは確かめていません。どちらにしても、表の行（支払い済みは？ 出荷済みは？）が業務のルールと合っているかは人間が見る箇所です。差分を上から読む前に、まずこの表を読むのがよいと思います。

PR の説明文にも似た問題があります。AIDev データセットのエージェント PR 23,247 件を調べた論文（[Analyzing Message-Code Inconsistency](https://arxiv.org/html/2601.04886v2)）では、説明文がコード変更と食い違う PR が 1.7% あり、最多は「書いてあるのに実装されていない変更」（45.4%）でした。そうした PR の受理率は 28.3%（それ以外は 80.0%）、マージまでの時間は 55.8 時間対 16.0 時間です。測っているのは PR 作成からマージまでで、観察研究なので因果は言えません。ただ、判定にはテストに触れた説明があるのにテストファイルが変わっていない、という機械的な突き合わせが含まれていて、同じ検査は CI に置けそうです。

## 設計で範囲を狭める

ここは出典が少なく、私の考えが中心です。

`domain/` と `adapter/` にディレクトリが分かれているだけでは、「adapter の変更だから domain は読まなくていい」とは言えません。分かれていることが、守られ続けている保証にならないからです。OpenAI の事例が依存方向を機械的に強制しているのは、その保証を作るためだと読めます。

Go（1.26.5）で試しました。`adapter/pg` が `domain` を import している状態で、`domain` が `adapter/pg` を import すると、コンパイラが循環として止めます。

```
package example.com/shop/adapter/pg
	imports example.com/shop/domain from repo.go
	imports example.com/shop/adapter/pg from bad.go: import cycle not allowed
```

しかし `domain` が `database/sql` を直接 import しても、ビルドは通ります。循環にならないからです。止めるには、`go list -deps` で推移的な依存を出して禁止リストと照らす、小さなテストを書きます。

```go
var forbidden = []string{"database/sql", "net/http", "example.com/shop/adapter"}

func TestDomainDependsOnNothingOutside(t *testing.T) {
	out, err := exec.Command("go", "list", "-deps", "example.com/shop/domain").CombinedOutput()
	// ... 出力を forbidden と前方一致で照合して t.Errorf
}
```

```
--- FAIL: TestDomainDependsOnNothingOutside (0.08s)
    arch_test.go:20: domain -> database/sql/driver は禁止された依存
    arch_test.go:20: domain -> database/sql は禁止された依存
```

`database/sql/driver` まで出るのは、`go list -deps` が推移的な依存を返すからです。コンパイラが守る範囲と、自前で検査しないと守れない範囲は違いました。

この検査が緑なら、adapter だけが変わり、ポートのシグネチャも変わっていない PR では、domain の実装を読み直さなくて済みます。ただし、adapter の変更がトランザクションの境界や「誰がこの操作をしてよいか」の判定に触れるなら、依存方向が守られていても範囲を広げます。import の向きには現れないからです。

DDD の境界づけられたコンテキストと不変条件も同じ考え方です。不変条件がテストで守られていれば、それに触れない変更で別コンテキストを読む必要はありません。公開イベントやエンドポイントの形が変わるなら、境界の向こうの利用側まで広がります。

分けすぎると逆効果になります。一つの変更が interface、実装、モック、DI の配線に散ると、追うファイルが増えます。Google の [Small CLs](https://google.github.io/eng-practices/review/developer/small-cls.html) も、API を足すなら使う側を同じ変更に入れて、使われ方が見えるようにするよう勧めています。検査で守る境界は、変更の理由が実際に分かれている場所に絞るのがよさそうです。

## PR の作り方

Google のガイドは、PR の適切な大きさを「1 つの自己完結した変更」とし、100 行程度は妥当、1,000 行は大きすぎる、ただしファイル数も効くと書いています。リファクタリングは機能変更と分ける、信頼できるツールが生成した機械的な変更は大きくてよい、とも書いています。DORA の[小バッチの解説](https://dora.dev/capabilities/working-in-small-batches/)は、小バッチが AI 導入の効果を高めると述べています（読んだページに数値はありませんでした）。同じページには、AI が出した変更のレビューは 1 行あたりの認知負荷が高いかもしれない、という注記もあり、行数で見積もったレビュー時間が外れうることを示しています。

Simon Willison の [Your job is to deliver code you have proven to work](https://simonwillison.net/2025/Dec/18/code-proven-to-work/) は、手で動かした結果（コマンドと出力）と、実装を戻すと失敗する自動テストを PR に付けるよう書いています。レビュアーが再現する手間を、出す側が先に払う考え方です。

行数やパスで危険度が測りにくい例は、DB マイグレーションです。`ALTER COLUMN ... TYPE` は 1 行ですが、テーブルによっては全体の書き換えになり、本番で長いロックを取りえます。1,000 行のテスト追加のほうが、読む価値は低いこともあります。

### Go のバックエンドで 3 本の PR を比べる

| | クエリ最適化（DB アダプタ内） | 注文キャンセル条件の変更 | DB マイグレーション |
|---|---|---|---|
| 自動で確認 | 変更前後で同じ結果を返す統合テスト、ポート不変、依存方向 | 仕様から起こしたテスト表、依存方向、イベントの契約テスト | 空 DB と既存スキーマへの適用、旧アプリが新スキーマで動くこと |
| 人間が読む | SQL、実行計画の前後 | テスト表の各行、返金・在庫の副作用 | DDL とそのロック、デプロイ順 |
| 範囲を広げる条件 | ソート順や NULL の扱いが変わる、ロック句が変わる、ポートが変わる | 返金・認可・トランザクション境界に触れる、他が購読するイベントが変わる | 型変更、NOT NULL 追加、列削除、挙動変更の混入 |

CI が通ったあとの最初の一手は、次のとおりです。これは私の運用案で、実測したものではありません。

クエリ最適化では、実行計画の前後を見ます。小さなフィクスチャでは計画の違いはテストに出ません。次に、同値テストのデータに、同順位の行と NULL が入っているかを見ます。なければ、緑でも同値の証拠になりません。

キャンセル条件では、実装の差分より先にテスト表を読みます。支払い済み、出荷済み、一部出荷、返金済みの行があるか、期待値が業務の決まりと合っているか。表が実装を見てから書かれた形跡があれば、前に書いた理由で疑います。

マイグレーションでは、DDL を 1 文ずつ読み、取るロックとテーブルの大きさを照らします。そのうえで、旧バージョンのアプリが動いている間にこのスキーマになってよいかを、デプロイ順と一緒に確かめます。挙動変更が混ざっていたら、分けてもらいます。

## 既存のリポジトリで試す順序と、測り方

効果が見えやすく戻しやすい順に、次のように進めるのがよいと思います。

1. 2〜4 週間、何も変えずに測る。
2. PR に検証結果（コマンドと出力）を添え、機械的な変更と挙動変更を分ける。CI の変更は要りません。
3. 依存方向の検査を CI に置く。最初は警告にして、誤検知を潰してから必須にする。
4. 業務ルールに触れる変更では、仕様から起こしたテスト表を人間が確認する。
5. 変更の中身（マイグレーション、認可、課金）でレビュアーを分ける。
6. AI の一次レビューを入れる。前の記事によると、AI レビューが使われていても詰まりは残っていたので、最後でよいと思います。

測るのは、最初に分けた三つの時間です。レビュー依頼から最初の人間の反応までの待ちは、GitHub のイベントから取れます。マージまでの総時間も取れます。人間が実際にレビューに使った時間はタイムスタンプからは取れないので、数本の PR をサンプルしてレビュアーに聞くことになります。

これに、速くなった裏で何かが漏れていないかを見る数字を二つ並べます。変更依頼が付いた PR の割合や往復回数（再レビュー率）と、一定期間内のリバート・同じ箇所を直す追加 PR・障害（マージ後の手戻り）です。マージが速くなり、手戻りも増えているなら、読むべきものを読まずに通している可能性があります。待ちだけ減って再レビュー率が下がらないなら、手戻りの原因は検査の外にあります。

## 出典

- [コーディングエージェントでコードは3割増えたのに、レビュー待ちも5割伸びたという論文（前の記事）](https://blog.swallowarc.jp/posts/2026-11-19-coding-agents-review-bottleneck/)
- [Harvard researchers find AI coding agents shifted the bottleneck to code review（ComplexDiscovery）](https://complexdiscovery.com/harvard-researchers-find-ai-coding-agents-shifted-the-bottleneck-to-code-review/)
- [Artificial Intelligence in the Firm（論文 PDF、2026 年 1 月版）](https://fion.ac/jellyfish.pdf)
- [Harness engineering: leveraging Codex in an agent-first world（OpenAI）](https://openai.com/index/harness-engineering/)
- [Harness engineering for coding agent users（Birgitta Böckeler）](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html)
- [Small CLs（Google eng-practices）](https://google.github.io/eng-practices/review/developer/small-cls.html)
- [Working in small batches（DORA）](https://dora.dev/capabilities/working-in-small-batches/)
- [Your job is to deliver code you have proven to work（Simon Willison）](https://simonwillison.net/2025/Dec/18/code-proven-to-work/)
- [On the risk of coding before testing（arXiv）](https://arxiv.org/html/2607.05139v1)
- [Analyzing Message-Code Inconsistency in AI Coding Agent-Authored Pull Requests（arXiv）](https://arxiv.org/html/2601.04886v2)
