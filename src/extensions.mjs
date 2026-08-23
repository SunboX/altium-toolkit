// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

export * from 'circuitjson-toolkit/extensions'

export { AltiumExtensionResolver } from './convergence/AltiumExtensionResolver.mjs'
export { PcbScene3dBuilder } from './convergence/PcbScene3dBuilder.mjs'
export { PcbScene3dModelRegistry } from './convergence/PcbScene3dModelRegistry.mjs'
export { PcbSvgRenderer } from './convergence/PcbSvgRenderer.mjs'
export { SchematicSvgRenderer } from './convergence/SchematicSvgRenderer.mjs'
export * from './legacy-parser.mjs'
export * from './legacy-netlist-query.mjs'
export * from './legacy-renderers.mjs'
export {
    AltiumScene3dAuthoredBodyAnchorAdapter,
    PcbScene3dPackages,
    PcbScene3dScenePreparator,
    PcbScene3dSummaryRenderer,
    PcbScene3dTextBoxLayoutResolver
} from './legacy-scene3d.mjs'
