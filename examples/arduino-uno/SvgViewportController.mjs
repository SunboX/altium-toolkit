const ZOOM_IN_FACTOR = 0.97
const ZOOM_OUT_FACTOR = 1 / ZOOM_IN_FACTOR
const MIN_SCALE_RATIO = 0.05
const MAX_SCALE_RATIO = 4

/**
 * Adds wheel zoom and drag pan to rendered schematic and PCB SVGs.
 */
export class SvgViewportController {
    #svg
    #defaultViewBox
    #viewBox
    #dragState
    #boundWheel
    #boundMouseDown
    #boundMouseMove
    #boundMouseUp

    /**
     * Creates an interactive viewport controller.
     * @param {{ getAttribute: (name: string) => string | null, setAttribute: (name: string, value: string) => void, getBoundingClientRect: () => { left: number, top: number, width: number, height: number }, addEventListener: (type: string, listener: (event: any) => void, options?: any) => void, removeEventListener: (type: string, listener: (event: any) => void, options?: any) => void, classList?: { add: (...tokens: string[]) => void, remove: (...tokens: string[]) => void }, ownerDocument?: { addEventListener: (type: string, listener: (event: any) => void) => void, removeEventListener: (type: string, listener: (event: any) => void) => void, documentElement?: { classList?: { add: (...tokens: string[]) => void, remove: (...tokens: string[]) => void } } } }} svgElement
     */
    constructor(svgElement) {
        this.#svg = svgElement
        this.#defaultViewBox = this.#readViewBox()
        this.#viewBox = { ...this.#defaultViewBox }
        this.#dragState = null
        this.#boundWheel = (event) => this.#handleWheel(event)
        this.#boundMouseDown = (event) => this.#handleMouseDown(event)
        this.#boundMouseMove = (event) => this.#handleMouseMove(event)
        this.#boundMouseUp = (event) => this.#handleMouseUp(event)
        this.#bindEvents()
        this.#applyViewBox()
    }

    /**
     * Removes listeners and clears active drag state.
     * @returns {void}
     */
    dispose() {
        this.#unbindEvents()
        this.#stopDragging()
    }

    /**
     * Binds browser events needed for SVG viewport interaction.
     * @returns {void}
     */
    #bindEvents() {
        this.#svg.addEventListener('wheel', this.#boundWheel, {
            passive: false
        })
        this.#svg.addEventListener('mousedown', this.#boundMouseDown)
        this.#getOwnerDocument().addEventListener(
            'mousemove',
            this.#boundMouseMove
        )
        this.#getOwnerDocument().addEventListener('mouseup', this.#boundMouseUp)
    }

    /**
     * Removes browser event listeners.
     * @returns {void}
     */
    #unbindEvents() {
        this.#svg.removeEventListener('wheel', this.#boundWheel, {
            passive: false
        })
        this.#svg.removeEventListener('mousedown', this.#boundMouseDown)
        this.#getOwnerDocument().removeEventListener(
            'mousemove',
            this.#boundMouseMove
        )
        this.#getOwnerDocument().removeEventListener(
            'mouseup',
            this.#boundMouseUp
        )
    }

    /**
     * Applies wheel zoom around the current cursor position.
     * @param {{ deltaY?: number, clientX?: number, clientY?: number, preventDefault?: () => void }} event
     * @returns {void}
     */
    #handleWheel(event) {
        const deltaY = Number(event?.deltaY || 0)
        if (deltaY === 0) return

        const anchorPoint = this.#projectClientPointToDocument(
            Number(event?.clientX || 0),
            Number(event?.clientY || 0)
        )
        if (!anchorPoint) return

        event?.preventDefault?.()

        const zoomFactor = deltaY < 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR
        const nextWidth = this.#clampWidth(this.#viewBox.width * zoomFactor)
        const nextHeight = this.#clampHeight(this.#viewBox.height * zoomFactor)
        const relativeX =
            (anchorPoint.x - this.#viewBox.x) / this.#viewBox.width
        const relativeY =
            (anchorPoint.y - this.#viewBox.y) / this.#viewBox.height

        this.#viewBox = {
            x: anchorPoint.x - relativeX * nextWidth,
            y: anchorPoint.y - relativeY * nextHeight,
            width: nextWidth,
            height: nextHeight
        }

        this.#applyViewBox()
    }

    /**
     * Starts a drag pan on primary-button press.
     * @param {{ button?: number, clientX?: number, clientY?: number, preventDefault?: () => void }} event
     * @returns {void}
     */
    #handleMouseDown(event) {
        if (Number(event?.button) !== 0) return

        event?.preventDefault?.()
        this.#lockDocumentScroll()
        this.#dragState = {
            startClientX: Number(event?.clientX || 0),
            startClientY: Number(event?.clientY || 0),
            originViewBox: { ...this.#viewBox }
        }
        this.#svg.classList?.add('is-panning')
    }

    /**
     * Pans the viewBox while dragging.
     * @param {{ buttons?: number, clientX?: number, clientY?: number, preventDefault?: () => void }} event
     * @returns {void}
     */
    #handleMouseMove(event) {
        if (!this.#dragState) return

        if (Number(event?.buttons || 0) === 0) {
            this.#stopDragging()
            return
        }

        const rect = this.#svg.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return

        event?.preventDefault?.()

        const deltaX =
            ((Number(event?.clientX || 0) - this.#dragState.startClientX) /
                rect.width) *
            this.#dragState.originViewBox.width
        const deltaY =
            ((Number(event?.clientY || 0) - this.#dragState.startClientY) /
                rect.height) *
            this.#dragState.originViewBox.height

        this.#viewBox = {
            x: this.#dragState.originViewBox.x - deltaX,
            y: this.#dragState.originViewBox.y - deltaY,
            width: this.#dragState.originViewBox.width,
            height: this.#dragState.originViewBox.height
        }

        this.#applyViewBox()
    }

    /**
     * Stops a drag pan on primary-button release.
     * @param {{ button?: number }} event
     * @returns {void}
     */
    #handleMouseUp(event) {
        if (Number(event?.button) !== 0) return
        this.#stopDragging()
    }

    /**
     * Clears the active drag state.
     * @returns {void}
     */
    #stopDragging() {
        this.#dragState = null
        this.#svg.classList?.remove('is-panning')
        this.#unlockDocumentScroll()
    }

    /**
     * Returns the document-like target used for global move/up listeners.
     * @returns {{ addEventListener: (type: string, listener: (event: any) => void) => void, removeEventListener: (type: string, listener: (event: any) => void) => void, documentElement?: { classList?: { add: (...tokens: string[]) => void, remove: (...tokens: string[]) => void } } }}
     */
    #getOwnerDocument() {
        return this.#svg.ownerDocument || this.#svg
    }

    /**
     * Locks page scrolling while a pan gesture is active.
     * @returns {void}
     */
    #lockDocumentScroll() {
        this.#getOwnerDocument().documentElement?.classList?.add(
            'is-svg-panning'
        )
    }

    /**
     * Restores page scrolling after panning.
     * @returns {void}
     */
    #unlockDocumentScroll() {
        this.#getOwnerDocument().documentElement?.classList?.remove(
            'is-svg-panning'
        )
    }

    /**
     * Reads the SVG's current viewBox.
     * @returns {{ x: number, y: number, width: number, height: number }}
     */
    #readViewBox() {
        const rawValue = String(this.#svg.getAttribute('viewBox') || '')
        const [x, y, width, height] = rawValue
            .trim()
            .split(/\s+/)
            .map((value) => Number(value))

        return {
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : 0,
            width: Number.isFinite(width) && width > 0 ? width : 100,
            height: Number.isFinite(height) && height > 0 ? height : 100
        }
    }

    /**
     * Projects a client-space point into the current SVG document space.
     * @param {number} clientX
     * @param {number} clientY
     * @returns {{ x: number, y: number } | null}
     */
    #projectClientPointToDocument(clientX, clientY) {
        const rect = this.#svg.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) return null

        const relativeX = (clientX - rect.left) / rect.width
        const relativeY = (clientY - rect.top) / rect.height

        return {
            x: this.#viewBox.x + relativeX * this.#viewBox.width,
            y: this.#viewBox.y + relativeY * this.#viewBox.height
        }
    }

    /**
     * Clamps a candidate viewBox width to the allowed zoom range.
     * @param {number} width
     * @returns {number}
     */
    #clampWidth(width) {
        const minimumWidth = this.#defaultViewBox.width * MIN_SCALE_RATIO
        const maximumWidth = this.#defaultViewBox.width * MAX_SCALE_RATIO
        return Math.min(Math.max(width, minimumWidth), maximumWidth)
    }

    /**
     * Clamps a candidate viewBox height to the allowed zoom range.
     * @param {number} height
     * @returns {number}
     */
    #clampHeight(height) {
        const minimumHeight = this.#defaultViewBox.height * MIN_SCALE_RATIO
        const maximumHeight = this.#defaultViewBox.height * MAX_SCALE_RATIO
        return Math.min(Math.max(height, minimumHeight), maximumHeight)
    }

    /**
     * Writes the current viewBox to the SVG.
     * @returns {void}
     */
    #applyViewBox() {
        this.#svg.setAttribute(
            'viewBox',
            [
                SvgViewportController.#formatNumber(this.#viewBox.x),
                SvgViewportController.#formatNumber(this.#viewBox.y),
                SvgViewportController.#formatNumber(this.#viewBox.width),
                SvgViewportController.#formatNumber(this.#viewBox.height)
            ].join(' ')
        )
    }

    /**
     * Formats a numeric SVG value without noisy floating-point tails.
     * @param {number} value
     * @returns {string}
     */
    static #formatNumber(value) {
        return String(Number(value.toFixed(4)))
    }
}
