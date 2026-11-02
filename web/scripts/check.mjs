import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createExampleClimateCsv, parseClimateCsv, runSimulation, DEFAULT_SOILS, simulationSummaryCsv, simulationDailyCsv } from '../../docs/lib/model/index.js'

const climate = parseClimateCsv(createExampleClimateCsv())
assert(climate.length >= 365)
for (const latitude of [50, 55, 60]) {
  const result = runSimulation({ climate, latitude, summaryPolicy: 'equal-month' })
  assert.equal(result.baseline.daily.length, climate.length)
  assert.equal(result.baseline.monthly.length, 12)
  assert.equal(result.baseline.summary.length, 5)
  assert.equal(result.soils.length, DEFAULT_SOILS.length)
  assert(result.baseline.daily.every((day) => Number.isFinite(day.pet) && day.pet >= 0 && day.soils.every((soil) => Number.isFinite(soil.ratio))))
  assert(simulationSummaryCsv(result).includes('upstream_commit'))
  assert(simulationDailyCsv(result).includes('S5_AET_PET'))
}
assert.throws(() => parseClimateCsv('date,tmn,tmx,ppt\n2020-01-01,1,2,\n'), /precip|ppt|missing|empty|finite|numeric/i)
assert.throws(() => runSimulation({ climate: climate.slice(1), latitude: 55 }), /complete|January|year|start/i)
const wet = climate.map((day) => ({ ...day, tmn: 10, tmx: 20, ppt: 100 }))
const dry = wet.map((day) => ({ ...day, ppt: 0 }))
assert(runSimulation({ climate: wet, latitude: 55 }).baseline.summary[0].meanRatio > runSimulation({ climate: dry, latitude: 55 }).baseline.summary[0].meanRatio)
for (const name of ['index.html', 'app.mjs', 'worker.mjs', 'style.css']) assert(readFileSync(new URL(`../../docs/${name}`, import.meta.url)).length > 0)
console.log('Standalone checks passed: complete-year inputs, all latitude lookups, all five soils, water stress, exports and static assets.')
