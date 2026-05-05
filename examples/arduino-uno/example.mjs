import {
    AltiumParser,
    BomTableRenderer,
    PcbScene3dSummaryRenderer,
    PcbSvgRenderer,
    SchematicSvgRenderer
} from '../../src/index.mjs'
import { PcbThreeSceneRenderer } from './PcbThreeSceneRenderer.mjs'
import { SvgViewportController } from './SvgViewportController.mjs'

const SOURCE_PROJECT_URL =
    'https://github.com/Mehdi-KHALFALLAH/My-Arduino-UNO-Design'
const SOURCE_DOCUMENTS = [
    {
        key: 'schematic',
        label: 'source schematic',
        fileName: '[03] - 28PINS SHEMATIC.SchDoc',
        defaultView: 'schematic',
        url: 'https://raw.githubusercontent.com/Mehdi-KHALFALLAH/My-Arduino-UNO-Design/master/Design%20Files/28_Pin%20Project%20V1.1/%5B03%5D%20-%2028PINS%20SHEMATIC.SchDoc'
    },
    {
        key: 'pcb',
        label: 'source PCB',
        fileName: '28Pins_Project_1.1_PCB.PcbDoc',
        defaultView: 'pcb',
        url: 'https://raw.githubusercontent.com/Mehdi-KHALFALLAH/My-Arduino-UNO-Design/master/Design%20Files/28_Pin%20Project%20V1.1/28Pins_Project_1.1_PCB.PcbDoc'
    }
]

/**
 * Coordinates the local-file example page.
 */
class ArduinoUnoExample {
    #activeView = 'schematic'
    #documentModel = null
    #elements
    #sourceDocumentModels = new Map()
    #svgViewportController = null
    #threeRenderer = null

    /**
     * Starts the browser example.
     * @returns {void}
     */
    static boot() {
        new ArduinoUnoExample().#bind()
    }

    /**
     * Creates the page controller.
     */
    constructor() {
        this.#elements = {
            input: document.querySelector('#document-file'),
            output: document.querySelector('#output'),
            status: document.querySelector('#status'),
            tabs: [...document.querySelectorAll('[data-view]')]
        }
    }

    /**
     * Wires DOM events.
     * @returns {void}
     */
    #bind() {
        this.#elements.input?.addEventListener('change', (event) => {
            this.#handleFileSelection(event)
        })

        for (const tab of this.#elements.tabs) {
            tab.addEventListener('click', () => {
                this.#setActiveView(tab.dataset.view)
            })
        }

        this.#loadSourceDocuments()
    }

    /**
     * Reads and parses the selected file.
     * @param {Event} event
     * @returns {Promise<void>}
     */
    async #handleFileSelection(event) {
        const [file] = event.target.files || []
        if (!file) return

        this.#setStatus('Parsing ' + file.name + '...', 'busy')

        try {
            this.#disposeSvgViewportController()
            this.#disposeThreeRenderer()
            const arrayBuffer = await file.arrayBuffer()
            this.#documentModel = AltiumParser.parseArrayBuffer(
                file.name,
                arrayBuffer
            )
            this.#activeView =
                this.#documentModel.kind === 'pcb' ? 'pcb' : 'schematic'
            this.#setStatus(
                'Loaded ' +
                    file.name +
                    ' as ' +
                    this.#documentModel.fileType +
                    '.',
                'ready'
            )
            this.#syncTabs()
            this.#render()
        } catch (error) {
            this.#disposeSvgViewportController()
            this.#disposeThreeRenderer()
            this.#documentModel = null
            this.#setStatus(this.#formatError(error), 'error')
            this.#renderError(error)
        }
    }

    /**
     * Fetches and parses every document from the credited source project.
     * @returns {Promise<void>}
     */
    async #loadSourceDocuments() {
        this.#disposeSvgViewportController()
        this.#disposeThreeRenderer()
        this.#documentModel = null
        this.#activeView = 'schematic'
        this.#syncTabs()
        this.#setStatus(
            'Loading credited source documents from GitHub...',
            'busy'
        )
        this.#elements.output.innerHTML = this.#renderLoadingState()

        try {
            const loadedDocuments = await Promise.all(
                SOURCE_DOCUMENTS.map((sourceDocument) =>
                    this.#fetchSourceDocument(sourceDocument)
                )
            )
            this.#sourceDocumentModels = new Map(
                loadedDocuments.map(({ sourceDocument, documentModel }) => [
                    sourceDocument.key,
                    documentModel
                ])
            )
            this.#setStatus(
                'Loaded credited source schematic and source PCB from Mehdi KHALFALLAH via raw.githubusercontent.com.',
                'ready'
            )
            this.#syncTabs()
            this.#render()
        } catch (error) {
            this.#sourceDocumentModels = new Map()
            this.#setStatus(this.#formatError(error), 'error')
            this.#renderError(error)
        }
    }

    /**
     * Fetches and parses one credited source document.
     * @param {{ key: string, label: string, fileName: string, defaultView: string, url: string }} sourceDocument
     * @returns {Promise<{ sourceDocument: { key: string, label: string, fileName: string, defaultView: string, url: string }, documentModel: ReturnType<typeof AltiumParser.parseArrayBuffer> }>}
     */
    async #fetchSourceDocument(sourceDocument) {
        const response = await fetch(sourceDocument.url)
        if (!response.ok) {
            throw new Error(
                'GitHub returned HTTP ' +
                    response.status +
                    ' for ' +
                    sourceDocument.fileName +
                    '.'
            )
        }

        const arrayBuffer = await response.arrayBuffer()
        return {
            sourceDocument,
            documentModel: AltiumParser.parseArrayBuffer(
                sourceDocument.fileName,
                arrayBuffer
            )
        }
    }

    /**
     * Changes the active renderer tab.
     * @param {string | undefined} view
     * @returns {void}
     */
    #setActiveView(view) {
        if (!view) return
        this.#activeView = view
        this.#syncTabs()
        this.#render()
    }

    /**
     * Updates tab ARIA and selected state.
     * @returns {void}
     */
    #syncTabs() {
        for (const tab of this.#elements.tabs) {
            const isActive = tab.dataset.view === this.#activeView
            tab.classList.toggle('is-active', isActive)
            tab.setAttribute('aria-selected', String(isActive))
        }
    }

    /**
     * Selects the parsed document model for the current view.
     * @returns {ReturnType<typeof AltiumParser.parseArrayBuffer> | null}
     */
    #getActiveDocumentModel() {
        if (this.#documentModel) return this.#documentModel

        const sourceKeyByView = {
            '3d': 'pcb',
            bom: 'schematic',
            metadata: 'schematic',
            pcb: 'pcb',
            schematic: 'schematic',
            summary: 'pcb'
        }
        const sourceKey = sourceKeyByView[this.#activeView]

        return (
            this.#sourceDocumentModels.get(sourceKey) ||
            this.#sourceDocumentModels.values().next().value ||
            null
        )
    }

    /**
     * Writes the current view to the output panel.
     * @returns {void}
     */
    #render() {
        this.#disposeSvgViewportController()
        this.#disposeThreeRenderer()
        const documentModel = this.#getActiveDocumentModel()
        if (!documentModel) {
            this.#elements.output.innerHTML = this.#renderEmptyState()
            return
        }

        const renderers = {
            schematic: () => SchematicSvgRenderer.render(documentModel),
            pcb: () => PcbSvgRenderer.render(documentModel),
            bom: () => BomTableRenderer.render(documentModel.bom || []),
            '3d': () => this.#renderThreeScene(documentModel),
            summary: () => PcbScene3dSummaryRenderer.render(documentModel),
            metadata: () => this.#renderMetadata(documentModel)
        }

        this.#elements.output.innerHTML =
            renderers[this.#activeView]?.() || this.#renderEmptyState()

        if (this.#activeView === 'schematic') {
            this.#mountSvgViewport('.schematic-svg')
        } else if (this.#activeView === 'pcb') {
            this.#mountSvgViewport('.pcb-svg')
        } else if (this.#activeView === '3d') {
            this.#mountThreeScene(documentModel)
        }
    }

    /**
     * Mounts pan and zoom controls on the active SVG renderer output.
     * @param {string} selector
     * @returns {void}
     */
    #mountSvgViewport(selector) {
        const svgElement = this.#elements.output.querySelector(selector)
        if (!svgElement) return

        this.#svgViewportController = new SvgViewportController(svgElement)
    }

    /**
     * Releases the active SVG viewport controller when the view changes.
     * @returns {void}
     */
    #disposeSvgViewportController() {
        this.#svgViewportController?.dispose()
        this.#svgViewportController = null
    }

    /**
     * Mounts the browser-only Three.js PCB view.
     * @param {ReturnType<typeof AltiumParser.parseArrayBuffer>} documentModel
     * @returns {void}
     */
    #mountThreeScene(documentModel) {
        const rootNode = this.#elements.output.querySelector(
            '[data-three-scene-3d]'
        )
        if (!rootNode) return

        try {
            this.#threeRenderer = PcbThreeSceneRenderer.renderInto(
                rootNode,
                documentModel
            )
        } catch (error) {
            this.#renderError(error)
        }
    }

    /**
     * Releases the active Three.js renderer when the view changes.
     * @returns {void}
     */
    #disposeThreeRenderer() {
        this.#threeRenderer?.dispose()
        this.#threeRenderer = null
    }

    /**
     * Renders the interactive Three.js PCB shell.
     * @param {ReturnType<typeof AltiumParser.parseArrayBuffer>} documentModel
     * @returns {string}
     */
    #renderThreeScene(documentModel) {
        const pcb = documentModel?.pcb
        if (!pcb) {
            return '<section class="empty-state"><h2>No PCB document loaded</h2><p>The interactive 3D view renders after the credited source PCB or another PCB document is loaded.</p></section>'
        }

        const widthMil = Math.round(pcb.boardOutline?.widthMil || 0)
        const heightMil = Math.round(pcb.boardOutline?.heightMil || 0)
        const componentCount = pcb.components?.length || 0
        const padCount = pcb.pads?.length || 0

        return (
            '<section class="scene-3d" data-three-scene-3d><header class="scene-3d__header"><div><h2>Interactive 3D PCB</h2><p>' +
            widthMil +
            ' x ' +
            heightMil +
            ' mil board envelope</p></div><dl class="scene-3d__stats"><div><dt>Components</dt><dd>' +
            componentCount +
            '</dd></div><div><dt>Pads</dt><dd>' +
            padCount +
            '</dd></div></dl></header><div class="scene-3d__toolbar" aria-label="3D camera presets">' +
            '<button class="scene-3d__preset is-active" type="button" data-three-scene-3d-preset="isometric" aria-pressed="true">Isometric</button>' +
            '<button class="scene-3d__preset" type="button" data-three-scene-3d-preset="top" aria-pressed="false">Top</button>' +
            '<button class="scene-3d__preset" type="button" data-three-scene-3d-preset="bottom" aria-pressed="false">Bottom</button>' +
            '</div><div class="scene-3d__stage"><div class="scene-3d__viewport" aria-label="Interactive 3D PCB view">' +
            '<div class="scene-3d__canvas-mount" data-three-scene-3d-viewport></div>' +
            '<div class="scene-3d__loading" data-three-scene-3d-loading aria-live="polite"><p>Rendering PCB scene...</p></div></div>' +
            '<aside class="scene-3d__controls" aria-label="3D visibility controls">' +
            '<label class="scene-3d__toggle"><input type="checkbox" checked data-three-scene-3d-toggle="components" />Components</label>' +
            '<label class="scene-3d__toggle"><input type="checkbox" checked data-three-scene-3d-toggle="copper" />Copper</label>' +
            '</aside></div><p class="scene-3d__diagnostics" data-three-scene-3d-diagnostics aria-live="polite">Rendering PCB scene...</p></section>'
        )
    }

    /**
     * Renders parsed metadata and diagnostics.
     * @param {ReturnType<typeof AltiumParser.parseArrayBuffer>} documentModel
     * @returns {string}
     */
    #renderMetadata(documentModel) {
        const summaryRows = Object.entries(documentModel.summary || {})
            .map(
                ([label, value]) =>
                    '<tr><th>' +
                    this.#escapeHtml(label) +
                    '</th><td>' +
                    this.#escapeHtml(String(value)) +
                    '</td></tr>'
            )
            .join('')
        const diagnostics = (documentModel.diagnostics || [])
            .map(
                (diagnostic) =>
                    '<li><strong>' +
                    this.#escapeHtml(diagnostic.severity) +
                    '</strong> ' +
                    this.#escapeHtml(diagnostic.message) +
                    '</li>'
            )
            .join('')

        return (
            '<section class="metadata-panel"><header><h2>' +
            this.#escapeHtml(documentModel.fileName) +
            '</h2><p>' +
            this.#escapeHtml(documentModel.fileType) +
            ' parsed locally. Source inspiration: <a href="' +
            SOURCE_PROJECT_URL +
            '" target="_blank" rel="noreferrer">Mehdi KHALFALLAH&apos;s Arduino Uno Altium project</a>.</p></header>' +
            '<table><tbody>' +
            (summaryRows ||
                '<tr><td colspan="2">No summary fields were recovered.</td></tr>') +
            '</tbody></table><h3>Diagnostics</h3><ul>' +
            (diagnostics || '<li>No diagnostics were reported.</li>') +
            '</ul></section>'
        )
    }

    /**
     * Renders the initial empty state.
     * @returns {string}
     */
    #renderEmptyState() {
        return (
            '<section class="empty-state"><h2>No document loaded</h2><p>' +
            'The example can fetch credited source documents from GitHub or load another local Altium design.</p></section>'
        )
    }

    /**
     * Renders the source project loading state.
     * @returns {string}
     */
    #renderLoadingState() {
        return (
            '<section class="empty-state"><h2>Loading credited source documents</h2><p>' +
            'Fetching the source schematic and source PCB from Mehdi KHALFALLAH&apos;s public GitHub project. The files are parsed in this browser session and are not stored in this repository.</p></section>'
        )
    }

    /**
     * Renders a parse error.
     * @param {unknown} error
     * @returns {void}
     */
    #renderError(error) {
        this.#elements.output.innerHTML =
            '<section class="empty-state empty-state--error"><h2>Unable to render document</h2><p>' +
            this.#escapeHtml(this.#formatError(error)) +
            '</p></section>'
    }

    /**
     * Updates the status text.
     * @param {string} message
     * @param {'busy' | 'error' | 'ready'} tone
     * @returns {void}
     */
    #setStatus(message, tone = 'ready') {
        this.#elements.status.textContent = message
        this.#elements.status.dataset.tone = tone
    }

    /**
     * Formats thrown values for display.
     * @param {unknown} error
     * @returns {string}
     */
    #formatError(error) {
        return error instanceof Error ? error.message : String(error)
    }

    /**
     * Escapes text for trusted example markup assembly.
     * @param {string} value
     * @returns {string}
     */
    #escapeHtml(value) {
        return value.replace(/[&<>"']/g, (character) => {
            const escapes = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }
            return escapes[character]
        })
    }
}

ArduinoUnoExample.boot()
