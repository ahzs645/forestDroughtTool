import { parseClimateCsv, runSimulation } from './lib/model/index.js'
self.onmessage = ({ data }) => {
  try {
    const climate = parseClimateCsv(data.text)
    const result = runSimulation({ climate, ...data.options })
    self.postMessage({ id: data.id, result })
  } catch (error) {
    self.postMessage({ id: data.id, error: error instanceof Error ? error.message : String(error) })
  }
}
