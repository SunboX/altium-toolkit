// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { PcbScene3dBuilder } from '../../src/extensions.mjs'

const MAX_COPPER_MESHES = 420

/**
 * Mounts a lightweight interactive Three.js PCB preview for the example page.
 */
export class PcbThreeSceneRenderer {
    #rootNode
    #mountNode
    #documentModel
    #sceneDescription
    #renderer = null
    #scene = null
    #camera = null
    #controls = null
    #resizeObserver = null
    #animationFrame = 0
    #listeners = []
    #groups = new Map()
    #isDisposed = false

    /**
     * Creates and starts an interactive PCB scene in an existing shell.
     * @param {HTMLElement} rootNode
     * @param {{ pcb?: any }} documentModel
     * @returns {PcbThreeSceneRenderer}
     */
    static renderInto(rootNode, documentModel) {
        const renderer = new PcbThreeSceneRenderer(rootNode, documentModel)
        renderer.start()
        return renderer
    }

    /**
     * Creates a Three.js renderer controller.
     * @param {HTMLElement} rootNode
     * @param {{ pcb?: any }} documentModel
     */
    constructor(rootNode, documentModel) {
        this.#rootNode = rootNode
        this.#mountNode = rootNode.querySelector(
            '[data-three-scene-3d-viewport]'
        )
        this.#documentModel = documentModel
        this.#sceneDescription = PcbScene3dBuilder.build(documentModel)
    }

    /**
     * Starts the Three.js scene.
     * @returns {void}
     */
    start() {
        if (!this.#documentModel?.pcb || !this.#mountNode) {
            this.#setDiagnostics('3D preview is available for PCB documents.')
            this.#setLoading(false)
            return
        }

        this.#createRenderer()
        this.#createScene()
        this.#createControls()
        this.#bindUiControls()
        this.#observeSize()
        this.setPreset('isometric')
        this.#setDiagnostics(this.#formatSceneSummary())
        this.#setLoading(false)
        this.#renderLoop()
    }

    /**
     * Applies a named camera preset.
     * @param {string} preset
     * @returns {void}
     */
    setPreset(preset) {
        if (!this.#camera || !this.#controls) return

        const normalizedPreset = String(preset || 'isometric').toLowerCase()
        const radius = this.#resolveCameraRadius(normalizedPreset)
        const target = new THREE.Vector3(0, 0, 0)
        let position = new THREE.Vector3(radius, -radius, radius * 0.65)
        let up = new THREE.Vector3(0, 0, 1)

        if (normalizedPreset === 'top') {
            position = new THREE.Vector3(0, 0, radius)
            up = new THREE.Vector3(0, 1, 0)
        }

        if (normalizedPreset === 'bottom') {
            position = new THREE.Vector3(0, 0, -radius)
            up = new THREE.Vector3(0, -1, 0)
        }

        this.#camera.up.copy(up)
        this.#camera.position.copy(position)
        this.#controls.target.copy(target)
        this.#camera.lookAt(target)
        this.#controls.update()
        this.#syncPresetButtons(normalizedPreset)
    }

    /**
     * Shows or hides a scene detail group.
     * @param {string} groupName
     * @param {boolean} isVisible
     * @returns {void}
     */
    setGroupVisibility(groupName, isVisible) {
        const group = this.#groups.get(groupName)
        if (!group) return

        group.visible = isVisible
    }

    /**
     * Releases browser and Three.js resources.
     * @returns {void}
     */
    dispose() {
        this.#isDisposed = true
        if (this.#animationFrame) cancelAnimationFrame(this.#animationFrame)

        for (const { node, type, listener } of this.#listeners) {
            node.removeEventListener(type, listener)
        }

        this.#listeners = []
        this.#resizeObserver?.disconnect()
        this.#controls?.dispose()
        this.#disposeSceneGraph()
        this.#renderer?.dispose()
        this.#renderer?.domElement?.remove()

        this.#renderer = null
        this.#scene = null
        this.#camera = null
        this.#controls = null
        this.#resizeObserver = null
        this.#groups.clear()
    }

    /**
     * Creates the WebGL renderer and camera.
     * @returns {void}
     */
    #createRenderer() {
        const { width, height } = this.#resolveViewportSize()
        const board = this.#sceneDescription.board
        const cameraFar = Math.max(board.widthMil, board.heightMil, 1000) * 8

        this.#renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        })
        this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        this.#renderer.setSize(width, height, false)
        this.#renderer.setClearColor(0xf6f1e8, 1)
        this.#renderer.domElement.className = 'scene-3d__canvas'
        this.#renderer.domElement.setAttribute(
            'aria-label',
            'Interactive PCB 3D canvas'
        )

        this.#camera = new THREE.PerspectiveCamera(
            38,
            width / height,
            1,
            cameraFar
        )
        this.#camera.up.set(0, 0, 1)
        this.#mountNode.replaceChildren(this.#renderer.domElement)
    }

    /**
     * Creates lights and scene meshes.
     * @returns {void}
     */
    #createScene() {
        const board = this.#sceneDescription.board
        const boardSpan = Math.max(board.widthMil, board.heightMil, 1000)

        this.#scene = new THREE.Scene()
        this.#scene.fog = new THREE.Fog(
            0xf6f1e8,
            boardSpan * 2.2,
            boardSpan * 8
        )
        this.#scene.add(new THREE.AmbientLight(0xffffff, 1.7))

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.6)
        keyLight.position.set(1600, -2600, 4200)
        this.#scene.add(keyLight)

        const fillLight = new THREE.DirectionalLight(0xd7ebff, 0.85)
        fillLight.position.set(-3000, 1800, 2600)
        this.#scene.add(fillLight)

        const rootGroup = new THREE.Group()
        rootGroup.add(this.#buildBoardGroup())
        rootGroup.add(this.#buildComponentGroup())
        rootGroup.add(this.#buildCopperGroup())
        this.#scene.add(rootGroup)
    }

    /**
     * Creates OrbitControls for browser interaction.
     * @returns {void}
     */
    #createControls() {
        this.#controls = new OrbitControls(
            this.#camera,
            this.#renderer.domElement
        )
        this.#controls.enableDamping = true
        this.#controls.dampingFactor = 0.08
        this.#controls.screenSpacePanning = true
        this.#controls.minDistance = 220
        this.#controls.maxDistance =
            Math.max(
                this.#sceneDescription.board.widthMil,
                this.#sceneDescription.board.heightMil,
                900
            ) * 4
    }

    /**
     * Binds preset buttons and visibility toggles in the scene shell.
     * @returns {void}
     */
    #bindUiControls() {
        const presetButtons = [
            ...this.#rootNode.querySelectorAll('[data-three-scene-3d-preset]')
        ]
        const toggles = [
            ...this.#rootNode.querySelectorAll('[data-three-scene-3d-toggle]')
        ]

        for (const button of presetButtons) {
            const listener = () =>
                this.setPreset(
                    button.getAttribute('data-three-scene-3d-preset')
                )
            button.addEventListener('click', listener)
            this.#listeners.push({ node: button, type: 'click', listener })
        }

        for (const toggle of toggles) {
            const listener = () => {
                this.setGroupVisibility(
                    toggle.getAttribute('data-three-scene-3d-toggle'),
                    toggle.checked
                )
            }
            toggle.addEventListener('change', listener)
            this.#listeners.push({ node: toggle, type: 'change', listener })
            this.setGroupVisibility(
                toggle.getAttribute('data-three-scene-3d-toggle'),
                toggle.checked
            )
        }
    }

    /**
     * Resolves the camera distance needed to keep the board framed.
     * @param {string} preset
     * @returns {number}
     */
    #resolveCameraRadius(preset) {
        const board = this.#sceneDescription.board
        const verticalFov = THREE.MathUtils.degToRad(this.#camera.fov)
        const aspect = Math.max(Number(this.#camera.aspect || 1), 0.1)
        const horizontalFit =
            board.widthMil / (2 * Math.tan(verticalFov / 2) * aspect)
        const verticalFit = board.heightMil / (2 * Math.tan(verticalFov / 2))
        const flatFit = Math.max(horizontalFit, verticalFit, 900) * 1.16

        return preset === 'isometric' ? flatFit * 1.12 : flatFit
    }

    /**
     * Watches the mount size and keeps the canvas sharp.
     * @returns {void}
     */
    #observeSize() {
        if (typeof ResizeObserver !== 'undefined') {
            this.#resizeObserver = new ResizeObserver(() => this.#resize())
            this.#resizeObserver.observe(this.#mountNode)
        }

        window.addEventListener('resize', this.#resize)
        this.#listeners.push({
            node: window,
            type: 'resize',
            listener: this.#resize
        })
    }

    /**
     * Builds the board shell and outline.
     * @returns {THREE.Group}
     */
    #buildBoardGroup() {
        const board = this.#sceneDescription.board
        const boardGroup = new THREE.Group()
        const width = Math.max(board.widthMil, 80)
        const height = Math.max(board.heightMil, 80)
        const thickness = Math.max(board.thicknessMil, 24)
        const boardMesh = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, thickness),
            new THREE.MeshStandardMaterial({
                color: 0x1f7a68,
                roughness: 0.72,
                metalness: 0.02
            })
        )
        const edgeLines = new THREE.LineSegments(
            new THREE.EdgesGeometry(boardMesh.geometry),
            new THREE.LineBasicMaterial({
                color: 0x0e423a,
                transparent: true,
                opacity: 0.46
            })
        )

        boardGroup.add(boardMesh)
        boardGroup.add(edgeLines)
        this.#groups.set('board', boardGroup)

        return boardGroup
    }

    /**
     * Builds simplified component package bodies.
     * @returns {THREE.Group}
     */
    #buildComponentGroup() {
        const componentGroup = new THREE.Group()

        for (const component of this.#sceneDescription.components) {
            const body = component.body || {}
            const size = body.sizeMil || {}
            const width = Math.max(Number(size.width || 0), 36)
            const depth = Math.max(Number(size.depth || 0), 36)
            const height = Math.max(Number(size.height || 0), 24)
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(width, depth, height),
                new THREE.MeshStandardMaterial({
                    color: this.#resolveComponentColor(body.family),
                    roughness: 0.62,
                    metalness: 0.06
                })
            )
            const position = component.positionMil || {}

            mesh.position.set(
                Number(position.x || 0),
                Number(position.y || 0),
                Number(position.z || 0)
            )
            mesh.rotation.z = THREE.MathUtils.degToRad(
                Number(component.rotationDeg || 0)
            )
            mesh.userData = {
                designator: component.designator,
                family: body.family,
                mountSide: component.mountSide
            }
            componentGroup.add(mesh)
            componentGroup.add(this.#buildMeshEdges(mesh, 0x132127, 0.28))
        }

        this.#groups.set('components', componentGroup)

        return componentGroup
    }

    /**
     * Builds a capped set of top-side copper pad and track hints.
     * @returns {THREE.Group}
     */
    #buildCopperGroup() {
        const copperGroup = new THREE.Group()
        const board = this.#sceneDescription.board
        const copperMaterial = new THREE.MeshStandardMaterial({
            color: 0xc35f35,
            roughness: 0.48,
            metalness: 0.18
        })
        let meshCount = 0

        for (const pad of this.#sceneDescription.detail.pads || []) {
            if (meshCount >= MAX_COPPER_MESHES) break

            const padSize = this.#resolvePadSize(pad)
            const padMesh = new THREE.Mesh(
                new THREE.BoxGeometry(padSize.width, padSize.height, 5),
                copperMaterial
            )
            padMesh.position.set(
                Number(pad.x || 0) - board.centerX,
                Number(pad.y || 0) - board.centerY,
                board.thicknessMil / 2 + 3
            )
            copperGroup.add(padMesh)
            meshCount += 1
        }

        for (const track of this.#sceneDescription.detail.tracks || []) {
            if (meshCount >= MAX_COPPER_MESHES) break

            const trackMesh = this.#buildTrackMesh(track, copperMaterial)
            if (!trackMesh) continue

            copperGroup.add(trackMesh)
            meshCount += 1
        }

        this.#groups.set('copper', copperGroup)

        return copperGroup
    }

    /**
     * Builds a simple track rectangle between two endpoints.
     * @param {Record<string, number>} track
     * @param {THREE.Material} material
     * @returns {THREE.Mesh | null}
     */
    #buildTrackMesh(track, material) {
        const board = this.#sceneDescription.board
        const x1 = Number(track.x1 ?? track.xStart ?? track.startX ?? NaN)
        const y1 = Number(track.y1 ?? track.yStart ?? track.startY ?? NaN)
        const x2 = Number(track.x2 ?? track.xEnd ?? track.endX ?? NaN)
        const y2 = Number(track.y2 ?? track.yEnd ?? track.endY ?? NaN)
        if (![x1, y1, x2, y2].every(Number.isFinite)) return null

        const length = Math.hypot(x2 - x1, y2 - y1)
        if (length <= 0) return null

        const width = Math.max(Number(track.width || track.lineWidth || 8), 5)
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(length, width, 4),
            material
        )
        mesh.position.set(
            (x1 + x2) / 2 - board.centerX,
            (y1 + y2) / 2 - board.centerY,
            board.thicknessMil / 2 + 4
        )
        mesh.rotation.z = Math.atan2(y2 - y1, x2 - x1)

        return mesh
    }

    /**
     * Creates edge line segments for a mesh.
     * @param {THREE.Mesh} mesh
     * @param {number} color
     * @param {number} opacity
     * @returns {THREE.LineSegments}
     */
    #buildMeshEdges(mesh, color, opacity) {
        const edgeLines = new THREE.LineSegments(
            new THREE.EdgesGeometry(mesh.geometry),
            new THREE.LineBasicMaterial({
                color,
                transparent: true,
                opacity
            })
        )
        edgeLines.position.copy(mesh.position)
        edgeLines.rotation.copy(mesh.rotation)

        return edgeLines
    }

    /**
     * Resizes the renderer to the viewport.
     * @returns {void}
     */
    #resize = () => {
        if (!this.#renderer || !this.#camera || !this.#mountNode) return

        const { width, height } = this.#resolveViewportSize()
        this.#camera.aspect = width / height
        this.#camera.updateProjectionMatrix()
        this.#renderer.setSize(width, height, false)
    }

    /**
     * Renders the scene continuously for smooth controls.
     * @returns {void}
     */
    #renderLoop = () => {
        if (this.#isDisposed) return

        this.#controls?.update()
        this.#renderer?.render(this.#scene, this.#camera)
        this.#animationFrame = requestAnimationFrame(this.#renderLoop)
    }

    /**
     * Resolves the current viewport size.
     * @returns {{ width: number, height: number }}
     */
    #resolveViewportSize() {
        const bounds = this.#mountNode?.getBoundingClientRect?.() || {}

        return {
            width: Math.max(Math.round(bounds.width || 900), 320),
            height: Math.max(Math.round(bounds.height || 560), 280)
        }
    }

    /**
     * Resolves a pad footprint size.
     * @param {{ sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number }} pad
     * @returns {{ width: number, height: number }}
     */
    #resolvePadSize(pad) {
        return {
            width: Math.max(
                Number(pad.sizeTopX || pad.sizeMidX || pad.sizeBottomX || 34),
                14
            ),
            height: Math.max(
                Number(pad.sizeTopY || pad.sizeMidY || pad.sizeBottomY || 34),
                14
            )
        }
    }

    /**
     * Resolves a component material color by package family.
     * @param {string | undefined} family
     * @returns {number}
     */
    #resolveComponentColor(family) {
        const normalizedFamily = String(family || '').toLowerCase()
        if (normalizedFamily.includes('capacitor')) return 0x2a6fbb
        if (normalizedFamily.includes('connector')) return 0x3b4650
        if (normalizedFamily.includes('resistor')) return 0xd4b25f
        if (normalizedFamily.includes('ic')) return 0x202832
        if (normalizedFamily.includes('diode')) return 0x642f93

        return 0x687782
    }

    /**
     * Writes scene diagnostics.
     * @param {string} message
     * @returns {void}
     */
    #setDiagnostics(message) {
        const diagnosticsNode = this.#rootNode.querySelector(
            '[data-three-scene-3d-diagnostics]'
        )
        if (diagnosticsNode) diagnosticsNode.textContent = message
    }

    /**
     * Shows or hides the loading state.
     * @param {boolean} isLoading
     * @returns {void}
     */
    #setLoading(isLoading) {
        const loadingNode = this.#rootNode.querySelector(
            '[data-three-scene-3d-loading]'
        )
        if (loadingNode) loadingNode.hidden = !isLoading
    }

    /**
     * Updates pressed state on camera preset buttons.
     * @param {string} activePreset
     * @returns {void}
     */
    #syncPresetButtons(activePreset) {
        const presetButtons = [
            ...this.#rootNode.querySelectorAll('[data-three-scene-3d-preset]')
        ]

        for (const button of presetButtons) {
            const isActive =
                button.getAttribute('data-three-scene-3d-preset') ===
                activePreset
            button.classList.toggle('is-active', isActive)
            button.setAttribute('aria-pressed', String(isActive))
        }
    }

    /**
     * Formats a compact scene summary for the diagnostics region.
     * @returns {string}
     */
    #formatSceneSummary() {
        const board = this.#sceneDescription.board
        const width = Math.round(board.widthMil)
        const height = Math.round(board.heightMil)
        const components = this.#sceneDescription.components.length

        return (
            width +
            ' x ' +
            height +
            ' mil PCB with ' +
            components +
            ' rendered package bodies.'
        )
    }

    /**
     * Releases scene graph geometries and materials.
     * @returns {void}
     */
    #disposeSceneGraph() {
        this.#scene?.traverse((object) => {
            object.geometry?.dispose?.()
            const material = object.material
            if (Array.isArray(material)) {
                material.forEach((entry) => entry.dispose?.())
            } else {
                material?.dispose?.()
            }
        })
    }
}
