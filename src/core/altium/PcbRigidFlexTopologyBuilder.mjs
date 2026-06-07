// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Derives a rigid-flex topology report from the PCB layer-stack read model.
 */
export class PcbRigidFlexTopologyBuilder {
    static SCHEMA_ID = 'altium-toolkit.pcb.rigid-flex-topology.a1'

    /**
     * Builds a rigid-flex topology sidecar.
     * @param {object | undefined} layerStackReadModel Layer-stack sidecar.
     * @returns {object | undefined}
     */
    static build(layerStackReadModel) {
        if (!layerStackReadModel) return undefined

        const substacks = layerStackReadModel.substacks || []
        const boardRegions = layerStackReadModel.boardRegions || []
        const substackRegionJoins =
            PcbRigidFlexTopologyBuilder.#substackRegionJoins(substacks)
        const branchGraph = PcbRigidFlexTopologyBuilder.#branchGraph(
            layerStackReadModel.branches || [],
            substacks
        )
        const bendLines = PcbRigidFlexTopologyBuilder.#bendLines(
            substacks,
            boardRegions
        )
        const diagnostics = PcbRigidFlexTopologyBuilder.#diagnostics({
            substacks,
            branchGraph
        })
        const summary = {
            substackCount: substacks.length,
            flexSubstackCount: substacks.filter((substack) => substack.isFlex)
                .length,
            boardRegionCount:
                layerStackReadModel.summary?.boardRegionCount || 0,
            branchCount: branchGraph.length,
            bendLineCount: bendLines.length,
            diagnosticCount: diagnostics.length
        }

        return {
            schema: PcbRigidFlexTopologyBuilder.SCHEMA_ID,
            summary,
            substackRegionJoins,
            branchGraph,
            bendLines,
            diagnostics
        }
    }

    /**
     * Builds substack-to-board-region join rows.
     * @param {object[]} substacks Layer substacks.
     * @returns {object[]}
     */
    static #substackRegionJoins(substacks) {
        return substacks.map((substack) => ({
            substackId: substack.id,
            substackName: substack.name,
            isFlex: substack.isFlex,
            layerKeys: substack.layerKeys || [],
            regionIndexes: substack.boardRegionIndexes || [],
            regionNames: substack.boardRegionNames || []
        }))
    }

    /**
     * Builds a branch graph with resolved child substack summaries.
     * @param {object[]} branches Stack branches.
     * @param {object[]} substacks Layer substacks.
     * @returns {object[]}
     */
    static #branchGraph(branches, substacks) {
        const substackById = new Map(
            substacks
                .filter((substack) => substack.id)
                .map((substack) => [substack.id, substack])
        )

        return branches.map((branch) => ({
            branchId: branch.id,
            branchName: branch.name,
            rootStackRef: branch.rootStackRef,
            stackRefs: branch.stackRefs || [],
            ...(branch.sections ? { sections: branch.sections } : {}),
            childSubstacks: (branch.stackRefs || []).flatMap((stackRef) => {
                const substack = substackById.get(stackRef)
                if (!substack) return []

                return [
                    {
                        id: substack.id,
                        name: substack.name,
                        isFlex: substack.isFlex
                    }
                ]
            })
        }))
    }

    /**
     * Builds bend-line summaries.
     * @param {object[]} substacks Layer substacks.
     * @param {object[]} boardRegions Board-region summaries.
     * @returns {object[]}
     */
    static #bendLines(substacks, boardRegions) {
        const regionNameByIndex = new Map(
            boardRegions.map((region) => [region.regionIndex, region.name])
        )

        return substacks.flatMap((substack) =>
            (substack.boardRegionIndexes || []).flatMap((regionIndex) =>
                Array.from({ length: substack.bendingLineCount || 0 }).map(
                    (_, lineIndex) =>
                        PcbRigidFlexTopologyBuilder.#stripUndefined({
                            substackId: substack.id,
                            substackName: substack.name,
                            regionIndex,
                            regionName: regionNameByIndex.get(regionIndex),
                            lineIndex
                        })
                )
            )
        )
    }

    /**
     * Builds topology diagnostics.
     * @param {{ substacks: object[], branchGraph: object[] }} input Topology sections.
     * @returns {object[]}
     */
    static #diagnostics(input) {
        const diagnostics = []
        const substackIds = new Set(
            input.substacks.map((substack) => substack.id).filter(Boolean)
        )

        for (const branch of input.branchGraph) {
            for (const stackRef of branch.stackRefs || []) {
                if (substackIds.has(stackRef)) continue
                diagnostics.push({
                    code: 'pcb.rigid-flex.unresolved-branch-substack',
                    severity: 'warning',
                    message:
                        'Rigid-flex branch graph references an unknown substack.',
                    branchId: branch.branchId,
                    stackRef
                })
            }
        }

        return diagnostics
    }

    /**
     * Removes undefined values from an object.
     * @param {Record<string, unknown>} object Source object.
     * @returns {object}
     */
    static #stripUndefined(object) {
        return Object.fromEntries(
            Object.entries(object).filter(([, value]) => value !== undefined)
        )
    }
}
