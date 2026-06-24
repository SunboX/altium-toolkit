import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dPackages } from '../../src/ui/PcbScene3dPackages.mjs'

/**
 * Rounds one mil value for stable dimension assertions.
 * @param {number} value Source dimension.
 * @returns {number}
 */
function roundMil(value) {
    return Math.round(Number(value || 0) * 1000) / 1000
}

test('PcbScene3dPackages uses explicit package length and width metadata', () => {
    const body = PcbScene3dPackages.resolve(
        {
            pattern: 'GENERIC_RF_SHIELD_COVER',
            height: 40,
            parameters: {
                Length: '16mm',
                Width: '12mm'
            }
        },
        { width: 160, depth: 120 }
    )

    assert.equal(roundMil(body.sizeMil.width), 629.921)
    assert.equal(roundMil(body.sizeMil.depth), 472.441)
    assert.equal(body.sizeMil.height, 40)
})
