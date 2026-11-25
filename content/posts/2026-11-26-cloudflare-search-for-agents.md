---
title: "Cloudflare の Search for Agents を curl で試した"
date: 2026-11-26T08:31:57+09:00
slug: "2026-11-26-cloudflare-search-for-agents"
categories: ["新機能"]
tags: ["Cloudflare", "AI Search", "HTTP QUERY"]
---
Cloudflare が 11 月 25 日に出した [Search for Agents](https://blog.cloudflare.com/search-for-agents/) は、発表を読んだだけだと何が起きるのかつかみにくかったので、すでに有効化されている Cloudflare の開発者ドキュメントサイトに curl を投げてみました。

```sh
curl "https://developers.cloudflare.com/.well-known/search?q=cloudflare+artifacts+push+size"
```

返ってきたのは Markdown で、先頭は Artifacts の制限ページ、「Maximum push size: 64 MiB per push」と書いてありました。ゾーン（Cloudflare に載せたドメイン）のダッシュボードでトグルを入れると、このエンドポイントがサイトに生えます。裏では AI Search のインスタンスが自動で作られ、サイトをクロールして索引にします。AI Search は前からあるサービスで、インスタンスの作成、ドメインからの公開、エージェントへの周知を手作業でやる必要がありました。今回はそこが自動になった、というのが発表記事の説明です。

## エージェントに見つけさせる meta タグ

検索 API を置いても、エージェントが知らなければ使われません。そこで Cloudflare は各ページの `<head>` に meta タグを差し込みます。トップページを取得して確かめたら、こうなっていました。

```html
<meta name="agent:instructions" content="Use this search API to find relevant content across this site with keywords or natural-language queries, instead of crawling individual pages. Results are returned in Markdown.">
<meta name="agent:endpoint" content="https://developers.cloudflare.com/.well-known/search?q={query}">
<meta name="agent:method" content="GET">
<meta name="agent:documentation" content="https://developers.cloudflare.com/ai-search/how-to/search-for-agents/">
```

エンドポイントの場所だけでなく、「ページを一枚ずつクロールせず、これで聞いてください」という指示文まで入っています。Markdown for Agents（`Accept: text/markdown` で HTML を Markdown にして返す機能）を併用していると、同じ情報が YAML フロントマターで届きます。

返るのは検索にヒットした本文の断片で、AI が作った回答ではありません。発表記事は、エージェントはすでに自分のモデルと会話を持っているので、必要なのは情報であって別のモデルの答えではない、と書いています。

## QUERY メソッド

GET のクエリ文字列の代わりに、ボディで検索文を送れる `QUERY` メソッドにも対応しています。QUERY は 2026 年 6 月に [RFC 10008](https://www.rfc-editor.org/rfc/rfc10008.html) になった、安全で冪等なリクエストにボディを持たせるための HTTP メソッドです。curl 8.14.1 でそのまま通りました。

```sh
curl -X QUERY https://developers.cloudflare.com/.well-known/search \
  -H 'Content-Type: application/json' \
  --data '{"q":"Artifacts maximum push size"}'
```

応答ヘッダに `accept-query: text/plain, application/json` が付いていて、受け付ける形式をサーバー側が宣言しています。

## 試して引っかかった点

応答が大きいです。上の GET の応答は約 50 KB で、`##` の見出しで数えると 50 件の断片が入っていました。答えは先頭の 1 件で、残りはスコアが 0.3 台まで下がっていきます。エージェントのコンテキストに全部入れるのは重いので、上位の数件だけ読ませるのが現実的です。

しかも[公式ドキュメント](https://developers.cloudflare.com/ai-search/how-to/search-for-agents/)の既定は「最大 10 チャンク」です。開発者ドキュメントサイトだけ設定が違うのか、記述と実装がずれているのかはわかりません。JSON ボディに `max_num_results` を付けても件数は変わりませんでした。

ステータスの書き方も揃っていません。発表記事は「Starting today, available to all customers」ですが、ドキュメントには「available in beta on all plans」とあります。ドキュメントのほうが慎重な書き方なので、私はベータとして扱います。課金は AI Search の料金（取り込み、索引の保管、クエリ）にそのまま乗り、無料プランには上限があります。公開してよいページだけを索引にするようドキュメントも注意していて、Bot 管理、AI Crawl Control、WAF の設定でボットを止めているサイトでは、このエンドポイントも同じ設定に従います。

サイトを持たない側にも使いみちがあります。エージェントへの指示に「`agent:endpoint` の meta があればそれを使う」と一行足せば、対応サイトでは、ページをたどる代わりに検索 1 回で済ませられます。発表記事は OpenCode で試して、数秒で正しい答えが返ったと書いています。

## 出典

- [Introducing Search for Agents（Cloudflare Blog、2026-11-25）](https://blog.cloudflare.com/search-for-agents/)
- [Search for Agents（Cloudflare AI Search docs）](https://developers.cloudflare.com/ai-search/how-to/search-for-agents/)
- [RFC 10008（HTTP QUERY メソッド）](https://www.rfc-editor.org/rfc/rfc10008.html)
