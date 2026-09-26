#!/usr/bin/env node
/**
 * One-shot Spotify OAuth helper — captures a long-lived refresh token
 * for the now-playing integration. Run once locally; never commit the
 * resulting token.
 *
 * Prerequisites
 * -------------
 *   1. Create a Spotify Developer app at https://developer.spotify.com/dashboard
 *   2. Register redirect URI EXACTLY: http://127.0.0.1:8888/callback
 *      (Spotify now rejects `localhost` — you must use 127.0.0.1)
 *   3. Add these lines to .env.local at the project root:
 *        SPOTIFY_CLIENT_ID=<from dashboard>
 *        SPOTIFY_CLIENT_SECRET=<from dashboard>
 *
 * Usage
 * -----
 *   node scripts/spotify-oauth.mjs
 *
 * What it does
 * ------------
 *   - Starts a local HTTP server on 127.0.0.1:8888
 *   - Opens your browser to Spotify's authorize URL with the scopes
 *     `user-read-currently-playing user-read-playback-state user-read-recently-played`
 *   - Catches the /callback redirect, exchanges the code for a refresh
 *     token, prints it, and (if not already set) appends
 *     SPOTIFY_REFRESH_TOKEN=<token> to .env.local
 *
 * The 127.0.0.1:8888 callback is used ONLY for this one-time capture.
 * At runtime the app uses the refresh token server-side — no redirect
 * URIs, no user flow. That's why the same refresh token works on
 * localhost, Cloudflare Pages preview URLs, and production.
 *
 * Runs on Node 18+ (uses built-in fetch).
 */

import http from 'node:http'
import { URL } from 'node:url'
import { readFileSync, existsSync, appendFileSync } from 'node:fs'
import { exec } from 'node:child_process'
import { randomBytes } from 'node:crypto'

const REDIRECT_URI = 'http://127.0.0.1:8888/callback'
const SCOPES = 'user-read-currently-playing user-read-playback-state user-read-recently-played user-top-read'
const PORT = 8888

function loadEnvLocal() {
  const path = '.env.local'
  if (!existsSync(path)) {
    console.error('❌ .env.local not found at project root.')
    console.error('   Create it with:')
    console.error('     SPOTIFY_CLIENT_ID=<from Spotify Developer dashboard>')
    console.error('     SPOTIFY_CLIENT_SECRET=<from Spotify Developer dashboard>')
    process.exit(1)
  }
  const text = readFileSync(path, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match) {
      let val = match[2]
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      env[match[1]] = val
    }
  }
  return env
}

const env = loadEnvLocal()
const CLIENT_ID = env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = env.SPOTIFY_CLIENT_SECRET

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env.local')
  process.exit(1)
}

const state = randomBytes(16).toString('hex')

const authUrl = new URL('https://accounts.spotify.com/authorize')
authUrl.searchParams.set('client_id', CLIENT_ID)
authUrl.searchParams.set('response_type', 'code')
authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
authUrl.searchParams.set('scope', SCOPES)
authUrl.searchParams.set('state', state)

console.log('🎵 Spotify OAuth helper')
console.log('')
console.log('Opening your browser to authorize this app...')
console.log('If the browser does not open, paste this URL manually:')
console.log('')
console.log('  ' + authUrl.toString())
console.log('')

const opener =
  process.platform === 'darwin' ? 'open'
  : process.platform === 'win32' ? 'start ""'
  : 'xdg-open'
exec(`${opener} "${authUrl.toString()}"`, (err) => {
  if (err) {
    console.warn('(Could not auto-open the browser — copy the URL above instead.)')
  }
})

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://127.0.0.1:${PORT}`)

  if (reqUrl.pathname !== '/callback') {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
    return
  }

  const code = reqUrl.searchParams.get('code')
  const returnedState = reqUrl.searchParams.get('state')
  const error = reqUrl.searchParams.get('error')

  if (error) {
    res.writeHead(400, { 'Content-Type': 'text/html' })
    res.end(`<h1>Spotify returned: ${error}</h1><p>Close this tab and re-run the helper.</p>`)
    console.error(`❌ Spotify returned error: ${error}`)
    server.close()
    process.exit(1)
  }

  if (returnedState !== state) {
    res.writeHead(400, { 'Content-Type': 'text/html' })
    res.end('<h1>State mismatch</h1><p>Possible CSRF. Re-run the helper.</p>')
    console.error('❌ State mismatch — aborting')
    server.close()
    process.exit(1)
  }

  if (!code) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Missing code in callback')
    return
  }

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization':
          'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }).toString(),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      throw new Error(`Token exchange failed: ${tokenRes.status} ${text}`)
    }

    const data = await tokenRes.json()
    const refreshToken = data.refresh_token

    if (!refreshToken) {
      throw new Error('No refresh_token in response: ' + JSON.stringify(data))
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`
      <!doctype html>
      <html><head><title>Spotify OAuth — Done</title></head>
      <body style="font-family:-apple-system,system-ui,sans-serif;padding:40px;max-width:560px;margin:auto;color:#222">
        <h1 style="margin-top:0">✓ Got it</h1>
        <p>Refresh token captured. You can close this tab and return to your terminal.</p>
      </body></html>
    `)

    console.log('')
    console.log('✅ Success! Your refresh token:')
    console.log('')
    console.log(`  SPOTIFY_REFRESH_TOKEN=${refreshToken}`)
    console.log('')

    const envText = readFileSync('.env.local', 'utf8')
    if (!/^\s*SPOTIFY_REFRESH_TOKEN=/m.test(envText)) {
      const sep = envText.endsWith('\n') ? '' : '\n'
      appendFileSync('.env.local', `${sep}SPOTIFY_REFRESH_TOKEN=${refreshToken}\n`)
      console.log('   (Automatically appended to .env.local)')
    } else {
      console.log('   (SPOTIFY_REFRESH_TOKEN already exists in .env.local — not overwriting.')
      console.log('    If you want to replace it, edit .env.local manually.)')
    }

    console.log('')
    console.log('Next steps:')
    console.log('  1. Verify the three SPOTIFY_* vars are in .env.local')
    console.log('  2. In Cloudflare Pages → Settings → Environment variables,')
    console.log('     add all three (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET /')
    console.log('     SPOTIFY_REFRESH_TOKEN) to BOTH the Preview and Production scopes.')
    console.log('')

    server.close()
    process.exit(0)
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/html' })
    res.end(`<h1>Token exchange failed</h1><pre>${err.message}</pre>`)
    console.error('❌ Token exchange failed:', err)
    server.close()
    process.exit(1)
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`(local callback server listening on http://127.0.0.1:${PORT})`)
})
