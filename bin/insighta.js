#!/usr/bin/env node
import { program } from 'commander'
import { loginCommand } from '../src/commands/auth.js'
import { logoutCommand, whoamiCommand } from '../src/commands/auth.js'
import { profilesCommand } from '../src/commands/profiles.js'

program
  .name('insighta')
  .description('Insighta Labs+ CLI')
  .version('1.0.0')

// ── Auth commands ──────────────────────────────────────────────────────────
program
  .command('login')
  .description('Authenticate with GitHub')
  .action(loginCommand)

program
  .command('logout')
  .description('Log out and invalidate your session')
  .action(logoutCommand)

program
  .command('whoami')
  .description('Show currently logged-in user')
  .action(whoamiCommand)

// ── Profiles subcommand group ──────────────────────────────────────────────
const profiles = program.command('profiles').description('Manage profiles')
profilesCommand(profiles)

program.parseAsync(process.argv)