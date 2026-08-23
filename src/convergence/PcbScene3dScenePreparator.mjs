// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { PcbScene3dBuilder } from './PcbScene3dBuilder.mjs'
import { PcbScene3dModelRegistry } from './PcbScene3dModelRegistry.mjs'

/**
 * Builds converged renderer-ready scene descriptions for async preprocessing.
 */
export class PcbScene3dScenePreparator {
    /**
     * Builds one scene description with the converged registry and builder.
     * @param {object} documentModel Parsed Altium document model.
     * @param {{ sessionAssets?: object[], modelRegistry?: object | null, buildScene?: (documentModel: object, options: { modelRegistry: object }) => object }} [options] Scene preparation options.
     * @returns {Promise<object>}
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

        return buildScene(documentModel, { modelRegistry })
    }
}
