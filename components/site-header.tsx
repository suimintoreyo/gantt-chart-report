import Link from "next/link"

import { ThemeToggle } from "@/components/theme-toggle"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function SiteHeader() {
  return (
    <header className="border-b bg-card/60 shadow-xs backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground shadow-sm">
            GP
          </div>
          <div className="leading-tight">
            <Link href="/" className="text-lg font-semibold text-foreground">
              ガント進捗レポート
            </Link>
            <p className="text-sm text-muted-foreground">ガントチャートと日次レポートのためのワークスペース</p>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/projects"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}
          >
            プロジェクト
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
