import { tokenOf, verifiedEmail } from './access'
import { handleApi } from './api'
import { createD1Store } from './d1Store'
import { handleShared } from './shared'
import type { SyncStore } from './store'
import type { Env } from './types'

let store: SyncStore | undefined

/** Where to go after signing in: a path of this app, never another site. */
function returnPath(url: URL): string {
  const wanted = url.searchParams.get('return') ?? '/'
  return wanted.startsWith('/') && !wanted.startsWith('//') ? wanted : '/'
}

/**
 * The server part of PokéBinder: the API under /api/ for syncing between devices.
 * Everything else is the built app, which Cloudflare serves from its files.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    // What a share link shows is open to anybody who has the link; it is all they get.
    if (url.pathname.startsWith('/shared/')) {
      store ??= createD1Store(env.DB, env.IMAGES)
      try {
        return await handleShared(request, store)
      } catch {
        return new Response(JSON.stringify({ error: 'failed' }), {
          status: 500,
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
        })
      }
    }
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)

    const email = await verifiedEmail(tokenOf(request), {
      teamDomain: env.ACCESS_TEAM_DOMAIN,
      audience: env.ACCESS_AUD,
    })
    if (!email) {
      return new Response(JSON.stringify({ error: 'not signed in' }), {
        status: 401,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      })
    }

    // The app sends the browser here to sign in: Access asks for the code on the way, and
    // whoever arrives is signed in and goes back to the app.
    if (url.pathname === '/api/login') return Response.redirect(new URL(returnPath(url), url).toString(), 302)

    store ??= createD1Store(env.DB, env.IMAGES)
    try {
      return await handleApi(request, email, store)
    } catch {
      return new Response(JSON.stringify({ error: 'failed' }), {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      })
    }
  },
}
