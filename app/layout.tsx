import type { Metadata } from 'next'
import { IBM_Plex_Mono, Public_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { Navbar } from '@/components/navbar'
import { AuthProvider } from './auth-provider'
import { Ambience } from '@/components/ambience'
import { MOTION_BOOT_SCRIPT, MotionPreferenceSync } from '@/components/motion-preference'

const sans = Public_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-floored-sans' })
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-floored-mono' })

export const metadata: Metadata = {
  title: 'Floored',
  description: 'A casino game: a daily challenge, a roguelike survival run, and freeplay.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT_SCRIPT }} />
      </head>
      <body className="font-sans bg-background text-foreground h-screen flex flex-col" suppressHydrationWarning>
        <MotionPreferenceSync />
        <Ambience />
        <AuthProvider>
          <Navbar />
          <main className="relative z-10 container mx-auto px-4 sm:px-6 py-4 sm:py-6 [@media(max-height:640px)]:py-2 flex-1 min-h-0 flex flex-col overflow-y-auto">
            {children}
          </main>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
