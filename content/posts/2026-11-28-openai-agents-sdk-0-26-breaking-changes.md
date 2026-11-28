---
title: "OpenAI Agents SDK 0.26.0 で Docker マウントと Realtime のトレースが壊れうる箇所"
date: 2026-11-28T09:32:41+09:00
slug: "2026-11-28-openai-agents-sdk-0-26-breaking-changes"
categories: ["まとめ"]
tags: ["OpenAI Agents SDK", "Claude Agent SDK"]
---
OpenAI Agents SDK を 0.25.0 から 0.26.0 に上げるなら、先に [リリースノート](https://github.com/openai/openai-agents-python/releases/tag/v0.26.0)の下のほうにある「Release readiness review」を読んだほうがいいです。一覧の機能追加は GPT-Live デモの更新だけで目立ちませんが、この節に、上げると動かなくなる箇所が 3 つ書かれています。リスクはどれも LOW と評価されています。PyPI から 0.25.0 と 0.26.0 の wheel を取って、ソースも確認しました。

## Docker サンドボックスで in-container マウントが使えなくなった

Docker のサンドボックスで `InContainerMountStrategy` を使っていると、セッションの作成時にも再開時にも拒否されます。読み取り専用でも同じです。0.26.0 の `docker.py` には、次のメッセージを出すマニフェスト検証が入っていました。

```
Docker does not support in-container storage mounts. Use DockerVolumeMountStrategy with a compatible volume driver or mount the storage on the Docker host and expose it through a trusted host_path grant.
```

移行先は 2 つです。

- `DockerVolumeMountStrategy` と、対応するボリュームドライバを使う
- ホスト側でストレージをマウントし、信頼できる `SandboxPathGrant` で渡す

リリースノートには、特権付きのコンテナや capability を追加したコンテナは再利用しないとも書かれています。古いセッションと、それを含む `RunState` は破棄して、新しいマニフェストで作り直します。保存済みのワークスペースのファイルは、スナップショットから戻します。セッションを保存して resume する使い方をしているなら、ここは必ず確認が要ります。

## 自作 TraceProvider だと、Realtime のサーバートレースが止まる

0.25.0 の Realtime は、グローバルのトレース無効化スイッチを見ずに、設定されたサーバートレースを送っていました。0.26.0 では `get_trace_provider().is_disabled()` を確認するようになりました。

`provider.py` では、`is_disabled()` は抽象メソッドではなく、既定実装を持つメソッドとして追加されています。docstring には「古いカスタムプロバイダは、`set_disabled` と同じ状態を返すようこのメソッドを上書きするまで、サーバートレースが無効のまま」と書いてあります。例外は出ないので、アップグレード後に Realtime のトレースが届かなくなって初めて気づくことになります。直し方は、`set_disabled()` が保持している状態をそのまま返す `is_disabled()` を、自作プロバイダに実装することです。標準のプロバイダは対応済みです。

## experimental の codex_tool で、モデルが指定したローカル画像パスが通らなくなった

これまでは、モデルが `local_image` に書いたファイルパスがそのまま使われました。0.26.0 では、アプリケーション側があらかじめ許可した画像しか渡せません。ソースの docstring にある例はこうです。

```python
codex_tool(image_attachments={"diagram": "/app/diagram.png"})
```

呼び出すコード側で、名前（ここでは `diagram`）と実際のパスの対応を `image_attachments` に登録します。そのうえで、プロンプトなどでモデルに「`local_image` の path には `diagram` と書くように」と伝えます。モデルが `diagram` と書くと、SDK が登録済みの `/app/diagram.png` に置き換えます。登録できるのは絶対パスで、カンマを含まないものだけです。

同じ変更で、ツール入力の検証にも選択肢が増えました。tuple のような厳密な型を使うなら `parameter_validation_mode="json"` を指定します。既定は従来どおり `"python"` です。

## 入力ガードレールの tripwire で、待機中の関数ツールが止まる

こちらは破壊的変更ではありません。入力ガードレールの tripwire が発動すると、キューに入っていた関数ツールが実行されなくなりました。0.25.0 までの挙動はソースで確かめていないので、ツールがいつ動き出していたかは、リリースノートの書き方からの推測です。ツールに副作用があるなら、`run_in_parallel=False` を指定すると、入力チェックの完了後にしかツールが始まりません。

## Claude Agent SDK 0.2.188 と 0.2.189 は、同梱 CLI が 1 つずつ上がっただけ

[0.2.188](https://github.com/anthropics/claude-agent-sdk-python/releases/tag/v0.2.188) と [0.2.189](https://github.com/anthropics/claude-agent-sdk-python/releases/tag/v0.2.189) のリリースページには、PyPI へのリンクとインストールコマンドしか載っていません。そこで wheel を取って、0.2.187 から順に比較しました。

```sh
pip download claude-agent-sdk==0.2.189 --no-deps -d w
```

差分が出たのは、同梱の `claude` バイナリ、その `claude.version`、`_cli_version.py`、`_version.py` だけでした。Python のコードは変わっていません。同梱 CLI のバージョンは、次のように推移しています。

```
0.2.187  2.1.330
0.2.188  2.1.331
0.2.189  2.1.332
```

SDK 経由で Claude Code を動かしている場合、SDK のバージョンを上げると CLI の挙動もそれに追従します。CLI 2.1.331 と 2.1.332 で何が変わったのかは、確認できていません。

## 出典

- [OpenAI Agents SDK v0.26.0 リリースノート](https://github.com/openai/openai-agents-python/releases/tag/v0.26.0)
- [Claude Agent SDK v0.2.188](https://github.com/anthropics/claude-agent-sdk-python/releases/tag/v0.2.188)
- [Claude Agent SDK v0.2.189](https://github.com/anthropics/claude-agent-sdk-python/releases/tag/v0.2.189)
- PyPI の [openai-agents](https://pypi.org/project/openai-agents/) 0.25.0 / 0.26.0 と [claude-agent-sdk](https://pypi.org/project/claude-agent-sdk/) 0.2.187〜0.2.189 の wheel（ソースの確認に使用）
