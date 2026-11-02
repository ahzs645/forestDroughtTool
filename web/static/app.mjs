import { DEFAULT_SOILS, MODEL_INFO, MAX_CLIMATE_CSV_BYTES, createExampleClimateCsv, simulationSummaryCsv, simulationDailyCsv } from './lib/model/index.js'

const $ = (id) => document.getElementById(id)
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])
let climateText = '', inputName = '', scenarioData = [], result = null, runInput = null, worker = null, generation = 0, fileGeneration = 0, scenarioGeneration = 0
$('validation').textContent = MODEL_INFO.validation
$('soils').innerHTML = DEFAULT_SOILS.map((soil, index) => `<tr><td>${escape(soil.label)}</td>${['afc', 'awsc', 'infiltrationRate'].map((field) => `<td><input aria-label="${escape(soil.label)} ${field}" data-index="${index}" data-field="${field}" type="number" step="any" value="${soil[field]}" required></td>`).join('')}</tr>`).join('')

function download(text, filename, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function stop() {
  generation++
  worker?.terminate(); worker = null
  $('cancel').hidden = true
  $('run').disabled = !climateText
}
function invalidate() {
  stop(); result = null; runInput = null; $('results').hidden = true; $('error').hidden = true
  $('status').textContent = climateText ? 'Inputs changed. Run to calculate these settings.' : 'Choose a climate file or load the demonstration.'
}
function error(message) { $('error').textContent = message; $('error').hidden = false }
function setClimate(text, name) {
  climateText = text; inputName = name; invalidate()
  $('input-info').textContent = `${name} · ${Math.round(new TextEncoder().encode(text).byteLength / 1024)} KB · held on this device`
}
$('climate').addEventListener('change', async () => {
  const id = ++fileGeneration, file = $('climate').files?.[0]
  climateText = ''; invalidate(); $('input-info').textContent = 'Reading local climate file…'
  if (!file) { $('input-info').textContent = 'No climate file selected.'; return }
  if (file.size > MAX_CLIMATE_CSV_BYTES) { error(`Climate CSV must be at most ${MAX_CLIMATE_CSV_BYTES / 1_000_000} MB.`); return }
  try { const text = await file.text(); if (id === fileGeneration) setClimate(text, file.name) }
  catch (e) { if (id === fileGeneration) error(`Could not read climate file: ${e.message}`) }
})
$('demo').onclick = () => { fileGeneration++; $('climate').value = ''; setClimate(createExampleClimateCsv(), 'Synthetic demonstration — not observed station data') }
$('template').onclick = () => download(createExampleClimateCsv(), 'synthetic-climate-example.csv')
$('scenario-template').onclick = () => download(JSON.stringify([{ id: 'monthly-example', label: 'User-defined monthly climate sensitivity', monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, tminDelta: 2, tmaxDelta: 2, precipMultiplier: i >= 4 && i <= 8 ? 0.85 : 1 })) }], null, 2), 'monthly-scenarios.json', 'application/json')
$('scenario-file').onchange = async () => {
  const id = ++scenarioGeneration, file = $('scenario-file').files?.[0]; scenarioData = []; invalidate()
  if (!file) return
  if (file.size > 100_000) { error('Monthly scenario JSON must be at most 100 KB.'); return }
  try {
    const parsed = JSON.parse(await file.text())
    if (id !== scenarioGeneration) return
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 9) throw new Error('Provide an array of 1 to 9 scenarios; see the downloadable template.')
    scenarioData = parsed; $('scenario-info').textContent = `${parsed.length} monthly scenarios loaded from ${file.name}. Uniform adjustments are ignored.`
  } catch (e) { if (id === scenarioGeneration) { $('scenario-info').textContent = 'Invalid scenario file. Correct it or clear monthly scenarios.'; error(e.message) } }
}
$('clear-scenarios').onclick = () => { scenarioGeneration++; scenarioData = []; $('scenario-file').value = ''; $('scenario-info').textContent = 'Uniform adjustments are used when nonzero.'; invalidate() }
for (const element of document.querySelectorAll('select,input[type=number]')) element.addEventListener('input', invalidate)
$('cancel').onclick = () => { stop(); $('status').textContent = 'Calculation cancelled. No partial result is displayed.' }

function readOptions() {
  const soils = DEFAULT_SOILS.map((soil) => ({ ...soil }))
  for (const input of $('soils').querySelectorAll('input')) {
    if (!input.value.trim()) throw new Error('Every soil parameter is required.')
    soils[Number(input.dataset.index)][input.dataset.field] = Number(input.value)
  }
  const delta = Number($('warming').value), multiplier = Number($('precip').value)
  if (!$('warming').value.trim() || !$('precip').value.trim() || !Number.isFinite(delta) || !Number.isFinite(multiplier)) throw new Error('Enter finite scenario adjustments.')
  if ($('scenario-file').files?.length && !scenarioData.length) throw new Error('Correct the monthly scenario file, or clear it before running.')
  const scenarios = scenarioData.length ? scenarioData : delta !== 0 || multiplier !== 1 ? [{ id: 'user-adjustment', label: `User sensitivity: ${delta} °C; precipitation ×${multiplier}`, monthly: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, tminDelta: delta, tmaxDelta: delta, precipMultiplier: multiplier })) }] : []
  return { latitude: Number($('latitude').value), summaryPolicy: $('policy').value, soils, scenarios }
}
$('setup').onsubmit = (event) => {
  event.preventDefault(); if (!climateText) return
  invalidate()
  try {
    const options = readOptions(), id = ++generation
    runInput = { schema: 'forest-drought-browser-run-v1', climateName: inputName, climateCsv: climateText, options }
    worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' })
    $('run').disabled = true; $('cancel').hidden = false; $('status').textContent = 'Calculating daily water balance on this device…'
    worker.onmessage = ({ data }) => {
      if (data.id !== generation) return
      stop()
      if (data.error) { error(data.error); $('status').textContent = 'Inputs need attention.'; return }
      result = data.result; renderResults(); $('status').textContent = 'Calculation complete.'
    }
    worker.onerror = (event) => { if (id === generation) { stop(); error(event.message || 'The calculation worker could not start.'); $('status').textContent = 'Calculation failed.' } }
    worker.postMessage({ id, text: climateText, options })
  } catch (e) { stop(); error(e.message); $('status').textContent = 'Inputs need attention.' }
}
function renderResults() {
  if (!result) return
  $('result-info').textContent = `${result.years.join(', ')} · ${result.baseline.daily.length.toLocaleString()} days · ${result.summaryPolicy} summaries · ${result.latitude}° N lookup · ${inputName}`
  const scenarios = [result.baseline, ...result.scenarios]
  $('summary').innerHTML = `<table><caption>Mean daily AET/PET, summarized with the selected weighting policy</caption><thead><tr><th>Climate</th>${result.soils.map((soil) => `<th>${escape(soil.label)}</th>`).join('')}</tr></thead><tbody>${scenarios.map((scenario) => `<tr><td>${escape(scenario.label)}</td>${scenario.summary.map((soil) => `<td>${soil.meanRatio.toFixed(6)} <span class="hint">${escape(soil.asmrClass ?? 'Unclassified')}</span></td>`).join('')}</tr>`).join('')}</tbody></table>`
  $('monthly').innerHTML = `<table><caption>Baseline calendar-month means across the supplied years</caption><thead><tr><th>Month</th>${result.soils.map((soil) => `<th>${escape(soil.label)}</th>`).join('')}</tr></thead><tbody>${result.baseline.monthly.map((month) => `<tr><td>${new Date(Date.UTC(2020, month.month - 1, 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' })}</td>${month.soils.map((soil) => `<td>${soil.meanRatio.toFixed(6)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  $('warnings').replaceChildren(...result.warnings.map((warning) => { const li = document.createElement('li'); li.textContent = warning; return li }))
  const colors = ['#a46122', '#a08125', '#63946a', '#267364', '#174f72']
  const rows = result.baseline.monthly, values = rows.flatMap((row) => row.soils.map((soil) => soil.meanRatio))
  const low = Math.min(0, ...values), high = Math.max(1, ...values), x = (month) => 55 + (month - 1) * 65, y = (value) => 250 - ((value - low) / (high - low)) * 210
  $('chart').innerHTML = `<svg viewBox="0 0 800 290" role="img" aria-label="Baseline monthly AET/PET ratios. Exact values appear in the following table.">${Array.from({ length: 5 }, (_, i) => { const value = low + (high - low) * i / 4; return `<line class="gridline" x1="55" x2="770" y1="${y(value)}" y2="${y(value)}"/><text x="8" y="${y(value) + 4}">${value.toFixed(2)}</text>` }).join('')}${rows.map((row) => `<text text-anchor="middle" x="${x(row.month)}" y="276">${row.month}</text>`).join('')}${result.soils.map((soil, i) => `<polyline fill="none" stroke="${colors[i]}" stroke-width="2.5" points="${rows.map((row) => `${x(row.month)},${y(row.soils[i].meanRatio)}`).join(' ')}"><title>${escape(soil.label)}</title></polyline>`).join('')}</svg><p class="hint">Month (1–12). Line order: ${result.soils.map((soil) => escape(soil.label)).join(' · ')}. Use the table for exact values.</p>`
  $('results').hidden = false
}
$('export-summary').onclick = () => result && download(simulationSummaryCsv(result), 'forest-drought-summary.csv')
$('export-daily').onclick = () => result && download(simulationDailyCsv(result), 'forest-drought-baseline-daily.csv')
$('export-json').onclick = () => result && download(JSON.stringify({ ...runInput, result }, null, 2), 'forest-drought-run.json', 'application/json')
window.addEventListener('pagehide', stop)
