import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const features = [
  {
    title: "プロジェクトとタスクを可視化",
    description:
      "プロジェクトの期間やタスクの進捗をガントチャートで俯瞰し、スケジュールのズレをすぐに把握できます。",
  },
  {
    title: "日次スナップショットを保存",
    description: "毎日の状態をスナップショットとして残し、過去と今日の差分を簡単に追跡できます。",
  },
  {
    title: "差分レポートを自動生成",
    description: "前日からの進捗量をテキスト化し、日報やステータス共有にそのまま使えるレポートを生成します。",
  },
]

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-10">
      <section className="rounded-2xl border bg-card/50 p-10 shadow-sm">
        <p className="text-sm font-semibold text-primary">ガントチャート進捗報告アプリ</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">
          日次の進捗を見える化し、レポート作成を自動化する
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
          プロジェクトやタスクの計画・実績をガントチャートで確認しながら、日々のスナップショットと差分レポートを蓄積するためのワークスペースです。
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/projects" className={cn(buttonVariants({ size: "lg" }))}>
            プロジェクト一覧へ
          </Link>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "text-foreground")}
          >
            ログインして始める
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {features.map((feature) => (
          <div key={feature.title} className="rounded-xl border bg-card/50 p-6 shadow-xs">
            <h2 className="text-lg font-semibold">{feature.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
