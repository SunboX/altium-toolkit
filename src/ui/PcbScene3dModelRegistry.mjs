// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Indexes session companion assets for 3D model lookup.
 */
export class PcbScene3dModelRegistry {
    /** @type {{ file?: File | Blob | null, name: string, relativePath: string, format: string, source: string, normalizedPath: string, normalizedBaseName: string }[]} */
    #modelFiles

    /** @type {{ id: string, checksum: number | null, name: string, format: string, payloadText: string, sourceStream: string, normalizedId: string, normalizedBaseName: string }[]} */
    #embeddedModels

    /**
     * @param {{ file?: File | Blob | null, name: string, relativePath: string, format: string, source: string, normalizedPath: string, normalizedBaseName: string }[]} modelFiles
     * @param {{ id: string, checksum: number | null, name: string, format: string, payloadText: string, sourceStream: string, normalizedId: string, normalizedBaseName: string }[]} embeddedModels
     */
    constructor(modelFiles, embeddedModels) {
        this.#modelFiles = modelFiles
        this.#embeddedModels = embeddedModels
    }

    /**
     * Creates one model registry from session files.
     * @param {{ name?: string, relativePath?: string, source?: string }[]} sessionFiles
     * @param {{ id?: string, checksum?: number | null, name?: string, format?: string, payloadText?: string, sourceStream?: string }[]} [embeddedModels]
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
     * @returns {{ origin: 'embedded' | 'session', file?: File | Blob | null, name: string, relativePath?: string, format: string, payloadText?: string, sourceStream?: string } | null}
     */
    resolveComponentBodyModel(componentBody) {
        const embeddedMatch = this.#resolveEmbeddedMatch(componentBody)
        if (embeddedMatch) {
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
     * @param {{ id?: string, checksum?: number | null, name?: string, format?: string, payloadText?: string, sourceStream?: string }} model
     * @returns {{ id: string, checksum: number | null, name: string, format: string, payloadText: string, sourceStream: string, normalizedId: string, normalizedBaseName: string } | null}
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
            )
        }
    }

    /**
     * Resolves one embedded model match from authored model metadata.
     * @param {{ modelId?: string, checksum?: number | null, name?: string }} componentBody
     * @returns {{ origin: 'embedded', name: string, format: string, payloadText: string, sourceStream: string } | null}
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
            sourceStream: embeddedMatch.sourceStream
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
