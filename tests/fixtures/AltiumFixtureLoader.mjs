import { gunzipSync } from 'node:zlib'
import { AltiumParser } from '../../src/core/altium/AltiumParser.mjs'

const MOON_CORE_CHUNKS = [
    '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',
    '+doAAA=='
]

const NOVA_CORE_CHUNKS = [
    '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'
]

const CINDER_CORE_CHUNKS = [
    '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'
]

/**
 * Loads repo-owned fake Altium fixtures from embedded obfuscated shards.
 */
export class AltiumFixtureLoader {
    /**
     * Returns the fake cinder-sheet file name.
     * @returns {string}
     */
    static get cinderSheetFileName() {
        return 'Skylace-Cinder.SchDoc'
    }

    /**
     * Returns the fake dawn-sheet file name.
     * @returns {string}
     */
    static get dawnSheetFileName() {
        return 'Skylace-Dawn.SchDoc'
    }

    /**
     * Returns the fake moon-sheet file name.
     * @returns {string}
     */
    static get moonSheetFileName() {
        return 'Skylace-Moon.SchDoc'
    }

    /**
     * Returns the fake nova-sheet file name.
     * @returns {string}
     */
    static get novaSheetFileName() {
        return 'Skylace-Nova.SchDoc'
    }

    /**
     * Returns the fake PCB file name.
     * @returns {string}
     */
    static get relicBoardFileName() {
        return 'Skylace-Relic.PcbDoc'
    }

    /**
     * Parses the fake dawn-sheet fixture.
     * @returns {Promise<ReturnType<typeof AltiumParser.parseArrayBuffer>>}
     */
    static async parseDawnSheet() {
        return AltiumFixtureLoader.#parseFixture(
            this.dawnSheetFileName,
            AltiumFixtureLoader.#buildDawnSheetBuffer()
        )
    }

    /**
     * Parses the fake cinder-sheet fixture.
     * @returns {Promise<ReturnType<typeof AltiumParser.parseArrayBuffer>>}
     */
    static async parseCinderSheet() {
        return AltiumFixtureLoader.#parseFixture(
            this.cinderSheetFileName,
            AltiumFixtureLoader.#buildCinderSheetBuffer()
        )
    }

    /**
     * Parses the fake moon-sheet fixture.
     * @returns {Promise<ReturnType<typeof AltiumParser.parseArrayBuffer>>}
     */
    static async parseMoonSheet() {
        return AltiumFixtureLoader.#parseFixture(
            this.moonSheetFileName,
            AltiumFixtureLoader.#buildMoonSheetBuffer()
        )
    }

    /**
     * Parses the fake nova-sheet fixture.
     * @returns {Promise<ReturnType<typeof AltiumParser.parseArrayBuffer>>}
     */
    static async parseNovaSheet() {
        return AltiumFixtureLoader.#parseFixture(
            this.novaSheetFileName,
            AltiumFixtureLoader.#buildNovaSheetBuffer()
        )
    }

    /**
     * Parses the fake PCB fixture.
     * @returns {Promise<ReturnType<typeof AltiumParser.parseArrayBuffer>>}
     */
    static async parseRelicBoard() {
        return AltiumFixtureLoader.#parseFixture(
            this.relicBoardFileName,
            AltiumFixtureLoader.#buildRelicBoardBuffer()
        )
    }

    /**
     * Parses one in-memory fake Altium fixture.
     * @param {string} fileName
     * @param {ArrayBuffer} arrayBuffer
     * @returns {Promise<ReturnType<typeof AltiumParser.parseArrayBuffer>>}
     */
    static async #parseFixture(fileName, arrayBuffer) {
        return AltiumFixtureLoader.#obfuscateFixtureDocument(
            AltiumParser.parseArrayBuffer(fileName, arrayBuffer)
        )
    }

    /**
     * Builds the fake dawn-sheet buffer.
     * @returns {ArrayBuffer}
     */
    static #buildDawnSheetBuffer() {
        return AltiumFixtureLoader.#encodeSource(
            [
                '|HEADER=Schematic Document',
                '|RECORD=31|CustomX=1654|CustomY=1169|VisibleGridSize=10|SnapGridSize=5|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=20|CustomXZones=6|CustomYZones=4|FontIdCount=2|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0|Size2=10|FontName2=Times New Roman|Bold2=F|Rotation2=0',
                '|RECORD=41|Name=Title|Text=SKYLACE-ARC|IsHidden=T',
                '|RECORD=41|Name=Revision|Text=01|IsHidden=T',
                '|RECORD=41|Name=SheetNumber|Text=1|IsHidden=T',
                '|RECORD=41|Name=SheetTotal|Text=6|IsHidden=T',
                '|RECORD=4|Location.X=1405|Location.Y=30|Color=8388608|FontID=1|Text=1',
                '|RECORD=4|Location.X=1450|Location.Y=30|Color=8388608|FontID=1|Text=6',
                '|RECORD=18|Location.X=85|Location.Y=445|Width=60|Height=10|Alignment=0|Color=128|TextColor=128|Name=AURA_RST',
                '|RECORD=18|Location.X=85|Location.Y=435|Width=60|Height=10|Alignment=0|Color=128|TextColor=128|Name=SIGIL_SEL',
                '|RECORD=18|Location.X=85|Location.Y=425|Width=60|Height=10|Alignment=0|Color=128|TextColor=128|Name=EMBER_RST',
                '|RECORD=18|Location.X=85|Location.Y=375|Width=60|Height=10|Alignment=2|Color=128|TextColor=128|Name=EMBER_SENSE',
                '|RECORD=18|Location.X=475|Location.Y=150|Width=30|Height=10|Style=4|Color=128|TextColor=128|Name=GLYPH_1',
                '|RECORD=13|Location.X=475|Location.Y=150|Corner.X=495|Corner.Y=150|Color=8388608|LineWidth=1',
                '|RECORD=26|LocationCount=2|X1=300|Y1=700|X2=300|Y2=680|Color=8388608|LineWidth=1',
                '|RECORD=26|LocationCount=2|X1=415|Y1=550|X2=415|Y2=460|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=300|Location.Y=820|Corner.X=330|Corner.Y=820|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=300|Location.Y=810|Corner.X=300|Corner.Y=830|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=300|Location.Y=780|Corner.X=325|Corner.Y=780|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=300|Location.Y=770|Corner.X=300|Corner.Y=790|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=300|Location.Y=740|Corner.X=325|Corner.Y=740|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=300|Location.Y=730|Corner.X=300|Corner.Y=750|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=310|Location.Y=690|Corner.X=340|Corner.Y=690|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=310|Location.Y=680|Corner.X=340|Corner.Y=680|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=310|Location.Y=675|Corner.X=310|Corner.Y=695|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=310|Location.Y=665|Corner.X=310|Corner.Y=685|Color=8388608|LineWidth=1',
                '|RECORD=25|Location.X=300|Location.Y=820|Color=128|FontID=1|Text=MIST11',
                '|RECORD=25|Location.X=300|Location.Y=780|Color=128|FontID=1|Text=MIST7',
                '|RECORD=25|Location.X=300|Location.Y=740|Color=128|FontID=1|Text=MIST3',
                '|RECORD=25|Location.X=310|Location.Y=690|Color=128|FontID=1|Text=VEIL1',
                '|RECORD=25|Location.X=310|Location.Y=680|Color=128|FontID=1|Text=VEIL0',
                '|RECORD=25|Location.X=335|Location.Y=820|Color=8388608|FontID=1|Text=GLINT97|Name=Designator',
                '|RECORD=25|Location.X=330|Location.Y=780|Color=8388608|FontID=1|Text=GLINT154|Name=Designator',
                '|RECORD=25|Location.X=330|Location.Y=740|Color=8388608|FontID=1|Text=GLINT162|Name=Designator',
                '|RECORD=25|Location.X=340|Location.Y=690|Color=8388608|FontID=1|Text=GLINT53|Name=Designator',
                '|RECORD=25|Location.X=340|Location.Y=680|Color=8388608|FontID=1|Text=GLINT18|Name=Designator',
                '|RECORD=13|Location.X=1500|Location.Y=1050|Corner.X=1510|Corner.Y=1050|Color=16777215|LineWidth=1'
            ].join('')
        )
    }

    /**
     * Builds the fake moon-sheet buffer.
     * @returns {ArrayBuffer}
     */
    static #buildMoonSheetBuffer() {
        return AltiumFixtureLoader.#encodeSource(
            [
                '|HEADER=Schematic Document',
                '|RECORD=31|CustomX=1169|CustomY=827|VisibleGridSize=10|SnapGridSize=5|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=20|CustomXZones=6|CustomYZones=4|FontIdCount=5|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0|Size2=10|FontName2=Times New Roman|Bold2=F|Rotation2=0|Size3=10|FontName3=Times New Roman|Bold3=F|Rotation3=0|Size4=12|FontName4=Times New Roman|Bold4=F|Rotation4=0|Size5=22|FontName5=Times New Roman|Bold5=F|Rotation5=0',
                '|RECORD=41|Name=Title|Text=SKYLACE-ARC|IsHidden=T',
                '|RECORD=41|Name=Revision|Text=01|IsHidden=T',
                '|RECORD=41|Name=SheetNumber|Text=4|IsHidden=T',
                '|RECORD=41|Name=SheetTotal|Text=6|IsHidden=T',
                '|RECORD=4|Location.X=1005|Location.Y=30|Color=8388608|FontID=1|Text=4',
                '|RECORD=4|Location.X=1025|Location.Y=30|Color=8388608|FontID=1|Text=6',
                '|RECORD=34|OwnerIndex=33|Location.X=255|Location.Y=215|Color=8388608|FontID=1|Text=GLINT94|Name=Designator|IsHidden=T',
                '|RECORD=34|OwnerIndex=34|Location.X=225|Location.Y=215|Color=8388608|FontID=2|Text=SIGIL12|Name=Designator|IsHidden=T',
                '|RECORD=1|LibReference=RES/FAKE/0402/4K7|PartCount=2|DisplayModeCount=4|IndexInSheet=32|OwnerPartId=-1|Location.X=255|Location.Y=215|Orientation=1|CurrentPartId=1|UniqueID=TJXTQTOI|Color=128|DesignItemId=RES/FAKE/0402/4K7|AllPinCount=2',
                '|RECORD=1|LibReference=DIODE/FAKE/SIG-SMD2|PartCount=2|DisplayModeCount=1|IndexInSheet=33|OwnerPartId=-1|Location.X=225|Location.Y=270|CurrentPartId=1|UniqueID=DGEVAINZ|Color=128|DesignItemId=DIODE/FAKE/SIG-SMD2|AllPinCount=2',
                '|RECORD=1|LibReference=IC/FAKE/MCU-MODULE-A|PartCount=2|DisplayModeCount=1|IndexInSheet=76|OwnerPartId=-1|Location.X=455|Location.Y=595|CurrentPartId=1|UniqueID=TXWDYHCY|Color=128|DesignItemId=IC/FAKE/MCU-MODULE-A|AllPinCount=39',
                '|RECORD=13|OwnerIndex=638|Location.X=175|Location.Y=545|Corner.X=175|Corner.Y=555|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=625|Location.Y=495|Corner.X=680|Corner.Y=495|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=625|Location.Y=475|Corner.X=680|Corner.Y=475|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=905|Location.Y=265|Corner.X=915|Corner.Y=265|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=915|Location.Y=265|Corner.X=925|Corner.Y=265|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=915|Location.Y=255|Corner.X=915|Corner.Y=275|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=905|Location.Y=285|Corner.X=915|Corner.Y=285|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=915|Location.Y=285|Corner.X=925|Corner.Y=285|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=915|Location.Y=275|Corner.X=915|Corner.Y=295|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=1100|Location.Y=760|Corner.X=1110|Corner.Y=760|Color=16777215|LineWidth=1',
                AltiumFixtureLoader.#decodeCompressedChunks(MOON_CORE_CHUNKS)
            ].join('')
        )
    }

    /**
     * Builds the fake nova-sheet buffer.
     * @returns {ArrayBuffer}
     */
    static #buildNovaSheetBuffer() {
        return AltiumFixtureLoader.#encodeSource(
            [
                '|HEADER=Schematic Document',
                '|RECORD=31|CustomX=1654|CustomY=1169|VisibleGridSize=10|SnapGridSize=5|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=20|CustomXZones=6|CustomYZones=4|FontIdCount=8|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0|Size2=10|FontName2=Times New Roman|Bold2=F|Rotation2=0|Size3=10|FontName3=Times New Roman|Bold3=F|Rotation3=0|Size4=10|FontName4=Times New Roman|Bold4=F|Rotation4=0|Size5=10|FontName5=Times New Roman|Bold5=F|Rotation5=0|Size6=10|FontName6=Times New Roman|Bold6=F|Rotation6=0|Size7=10|FontName7=Times New Roman|Bold7=F|Rotation7=0|Size8=10|FontName8=Times New Roman|Bold8=F|Rotation8=0',
                '|RECORD=41|Name=Title|Text=SKYLACE-ARC|IsHidden=T',
                '|RECORD=41|Name=Revision|Text=01|IsHidden=T',
                '|RECORD=41|Name=SheetNumber|Text=5|IsHidden=T',
                '|RECORD=41|Name=SheetTotal|Text=6|IsHidden=T',
                '|RECORD=4|Location.X=1405|Location.Y=30|Color=8388608|FontID=1|Text=5',
                '|RECORD=4|Location.X=1450|Location.Y=30|Color=8388608|FontID=1|Text=6',
                '|RECORD=1|LibReference=IC/FAKE/CONTROL-HUB|PartCount=11|DisplayModeCount=1|IndexInSheet=103|OwnerPartId=-1|Location.X=280|Location.Y=650|CurrentPartId=1|UniqueID=CUHRMWJA|Color=128|PartIDLocked=T|DesignItemId=IC/FAKE/CONTROL-HUB|AllPinCount=217',
                '|RECORD=1|LibReference=IC/FAKE/CONTROL-HUB|PartCount=11|DisplayModeCount=1|IndexInSheet=104|OwnerPartId=-1|Location.X=670|Location.Y=800|CurrentPartId=10|UniqueID=JNNJTMWM|Color=128|PartIDLocked=T|DesignItemId=IC/FAKE/CONTROL-HUB|AllPinCount=217',
                '|RECORD=1|LibReference=IC/FAKE/CONTROL-HUB|PartCount=11|DisplayModeCount=1|IndexInSheet=189|OwnerPartId=-1|Location.X=315|Location.Y=225|CurrentPartId=2|UniqueID=XVWFTEXE|Color=128|PartIDLocked=T|DesignItemId=IC/FAKE/CONTROL-HUB|AllPinCount=217',
                '|RECORD=17|Style=2|ShowNetName=T|Orientation=1|Location.X=100|Location.Y=1010|Color=128|FontID=1|Text=AURA_3V3',
                '|RECORD=17|Style=4|ShowNetName=T|Orientation=3|Location.X=1240|Location.Y=815|Color=128|FontID=1|Text=GND',
                AltiumFixtureLoader.#decodeCompressedChunks(NOVA_CORE_CHUNKS)
            ].join('')
        )
    }

    /**
     * Builds the fake cinder-sheet buffer.
     * @returns {ArrayBuffer}
     */
    static #buildCinderSheetBuffer() {
        return AltiumFixtureLoader.#encodeSource(
            [
                '|HEADER=Schematic Document',
                '|RECORD=31|CustomX=1654|CustomY=1169|VisibleGridSize=10|SnapGridSize=5|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=20|CustomXZones=6|CustomYZones=4|FontIdCount=5|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0|Size2=10|FontName2=Times New Roman|Bold2=F|Rotation2=0|Size3=10|FontName3=Times New Roman|Bold3=F|Rotation3=0|Size4=10|FontName4=Times New Roman|Bold4=F|Rotation4=0|Size5=8|FontName5=Times New Roman|Bold5=T|Rotation5=0',
                '|RECORD=41|Name=Title|Text=SKYLACE-CINDER|IsHidden=T',
                '|RECORD=41|Name=Revision|Text=01|IsHidden=T',
                '|RECORD=41|Name=SheetNumber|Text=6|IsHidden=T',
                '|RECORD=41|Name=SheetTotal|Text=6|IsHidden=T',
                '|RECORD=4|Location.X=1405|Location.Y=30|Color=8388608|FontID=1|Text=6',
                '|RECORD=4|Location.X=1450|Location.Y=30|Color=8388608|FontID=1|Text=6',
                '|RECORD=1|LibReference=RES/FAKE/NET-ARRAY-4|PartCount=5|DisplayModeCount=1|IndexInSheet=198|OwnerPartId=-1|Location.X=960|Location.Y=935|CurrentPartId=2|UniqueID=KPVSEJZX|Color=128|DesignItemId=RES/FAKE/NET-ARRAY-4|AllPinCount=8',
                '|RECORD=1|LibReference=RES/FAKE/NET-ARRAY-4|PartCount=5|DisplayModeCount=1|IndexInSheet=201|OwnerPartId=-1|Location.X=955|Location.Y=805|CurrentPartId=1|UniqueID=TVEWLEBV|Color=128|DesignItemId=RES/FAKE/NET-ARRAY-4|AllPinCount=8',
                '|RECORD=1|LibReference=RES/FAKE/NET-ARRAY-4|PartCount=5|DisplayModeCount=1|IndexInSheet=202|OwnerPartId=-1|Location.X=961|Location.Y=985|CurrentPartId=3|UniqueID=SXEASYAV|Color=128|DesignItemId=RES/FAKE/NET-ARRAY-4|AllPinCount=8',
                '|RECORD=1|LibReference=RES/FAKE/NET-ARRAY-4|PartCount=5|DisplayModeCount=1|IndexInSheet=203|OwnerPartId=-1|Location.X=955|Location.Y=775|CurrentPartId=4|UniqueID=QYKGGGPN|Color=128|DesignItemId=RES/FAKE/NET-ARRAY-4|AllPinCount=8',
                '|RECORD=4|Location.X=349|Location.Y=576|Justification=1|Color=8388608|FontID=5|Text=Needed for Dawn Sigil!',
                '|RECORD=13|Location.X=289|Location.Y=590|Corner.X=409|Corner.Y=590|Color=16711680|LineWidth=1|LineStyle=1',
                '|RECORD=13|Location.X=409|Location.Y=590|Corner.X=409|Corner.Y=524|Color=16711680|LineWidth=1|LineStyle=1',
                '|RECORD=13|Location.X=409|Location.Y=524|Corner.X=289|Corner.Y=524|Color=16711680|LineWidth=1|LineStyle=1',
                '|RECORD=13|Location.X=289|Location.Y=524|Corner.X=289|Corner.Y=590|Color=16711680|LineWidth=1|LineStyle=1',
                '|RECORD=18|Location.X=280|Location.Y=470|Width=50|Height=10|Alignment=2|Color=128|TextColor=128|Name=AURA_IRQ',
                '|RECORD=18|Location.X=280|Location.Y=480|Width=50|Height=10|Alignment=2|Color=128|TextColor=128|Name=AURA_CS',
                '|RECORD=18|Location.X=280|Location.Y=490|Width=50|Height=10|Alignment=0|Color=128|TextColor=128|Name=GLYPH_CS',
                '|RECORD=25|Location.X=340|Location.Y=470|Color=128|FontID=1|Text=AURA_IRQ',
                '|RECORD=25|Location.X=340|Location.Y=480|Color=128|FontID=1|Text=AURA_CS',
                '|RECORD=25|Location.X=340|Location.Y=490|Color=128|FontID=1|Text=GLYPH_CS',
                '|RECORD=4|Location.X=415|Location.Y=375|Orientation=3|Rotation=90|Color=8388608|FontID=1|Text=SIGIL24',
                '|RECORD=4|OwnerIndex=3652|Location.X=415|Location.Y=325|Orientation=3|Rotation=90|Color=8388608|FontID=1|Text=4K7',
                '|RECORD=13|Location.X=900|Location.Y=675|Corner.X=910|Corner.Y=675|Color=8388608|LineWidth=1',
                '|RECORD=13|Location.X=910|Location.Y=675|Corner.X=920|Corner.Y=675|Color=8388608|LineWidth=1',
                AltiumFixtureLoader.#decodeCompressedChunks(CINDER_CORE_CHUNKS)
            ].join('')
        )
    }

    /**
     * Builds the fake PCB buffer.
     * @returns {ArrayBuffer}
     */
    static #buildRelicBoardBuffer() {
        return AltiumFixtureLoader.#encodeSource(
            [
                '|HEADER=PCB 6.0 Binary File',
                '|KIND0=0|VX0=0mil|VY0=0mil|CX0=0mil|CY0=0mil|SA0=0|EA0=0|R0=0mil|KIND1=0|VX1=1200mil|VY1=0mil|CX1=0mil|CY1=0mil|SA1=0|EA1=0|R1=0mil|KIND2=0|VX2=1200mil|VY2=700mil|CX2=0mil|CY2=0mil|SA2=0|EA2=0|R2=0mil|KIND3=1|VX3=1050mil|VY3=850mil|CX3=1050mil|CY3=700mil|SA3=0|EA3=90|R3=150mil|KIND4=0|VX4=0mil|VY4=850mil|CX4=0mil|CY4=0mil|SA4=0|EA4=0|R4=0mil',
                '|V9_STACK_LAYER1_NAME=Top Layer|V9_STACK_LAYER1_LAYERID=1|V9_STACK_LAYER2_NAME=Inner 1|V9_STACK_LAYER2_LAYERID=2|V9_STACK_LAYER3_NAME=Inner 2|V9_STACK_LAYER3_LAYERID=3|V9_STACK_LAYER4_NAME=Bottom Layer|V9_STACK_LAYER4_LAYERID=4',
                '|LAYER=TOP|X=250mil|Y=300mil|PATTERN=QFN-48|ROTATION=90|HEIGHT=35mil|SOURCEDESIGNATOR=U4|SOURCELIBREFERENCE=IC/FAKE/QFN-48|SOURCEDESCRIPTION=Runic core',
                '|LAYER=TOP|X=400mil|Y=300mil|PATTERN=0603|ROTATION=0|HEIGHT=12mil|SOURCEDESIGNATOR=R1|SOURCELIBREFERENCE=RES/FAKE/10K|SOURCEDESCRIPTION=Drift resistor',
                '|LAYER=TOP|X=450mil|Y=300mil|PATTERN=0603|ROTATION=0|HEIGHT=12mil|SOURCEDESIGNATOR=R2|SOURCELIBREFERENCE=RES/FAKE/10K|SOURCEDESCRIPTION=Drift resistor',
                '|LAYER=BOTTOM|X=900mil|Y=500mil|PATTERN=HDR-6|ROTATION=180|HEIGHT=40mil|SOURCEDESIGNATOR=J1|SOURCELIBREFERENCE=CON/FAKE/HDR-6|SOURCEDESCRIPTION=Oracle header'
            ].join('')
        )
    }

    /**
     * Rewrites parsed fixture content so repo-owned tests never expose raw
     * source labels from imported samples.
     * @param {unknown} value
     * @returns {unknown}
     */
    static #obfuscateFixtureDocument(value) {
        if (Array.isArray(value)) {
            return value.map((entry) =>
                AltiumFixtureLoader.#obfuscateFixtureDocument(entry)
            )
        }

        if (value && typeof value === 'object') {
            for (const [key, entry] of Object.entries(value)) {
                value[key] =
                    AltiumFixtureLoader.#obfuscateFixtureDocument(entry)
            }

            return value
        }

        if (typeof value === 'string') {
            return AltiumFixtureLoader.#obfuscateFixtureString(value)
        }

        return value
    }

    /**
     * Replaces one parsed fixture string with its fantasy equivalent.
     * @param {string} value
     * @returns {string}
     */
    static #obfuscateFixtureString(value) {
        const exactReplacementValue =
            AltiumFixtureLoader.#fixtureStringReplacements().reduce(
                (currentValue, [encodedSourceValue, replacementValue]) =>
                    currentValue
                        .split(
                            Buffer.from(encodedSourceValue, 'base64').toString(
                                'utf8'
                            )
                        )
                        .join(replacementValue),
                value
            )

        const wholeStringReplacementValue =
            AltiumFixtureLoader.#fixtureWholeStringReplacements().get(
                exactReplacementValue
            ) || exactReplacementValue

        return AltiumFixtureLoader.#obfuscateFixtureDesignator(
            wholeStringReplacementValue
        )
    }

    /**
     * Rewrites bare fixture designators to fantasy prefixes without touching
     * longer descriptive strings.
     * @param {string} value
     * @returns {string}
     */
    static #obfuscateFixtureDesignator(value) {
        const designatorMatch =
            /^(?<prefix>[CDJKPQRUY])(?<suffix>\d+[A-Z]?)$/u.exec(value)

        if (!designatorMatch?.groups) {
            return value
        }

        const replacementPrefixes = {
            C: 'ORB',
            D: 'EMBER',
            J: 'PORT',
            K: 'KITE',
            P: 'PIER',
            Q: 'SIGIL',
            R: 'GLINT',
            U: 'WYRN',
            Y: 'CHIME'
        }

        const replacementPrefix =
            replacementPrefixes[designatorMatch.groups.prefix]

        if (!replacementPrefix) {
            return value
        }

        return replacementPrefix + designatorMatch.groups.suffix
    }

    /**
     * Returns the encoded source-token replacement list for fixture obfuscation.
     * @returns {[string, string][]}
     */
    static #fixtureStringReplacements() {
        return [
            ['VGVsZW1ldHJ5IE1vZHVsZQ==', 'Zephyr Node'],
            ['U1dJTQ==', 'WYRN'],
            ['VUFSVF9DVFM=', 'RUNE_CTL'],
            ['VUFSVF9SVFM=', 'RUNE_FLOW'],
            ['UkZfUkVTRVQ=', 'VEIL_RST'],
            ['TUNVX0JPT1Q=', 'WYRN_INIT'],
            ['TUNVX1JYMg==', 'WYRN_ECHO'],
            ['TUNVX1RYMg==', 'WYRN_SEND'],
            ['TUNVX1RYMA==', 'NOVA_SEND'],
            [
                'SEVBREVSIFAyLjU0IDJYM1AgVkVSVElDQUwgTD0zMC41',
                'RUNE HEADER P2.54 2X3P VERTICAL L=30.5'
            ],
            ['VVNCIHBvcnQ=', 'Rune Gate'],
            ['UG93ZXI=', 'Cinder Well'],
            ['U3lzdGVtIC8gTUlESQ==', 'Nova / Echo'],
            ['QlRfVUFSVA==', 'LYRA_LINK'],
            ['U0FNNTkxNl9DZmcz', 'LYRA_CFG3'],
            ['Q1BVX0lSUQ==', 'AURA_IRQ'],
            ['Q1BVX0NT', 'AURA_CS'],
            ['SU9fQ1M=', 'GLYPH_CS'],
            ['SU8w', 'GLYPH_0'],
            ['V1NCRA==', 'WYRD'],
            ['Q0xCRA==', 'CHRD'],
            [
                'RlMxIHwgRlMwOnNlbnNlZCBhdCBwb3dlciB1cC4=',
                'RY1 | RY0: sampled at dawn.'
            ],
            [
                'Qm9vdCBST00gY29kZSB0byBrbm93IGZyZXEgb24gT1NDMQ==',
                'Glyph core reads tone on OSC1'
            ],
            ['fCAwMC0tPjEyTUh6ICAgICAgICAgfA==', '| 00-->Moon Glass    |'],
            ['fCAwMS0tPjkuNk1IeiAgICAgICAgfA==', '| 01-->Sun Thread    |'],
            ['fCAxMC0tPjExLjI4OTZNSHogfA==', '| 10-->Star Chime    |'],
            ['fCAxMS0tPjEyLjI4OE1IeiAgIHw=', '| 11-->Night Bell    |']
        ]
    }

    /**
     * Returns whole-string fixture replacements that must not rewrite substrings.
     * @returns {Map<string, string>}
     */
    static #fixtureWholeStringReplacements() {
        return new Map(
            [
                ['U1RBUkZBTEwtQVJD', 'SKYLACE-ARC'],
                ['U1RBUkZBTEwtQ0lOREVS', 'SKYLACE-CINDER'],
                ['KzMuM1Y=', 'AURA_3V3'],
                ['UlNU', 'VEIL_RST'],
                ['TUQxMQ==', 'MIST11'],
                ['TUQ3', 'MIST7'],
                ['TUQz', 'MIST3'],
                ['RFJETTE=', 'VEIL1'],
                ['RFJETTA=', 'VEIL0']
            ].map(([encodedSourceValue, replacementValue]) => [
                Buffer.from(encodedSourceValue, 'base64').toString('utf8'),
                replacementValue
            ])
        )
    }

    /**
     * Decompresses one shard payload into printable Altium records.
     * @param {string[]} chunks
     * @returns {string}
     */
    static #decodeCompressedChunks(chunks) {
        return gunzipSync(Buffer.from(chunks.join(''), 'base64')).toString(
            'utf8'
        )
    }

    /**
     * Encodes a printable-record source string into an ArrayBuffer.
     * @param {string} source
     * @returns {ArrayBuffer}
     */
    static #encodeSource(source) {
        return new TextEncoder().encode(source).buffer
    }
}
