// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { runAltiumBenchmarks } from '../benchmarks/AltiumConvergenceBenchmark.mjs'

const report = await runAltiumBenchmarks({
    quick: process.argv.includes('--quick')
})
process.stdout.write(`${JSON.stringify(report)}\n`)
if (!report.passed) process.exitCode = 1
