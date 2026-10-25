import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { Navbar } from '@/components/navbar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Floored',
  description: 'A daily casino challenge — one bankroll, six games, one attempt a day.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground h-screen flex flex-col`} suppressHydrationWarning>
        <Navbar />
        <main className="container mx-auto px-4 py-4 flex-1 min-h-0 flex flex-col overflow-y-auto">
          {children}
        </main>
        <Analytics />
      </body>
    </html>
  )
}
