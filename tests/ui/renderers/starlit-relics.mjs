import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { AltiumFixtureLoader } from '../../fixtures/AltiumFixtureLoader.mjs'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'
import { BomTableRenderer } from '../../../src/ui/BomTableRenderer.mjs'
import { PcbSvgRenderer } from '../../../src/ui/PcbSvgRenderer.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies the moon sheet renders WYRN6 pin numbers outside the body and
 * restores missing WYRN29/WYRN31 gate pin numbers.
 */
test('renderSchematicSvg aligns moon-sheet pin number and name columns', async () => {
    const documentModel = await AltiumFixtureLoader.parseMoonSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /text class="schematic-pin-number" x="453" y="261" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">1</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="459" y="265" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">GND</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="601" y="265" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">GND</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="379" y="615" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">A</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="431" y="615" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">VCC</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="624" y="625" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">A</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="676" y="625" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">VCC</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="618" y="621" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">1</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="682" y="621" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">5</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="373" y="611" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">1</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="437" y="611" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">5</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="483" y="419" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 483 419\)">15</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="499" y="408" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 499 408\)">IO13</
    )
    assert.match(
        markup,
        /text class="schematic-label" x="619" y="603" fill="var\(--schematic-default-ink-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">KITE29</
    )
    assert.match(
        markup,
        /text class="schematic-label" x="715" y="622" fill="var\(--schematic-default-ink-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">ORB187</
    )
    assert.match(
        markup,
        /text class="schematic-label" x="974" y="583" fill="var\(--schematic-default-ink-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">PIER5</
    )
})

/**
 * Verifies the moon-sheet SIGIL12 diode symbol includes the triangle body
 * linework from the source polygon primitive.
 */
test('renderSchematicSvg renders the moon SIGIL12 diode triangle', async () => {
    const documentModel = await AltiumFixtureLoader.parseMoonSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /<line x1="217" y1="589" x2="233" y2="589" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" \/>/
    )
    assert.match(
        markup,
        /<line x1="233" y1="589" x2="225" y2="573" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" \/>/
    )
    assert.match(
        markup,
        /<line x1="225" y1="573" x2="217" y2="589" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" \/>/
    )
})

/**
 * Verifies non-mirrored `Orientation=3` texts keep their existing clockwise
 * flow so mirrored owner-side pin-name fixes do not flip ordinary labels.
 */
test('renderSchematicSvg keeps cinder-sheet non-mirrored orientation-3 labels clockwise', async () => {
    const documentModel = await AltiumFixtureLoader.parseCinderSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /<text class="schematic-label" x="415" y="794" fill="var\(--schematic-default-ink-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(90 415 794\)">SIGIL24</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="415" y="844" fill="var\(--schematic-default-ink-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(90 415 844\)">4K7</
    )
})

/**
 * Verifies the nova sheet renders one copy of each visible WYRN2 section
 * and includes the multipart body outlines recovered from record 6.
 */
test('renderSchematicSvg restores multipart WYRN2 bodies on the nova sheet', async () => {
    const documentModel = await AltiumFixtureLoader.parseNovaSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal((markup.match(/>Rune Gate</g) || []).length, 1)
    assert.equal((markup.match(/>Cinder Well</g) || []).length, 1)
    assert.equal((markup.match(/>Nova \/ Echo</g) || []).length, 1)
    assert.match(
        markup,
        /<line x1="670" y1="369" x2="670" y2="159" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" \/>/
    )
    assert.match(
        markup,
        /<line x1="280" y1="519" x2="280" y2="189" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" \/>/
    )
    assert.match(markup, />A3</)
    assert.match(markup, />Sheet 5 of 6</)
})

/**
 * Verifies nova-sheet text records beyond the old 300-item truncation limit still
 * render in the SVG output.
 */
test('renderSchematicSvg keeps late nova-sheet labels beyond the old text cap', async () => {
    const documentModel = await AltiumFixtureLoader.parseNovaSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(markup, />WYRN9</)
    assert.match(markup, />WYRN11</)
    assert.match(markup, />NOVA_SEND</)
    assert.match(markup, />LYRA_LINK</)
})

/**
 * Verifies nova-sheet note/comment records render as boxed multiline callouts.
 */
test('renderSchematicSvg renders the nova-sheet mode note as a boxed multiline callout', async () => {
    const documentModel = await AltiumFixtureLoader.parseNovaSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(markup, /class="schematic-note"/)
    assert.match(markup, />RY1 \| RY0: sampled at dawn\.</)
    assert.match(markup, />Glyph core reads tone on OSC1</)
    assert.match(markup, />\| 10--&gt;Star Chime    \|</)
})

/**
 * Verifies record-28 wrapped notes reuse the note-box renderer instead of
 * falling back to one long plain text label.
 */
test('renderSchematicSvg renders record-28 notes as boxed multiline callouts', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Record-28 note schematic' },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [],
            texts: [
                {
                    x: 20,
                    y: 20,
                    text: '*NOTE:\n1)Alpha\n2)Beta',
                    color: '#ff0000',
                    hidden: false,
                    recordType: '28',
                    style: 0,
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 0,
                    anchor: 'start',
                    cornerX: 120,
                    cornerY: 60,
                    fill: '#ffffff',
                    borderColor: '#c0c0c0',
                    isSolid: true,
                    showBorder: false,
                    textMargin: 4,
                    noteLines: ['*NOTE:', '1)Alpha', '2)Beta']
                }
            ],
            components: [],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.match(markup, /class="schematic-note"/)
    assert.match(
        markup,
        /<rect class="schematic-note-box" x="20" y="40" width="100" height="40" fill="var\(--schematic-fill-light-color\)" stroke="none" \/>/
    )
    assert.match(markup, />\*NOTE:</)
    assert.match(markup, />1\)Alpha</)
    assert.match(markup, />2\)Beta</)
    assert.doesNotMatch(markup, /class="schematic-label"[^>]*>\*NOTE:/)
})

/**
 * Verifies note text wraps to the available box width instead of overflowing
 * as one long SVG text line.
 */
test('renderSchematicSvg wraps note rows to the note box width', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Wrapped note schematic' },
        schematic: {
            sheet: { width: 200, height: 120 },
            lines: [],
            texts: [
                {
                    x: 20,
                    y: 20,
                    text: 'Alpha Beta Gamma Delta',
                    color: '#ff0000',
                    hidden: false,
                    recordType: '28',
                    style: 0,
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 0,
                    anchor: 'start',
                    cornerX: 90,
                    cornerY: 80,
                    fill: '#ffffff',
                    borderColor: '#c0c0c0',
                    isSolid: true,
                    showBorder: false,
                    textMargin: 4,
                    noteLines: ['Alpha Beta Gamma Delta']
                }
            ],
            components: [],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.match(markup, />Alpha Beta</)
    assert.match(markup, />Gamma Delta</)
    assert.doesNotMatch(markup, />Alpha Beta Gamma Delta</)
})

/**
 * Verifies dashed schematic guide frames keep their stroke pattern in the
 * rendered SVG.
 */
test('renderSchematicSvg keeps dashed module frames dashed', async () => {
    const documentModel = await AltiumFixtureLoader.parseCinderSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(markup, /stroke-dasharray=/)
})

/**
 * Verifies the nova-sheet boot labels keep reading rightward from the port.
 */
test('renderSchematicSvg keeps nova-sheet boot wire labels anchored to the right', async () => {
    const documentModel = await AltiumFixtureLoader.parseNovaSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /<text class="schematic-label" x="1075" y="139" fill="var\(--schematic-power-color\)" text-anchor="start"[^>]*>WYRD</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="1075" y="149" fill="var\(--schematic-power-color\)" text-anchor="start"[^>]*>CHRD</
    )
})

/**
 * Verifies the nova block renders multipart unit suffixes, readable
 * decoded pin names, and the crystal pin numbers shown in Altium.
 */
test('renderSchematicSvg restores nova-sheet multipart suffixes and CHIME2 crystal pin numbers', async () => {
    const documentModel = await AltiumFixtureLoader.parseNovaSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(markup, />WYRN2A</)
    assert.match(markup, />WYRN2B</)
    assert.match(markup, />WYRN2J</)
    assert.doesNotMatch(markup, />WYRN2</)
    assert.match(markup, />VEIL_RST</)
    assert.doesNotMatch(markup, /\\R\\S\\T\\/)
    assert.match(
        markup,
        /text class="schematic-pin-number" x="163" y="773" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">1</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="187" y="773" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">3</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="193" y="748" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 193 748\)">2</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="203" y="748" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 203 748\)">4</
    )
})

/**
 * Verifies nova-sheet EMBER12 renders as the filled dual-row package from the
 * Altium reference instead of a diagonal line with partial labels.
 */
test('renderSchematicSvg renders the nova-sheet EMBER12 package body and both pin rows', async () => {
    const documentModel = await AltiumFixtureLoader.parseNovaSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /<rect class="schematic-rectangle" x="1210" y="284" width="60" height="60" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" stroke-width="1" \/>/
    )
    assert.doesNotMatch(
        markup,
        /<line x1="1210" y1="344" x2="1270" y2="284" stroke="var\(--schematic-power-color\)" stroke-width="1" \/>/
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="1220" y="288" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 1220 288\)">I\/O4</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="1240" y="288" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 1240 288\)">VDD</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="1260" y="288" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 1260 288\)">I\/O3</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="1224" y="340" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 1224 340\)">I\/O1</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="1244" y="340" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 1244 340\)">GND</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="1264" y="340" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 1264 340\)">I\/O2</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="1218" y="278" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="9" font-family="Times New Roman" font-weight="400">6</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="1238" y="278" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="9" font-family="Times New Roman" font-weight="400">5</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="1258" y="278" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="9" font-family="Times New Roman" font-weight="400">4</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="1218" y="351" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 1218 351\)">1</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="1238" y="351" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 1238 351\)">2</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="1258" y="351" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 1258 351\)">3</
    )
})

/**
 * Verifies the nova-sheet EMBER12 ground power port falls back to the default
 * downward ground symbol instead of treating ground orientation 3 like a
 * right-facing rail direction.
 */
test('renderSchematicSvg keeps the nova-sheet EMBER12 ground power port downward', async () => {
    const documentModel = await AltiumFixtureLoader.parseNovaSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /<g class="schematic-power-port schematic-power-port--ground" stroke-linecap="round"><line x1="1240" y1="354" x2="1240" y2="361" stroke="var\(--schematic-power-color\)" \/><line x1="1233" y1="361" x2="1247" y2="361" stroke="var\(--schematic-power-color\)" \/><line x1="1235" y1="364" x2="1245" y2="364" stroke="var\(--schematic-power-color\)" \/><line x1="1237" y1="367" x2="1243" y2="367" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.doesNotMatch(
        markup,
        /<g class="schematic-power-port schematic-power-port--ground" stroke-linecap="round"><line x1="1240" y1="354" x2="1247" y2="354" stroke="var\(--schematic-power-color\)" \/><line x1="1247" y1="347" x2="1247" y2="361" stroke="var\(--schematic-power-color\)"/
    )
})

/**
 * Verifies the nova-sheet inductors emit visible arc paths for their coil bodies.
 */
test('renderSchematicSvg renders the nova-sheet inductor coils as SVG arcs', async () => {
    const documentModel = await AltiumFixtureLoader.parseNovaSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal(
        (markup.match(/class="schematic-arc"/g) || []).length >= 3,
        true
    )
})

/**
 * Verifies the cinder-sheet dawn-sigil region matches the reference layout by keeping
 * the note heading centered, the mixed off-sheet port directions, and the
 * visible same-row wire labels.
 */
test('renderSchematicSvg matches the cinder-sheet dawn-sigil reference layout', async () => {
    const documentModel = await AltiumFixtureLoader.parseCinderSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /<text class="schematic-label" x="349" y="593" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="7" font-family="Times New Roman" font-weight="700">Needed for Dawn Sigil!</
    )
    assert.match(
        markup,
        /<line x1="289" y1="579" x2="409" y2="579" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" stroke-dasharray="8 5" stroke-linecap="round" \/>/
    )
    assert.match(
        markup,
        /<line x1="409" y1="579" x2="409" y2="645" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" stroke-dasharray="8 5" stroke-linecap="round" \/>/
    )
    assert.match(
        markup,
        /<line x1="409" y1="645" x2="289" y2="645" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" stroke-dasharray="8 5" stroke-linecap="round" \/>/
    )
    assert.match(
        markup,
        /<line x1="289" y1="645" x2="289" y2="579" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" stroke-dasharray="8 5" stroke-linecap="round" \/>/
    )
    assert.doesNotMatch(
        markup,
        /<line x1="260" y1="579" x2="515" y2="579" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" stroke-dasharray="8 5" stroke-linecap="round" \/>/
    )
    assert.match(
        markup,
        /<polygon points="280,679 288,674 330,674 330,684 288,684" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.match(
        markup,
        /<polygon points="280,684 322,684 330,689 322,694 280,694" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.match(
        markup,
        /<polygon points="280,694 322,694 330,699 322,704 280,704" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.match(
        markup,
        /<text class="schematic-port-label" x="309" y="681\.34" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="6\.50" font-family="Times New Roman" font-weight="400">GLYPH_CS</
    )
    assert.match(
        markup,
        /<text class="schematic-port-label" x="301" y="691\.34" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="6\.50" font-family="Times New Roman" font-weight="400">AURA_CS</
    )
    assert.match(
        markup,
        /<text class="schematic-port-label" x="301" y="701\.34" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="6\.50" font-family="Times New Roman" font-weight="400">AURA_IRQ</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="340" y="679" fill="var\(--schematic-power-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">GLYPH_CS</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="340" y="689" fill="var\(--schematic-power-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">AURA_CS</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="340" y="699" fill="var\(--schematic-power-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">AURA_IRQ</
    )
})

/**
 * Verifies mirrored free-text strings honor their decoded horizontal
 * justification in the final SVG output.
 */
test('renderSchematicSvg honors generic free-text justification anchors', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=500|CustomY=300|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=4|Location.X=200|Location.Y=220|Justification=2|Color=255|FontID=1|Text=DC 12V IN|IsMirrored=T',
        '|RECORD=4|Location.X=120|Location.Y=140|Justification=6|Color=8388608|FontID=1|Text=StandBy|IsMirrored=T'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'free-text-justification.SchDoc',
        arrayBuffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /<text class="schematic-label" x="200" y="40" fill="var\(--schematic-alert-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">DC 12V IN</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="120" y="120" fill="var\(--schematic-default-ink-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">StandBy</
    )
})

/**
 * Verifies opposite Altium rotated-text orientations emit opposite signed SVG
 * transforms instead of collapsing to the same vertical flow.
 */
test('renderSchematicSvg preserves opposite signed rotations for vertical texts', async () => {
    const moonDocument = await AltiumFixtureLoader.parseMoonSheet()
    const moonMarkup = SchematicSvgRenderer.render(moonDocument)
    const cinderDocument = await AltiumFixtureLoader.parseCinderSheet()
    const cinderMarkup = SchematicSvgRenderer.render(cinderDocument)

    assert.match(
        moonMarkup,
        /<text class="schematic-label" x="225" y="612" fill="var\(--schematic-default-ink-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 225 612\)">SIGIL12</
    )
    assert.match(
        moonMarkup,
        /<text class="schematic-label" x="995" y="552" fill="var\(--schematic-default-ink-color\)" text-anchor="start" font-size="21" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 995 552\)">WYRN</
    )
    assert.match(
        cinderMarkup,
        /<text class="schematic-label" x="415" y="794" fill="var\(--schematic-default-ink-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(90 415 794\)">SIGIL24</
    )
    assert.match(
        cinderMarkup,
        /<text class="schematic-label" x="415" y="844" fill="var\(--schematic-default-ink-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(90 415 844\)">4K7</
    )
})

/**
 * Verifies the cinder-sheet multipart resistor labels render with section suffixes,
 * while the nearby connector keeps its raw fantasy designator.
 */
test('renderSchematicSvg renders multipart resistor suffixes without suffixing the cinder-sheet connector', async () => {
    const documentModel = await AltiumFixtureLoader.parseCinderSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(markup, />SIGIL92A</)
    assert.match(
        markup,
        /<text class="schematic-label" x="934" y="235" fill="var\(--schematic-default-ink-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">SIGIL92B</
    )
    assert.match(markup, />SIGIL92C</)
    assert.match(markup, />SIGIL92D</)
    assert.match(markup, />PIER4</)
    assert.doesNotMatch(markup, />PIER4A</)
    assert.match(
        markup,
        /text class="schematic-pin-number" x="968" y="233" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">2</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="992" y="233" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">7</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="963" y="363" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">1</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="987" y="363" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">8</
    )
})
