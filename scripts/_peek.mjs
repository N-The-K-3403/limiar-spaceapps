import fs from 'node:fs'
const root = new URL('../../', import.meta.url)
const rd = (p) => fs.readFileSync(new URL(p, root), 'utf8')
const cat = JSON.parse(rd('data/investigations_catalog.json'))
for (const i of cat) {
  console.log(
    [i.psi_id, i.acronym, i.type, i.pillar_seed, '|', (i.hardware || '').slice(0, 40), '|', (i.flight || '').slice(0, 30), '| pubs', Array.isArray(i.publications) ? i.publications.length : typeof i.publications, '| table', i.experimental_table ? 'y' : 'n', '| files', i.n_files, JSON.stringify(i.file_ext_counts)].join(' '),
  )
}
console.log('\nPUBLICATION sample', JSON.stringify(cat[0].publications).slice(0, 600))
console.log('EXPTABLE sample', JSON.stringify(cat[0].experimental_table).slice(0, 400))
console.log('\n== psi_index.csv')
console.log(rd('data/psi_index.csv').split(/\r?\n/).slice(0, 27).join('\n'))
console.log('\ntitles of last 8:', cat.slice(-8).map((i) => i.psi_id + ' ' + i.title.slice(0, 80)).join('\n'))
