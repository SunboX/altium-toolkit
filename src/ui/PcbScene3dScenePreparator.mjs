// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbScene3dBuilder } from './PcbScene3dBuilder.mjs'
import { PcbScene3dModelRegistry } from './PcbScene3dModelRegistry.mjs'

/**
 * Builds renderer-ready 3D scene descriptions for the initial viewport mount.
 */
export class PcbScene3dScenePreparator {
    /**
     * Builds one scene description for the initial runtime mount.
     * @param {any} documentModel
     * @param {{ sessionAssets?: any[], modelRegistry?: PcbScene3dModelRegistry | null, buildScene?: (documentModel: any, options: { modelRegistry: PcbScene3dModelRegistry }) => any }} [options]
     * @returns {Promise<any>}
     */
    static async prepare(documentModel, options = {}) {
        const modelRegistry =
            options.modelRegistry ||
            PcbScene3dModelRegistry.create(
                options.sessionAssets || [],
                Array.isArray(documentModel?.pcb?.embeddedModels)
                    ? documentModel.pcb.embeddedModels
                    : []
            )
        const buildScene =
            options.buildScene ||
            ((nextDocumentModel, buildOptions) =>
                PcbScene3dBuilder.build(nextDocumentModel, buildOptions))

        return buildScene(documentModel, {
            modelRegistry
        })
    }
}
