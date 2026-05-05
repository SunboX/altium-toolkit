import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/**
 * Verifies npm start serves the local Arduino example page.
 */
test('npm start serves the Arduino Uno example page', async (t) => {
    const packageJson = JSON.parse(
        await readFile(resolve(REPO_ROOT, 'package.json'), 'utf8')
    )

    assert.equal(packageJson.scripts.start, 'node examples/server.mjs')

    const child = spawn('npm', ['start'], {
        cwd: REPO_ROOT,
        env: {
            ...process.env,
            PORT: '0'
        },
        stdio: ['ignore', 'pipe', 'pipe']
    })

    t.after(async () => {
        await stopProcess(child)
    })

    const url = await readReadyUrl(child)
    const response = await fetch(url)
    const body = await response.text()

    assert.equal(response.status, 200)
    assert.match(body, /Arduino Uno design viewer/)
    assert.match(body, /Mehdi KHALFALLAH/)
})

/**
 * Reads the server URL from npm start output.
 * @param {import('node:child_process').ChildProcessWithoutNullStreams} child
 * @returns {Promise<string>}
 */
async function readReadyUrl(child) {
    let output = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    return await new Promise((resolveReadyUrl, rejectReadyUrl) => {
        const timer = setTimeout(() => {
            rejectReadyUrl(
                new Error(
                    'Timed out waiting for example server. stdout=' +
                        output +
                        ' stderr=' +
                        stderr
                )
            )
        }, 5000)

        /**
         * Resolves the URL once the server announces readiness.
         * @param {string} chunk
         * @returns {void}
         */
        const handleOutput = (chunk) => {
            output += chunk
            const match = output.match(
                /http:\/\/127\.0\.0\.1:\d+\/examples\/arduino-uno\//
            )
            if (!match) return

            clearTimeout(timer)
            resolveReadyUrl(match[0])
        }

        child.stdout.on('data', handleOutput)
        child.stderr.on('data', (chunk) => {
            stderr += chunk
        })
        child.once('exit', (code) => {
            clearTimeout(timer)
            rejectReadyUrl(
                new Error(
                    'Example server exited before readiness with code ' +
                        code +
                        '. ' +
                        stderr
                )
            )
        })
    })
}

/**
 * Stops a child process and waits for it to exit.
 * @param {import('node:child_process').ChildProcessWithoutNullStreams} child
 * @returns {Promise<void>}
 */
async function stopProcess(child) {
    if (child.exitCode !== null || child.signalCode !== null) return

    child.kill('SIGTERM')
    await once(child, 'exit')
}
