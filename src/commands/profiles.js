import ora from 'ora'
import chalk from 'chalk'
import { createWriteStream } from 'fs'
import { join } from 'path'
import { apiFetch } from '../utils/api.js'
import { printProfilesTable, printProfileDetail, printPagination } from '../utils/display.js'

export function profilesCommand(profiles) {

  // ── list ────────────────────────────────────────────────────────────────────
  profiles
    .command('list')
    .description('List profiles with optional filters')
    .option('--gender <gender>', 'Filter by gender (male|female)')
    .option('--country <code>', 'Filter by ISO country code (e.g. NG)')
    .option('--age-group <group>', 'Filter by age group (child|teenager|adult|senior)')
    .option('--min-age <n>', 'Minimum age')
    .option('--max-age <n>', 'Maximum age')
    .option('--sort-by <field>', 'Sort field (name|age|gender|country_id|created_at)')
    .option('--order <dir>', 'Sort direction (asc|desc)', 'desc')
    .option('--page <n>', 'Page number', '1')
    .option('--limit <n>', 'Results per page', '10')
    .action(async (opts) => {
      const spinner = ora('Fetching profiles…').start()
      try {
        const params = new URLSearchParams()
        if (opts.gender)    params.set('gender', opts.gender)
        if (opts.country)   params.set('country_id', opts.country)
        if (opts.ageGroup)  params.set('age_group', opts.ageGroup)
        if (opts.minAge)    params.set('min_age', opts.minAge)
        if (opts.maxAge)    params.set('max_age', opts.maxAge)
        if (opts.sortBy)    params.set('sort_by', opts.sortBy)
        if (opts.order)     params.set('order', opts.order)
        params.set('page', opts.page)
        params.set('limit', opts.limit)

        const data = await apiFetch(`/api/profiles?${params}`)
        spinner.stop()
        printProfilesTable(data.data)
        printPagination(data)
      } catch (err) {
        spinner.fail(chalk.red(err.message))
        process.exit(1)
      }
    })

  // ── get ─────────────────────────────────────────────────────────────────────
  profiles
    .command('get <id>')
    .description('Get a profile by ID')
    .action(async (id) => {
      const spinner = ora('Fetching profile…').start()
      try {
        const data = await apiFetch(`/api/profiles/${id}`)
        spinner.stop()
        printProfileDetail(data.data)
      } catch (err) {
        spinner.fail(chalk.red(err.message))
        process.exit(1)
      }
    })

  // ── search ──────────────────────────────────────────────────────────────────
  profiles
    .command('search <query>')
    .description('Natural language search (e.g. "young males from nigeria")')
    .option('--page <n>', 'Page number', '1')
    .option('--limit <n>', 'Results per page', '10')
    .action(async (query, opts) => {
      const spinner = ora(`Searching for "${query}"…`).start()
      try {
        const params = new URLSearchParams({ q: query, page: opts.page, limit: opts.limit })
        const data = await apiFetch(`/api/profiles/search?${params}`)
        spinner.stop()
        printProfilesTable(data.data)
        printPagination(data)
      } catch (err) {
        spinner.fail(chalk.red(err.message))
        process.exit(1)
      }
    })

  // ── create ──────────────────────────────────────────────────────────────────
  profiles
    .command('create')
    .description('Create a new profile (admin only)')
    .requiredOption('--name <name>', 'Full name of the person')
    .action(async (opts) => {
      const spinner = ora(`Creating profile for "${opts.name}"…`).start()
      try {
        const data = await apiFetch('/api/profiles', {
          method: 'POST',
          body: JSON.stringify({ name: opts.name }),
        })
        spinner.stop()
        printProfileDetail(data.data)
        console.log(chalk.green('\n✅ Profile created.'))
      } catch (err) {
        spinner.fail(chalk.red(err.message))
        process.exit(1)
      }
    })

  // ── export ──────────────────────────────────────────────────────────────────
  profiles
    .command('export')
    .description('Export profiles to CSV')
    .option('--format <fmt>', 'Export format', 'csv')
    .option('--gender <gender>', 'Filter by gender')
    .option('--country <code>', 'Filter by ISO country code')
    .option('--age-group <group>', 'Filter by age group')
    .option('--min-age <n>', 'Minimum age')
    .option('--max-age <n>', 'Maximum age')
    .action(async (opts) => {
      const spinner = ora('Exporting profiles…').start()
      try {
        const params = new URLSearchParams({ format: opts.format })
        if (opts.gender)   params.set('gender', opts.gender)
        if (opts.country)  params.set('country_id', opts.country)
        if (opts.ageGroup) params.set('age_group', opts.ageGroup)
        if (opts.minAge)   params.set('min_age', opts.minAge)
        if (opts.maxAge)   params.set('max_age', opts.maxAge)

        const res = await apiFetch(`/api/profiles/export?${params}`, { raw: true })

        const contentDisposition = res.headers.get('content-disposition') || ''
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/)
        const filename = filenameMatch?.[1] || `profiles_export.csv`
        const outputPath = join(process.cwd(), filename)

        const fileStream = createWriteStream(outputPath)
        const reader = res.body.getReader()

        await new Promise((resolve, reject) => {
          function pump() {
            reader.read().then(({ done, value }) => {
              if (done) { fileStream.end(); resolve(); return }
              fileStream.write(Buffer.from(value))
              pump()
            }).catch(reject)
          }
          pump()
        })

        spinner.succeed(chalk.green(`Exported to ${chalk.bold(outputPath)}`))
      } catch (err) {
        spinner.fail(chalk.red(err.message))
        process.exit(1)
      }
    })
}