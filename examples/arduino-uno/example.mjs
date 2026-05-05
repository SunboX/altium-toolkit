import {
    AltiumParser,
    BomTableRenderer,
    PcbScene3dSummaryRenderer,
    PcbSvgRenderer,
    SchematicSvgRenderer
} from '../../src/index.mjs'

const SOURCE_PROJECT_URL =
    'https://github.com/Mehdi-KHALFALLAH/My-Arduino-UNO-Design'

/**
 * Coordinates the local-file example page.
 */
class ArduinoUnoExample {
    #activeView = 'schematic'
    #documentModel = null
    #elements

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
            this.#documentModel = null
            this.#setStatus(this.#formatError(error), 'error')
            this.#renderError(error)
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
     * Writes the current view to the output panel.
     * @returns {void}
     */
    #render() {
        if (!this.#documentModel) {
            this.#elements.output.innerHTML = this.#renderEmptyState()
            return
        }

        const renderers = {
            schematic: () => SchematicSvgRenderer.render(this.#documentModel),
            pcb: () => PcbSvgRenderer.render(this.#documentModel),
            bom: () => BomTableRenderer.render(this.#documentModel.bom || []),
            summary: () =>
                PcbScene3dSummaryRenderer.render(this.#documentModel),
            metadata: () => this.#renderMetadata(this.#documentModel)
        }

        this.#elements.output.innerHTML =
            renderers[this.#activeView]?.() || this.#renderEmptyState()
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
            'The example does not bundle the credited Altium files. Load a local document downloaded from the source project or another Altium design.</p></section>'
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
