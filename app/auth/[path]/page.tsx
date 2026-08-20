import { AuthView } from '@neondatabase/auth/react/ui'
import { authViewPaths } from '@neondatabase/auth/react/ui/server'

export const dynamicParams = false

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }))
}

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params
  return (
    <div className="flex-1 flex items-center justify-center">
      <AuthView pathname={path} />
    </div>
  )
}
