# forestDroughtTool in the browser

This fork adds a TypeScript implementation and a static browser interface while
retaining the original R package and its history. No application server, API key,
R installation, or Wasm download is needed by the browser. Climate uploads and
scenario inputs are processed locally in a cancellable Web Worker.

## Run or build

```sh
cd web
npm ci
npm run build
npm test
cd ..
python3 -m http.server 8000
```

Open `http://localhost:8000/docs/`. The generated `docs/` directory can be served
by any static host. GitHub Pages can serve the `master` branch's `/docs` folder.
The committed build is deterministic and CI checks it against the source.

## Inputs and output

Import a CSV with `date,tmn,tmx,ppt`, using ISO dates, degrees Celsius, and
millimetres of precipitation per day. Complete, ordered, continuous calendar
years are required. The browser rejects missing observations instead of
silently reproducing the older cleaning function's interpolation error.

Choose the 50°, 55°, or 60° latitude lookup, edit the five soil parameter sets,
and choose explicit equal-month or day-weighted summaries. Climate sensitivity
scenarios can use a uniform temperature delta and precipitation multiplier or
a local JSON array of up to nine twelve-month anomaly sets. They are labelled
user assumptions and are not presented as official ClimateBC projections.

The results include daily water balance, calendar-month means, annual summaries,
legacy ASMR classes, original parameter values, and upstream commit provenance.
Downloads provide summary CSV, daily baseline CSV, and a JSON record containing
both inputs and results. The synthetic demonstration is labelled as synthetic.

## Numerical validation

`scripts/reference` contains the unchanged pinned R kernel, original binary
soil/class datasets, deterministic input generation, and a comparison program.
The GitHub workflow runs the compiled browser engine against actual R for all
three latitude lookups, with seasonal/leap-year, wet, dry, freezing, and lateral
flow cases. See `METHOD.md` and the workflow results for the current evidence.

To reproduce the comparison locally after building (R needs dplyr and tidyr):

```sh
node scripts/reference/create-inputs.mjs /tmp/forest-drought-cases
Rscript scripts/reference/generate-reference.R scripts/reference /tmp/forest-drought-cases /tmp/forest-drought-reference
node scripts/reference/compare-reference.mjs "$PWD/../docs/lib/model/index.js" /tmp/forest-drought-cases /tmp/forest-drought-reference
```

Matching these cases establishes numerical agreement for the tested kernel
inputs. It does not validate the model scientifically at a new site or reproduce
the newer forDRAT preparation workflow.

## Reuse and source ownership

The dependency-free implementation is in `src/model/`. After build, import the
ES modules from `docs/lib/model/index.js`. PGMaps mirrors these source files
under `src/features/forest-drought/model/` with a pinned fork revision and file
hashes; its integration checks prevent silent drift. Change the fork source,
run both validation suites, and update the PGMaps snapshot deliberately.

The published-data explorer is a separate fork:
<https://github.com/ahzs645/forDRAT>. This calculator does not overwrite or
reclassify the published estimates. Upstream model pin:
`e02ddcbf8203e65bada1a36655887e1d0c8fe2f5`.

## Licence

Copyright 2019 Province of British Columbia; browser adaptation 2026.
Apache-2.0, as retained in the repository's original `LICENSE` and the browser
distribution. Modified files identify the adaptation. See `static/NOTICE.md`.
