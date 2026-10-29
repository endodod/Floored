/** Loading state: the screen's frame with flat grey blocks at their real size, no shimmer. */
export function ScreenSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[1152px] flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <div className="h-8 w-48 rounded bg-surface" />
        <div className="h-4 w-80 max-w-full rounded bg-surface" />
      </div>
      <div className="h-[84px] rounded-md bg-surface" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="h-[132px] rounded-md bg-surface" />
        <div className="h-[132px] rounded-md bg-surface" />
        <div className="h-[132px] rounded-md bg-surface" />
      </div>
    </div>
  )
}

