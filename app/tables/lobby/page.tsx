import { redirect } from 'next/navigation'

/** The table chooser now lives at /tables; keep old links working. */
export default function TablesLobbyRedirect() {
  redirect('/tables')
}
