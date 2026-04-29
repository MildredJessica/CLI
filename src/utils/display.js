import Table from 'cli-table3'
import chalk from 'chalk'

export function printProfilesTable(profiles) {
  if (!profiles.length) {
    console.log(chalk.yellow('No profiles found.'))
    return
  }

  const table = new Table({
    head: [
      chalk.bold('Name'),
      chalk.bold('Gender'),
      chalk.bold('Age'),
      chalk.bold('Group'),
      chalk.bold('Country'),
      chalk.bold('Created'),
    ],
    colWidths: [28, 10, 6, 12, 20, 14],
    style: { head: ['cyan'] },
  })

  for (const p of profiles) {
    table.push([
      p.name.length > 25 ? p.name.slice(0, 24) + '…' : p.name,
      p.gender,
      String(p.age),
      p.age_group,
      p.country_name,
      new Date(p.created_at).toLocaleDateString(),
    ])
  }

  console.log(table.toString())
}

export function printProfileDetail(p) {
  const table = new Table({ style: { head: ['cyan'] } })
  table.push(
    [chalk.bold('ID'), p.id],
    [chalk.bold('Name'), p.name],
    [chalk.bold('Gender'), `${p.gender} (${(p.gender_probability * 100).toFixed(1)}%)`],
    [chalk.bold('Age'), `${p.age} (${p.age_group})`],
    [chalk.bold('Country'), `${p.country_name} (${p.country_id}) — ${(p.country_probability * 100).toFixed(1)}%`],
    [chalk.bold('Created'), new Date(p.created_at).toLocaleString()]
  )
  console.log(table.toString())
}

export function printPagination({ page, total_pages, total, limit }) {
  console.log(
    chalk.dim(
      `\n  Page ${page} of ${total_pages} · ${total} total · ${limit}/page`
    )
  )
}