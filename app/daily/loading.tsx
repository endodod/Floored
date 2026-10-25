export default function DailyLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3 animate-pulse">
      <div className="rounded-2xl bg-zinc-900 h-16" />
      <div className="rounded-2xl bg-zinc-900 flex-1 min-h-[400px]" />
    </div>
  )
}
