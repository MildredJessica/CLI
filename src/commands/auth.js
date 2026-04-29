import http from 'http'
import crypto from 'crypto'
import ora from 'ora'
import chalk from 'chalk'
import open from 'open'
import { saveCredentials, loadCredentials, clearCredentials, API_BASE } from '../utils/api.js'

// ── Login ─────────────────────────────────────────────────────────────────────
//
// Flow:
//   1. CLI starts a local HTTP server on a random port
//   2. CLI opens: GET /auth/github?cli=1&cli_port=<port>
//   3. Backend redirects browser to GitHub OAuth
//   4. GitHub redirects back to backend: GET /auth/github/callback
//   5. Backend exchanges code, creates user, issues tokens
//   6. Backend redirects browser to: http://localhost:<port>/callback?tokens=<encoded>
//   7. CLI local server receives the redirect, extracts tokens, saves credentials

export async function loginCommand() {
  const server = http.createServer()
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  
  const spinner = ora('Waiting for GitHub authentication…').start()
  
  const authComplete = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Authentication timed out (2 minutes)'))
    }, 2 * 60 * 1000)

    server.on('request', (req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`)
      if (url.pathname !== '/callback') { res.end(); return }

      clearTimeout(timeout)

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body style="font-family:sans-serif;padding:40px;text-align:center"><h2>✅ Logged in!</h2><p>You can close this tab.</p></body></html>')

      // Backend passes tokens as query params to this local callback
      const accessToken  = url.searchParams.get('access_token')
      const refreshToken = url.searchParams.get('refresh_token')
      const username     = url.searchParams.get('username')
      const role         = url.searchParams.get('role')
      const id           = url.searchParams.get('id')
      const error        = url.searchParams.get('error')

      if (error) { reject(new Error(decodeURIComponent(error))); return }
      if (!accessToken) { reject(new Error('No token received')); return }

      resolve({ accessToken, refreshToken, username, role, id })
    })
  })

  const authUrl = `${API_BASE}/auth/github?cli=1&cli_port=${port}`
  console.log(chalk.cyan('\n🔐 Opening GitHub login in your browser…'))
  console.log(chalk.dim(`   If it doesn't open: ${authUrl}\n`))

  await open(authUrl)

  try {
    const { accessToken, refreshToken, username, role, id } = await authComplete

    saveCredentials({
      access_token:  accessToken,
      refresh_token: refreshToken,
      username,
      role,
      id,
    })

    spinner.succeed(chalk.green(`Logged in as ${chalk.bold('@' + username)}`))
  } catch (err) {
    spinner.fail(chalk.red(`Login failed: ${err.message}`))
    process.exit(1)
  } finally {
    server.close()
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logoutCommand() {
  const creds = loadCredentials()
  if (!creds?.access_token) {
    console.log(chalk.yellow('You are not logged in.'))
    return
  }
  const spinner = ora('Logging out…').start()
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: creds.refresh_token }),
    })
  } catch { /* best-effort */ }
  clearCredentials()
  spinner.succeed(chalk.green('Logged out.'))
}

// ── Whoami ────────────────────────────────────────────────────────────────────

export async function whoamiCommand() {
  const creds = loadCredentials()
  if (!creds?.username) {
    console.log(chalk.yellow('Not logged in. Run: insighta login'))
    return
  }
  console.log(chalk.cyan(`Logged in as ${chalk.bold('@' + creds.username)}`))
  console.log(chalk.dim(`Role: ${creds.role} | ID: ${creds.id}`))
}

