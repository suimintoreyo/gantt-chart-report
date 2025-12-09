# PR Review: claude/review-requirements-01ThGou8CdtNCsqFdVL9feHb → dev_claude

## 概要
`requirements-doc.md` が全面的に日本語化され、Bulma / Frappe Gantt 採用方針やUI構成、ドラッグ挙動の例示が詳細化されています。一方で、いくつか矛盾や実装上の曖昧さが残っています。

## 気になる点 / 改善提案
1. **「フレームワーク不使用」とライブラリ導入方針の整合**  
   冒頭で「フロントエンドフレームワーク不使用（Vanilla JS/HTML/CSS）」としつつ、直後に Bulma・bulma-prefers-dark・Frappe Gantt を必須ライブラリとして列挙しています。CSS/JSライブラリの使用可否や取得方法（CDN禁止・ローカル同梱）、既存UIとの親和性を明示しておかないと、レビュー観点が揃いません。ライブラリ利用を許容するなら「CSSフレームワーク・Ganttライブラリはローカル配布前提で可」等、方針の一貫性を補足してください。【F:requirements-doc.md†L14-L54】

2. **カスタムCSS 20〜30行上限は実現性が低い**  
   Bulmaベースでも、2ペインレイアウトやズームボタンを持つガント、タブ/トースト、サイドパネルをまとめると20〜30行では足りない可能性が高いです。スタイル追加の上限や、どこまでBulmaのユーティリティで賄う前提かを緩和/具体化しないと、開発時に要件違反かどうか判断できません。【F:requirements-doc.md†L34-L54】【F:requirements-doc.md†L374-L410】【F:requirements-doc.md†L423-L472】

3. **UUID生成のブラウザ要件とフォールバックの扱い**  
   ID生成を `crypto.randomUUID()` に固定していますが、サポート対象ブラウザを明記しないと互換性懸念が残ります。最新Chrome/Edge以外を切り捨てるのか、非対応環境向けのフォールバックを用意するのか、方針を追記することをおすすめします。【F:requirements-doc.md†L153-L160】

## よかった点
- UI構成（ズームボタン付きガント、左右ペイン、タブ/トースト通知など）が具体的で、実装イメージを共有しやすいです。【F:requirements-doc.md†L374-L410】【F:requirements-doc.md†L290-L314】
- ドラッグ操作の種類と日付更新ロジックを表や疑似コードで示しており、挙動が明確です。【F:requirements-doc.md†L423-L472】
- テスト対象やケース例が整理されており、品質基準が把握しやすくなっています。【F:requirements-doc.md†L617-L653】

