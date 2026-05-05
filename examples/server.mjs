// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DEFAULT_EXAMPLE_PATH = '/examples/arduino-uno/'
const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 4173
const CONTENT_TYPES = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.mjs', 'text/javascript; charset=utf-8'],
    ['.svg', 'image/svg+xml; charset=utf-8'],
    ['.txt', 'text/plain; charset=utf-8']
])

/**
 * Serves the browser examples with Node's built-in HTTP server.
 */
export class ExampleServer {
    /**
     * Reads default server options from the environment.
     * @param {NodeJS.ProcessEnv} env
     * @returns {{ host: string, port: number, rootDirectory: string }}
     */
    static defaultOptions(env = process.env) {
        return {
            host: env.HOST || DEFAULT_HOST,
            port: ExampleServer.#parsePort(env.PORT),
            rootDirectory: resolve(
                fileURLToPath(new URL('..', import.meta.url))
            )
        }
    }

    /**
     * Creates an HTTP request handler rooted at the repository directory.
     * @param {string} rootDirectory
     * @returns {import('node:http').RequestListener}
     */
    static createHandler(rootDirectory) {
        const root = resolve(rootDirectory)

        return async (request, response) => {
            const filePath = await ExampleServer.resolveRequestPath(
                root,
                request.url || '/'
            )

            if (!filePath) {
                ExampleServer.#writeResponse(response, 403, 'Forbidden')
                return
            }

            const fileStat = await stat(filePath).catch(() => null)
            if (!fileStat?.isFile()) {
                ExampleServer.#writeResponse(response, 404, 'Not found')
                return
            }

            response.writeHead(200, {
                'content-type': ExampleServer.getContentType(filePath)
            })
            createReadStream(filePath).pipe(response)
        }
    }

    /**
     * Resolves a request URL to a file inside the served root.
     * @param {string} rootDirectory
     * @param {string} requestUrl
     * @returns {Promise<string | null>}
     */
    static async resolveRequestPath(rootDirectory, requestUrl) {
        const parsedUrl = new URL(requestUrl, 'http://localhost')
        const pathname =
            parsedUrl.pathname === '/'
                ? DEFAULT_EXAMPLE_PATH
                : parsedUrl.pathname
        const requestedPath = ExampleServer.#resolveSafePath(
            rootDirectory,
            pathname
        )

        if (!requestedPath) return null

        const fileStat = await stat(requestedPath).catch(() => null)
        if (fileStat?.isDirectory()) {
            return join(requestedPath, 'index.html')
        }

        return requestedPath
    }

    /**
     * Returns a content type for a file path.
     * @param {string} filePath
     * @returns {string}
     */
    static getContentType(filePath) {
        return (
            CONTENT_TYPES.get(extname(filePath).toLowerCase()) ||
            'application/octet-stream'
        )
    }

    /**
     * Starts the local example server.
     * @param {{ host?: string, port?: number, rootDirectory?: string, logger?: Pick<Console, 'log'> }} options
     * @returns {Promise<{ server: import('node:http').Server, url: string, host: string, port: number, rootDirectory: string }>}
     */
    static async start(options = {}) {
        const defaults = ExampleServer.defaultOptions()
        const host = options.host || defaults.host
        const port = options.port ?? defaults.port
        const rootDirectory = options.rootDirectory || defaults.rootDirectory
        const logger = options.logger || console
        const server = createServer(ExampleServer.createHandler(rootDirectory))

        await new Promise((resolveStart, rejectStart) => {
            server.once('error', rejectStart)
            server.listen(port, host, () => {
                server.off('error', rejectStart)
                resolveStart()
            })
        })

        const address = server.address()
        const resolvedPort =
            typeof address === 'object' && address ? address.port : port
        const url = 'http://' + host + ':' + resolvedPort + DEFAULT_EXAMPLE_PATH

        logger.log('Serving Arduino Uno example at ' + url)

        return {
            server,
            url,
            host,
            port: resolvedPort,
            rootDirectory
        }
    }

    /**
     * Converts an environment port value into a listen port.
     * @param {string | undefined} value
     * @returns {number}
     */
    static #parsePort(value) {
        const port = Number(value || DEFAULT_PORT)
        if (!Number.isInteger(port) || port < 0 || port > 65535) {
            throw new Error('PORT must be an integer from 0 through 65535.')
        }

        return port
    }

    /**
     * Resolves a request path without allowing directory traversal.
     * @param {string} rootDirectory
     * @param {string} pathname
     * @returns {string | null}
     */
    static #resolveSafePath(rootDirectory, pathname) {
        const root = resolve(rootDirectory)
        const decodedPath = decodeURIComponent(pathname)
        const normalizedPath = normalize('/' + decodedPath).replace(/^\/+/, '')
        const filePath = resolve(root, normalizedPath)
        const relativePath = relative(root, filePath)

        if (
            relativePath === '..' ||
            relativePath.startsWith('..' + sep) ||
            relativePath.startsWith('/')
        ) {
            return null
        }

        return filePath
    }

    /**
     * Writes a plain-text status response.
     * @param {import('node:http').ServerResponse} response
     * @param {number} status
     * @param {string} body
     * @returns {void}
     */
    static #writeResponse(response, status, body) {
        response.writeHead(status, {
            'content-type': 'text/plain; charset=utf-8'
        })
        response.end(body)
    }
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    ExampleServer.start().catch((error) => {
        console.error(error instanceof Error ? error.message : String(error))
        process.exitCode = 1
    })
}
