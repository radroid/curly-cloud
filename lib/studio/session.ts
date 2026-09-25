import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth'
import { getAppEnv } from '@/lib/env'

/** True when the request carries a valid studio session cookie. For server components. */
export async function hasStudioSession(): Promise<boolean> {
  const env = await getAppEnv()
  const store = await cookies()
  return verifySessionToken(env.SESSION_SECRET, store.get(SESSION_COOKIE)?.value)
}

/**
 * Guard for every studio layout and page. Layouts don't re-render on client navigation,
 * so pages call this too.
 */
export async function requireStudioSession(): Promise<void> {
  if (!(await hasStudioSession())) redirect('/studio/login')
}
