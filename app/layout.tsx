import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { Navbar } from '@/components/navbar'
import { AuthProvider } from './auth-provider'
import { AccountSync } from '@/components/account-sync'
import { Ambience } from '@/components/ambience'
import { MOTION_BOOT_SCRIPT, MotionPreferenceSync, SimpleViewSync } from '@/components/motion-preference'
import { SimpleTabBar } from '@/components/simple-tab-bar'

export const metadata: Metadata = {
  title: 'Floored',
  description: 'A casino game: a daily challenge, a ladder climb, tables and freeplay.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT_SCRIPT }} />
      </head>
      <body className="font-sans bg-background text-foreground h-screen h-dvh flex flex-col" suppressHydrationWarning>
        <MotionPreferenceSync />
        <SimpleViewSync />
        <Ambience />
        <AuthProvider>
          <AccountSync />
          <Navbar />
          <main className="relative z-10 container mx-auto px-4 sm:px-6 py-4 sm:py-6 [@media(max-height:640px)]:py-2 pb-[max(1rem,env(safe-area-inset-bottom))] flex-1 min-h-0 flex flex-col overflow-y-auto">
            {children}
          </main>
          <SimpleTabBar />
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
