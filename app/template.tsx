/** Re-mounts on every navigation, so each screen arrives with a short fade-up. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in flex flex-1 min-h-0 flex-col">{children}</div>
}
