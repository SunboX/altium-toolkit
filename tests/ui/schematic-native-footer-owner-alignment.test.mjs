// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'

import { SchematicSvgRenderer } from '../../src/convergence/SchematicSvgRenderer.mjs'

/**
 * Verifies a seeded native footer keeps every primitive owned by the same
 * authored assembly under one right-edge translation.
 */
test('renderSchematicSvg applies the footer translation to every primitive in its owner group', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Grouped native footer' },
        schematic: {
            sheet: {
                width: 1654,
                height: 830,
                sourceWidth: 1550,
                sourceHeight: 830,
                marginWidth: 20,
                borderOn: true,
                titleBlockOn: false,
                paperSize: 'A3'
            },
            lines: [
                {
                    x1: 1160,
                    y1: 80,
                    x2: 1530,
                    y2: 80,
                    color: '#000000',
                    width: 1,
                    ownerIndex: 'footer-owner'
                },
                {
                    x1: 1160,
                    y1: 180,
                    x2: 1530,
                    y2: 180,
                    color: '#000000',
                    width: 1,
                    ownerIndex: 'footer-owner'
                },
                {
                    x1: 900,
                    y1: 180,
                    x2: 980,
                    y2: 180,
                    color: '#000000',
                    width: 1,
                    ownerIndex: 'content-owner'
                },
                {
                    x1: 1400,
                    y1: 100,
                    x2: 1500,
                    y2: 100,
                    color: '#000000',
                    width: 1,
                    ownerIndex: 'secondary-footer-owner'
                },
                {
                    x1: 1000,
                    y1: 200,
                    x2: 1100,
                    y2: 200,
                    color: '#000000',
                    width: 1,
                    ownerIndex: 'secondary-footer-owner'
                }
            ],
            texts: [
                {
                    x: 1165,
                    y: 165,
                    text: 'NEUTRAL FOOTER',
                    color: '#000000',
                    ownerIndex: 'footer-owner'
                }
            ],
            images: [
                {
                    x: 1395,
                    y: 120,
                    cornerX: 1525,
                    cornerY: 160,
                    mimeType: 'image/png',
                    dataBase64: 'AAAA',
                    ownerIndex: 'footer-owner'
                }
            ],
            components: [],
            pins: [],
            ports: [],
            crosses: []
        }
    })
    const nativeFooterStart = markup.indexOf(
        '<g class="schematic-native-footer"'
    )
    const nativeFooterEnd = markup.indexOf('</g>', nativeFooterStart)
    const contentMarkup = markup.slice(0, nativeFooterStart)
    const nativeFooterMarkup = markup.slice(nativeFooterStart, nativeFooterEnd)

    assert.notEqual(nativeFooterStart, -1)
    assert.notEqual(nativeFooterEnd, -1)
    assert.match(nativeFooterMarkup, /transform="translate\(104 0\)"/u)
    assert.match(
        nativeFooterMarkup,
        /<line x1="1160" y1="750" x2="1530" y2="750"/u
    )
    assert.match(contentMarkup, /<line x1="1264" y1="650" x2="1634" y2="650"/u)
    assert.match(contentMarkup, /x="1269"[^>]*>NEUTRAL FOOTER<\/text>/u)
    assert.match(
        contentMarkup,
        /<image class="schematic-embedded-image" x="1499" y="670"/u
    )
    assert.match(contentMarkup, /<line x1="1104" y1="630" x2="1204" y2="630"/u)
    assert.match(contentMarkup, /<line x1="900" y1="650" x2="980" y2="650"/u)
    assert.doesNotMatch(
        nativeFooterMarkup,
        /<line x1="900" y1="650" x2="980" y2="650"/u
    )
})
