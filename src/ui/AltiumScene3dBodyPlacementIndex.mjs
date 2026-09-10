// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

/** Matches placements to authored bodies within one adapter invocation. */
export class AltiumScene3dBodyPlacementIndex {
    #cells = new Map()

    /**
     * Groups authored body positions into one-mil cells in source order.
     * @param {object[]} componentBodies Source component bodies.
     */
    constructor(componentBodies) {
        componentBodies.forEach((componentBody, order) => {
            const x = Number(componentBody?.positionMil?.x || 0)
            const y = Number(componentBody?.positionMil?.y || 0)
            if (!Number.isFinite(x) || !Number.isFinite(y)) return
            const key = `${Math.floor(x)}:${Math.floor(y)}`
            const cell = this.#cells.get(key) || []
            cell.push({ componentBody, x, y, order })
            this.#cells.set(key, cell)
        })
    }

    /**
     * Selects by identity affinity, distance, then original source order.
     * @param {object} placement Built external placement.
     * @returns {object | null}
     */
    resolve(placement) {
        const x = Number(placement?.bodyPositionMil?.x || 0)
        const y = Number(placement?.bodyPositionMil?.y || 0)
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null
        const placementText = AltiumScene3dBodyPlacementIndex.#identityText([
            placement?.designator,
            placement?.externalModel?.name
        ])
        let best = null
        let bestScore = -1
        let bestDistance = Infinity
        for (const dx of [-1, 0, 1]) {
            for (const dy of [-1, 0, 1]) {
                const cell =
                    this.#cells.get(
                        `${Math.floor(x) + dx}:${Math.floor(y) + dy}`
                    ) || []
                for (const candidate of cell) {
                    const distance = Math.hypot(
                        x - candidate.x,
                        y - candidate.y
                    )
                    if (!(distance <= 0.01)) continue
                    const bodyText =
                        AltiumScene3dBodyPlacementIndex.#identityText([
                            candidate.componentBody?.identifier,
                            candidate.componentBody?.name
                        ])
                    const score =
                        placementText &&
                        bodyText &&
                        placementText.includes(bodyText)
                            ? bodyText.length
                            : 0
                    if (
                        best &&
                        !(
                            score > bestScore ||
                            (score === bestScore &&
                                (distance < bestDistance ||
                                    (distance === bestDistance &&
                                        candidate.order < best.order)))
                        )
                    )
                        continue
                    best = candidate
                    bestScore = score
                    bestDistance = distance
                }
            }
        }
        return best?.componentBody || null
    }

    /**
     * Normalizes metadata with the placement adapter's identity convention.
     * @param {unknown[]} values Source identity fields.
     * @returns {string}
     */
    static #identityText(values) {
        return values
            .map((value) => String(value || '').toLowerCase())
            .join(' ')
            .replace(/\.[a-z0-9]+\\b/g, '')
            .replace(/[^a-z0-9]+/g, '')
    }
}
