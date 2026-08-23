// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

const MILS_PER_METER = 39370.07874015748
const MILS_PER_MILLIMETER = 1000 / 25.4
const MILS_PER_INCH = 1000

/**
 * Indexes session companion assets for 3D model lookup.
 */
export class PcbScene3dModelRegistry {
    /** @type {{ file?: File | Blob | null, name: string, relativePath: string, format: string, source: string, normalizedPath: string, normalizedBaseName: string }[]} */
    #modelFiles

    /** @type {{ id: string, checksum: number | null, name: string, format: string, payloadText: string, sourceStream: string, normalizedId: string, normalizedBaseName: string, boundsMil?: { width: number, depth: number, height: number }, transform?: { rotationDeg?: { x?: number, y?: number, z?: number }, dzMil?: number } }[]} */
    #embeddedModels

    /**
     * @param {{ file?: File | Blob | null, name: string, relativePath: string, format: string, source: string, normalizedPath: string, normalizedBaseName: string }[]} modelFiles
     * @param {{ id: string, checksum: number | null, name: string, format: string, payloadText: string, sourceStream: string, normalizedId: string, normalizedBaseName: string, boundsMil?: { width: number, depth: number, height: number }, transform?: { rotationDeg?: { x?: number, y?: number, z?: number }, dzMil?: number } }[]} embeddedModels
     */
    constructor(modelFiles, embeddedModels) {
        this.#modelFiles = modelFiles
        this.#embeddedModels = embeddedModels
    }

    /**
     * Creates one model registry from session files.
     * @param {{ name?: string, relativePath?: string, source?: string }[]} sessionFiles
     * @param {{ id?: string, checksum?: number | null, name?: string, format?: string, payloadText?: string, sourceStream?: string, transform?: object }[]} [embeddedModels]
     * @returns {PcbScene3dModelRegistry}
     */
    static create(sessionFiles, embeddedModels = []) {
        const modelFiles = (Array.isArray(sessionFiles) ? sessionFiles : [])
            .map((file) => PcbScene3dModelRegistry.#normalizeFile(file))
            .filter(Boolean)
        const normalizedEmbeddedModels = (
            Array.isArray(embeddedModels) ? embeddedModels : []
        )
            .map((model) =>
                PcbScene3dModelRegistry.#normalizeEmbeddedModel(model)
            )
            .filter(Boolean)

        return new PcbScene3dModelRegistry(modelFiles, normalizedEmbeddedModels)
    }

    /**
     * Resolves the best available external model for one component.
     * @param {{ pattern?: string, source?: string, modelPath?: string }} component
     * @returns {{ file?: File | Blob | null, name: string, relativePath: string, format: string } | null}
     */
    resolveComponentModel(component) {
        const explicitMatch = this.#resolveExplicitMatch(component.modelPath)
        if (explicitMatch) {
            return explicitMatch
        }

        const heuristicMatch = this.#resolveHeuristicMatch(component)
        if (heuristicMatch) {
            return heuristicMatch
        }

        return null
    }

    /**
     * Normalizes one session file into registry metadata.
     * @param {{ name?: string, relativePath?: string, source?: string }} file
     * @returns {{ file?: File | Blob | null, name: string, relativePath: string, format: string, source: string, normalizedPath: string, normalizedBaseName: string } | null}
     */
    static #normalizeFile(file) {
        const relativePath = String(file?.relativePath || file?.name || '')
        const name = String(file?.name || relativePath.split('/').pop() || '')
        const format = PcbScene3dModelRegistry.#resolveFormat(relativePath)

        if (!name || !format) {
            return null
        }

        return {
            file: file?.file || file?.blob || null,
            name,
            relativePath,
            format,
            source: String(file?.source || ''),
            normalizedPath:
                PcbScene3dModelRegistry.#normalizeToken(relativePath),
            normalizedBaseName: PcbScene3dModelRegistry.#normalizeToken(
                name.replace(/\.[^.]+$/, '')
            )
        }
    }

    /**
     * Resolves the supported model format from one file path.
     * @param {string} filePath
     * @returns {string}
     */
    static #resolveFormat(filePath) {
        const lowerCasePath = String(filePath || '').toLowerCase()
        if (lowerCasePath.endsWith('.wrl') || lowerCasePath.endsWith('.vrml')) {
            return 'wrl'
        }

        if (lowerCasePath.endsWith('.step') || lowerCasePath.endsWith('.stp')) {
            return 'step'
        }

        if (lowerCasePath.endsWith('.glb')) {
            return 'glb'
        }

        if (lowerCasePath.endsWith('.gltf')) {
            return 'gltf'
        }

        if (lowerCasePath.endsWith('.stl')) {
            return 'stl'
        }

        if (lowerCasePath.endsWith('.obj')) {
            return 'obj'
        }

        return ''
    }

    /**
     * Resolves one explicit model-path match.
     * @param {string | undefined} modelPath
     * @returns {{ file?: File | Blob | null, name: string, relativePath: string, format: string } | null}
     */
    #resolveExplicitMatch(modelPath) {
        const normalizedPath =
            PcbScene3dModelRegistry.#normalizeToken(modelPath)
        if (!normalizedPath) {
            return null
        }

        const byPath = this.#modelFiles.find(
            (file) => file.normalizedPath === normalizedPath
        )
        if (byPath) {
            return PcbScene3dModelRegistry.#sessionModelFromFile(byPath)
        }

        const fileName =
            String(modelPath || '')
                .split('/')
                .pop() || ''
        const normalizedBaseName = PcbScene3dModelRegistry.#normalizeToken(
            fileName.replace(/\.[^.]+$/, '')
        )
        return this.#resolveByBaseName(normalizedBaseName)
    }

    /**
     * Resolves a heuristic model match from component naming fields.
     * @param {{ pattern?: string, source?: string }} component
     * @returns {{ file?: File | Blob | null, name: string, relativePath: string, format: string } | null}
     */
    #resolveHeuristicMatch(component) {
        const candidates = [component?.pattern, component?.source]

        for (const candidate of candidates) {
            const normalized = PcbScene3dModelRegistry.#normalizeToken(
                String(candidate || '')
            )
            const match = this.#resolveByBaseName(normalized)
            if (match) {
                return match
            }
        }

        return null
    }

    /**
     * Resolves one indexed file by normalized basename and format priority.
     * @param {string} normalizedBaseName
     * @returns {{ file?: File | Blob | null, name: string, relativePath: string, format: string, source?: string } | null}
     */
    #resolveByBaseName(normalizedBaseName) {
        if (!normalizedBaseName) {
            return null
        }

        const rankedMatches = this.#modelFiles
            .filter((file) => file.normalizedBaseName === normalizedBaseName)
            .sort(
                (left, right) =>
                    PcbScene3dModelRegistry.#formatRank(left.format) -
                    PcbScene3dModelRegistry.#formatRank(right.format)
            )

        if (!rankedMatches.length) {
            return null
        }

        return PcbScene3dModelRegistry.#sessionModelFromFile(rankedMatches[0])
    }

    /**
     * Builds public session model metadata from one indexed file row.
     * @param {{ file?: File | Blob | null, name: string, relativePath: string, format: string, source?: string }} file Indexed model file.
     * @returns {{ origin: 'session', file?: File | Blob | null, name: string, relativePath: string, format: string, source?: string }}
     */
    static #sessionModelFromFile(file) {
        const model = {
            origin: 'session',
            file: file.file,
            name: file.name,
            relativePath: file.relativePath,
            format: file.format
        }
        const source = String(file.source || '').trim()
        if (source) {
            model.source = source
        }

        return model
    }

    /**
     * Resolves the best available model for one normalized component-body
     * placement.
     * @param {{ modelId?: string, checksum?: number | null, name?: string }} componentBody
     * @returns {{ origin: 'embedded' | 'session', file?: File | Blob | null, name: string, relativePath?: string, format: string, payloadText?: string, sourceStream?: string, boundsMil?: { width: number, depth: number, height: number }, transform?: { rotationDeg?: { x?: number, y?: number, z?: number }, dzMil?: number } } | null}
     */
    resolveComponentBodyModel(componentBody) {
        const embeddedMatch = this.#resolveEmbeddedMatch(componentBody)
        if (
            embeddedMatch &&
            PcbScene3dModelRegistry.#isRenderableEmbeddedFormat(
                embeddedMatch.format
            )
        ) {
            return embeddedMatch
        }

        return this.#resolveExplicitMatch(componentBody?.name)
    }

    /**
     * Resolves a project-level full board assembly model for one PCB document.
     * @param {{ fileName?: string }} documentModel
     * @returns {{ origin: 'board-assembly', file?: File | Blob | null, name: string, relativePath: string, format: string } | null}
     */
    resolveBoardAssemblyModel(documentModel) {
        const normalizedBoardBaseName = PcbScene3dModelRegistry.#normalizeToken(
            PcbScene3dModelRegistry.#basenameWithoutExtension(
                documentModel?.fileName
            )
        )
        if (!normalizedBoardBaseName) {
            return null
        }

        const rankedMatches = this.#modelFiles
            .filter(
                (file) =>
                    file.normalizedBaseName === normalizedBoardBaseName &&
                    PcbScene3dModelRegistry.#isBoardAssemblyPath(
                        file.relativePath
                    )
            )
            .sort(
                (left, right) =>
                    PcbScene3dModelRegistry.#formatRank(left.format) -
                    PcbScene3dModelRegistry.#formatRank(right.format)
            )

        if (!rankedMatches.length) {
            return null
        }

        const matchedFile = rankedMatches[0]
        return {
            origin: 'board-assembly',
            file: matchedFile.file,
            name: matchedFile.name,
            relativePath: matchedFile.relativePath,
            format: matchedFile.format
        }
    }

    /**
     * Normalizes one embedded payload for registry lookup.
     * @param {{ id?: string, checksum?: number | null, name?: string, format?: string, payloadText?: string, sourceStream?: string, transform?: object }} model
     * @returns {{ id: string, checksum: number | null, name: string, format: string, payloadText: string, sourceStream: string, normalizedId: string, normalizedBaseName: string, boundsMil?: { width: number, depth: number, height: number }, transform?: { rotationDeg?: { x?: number, y?: number, z?: number }, dzMil?: number } } | null}
     */
    static #normalizeEmbeddedModel(model) {
        const id = String(model?.id || '').trim()
        const name = String(model?.name || '').trim()
        const format = String(model?.format || '').trim()
        const payloadText = String(model?.payloadText || '')
        const sourceStream = String(model?.sourceStream || '').trim()

        if (!id || !name || !format || !payloadText || !sourceStream) {
            return null
        }

        const boundsMil = PcbScene3dModelRegistry.#resolveEmbeddedBoundsMil(
            format,
            payloadText
        )
        const transform = PcbScene3dModelRegistry.#normalizeModelTransform(
            model?.transform
        )

        return {
            id,
            checksum: Number.isFinite(Number(model?.checksum))
                ? Number(model?.checksum)
                : null,
            name,
            format,
            payloadText,
            sourceStream,
            normalizedId: PcbScene3dModelRegistry.#normalizeToken(id),
            normalizedBaseName: PcbScene3dModelRegistry.#normalizeToken(
                name.replace(/\.[^.]+$/, '')
            ),
            ...(boundsMil ? { boundsMil } : {}),
            ...(transform ? { transform } : {})
        }
    }

    /**
     * Resolves one embedded model match from authored model metadata.
     * @param {{ modelId?: string, checksum?: number | null, name?: string }} componentBody
     * @returns {{ origin: 'embedded', name: string, format: string, payloadText: string, sourceStream: string, boundsMil?: { width: number, depth: number, height: number }, transform?: { rotationDeg?: { x?: number, y?: number, z?: number }, dzMil?: number } } | null}
     */
    #resolveEmbeddedMatch(componentBody) {
        const normalizedId = PcbScene3dModelRegistry.#normalizeToken(
            componentBody?.modelId
        )
        const checksum = Number.isFinite(Number(componentBody?.checksum))
            ? Number(componentBody?.checksum)
            : null
        const normalizedBaseName = PcbScene3dModelRegistry.#normalizeToken(
            String(componentBody?.name || '').replace(/\.[^.]+$/, '')
        )

        const embeddedMatch =
            this.#embeddedModels.find(
                (model) => normalizedId && model.normalizedId === normalizedId
            ) ||
            this.#embeddedModels.find(
                (model) =>
                    checksum !== null &&
                    model.checksum === checksum &&
                    normalizedBaseName &&
                    model.normalizedBaseName === normalizedBaseName
            ) ||
            this.#embeddedModels.find(
                (model) =>
                    normalizedBaseName &&
                    model.normalizedBaseName === normalizedBaseName
            )

        if (!embeddedMatch) {
            return null
        }

        return {
            origin: 'embedded',
            name: embeddedMatch.name,
            format: embeddedMatch.format,
            payloadText: embeddedMatch.payloadText,
            sourceStream: embeddedMatch.sourceStream,
            ...(embeddedMatch.boundsMil
                ? { boundsMil: embeddedMatch.boundsMil }
                : {}),
            ...(embeddedMatch.transform
                ? { transform: embeddedMatch.transform }
                : {})
        }
    }

    /**
     * Normalizes optional embedded model transform metadata.
     * @param {object | null | undefined} transform Source transform metadata.
     * @returns {{ rotationDeg?: { x?: number, y?: number, z?: number }, dzMil?: number } | null}
     */
    static #normalizeModelTransform(transform) {
        if (!transform || typeof transform !== 'object') {
            return null
        }

        const normalized = {}
        const sourceRotation = transform.rotationDeg || {}
        const rotationDeg = {}
        for (const axis of ['x', 'y', 'z']) {
            const value = Number(sourceRotation?.[axis])
            if (Number.isFinite(value)) {
                rotationDeg[axis] = value
            }
        }
        if (Object.keys(rotationDeg).length) {
            normalized.rotationDeg = rotationDeg
        }

        const dzMil = Number(transform.dzMil)
        if (Number.isFinite(dzMil)) {
            normalized.dzMil = dzMil
        }

        return Object.keys(normalized).length ? normalized : null
    }

    /**
     * Resolves an embedded model envelope in mils when the payload format is
     * inspectable without a geometry engine.
     * @param {string} format Embedded model format.
     * @param {string} payloadText Embedded model text payload.
     * @returns {{ width: number, depth: number, height: number } | null}
     */
    static #resolveEmbeddedBoundsMil(format, payloadText) {
        const normalizedFormat = String(format || '').toLowerCase()
        if (normalizedFormat !== 'step' && normalizedFormat !== 'stp') {
            return null
        }

        return PcbScene3dModelRegistry.#resolveStepBoundsMil(payloadText)
    }

    /**
     * Resolves a STEP payload envelope from authored Cartesian points.
     * @param {string} payloadText STEP text payload.
     * @returns {{ width: number, depth: number, height: number } | null}
     */
    static #resolveStepBoundsMil(payloadText) {
        const text = String(payloadText || '')
        const points = []
        const pointPattern =
            /CARTESIAN_POINT\s*\(\s*(?:'[^']*'|[^,]*),\s*\(([^)]*)\)\s*\)/giu
        let match = pointPattern.exec(text)

        while (match) {
            const coordinates = String(match[1] || '')
                .split(',')
                .slice(0, 3)
                .map((value) => Number(value.trim()))
            if (
                coordinates.length === 3 &&
                coordinates.every((value) => Number.isFinite(value))
            ) {
                points.push(coordinates)
            }

            match = pointPattern.exec(text)
        }

        if (points.length < 2) {
            return null
        }

        const scale = PcbScene3dModelRegistry.#resolveStepMilScale(text)
        const [firstPoint] = points
        const bounds = {
            minX: firstPoint[0],
            maxX: firstPoint[0],
            minY: firstPoint[1],
            maxY: firstPoint[1],
            minZ: firstPoint[2],
            maxZ: firstPoint[2]
        }

        points.slice(1).forEach(([x, y, z]) => {
            bounds.minX = Math.min(bounds.minX, x)
            bounds.maxX = Math.max(bounds.maxX, x)
            bounds.minY = Math.min(bounds.minY, y)
            bounds.maxY = Math.max(bounds.maxY, y)
            bounds.minZ = Math.min(bounds.minZ, z)
            bounds.maxZ = Math.max(bounds.maxZ, z)
        })

        return {
            width: (bounds.maxX - bounds.minX) * scale,
            depth: (bounds.maxY - bounds.minY) * scale,
            height: (bounds.maxZ - bounds.minZ) * scale
        }
    }

    /**
     * Resolves the STEP length-unit scale to mils.
     * @param {string} payloadText STEP text payload.
     * @returns {number}
     */
    static #resolveStepMilScale(payloadText) {
        const text = String(payloadText || '').toUpperCase()
        if (/\bINCH\b|\.INCH\./u.test(text)) {
            return MILS_PER_INCH
        }

        const siUnitMatch = text.match(
            /SI_UNIT\s*\(\s*(\.[A-Z]+\.|\$)\s*,\s*\.METRE\.\s*\)/u
        )
        if (siUnitMatch) {
            return (
                PcbScene3dModelRegistry.#metricPrefixMeterScale(
                    siUnitMatch[1]
                ) * MILS_PER_METER
            )
        }

        return MILS_PER_MILLIMETER
    }

    /**
     * Resolves one SI metric prefix into metres per STEP coordinate unit.
     * @param {string} prefix STEP SI prefix token.
     * @returns {number}
     */
    static #metricPrefixMeterScale(prefix) {
        switch (String(prefix || '').toUpperCase()) {
            case '.EXA.':
                return 1e18
            case '.PETA.':
                return 1e15
            case '.TERA.':
                return 1e12
            case '.GIGA.':
                return 1e9
            case '.MEGA.':
                return 1e6
            case '.KILO.':
                return 1e3
            case '.HECTO.':
                return 1e2
            case '.DECA.':
                return 1e1
            case '$':
                return 1
            case '.DECI.':
                return 1e-1
            case '.CENTI.':
                return 1e-2
            case '.MILLI.':
                return 1e-3
            case '.MICRO.':
                return 1e-6
            case '.NANO.':
                return 1e-9
            case '.PICO.':
                return 1e-12
            case '.FEMTO.':
                return 1e-15
            case '.ATTO.':
                return 1e-18
            default:
                return 1e-3
        }
    }

    /**
     * Resolves the format priority for ties.
     * @param {string} format
     * @returns {number}
     */
    static #formatRank(format) {
        return format === 'wrl' ? 0 : 1
    }

    /**
     * Checks whether one embedded payload format can be loaded inline.
     * @param {string} format Embedded payload format.
     * @returns {boolean}
     */
    static #isRenderableEmbeddedFormat(format) {
        return ['step', 'stp', 'wrl'].includes(
            String(format || '').toLowerCase()
        )
    }

    /**
     * Checks whether one model path is in a conventional board model folder.
     * @param {string | undefined} relativePath
     * @returns {boolean}
     */
    static #isBoardAssemblyPath(relativePath) {
        return String(relativePath || '')
            .replaceAll('\\', '/')
            .split('/')
            .some(
                (part) =>
                    PcbScene3dModelRegistry.#normalizeToken(part) === '3dbodies'
            )
    }

    /**
     * Returns one path basename without its extension.
     * @param {string | undefined} filePath
     * @returns {string}
     */
    static #basenameWithoutExtension(filePath) {
        const baseName =
            String(filePath || '')
                .replaceAll('\\', '/')
                .split('/')
                .filter(Boolean)
                .at(-1) || ''

        return baseName.replace(/\.[^.]+$/u, '')
    }

    /**
     * Normalizes one lookup token.
     * @param {string | undefined} value
     * @returns {string}
     */
    static #normalizeToken(value) {
        return String(value || '')
            .toLowerCase()
            .replaceAll('\\', '/')
            .replace(/[^a-z0-9/]+/g, '')
    }
}
