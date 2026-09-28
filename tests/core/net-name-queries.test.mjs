import assert from 'node:assert/strict'
import test from 'node:test'
import { LoadedDesignNetlistService } from 'altium-toolkit/extensions'

/** Builds a service with an unrelated active sheet and a selected test board. */
function createService(
    retained = false,
    nets = [{ name: 'SIGNAL_B' }, { name: 'SIGNAL_A' }]
) {
    const native = {
        sourceFormat: 'altium',
        fileName: 'query-board.PcbDoc',
        kind: 'pcb',
        summary: { title: 'Query Board' },
        pcb: { nets }
    }
    const documentModel = retained
        ? {
              schema: 'ecad-toolkit.document.v1',
              source: { format: 'altium', fileName: native.fileName },
              model: [],
              extensions: { altium: { native } }
          }
        : native
    return new LoadedDesignNetlistService({
        getDocuments: () => [
            {
                id: 'sheet',
                active: true,
                documentModel: {
                    kind: 'schematic',
                    summary: { title: 'Other Sheet' },
                    schematic: {
                        nets: [
                            {
                                name: 'OTHER_NET',
                                pins: [{ refdes: 'U1', designator: '1' }]
                            }
                        ]
                    }
                }
            },
            { id: 'board', documentModel }
        ]
    })
}

for (const retained of [false, true]) {
    test(`net listing reads the selected PCB net table (retained=${retained})`, () => {
        const service = createService(retained, [
            { name: ' SIGNAL_B ' },
            { name: 'SIGNAL_A' },
            { name: 'SIGNAL_A' },
            { name: '' },
            { name: '  ' },
            null
        ])
        assert.deepEqual(service.listNets({ design: 'board' }), {
            nets: ['SIGNAL_A', 'SIGNAL_B']
        })
        assert.deepEqual(service.listNets(), { nets: ['OTHER_NET'] })
        assert.equal(
            service.listDesigns().find((design) => design.id === 'board')
                .hasConnectivity,
            false
        )
        assert.match(
            service.queryXnetByNetName({
                design: 'board',
                net_name: 'SIGNAL_A'
            }).error,
            /No schematic connectivity/
        )
    })

    test(`net search uses the PCB names and preserves regex validation (retained=${retained})`, () => {
        const service = createService(retained)
        assert.deepEqual(
            service.searchNets({ design: 'board', pattern: 'signal_a$' }),
            {
                results: { 'Query Board': ['SIGNAL_A'] }
            }
        )
        assert.match(
            service.searchNets({ design: 'board', pattern: '[' }).error,
            /Invalid regex/
        )
        assert.match(
            service.searchNets({ design: 'board', pattern: '.*' }).error,
            /every net/
        )
        assert.deepEqual(
            service.searchNets({ design: 'board', pattern: 'ABSENT' }).results,
            {
                'Query Board': []
            }
        )
    })
}

test('schematic net names do not require attached component pins', () => {
    const service = new LoadedDesignNetlistService({
        getDocuments: () => [
            {
                id: 'sheet',
                documentModel: {
                    kind: 'schematic',
                    summary: { title: 'Query Sheet' },
                    schematic: {
                        nets: [
                            { name: 'NAMED_ONLY', pins: [] },
                            {
                                name: 'CONNECTED',
                                pins: [{ refdes: 'U1', designator: '1' }]
                            }
                        ]
                    }
                }
            }
        ]
    })
    assert.deepEqual(service.listNets(), { nets: ['CONNECTED', 'NAMED_ONLY'] })
    assert.deepEqual(service.searchNets({ pattern: '^NAMED' }), {
        results: { 'Query Sheet': ['NAMED_ONLY'] }
    })
    assert.match(
        service.queryXnetByNetName({ net_name: 'NAMED_ONLY' }).error,
        /not found/
    )
})

test('missing net data and unresolved selectors still return errors', () => {
    const service = createService(false, [])
    assert.match(
        service.listNets({ design: 'board' }).error,
        /No schematic connectivity/
    )
    assert.match(service.listNets({ design: 'missing' }).error, /did not match/)
})
