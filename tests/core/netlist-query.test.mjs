import assert from 'node:assert/strict'
import test from 'node:test'
import {
    CircuitTraversal,
    ComponentGrouping,
    LoadedDesignNetlistService,
    QueryNetlistBuilder,
    RegexPattern
} from 'altium-toolkit/netlist-query'

/**
 * Builds one fake schematic document.
 * @param {string} [fileName] File name.
 * @returns {object}
 */
function createSchematicDocument(fileName = 'logic.SchDoc') {
    return {
        sourceFormat: 'altium',
        fileName,
        kind: 'schematic',
        summary: { title: 'Logic Sheet', componentCount: 4 },
        schematic: {
            components: [
                {
                    designator: 'U1',
                    ownerIndex: '100',
                    value: 'controller'
                },
                {
                    designator: 'R1',
                    ownerIndex: '200',
                    value: '4.7k'
                },
                {
                    designator: 'C1',
                    ownerIndex: '300',
                    value: '1uF'
                },
                {
                    designator: 'R9',
                    ownerIndex: '900',
                    value: '0R'
                }
            ],
            nets: [
                {
                    name: 'I2C_SDA',
                    pins: [
                        { refdes: 'U1', designator: '5', name: 'SDA' },
                        { refdes: 'R1', designator: '2', name: '2' },
                        { refdes: 'R9', designator: '2', name: '2' }
                    ]
                },
                {
                    name: 'PP3V3',
                    pins: [
                        { refdes: 'U1', designator: '3', name: 'VDD' },
                        { refdes: 'R1', designator: '1', name: '1' },
                        { refdes: 'C1', designator: '1', name: '1' }
                    ]
                },
                {
                    name: 'FILTERED_SIG',
                    pins: [{ refdes: 'R9', designator: '1', name: '1' }]
                },
                {
                    name: 'GND',
                    pins: [{ refdes: 'C1', designator: '2', name: '2' }]
                }
            ]
        },
        bom: [
            {
                designators: ['U1'],
                quantity: 1,
                pattern: 'MCU-FAKE-48',
                source: 'IC MCU fake 48QFN',
                value: 'controller'
            },
            {
                designators: ['R1'],
                quantity: 1,
                pattern: 'RC0402-4K7',
                source: 'RES 4.7K 0402',
                value: '4.7k'
            },
            {
                designators: ['C1'],
                quantity: 1,
                pattern: 'CC0402-1UF',
                source: 'CAP 1UF 0402',
                value: '1uF'
            },
            {
                designators: ['R9'],
                quantity: 1,
                pattern: 'DNP',
                source: 'RES optional jumper',
                value: '0R'
            }
        ]
    }
}

/**
 * Builds a query service over fake documents.
 * @param {object[]} documents Loaded documents.
 * @returns {LoadedDesignNetlistService}
 */
function createService(documents) {
    return new LoadedDesignNetlistService({
        getDocuments: () => documents
    })
}

/**
 * Verifies the public netlist-query package export.
 */
test('netlist-query exports the public query API', () => {
    assert.equal(typeof RegexPattern.parse, 'function')
    assert.equal(typeof ComponentGrouping.groupComponentsByMpn, 'function')
    assert.equal(typeof CircuitTraversal.traverseCircuitFromNet, 'function')
    assert.equal(typeof QueryNetlistBuilder.build, 'function')
    assert.equal(typeof LoadedDesignNetlistService, 'function')
})

/**
 * Verifies document models are converted into compact query netlists.
 */
test('QueryNetlistBuilder builds compact schematic connectivity', () => {
    const netlist = QueryNetlistBuilder.build(createSchematicDocument())

    assert.deepEqual(Object.keys(netlist.nets).sort(), [
        'FILTERED_SIG',
        'GND',
        'I2C_SDA',
        'PP3V3'
    ])
    assert.equal(netlist.nets.I2C_SDA.U1, '5')
    assert.deepEqual(netlist.components.U1.pins[5], {
        name: 'SDA',
        net: 'I2C_SDA'
    })
    assert.equal(netlist.components.U1.mpn, 'MCU-FAKE-48')
})

/**
 * Verifies design lookup, net listing, and regex search.
 */
test('LoadedDesignNetlistService lists and searches loaded designs', () => {
    const service = createService([
        {
            id: 'doc-1',
            active: true,
            documentModel: createSchematicDocument('logic.SchDoc')
        },
        {
            id: 'doc-2',
            active: false,
            documentModel: createSchematicDocument('power.SchDoc')
        }
    ])

    assert.deepEqual(
        service.listDesigns().map((design) => design.id),
        ['doc-1', 'doc-2']
    )
    assert.deepEqual(service.listNets({ design: 'power' }), {
        nets: ['FILTERED_SIG', 'GND', 'I2C_SDA', 'PP3V3']
    })
    assert.deepEqual(service.searchNets({ pattern: '(?i)sda' }), {
        results: { 'Logic Sheet': ['I2C_SDA'] }
    })
    assert.match(service.searchNets({ pattern: '[' }).error, /Invalid regex/)
    assert.match(service.searchNets({ pattern: '.*' }).error, /every net/)
})

/**
 * Verifies component search, grouping, and DNS filtering.
 */
test('LoadedDesignNetlistService searches and groups component metadata', () => {
    const service = createService([
        {
            id: 'doc-1',
            active: true,
            documentModel: createSchematicDocument()
        }
    ])

    assert.deepEqual(service.listComponents({ type: 'R' }), {
        components: [
            {
                mpn: 'RC0402-4K7',
                description: 'RES 4.7K 0402',
                value: '4.7k',
                count: 1,
                refdes: 'R1'
            }
        ]
    })
    assert.equal(
        service.listComponents({ type: 'R', include_dns: true }).components
            .length,
        2
    )
    assert.deepEqual(service.searchComponentsByMpn({ pattern: 'MCU' }), {
        results: {
            'Logic Sheet': [
                {
                    mpn: 'MCU-FAKE-48',
                    description: 'IC MCU fake 48QFN',
                    value: 'controller',
                    count: 1,
                    refdes: 'U1'
                }
            ]
        }
    })
    assert.equal(
        service.queryComponent({ refdes: 'u1' }).pins[5].net,
        'I2C_SDA'
    )
})

/**
 * Verifies circuit traversal by net and pin.
 */
test('LoadedDesignNetlistService traces extended nets', () => {
    const service = createService([
        {
            id: 'doc-1',
            active: true,
            documentModel: createSchematicDocument()
        }
    ])

    const byNet = service.queryXnetByNetName({ net_name: 'I2C_SDA' })
    assert.equal(byNet.starting_point, 'I2C_SDA')
    assert.equal(byNet.total_components, 2)
    assert.deepEqual(byNet.visited_nets, ['I2C_SDA', 'PP3V3'])
    assert.equal(byNet.circuit_hash.length, 16)

    const byPin = service.queryXnetByPinName({ pin_name: 'u1.5' })
    assert.equal(byPin.starting_point, 'U1.5')
    assert.equal(byPin.net, 'I2C_SDA')

    assert.match(
        service.queryXnetByNetName({ net_name: 'GND' }).error,
        /cannot be queried/
    )
})

/**
 * Verifies PCB-only documents expose metadata but not schematic traversal.
 */
test('LoadedDesignNetlistService handles PCB-only documents without connectivity', () => {
    const service = createService([
        {
            id: 'doc-1',
            active: true,
            documentModel: {
                sourceFormat: 'altium',
                fileName: 'board.PcbDoc',
                kind: 'pcb',
                summary: { title: 'Board' },
                pcb: {
                    components: [{ designator: 'U1', pattern: 'QFN48' }]
                },
                bom: []
            }
        }
    ])

    assert.deepEqual(service.listComponents({ type: 'U' }), {
        components: [
            {
                description: 'QFN48',
                notes: [
                    'MPN not found in loaded design metadata. Add a part number to the symbol properties or provide a BOM.'
                ],
                count: 1,
                refdes: 'U1'
            }
        ]
    })
    assert.match(service.listNets().error, /No schematic connectivity/)
})
