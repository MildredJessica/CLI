import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import jwt from 'jsonwebtoken'
import { console } from 'inspector'

console.log(homedir())
const CREDS_DIR = join(homedir(), '.insighta')
const CREDS_FILE = join(CREDS_DIR, 'credentials.json')

export const API_BASE = process.env.INSIGHTA_API_URL

// ── Credentials storage ───────────────────────────────────────────────────────

export function saveCredentials(data) {
  mkdirSync(CREDS_DIR, { recursive: true, mode: 0o700 })
  writeFileSync(CREDS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 })
}

export function loadCredentials() {
  if (!existsSync(CREDS_FILE)) return null
  try {
    return JSON.parse(readFileSync(CREDS_FILE, 'utf-8'))
  } catch {
    return null
  }
}

export function clearCredentials() {
  if (existsSync(CREDS_FILE)) {
    writeFileSync(CREDS_FILE, JSON.stringify({}), { mode: 0o600 })
  }
}

// ── Token helpers ─────────────────────────────────────────────────────────────

export function isTokenExpired(token) {
  try {
    const { exp } = jwt.decode(token)
    return Date.now() >= exp * 1000 - 10_000 // 10s buffer
  } catch {
    return true
  }
}

async function refreshTokens(refreshToken) {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!res.ok) throw new Error('Token refresh failed')
  return res.json()
}

// ── Authenticated fetch ───────────────────────────────────────────────────────

/**
 * Makes an authenticated request.
 * Auto-refreshes access token if expired.
 * Throws with a user-friendly message if re-login is needed.
 */
export async function apiFetch(path, options = {}) {
  let creds = loadCredentials()
  if (!creds?.access_token) {
    throw new Error('Not logged in. Run: insighta login')
  }

  // Auto-refresh if access token is expired
  if (isTokenExpired(creds.access_token)) {
    if (!creds.refresh_token || isTokenExpired(creds.refresh_token)) {
      clearCredentials()
      throw new Error('Session expired. Run: insighta login')
    }
    try {
      const refreshed = await refreshTokens(creds.refresh_token)
      creds = {
        ...creds,
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
      }
      saveCredentials(creds)
    } catch {
      clearCredentials()
      throw new Error('Session expired. Run: insighta login')
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${creds.access_token}`,
      'X-API-Version': '1',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `Request failed: ${res.status}`)
  }

  // Return raw response for streaming (e.g. CSV)
  if (options.raw) return res
  return res.json()
}