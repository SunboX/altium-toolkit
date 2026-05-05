// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { AltiumParser } from '../core/altium/AltiumParser.mjs'

self.addEventListener('message', (event) => {
    const payload = event?.data || {}
    if (payload.type !== 'parse:file') return

    try {
        const documentModel = AltiumParser.parseArrayBuffer(
            String(payload.fileName || 'document'),
            payload.buffer
        )
        self.postMessage({
            type: 'parser:success',
            requestId: String(payload.requestId || ''),
            documentModel
        })
    } catch (error) {
        self.postMessage({
            type: 'parser:error',
            requestId: String(payload.requestId || ''),
            message:
                error instanceof Error ? error.message : 'Parser worker failed.'
        })
    }
})
