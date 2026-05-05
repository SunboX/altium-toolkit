import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicMultipartOwnerMatcher } from '../../src/core/altium/SchematicMultipartOwnerMatcher.mjs'

/**
 * Verifies mirrored multipart symbols still resolve their active owner part
 * when the component anchor lands on the top-right corner instead of the
 * top-left corner of the visible part bounds.
 */
test('collectActiveMultipartOwnerParts matches mirrored multipart owners by full bounds', () => {
    const records = [
        {
            raw: '',
            fields: {
                RECORD: '6',
                OwnerIndex: '28',
                OwnerPartId: '6',
                LocationCount: '4',
                X1: '520',
                Y1: '620',
                X2: '600',
                Y2: '620',
                X3: '600',
                Y3: '980',
                X4: '520',
                Y4: '980'
            }
        }
    ]
    const componentRecords = [
        {
            raw: '',
            fields: {
                RECORD: '1',
                IndexInSheet: '27',
                PartCount: '11',
                CurrentPartId: '6',
                'Location.X': '600',
                'Location.Y': '620',
                IsMirrored: 'T'
            }
        }
    ]

    const activeOwnerParts =
        SchematicMultipartOwnerMatcher.collectActiveMultipartOwnerParts(
            records,
            componentRecords
        )

    assert.equal(activeOwnerParts.get('28'), '6')
})

/**
 * Verifies passive multipart owners can match when the component placement is
 * anchored on the left outer pin endpoint instead of a bounds corner.
 */
test('collectActiveMultipartOwnerParts matches passive multipart owners by left pin anchor', () => {
    const records = [
        {
            raw: '',
            fields: {
                RECORD: '2',
                OwnerIndex: '28',
                OwnerPartId: '2',
                'Location.X': '150',
                'Location.Y': '205',
                PinLength: '10',
                PinConglomerate: '50'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '2',
                OwnerIndex: '28',
                OwnerPartId: '2',
                'Location.X': '170',
                'Location.Y': '205',
                PinLength: '10',
                PinConglomerate: '48'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '14',
                OwnerIndex: '28',
                OwnerPartId: '2',
                'Location.X': '150',
                'Location.Y': '200',
                'Corner.X': '170',
                'Corner.Y': '210'
            }
        }
    ]
    const componentRecords = [
        {
            raw: '',
            fields: {
                RECORD: '1',
                IndexInSheet: '27',
                PartCount: '5',
                CurrentPartId: '2',
                'Location.X': '140',
                'Location.Y': '205'
            }
        }
    ]

    const activeOwnerParts =
        SchematicMultipartOwnerMatcher.collectActiveMultipartOwnerParts(
            records,
            componentRecords
        )

    assert.equal(activeOwnerParts.get('28'), '2')
})

/**
 * Verifies op-amp style multipart owners still resolve their active part when
 * the component placement lands inside the enclosing owner bounds instead of
 * on one of the existing per-part corner anchors.
 */
test('collectActiveMultipartOwnerParts matches op-amp owners by enclosing owner bounds', () => {
    const records = [
        {
            raw: '',
            fields: {
                RECORD: '6',
                OwnerIndex: '44',
                OwnerPartId: '1',
                LocationCount: '5',
                X1: '215',
                Y1: '285',
                X2: '215',
                Y2: '225',
                X3: '255',
                Y3: '245',
                X4: '275',
                Y4: '255',
                X5: '215',
                Y5: '285'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '6',
                OwnerIndex: '44',
                OwnerPartId: '2',
                LocationCount: '5',
                X1: '215',
                Y1: '280',
                X2: '215',
                Y2: '220',
                X3: '255',
                Y3: '240',
                X4: '275',
                Y4: '250',
                X5: '215',
                Y5: '280'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '6',
                OwnerIndex: '44',
                OwnerPartId: '3',
                LocationCount: '5',
                X1: '210',
                Y1: '280',
                X2: '210',
                Y2: '220',
                X3: '250',
                Y3: '240',
                X4: '270',
                Y4: '250',
                X5: '210',
                Y5: '280'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '6',
                OwnerIndex: '44',
                OwnerPartId: '4',
                LocationCount: '5',
                X1: '200',
                Y1: '280',
                X2: '200',
                Y2: '220',
                X3: '240',
                Y3: '240',
                X4: '260',
                Y4: '250',
                X5: '200',
                Y5: '280'
            }
        }
    ]
    const componentRecords = [
        {
            raw: '',
            fields: {
                RECORD: '1',
                IndexInSheet: '62',
                PartCount: '6',
                CurrentPartId: '3',
                'Location.X': '215',
                'Location.Y': '265',
                IsMirrored: 'T'
            }
        }
    ]

    const activeOwnerParts =
        SchematicMultipartOwnerMatcher.collectActiveMultipartOwnerParts(
            records,
            componentRecords
        )

    assert.equal(activeOwnerParts.get('44'), '3')
})

/**
 * Verifies mirrored multipart owners can resolve from the right outer pin
 * endpoint when the component anchor sits one pin-length beyond the body.
 */
test('collectActiveMultipartOwnerParts matches mirrored owners by right pin endpoint', () => {
    const records = [
        {
            raw: '',
            fields: {
                RECORD: '2',
                OwnerIndex: '28',
                OwnerPartId: '1',
                'Location.X': '130',
                'Location.Y': '120',
                PinLength: '10',
                PinConglomerate: '56'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '2',
                OwnerIndex: '28',
                OwnerPartId: '1',
                'Location.X': '100',
                'Location.Y': '100',
                PinLength: '10',
                PinConglomerate: '59'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '2',
                OwnerIndex: '28',
                OwnerPartId: '1',
                'Location.X': '100',
                'Location.Y': '140',
                PinLength: '10',
                PinConglomerate: '57'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '2',
                OwnerIndex: '28',
                OwnerPartId: '2',
                'Location.X': '130',
                'Location.Y': '120',
                PinLength: '10',
                PinConglomerate: '56'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '2',
                OwnerIndex: '28',
                OwnerPartId: '2',
                'Location.X': '100',
                'Location.Y': '100',
                PinLength: '10',
                PinConglomerate: '59'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '2',
                OwnerIndex: '28',
                OwnerPartId: '2',
                'Location.X': '100',
                'Location.Y': '140',
                PinLength: '10',
                PinConglomerate: '57'
            }
        }
    ]
    const componentRecords = [
        {
            raw: '',
            fields: {
                RECORD: '1',
                IndexInSheet: '27',
                PartCount: '3',
                CurrentPartId: '2',
                'Location.X': '140',
                'Location.Y': '120',
                IsMirrored: 'T'
            }
        }
    ]

    const activeOwnerParts =
        SchematicMultipartOwnerMatcher.collectActiveMultipartOwnerParts(
            records,
            componentRecords
        )

    assert.equal(activeOwnerParts.get('28'), '2')
})

/**
 * Verifies multipart components can recover their active owner directly from
 * the serialized component record block when geometric anchors do not match
 * the library placement origin.
 */
test('collectActiveMultipartOwnerParts matches multipart owners by dominant serialized owner block', () => {
    const componentRecord = {
        raw: '',
        fields: {
            RECORD: '1',
            IndexInSheet: '204',
            PartCount: '4',
            CurrentPartId: '3',
            'Location.X': '660',
            'Location.Y': '120'
        }
    }
    const records = [
        componentRecord,
        {
            raw: '',
            fields: {
                RECORD: '41',
                OwnerIndex: '700',
                OwnerPartId: '-1',
                Name: 'MODEL',
                Text: 'AMP-DEMO'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '13',
                OwnerIndex: '700',
                OwnerPartId: '1',
                'Location.X': '680',
                'Location.Y': '90',
                'Corner.X': '680',
                'Corner.Y': '130'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '2',
                OwnerIndex: '700',
                OwnerPartId: '1',
                'Location.X': '680',
                'Location.Y': '100',
                PinLength: '20',
                PinConglomerate: '50'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '2',
                OwnerIndex: '700',
                OwnerPartId: '2',
                'Location.X': '680',
                'Location.Y': '120',
                PinLength: '20',
                PinConglomerate: '50'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '13',
                OwnerIndex: '700',
                OwnerPartId: '3',
                'Location.X': '680',
                'Location.Y': '90',
                'Corner.X': '680',
                'Corner.Y': '130'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '2',
                OwnerIndex: '700',
                OwnerPartId: '3',
                'Location.X': '700',
                'Location.Y': '120',
                PinLength: '10',
                PinConglomerate: '49'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '2',
                OwnerIndex: '700',
                OwnerPartId: '3',
                'Location.X': '700',
                'Location.Y': '100',
                PinLength: '10',
                PinConglomerate: '51'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '41',
                OwnerIndex: '701',
                OwnerPartId: '-1',
                Name: 'PinUniqueId',
                Text: 'SUB-1'
            }
        },
        {
            raw: '',
            fields: {
                RECORD: '41',
                OwnerIndex: '702',
                OwnerPartId: '-1',
                Name: 'PinUniqueId',
                Text: 'SUB-2'
            }
        }
    ]

    const activeOwnerParts =
        SchematicMultipartOwnerMatcher.collectActiveMultipartOwnerParts(
            records,
            [componentRecord]
        )

    assert.equal(activeOwnerParts.get('700'), '3')
})
