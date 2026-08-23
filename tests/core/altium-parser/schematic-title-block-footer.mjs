// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'

/**
 * Verifies owner-indexed native footer placeholders resolve from sheet
 * metadata, while label cells and address rows stay out of title fields.
 */
test('parseAltiumArrayBuffer resolves owner-indexed native title-block footer placeholders', () => {
    const latinAddress = 'Pol' + String.fromCharCode(0xed) + 'gono Unit'
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=1500|CustomY=1070|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=T|TitleBlockOn=F|CustomMarginWidth=20|CustomXZones=8|CustomYZones=4' +
            '|FontIdCount=2|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|Size2=9|FontName2=Times New Roman|Bold2=F|Italic2=T|Rotation2=0',
        '|RECORD=4|OwnerIndex=1|Location.X=1075|Location.Y=65|Color=8388608|FontID=1|Text=Title:',
        '|RECORD=4|OwnerIndex=1|Location.X=1166|Location.Y=66|Color=128|FontID=1|Text==title',
        '|RECORD=4|OwnerIndex=1|Location.X=1075|Location.Y=165|Color=8388608|FontID=1|Text==organization',
        '|RECORD=4|OwnerIndex=1|Location.X=1205|Location.Y=165|Color=8388608|FontID=1|Text==ApprovedBy',
        '|RECORD=4|OwnerIndex=1|Location.X=1176|Location.Y=61|Color=8388608|FontID=1|Text==documentnumber',
        '|RECORD=4|OwnerIndex=1|Location.X=1328|Location.Y=65|Color=8388608|FontID=2|Text==address1',
        '|RECORD=4|OwnerIndex=1|Location.X=1333|Location.Y=55|Color=8388608|FontID=2|Text==address2',
        '|RECORD=4|OwnerIndex=1|Location.X=1075|Location.Y=51|Color=8388608|FontID=1|Text=Size:',
        '|RECORD=4|OwnerIndex=1|Location.X=1097|Location.Y=51|Color=8388608|FontID=1|Text=A3',
        '|RECORD=4|OwnerIndex=1|Location.X=1125|Location.Y=51|Color=8388608|FontID=1|Text=Drawn by:',
        '|RECORD=4|OwnerIndex=1|Location.X=1188|Location.Y=51|Color=8388608|FontID=1|Text==DrawnBy',
        '|RECORD=4|OwnerIndex=1|Location.X=1330|Location.Y=45|Color=8388608|FontID=2|Text==address3',
        '|RECORD=4|OwnerIndex=1|Location.X=1075|Location.Y=38|Color=8388608|FontID=1|Text=Revision:',
        '|RECORD=4|OwnerIndex=1|Location.X=1120|Location.Y=37|Color=8388608|FontID=1|Text==Revision',
        '|RECORD=4|OwnerIndex=1|Location.X=1164|Location.Y=37|Color=8388608|FontID=1|Text=Date:',
        '|RECORD=4|OwnerIndex=1|Location.X=1188|Location.Y=37|Color=8388608|FontID=1|Text==Date',
        '|RECORD=4|OwnerIndex=1|Location.X=1258|Location.Y=37|Color=8388608|FontID=1|Text=Sheet',
        '|RECORD=4|OwnerIndex=1|Location.X=1282|Location.Y=37|Color=8388608|FontID=1|Text==SheetNumber',
        '|RECORD=4|OwnerIndex=1|Location.X=1291|Location.Y=37|Color=8388608|FontID=1|Text=of',
        '|RECORD=4|OwnerIndex=1|Location.X=1305|Location.Y=37|Color=8388608|FontID=1|Text==SheetTotal',
        '|RECORD=4|OwnerIndex=1|Location.X=1075|Location.Y=23|Color=8388608|FontID=1|Text=Project:',
        '|RECORD=4|OwnerIndex=1|Location.X=1154|Location.Y=21|Color=128|FontID=1|Text==Project',
        '|RECORD=4|OwnerIndex=1|Location.X=1333|Location.Y=22|Color=8388608|FontID=2|Text==WebAddress',
        '|RECORD=41|Name=Title|Text=OBFUSCATED_CORE|IsHidden=T',
        '|RECORD=41|Name=Revision|Text=04|IsHidden=T',
        '|RECORD=41|Name=DrawnBy|Text=QA Team|IsHidden=T',
        '|RECORD=41|Name=Date|Text=25/06/2026|IsHidden=T',
        '|RECORD=41|Name=SheetNumber|Text=7|IsHidden=T',
        '|RECORD=41|Name=SheetTotal|Text=23|IsHidden=T',
        '|RECORD=41|Name=Project|Text=OBFUSCATED_PROJECT|IsHidden=T',
        '|RECORD=41|Name=Organization|Text=OBSCURA LABS|IsHidden=T',
        '|RECORD=41|Name=ApprovedBy|Text=*|IsHidden=T',
        '|RECORD=41|Name=Address1|Text=Unit 1|IsHidden=T',
        '|RECORD=41|Name=Address2|Text=' + latinAddress + '|IsHidden=T',
        '|RECORD=41|Name=Address3|Text=Test City|IsHidden=T',
        '|RECORD=41|Name=WebAddress|Text=example.invalid|IsHidden=T'
    ]
    const rawRecords = records.join('')
    const bytes = new Uint8Array(rawRecords.length)
    for (let index = 0; index < rawRecords.length; index += 1) {
        bytes[index] = rawRecords.charCodeAt(index) & 0xff
    }
    const documentModel = AltiumParser.parseArrayBufferToRendererModel(
        'native-footer-placeholders.SchDoc',
        bytes.buffer
    )
    const visibleTexts = documentModel.schematic.texts.map((text) => text.text)

    assert.equal(
        documentModel.schematic.sheet.titleBlock.title,
        'OBFUSCATED_CORE'
    )
    assert.equal(documentModel.schematic.sheet.titleBlock.revision, '04')
    assert.equal(documentModel.schematic.sheet.titleBlock.documentNumber, '')
    assert.equal(documentModel.schematic.sheet.titleBlock.sheetNumber, '7')
    assert.equal(documentModel.schematic.sheet.titleBlock.sheetTotal, '23')
    assert.equal(documentModel.schematic.sheet.titleBlock.date, '25/06/2026')
    assert.equal(documentModel.schematic.sheet.titleBlock.drawnBy, 'QA Team')
    assert.equal(visibleTexts.includes('OBFUSCATED_CORE'), true)
    assert.equal(visibleTexts.includes('OBFUSCATED_PROJECT'), true)
    assert.equal(visibleTexts.includes('OBSCURA LABS'), true)
    assert.equal(visibleTexts.filter((text) => text === '*').length, 1)
    assert.equal(visibleTexts.includes('Unit 1'), true)
    assert.equal(visibleTexts.includes('Polígono Unit'), true)
    assert.equal(visibleTexts.includes('=title'), false)
    assert.equal(visibleTexts.includes('=Project'), false)
    assert.equal(visibleTexts.includes('=address1'), false)
})
