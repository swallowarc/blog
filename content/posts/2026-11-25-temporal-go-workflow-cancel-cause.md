---
title: "Temporal Go SDK 1.52 で、キャンセルされた理由をワークフロー内で読めるようになった"
date: 2026-11-25T08:31:49+09:00
slug: "2026-11-25-temporal-go-workflow-cancel-cause"
categories: ["新機能"]
tags: ["Temporal", "Go"]
---
Temporal のワークフローがキャンセルされたとき、ワークフローのコードから見えるのは「キャンセルされた」という事実だけでした。`ctx.Err()` が返す `workflow.ErrCanceled` には、誰がなぜ止めたのかが入っていません。クライアントがキャンセル要求に理由を付けても、ワークフロー側には届かなかったわけです。

[v1.52.0](https://github.com/temporalio/sdk-go/releases/tag/v1.52.0)（2026-11-24）で、`workflow.Cause` と `workflow.WithCancelCause` が入りました。Go 標準ライブラリの `context.Cause` に相当するものです。

## 外から付けた理由を読む

リリースノートによると、`client.CancelWorkflowWithOptions` と `workflow.RequestCancelExternalWorkflowWithOptions` で渡した理由が、対象ワークフローの中でキャンセルの cause として取れます。`Context.Err()` は従来どおり `workflow.ErrCanceled` を返すので、既存の判定は壊れません。

呼び出し側では、`CancelWorkflowOptions` の `Reason` に理由を入れます（[定義](https://github.com/temporalio/sdk-go/blob/v1.52.0/internal/client.go)）。

```go
err := c.CancelWorkflowWithOptions(ctx, client.CancelWorkflowOptions{
	WorkflowID: "order-123",
	Reason:     "customer requested refund",
})
```

ワークフロー側では、キャンセルを検知したあとに `workflow.Cause` を読みます。キャンセル後の ctx では Activity を実行できないので、後始末用に `NewDisconnectedContext` で切り離した ctx を作っています。

```go
if ctx.Err() != nil {
	cause := workflow.Cause(ctx)
	workflow.GetLogger(ctx).Info("canceled", "cause", cause.Error())

	cleanupCtx, _ := workflow.NewDisconnectedContext(ctx)
	// cleanupCtx で後始末の Activity を実行する
}
```

[pkg.go.dev の説明](https://pkg.go.dev/go.temporal.io/sdk@v1.52.0/workflow)では、クライアントや別のワークフローからのキャンセルの場合、cause は `temporal.CanceledError` で、メッセージが呼び出し側の渡した理由です。理由が空なら `ErrCanceled` になります。

## ワークフロー内でのキャンセルと伝播

`WithCancelCause` は `WithCancel` の cause 付き版で、キャンセル関数に error を渡します。

```go
child, cancel := workflow.WithCancelCause(ctx)
cancel(errors.New("budget exceeded"))
```

ドキュメントに書かれている挙動は次のとおりです。

- 親が先にキャンセルされていたら、子は親の cause を引き継ぐ。そうでなければ `cancel` が子とその配下の cause を決め、親の cause は変わらない
- 最初のキャンセル以降は `cancel` を呼んでも cause は変わらない。`nil` を渡すと `ErrCanceled` になる
- この ctx で外部ワークフローや子ワークフローのキャンセルを要求すると、cause のメッセージが理由として使われる

最後の項目について、リリースノートは「空でない理由が渡されなかったとき cause を引き継ぐ」と書いています。明示した理由があればそちらが優先される、という読み方になります。

これが働くと、クライアントが付けた理由は、途中のワークフローが何もしなくても子や外部ワークフローまで流れます。階層が深いワークフローで、最初に誰が止めたのかを末端のログに残したいときに効きそうです。ただ、`WithCancelCause` の戻り値が標準ライブラリと同じ `(Context, CancelCauseFunc)` であることや、複数階層での伝播は、私は実行して確かめていません（Go が入っていない環境で書いたためです）。試すなら、`testsuite` のテスト環境で `Cause` に理由が届くかを先に見るのが早いと思います。

## 使いどころ

私は、まずログと監査に使うのがよいと思います。「ユーザー操作でのキャンセルなので補償処理をする」「上位のタイムアウト由来なので何もしない」といった分岐に使うこともできますが、自由な文字列で分岐すると文言の変更で壊れます。分岐させたいなら、`Reason` に `user_request` のような決め済みの短いコードを入れるほうが安全です。

また、`Reason` はヒストリーに残ります。個人情報や長い文章は入れないほうがいいでしょう。

## 出典

- [temporalio/sdk-go v1.52.0 リリースノート](https://github.com/temporalio/sdk-go/releases/tag/v1.52.0)
- [workflow パッケージ（v1.52.0）](https://pkg.go.dev/go.temporal.io/sdk@v1.52.0/workflow)
- [client パッケージ（v1.52.0）](https://pkg.go.dev/go.temporal.io/sdk@v1.52.0/client)
- [CancelWorkflowOptions の定義（v1.52.0）](https://github.com/temporalio/sdk-go/blob/v1.52.0/internal/client.go)
