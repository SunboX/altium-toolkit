import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'

const { escapeHtml, formatNumber, projectSchematicY } = SchematicSvgUtils

/**
 * Renders synthesized junction dots for connected schematic wire routes.
 */
export class SchematicJunctionRenderer {
    /**
     * Builds junction-dot markup from connected wire linework.
     * @param {{ x1: number, y1: number, x2: number, y2: number, color: string, ownerIndex?: string, isBus?: boolean }[]} lines
     * @param {{ x: number, y: number }[]} crosses
     * @param {{ x: number, y: number, width: number, direction?: 'left' | 'right' | 'up' | 'down' }[]} [ports]
     * @param {{ x: number, y: number, style?: number, powerPortDirection?: 'up' | 'down' | 'left' | 'right' }[]} [powerPorts]
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildMarkup(
        lines,
        crosses,
        ports = [],
        powerPorts = [],
        sheetHeight
    ) {
        return SchematicJunctionRenderer.#resolveJunctions(
            lines,
            crosses,
            ports,
            powerPorts
        )
            .map(
                (junction) =>
                    '<circle class="schematic-junction" cx="' +
                    formatNumber(junction.x) +
                    '" cy="' +
                    formatNumber(projectSchematicY(sheetHeight, junction.y)) +
                    '" r="2" fill="' +
                    escapeHtml(
                        SchematicColorResolver.resolveColor(
                            junction.color,
                            '--schematic-default-ink-color'
                        )
                    ) +
                    '" />'
            )
            .join('')
    }

    /**
     * Resolves all wire-junction points that should display a connection dot.
     * @param {{ x1: number, y1: number, x2: number, y2: number, color: string, ownerIndex?: string, isBus?: boolean }[]} lines
     * @param {{ x: number, y: number }[]} crosses
     * @param {{ x: number, y: number, width: number, direction?: 'left' | 'right' | 'up' | 'down' }[]} ports
     * @param {{ x: number, y: number, style?: number, powerPortDirection?: 'up' | 'down' | 'left' | 'right' }[]} powerPorts
     * @returns {{ x: number, y: number, color: string }[]}
     */
    static #resolveJunctions(lines, crosses, ports, powerPorts) {
        const wireLines = lines.filter(
            (line) => !line.ownerIndex && line.isBus !== true
        )
        const verticalPorts = ports.filter((port) =>
            SchematicJunctionRenderer.#isVerticalPort(port)
        )
        const visiblePowerPorts = powerPorts.filter((powerPort) =>
            SchematicJunctionRenderer.#isDrawablePowerPort(powerPort)
        )

        return SchematicJunctionRenderer.#collectCandidatePoints(
            wireLines,
            verticalPorts,
            visiblePowerPorts
        )
            .filter(
                (point) =>
                    !SchematicJunctionRenderer.#hasNearbyCross(point, crosses)
            )
            .flatMap((point) => {
                const contributingLines = wireLines.filter((line) =>
                    SchematicJunctionRenderer.#lineContainsPoint(line, point)
                )
                const contributingPorts = verticalPorts.filter((port) =>
                    SchematicJunctionRenderer.#portContainsPoint(port, point)
                )
                const contributingPowerPorts = visiblePowerPorts.filter(
                    (powerPort) =>
                        SchematicJunctionRenderer.#powerPortContainsPoint(
                            powerPort,
                            point
                        )
                )
                const directions = new Set()

                for (const line of contributingLines) {
                    SchematicJunctionRenderer.#appendDirections(
                        directions,
                        line,
                        point
                    )
                }

                for (const port of contributingPorts) {
                    SchematicJunctionRenderer.#appendPortDirections(
                        directions,
                        port
                    )
                }

                for (const powerPort of contributingPowerPorts) {
                    SchematicJunctionRenderer.#appendPowerPortDirections(
                        directions,
                        powerPort
                    )
                }

                if (directions.size < 3) {
                    return []
                }

                return [
                    {
                        x: point.x,
                        y: point.y,
                        color:
                            contributingLines[0]?.color ||
                            'var(--schematic-default-ink-color)'
                    }
                ]
            })
    }

    /**
     * Collects all distinct wire endpoints as candidate junction points.
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} lines
     * @param {{ x: number, y: number, width: number, direction?: 'up' | 'down' }[]} ports
     * @param {{ x: number, y: number }} powerPorts
     * @returns {{ x: number, y: number }[]}
     */
    static #collectCandidatePoints(lines, ports, powerPorts) {
        const candidates = new Map()

        for (const line of lines) {
            for (const point of [
                { x: line.x1, y: line.y1 },
                { x: line.x2, y: line.y2 }
            ]) {
                candidates.set(
                    SchematicJunctionRenderer.#pointKey(point),
                    point
                )
            }
        }

        for (const port of ports) {
            const connectionPoint =
                SchematicJunctionRenderer.#resolveVerticalPortConnectionPoint(
                    port
                )

            candidates.set(
                SchematicJunctionRenderer.#pointKey(connectionPoint),
                connectionPoint
            )
        }

        for (const powerPort of powerPorts) {
            candidates.set(
                SchematicJunctionRenderer.#pointKey(powerPort),
                powerPort
            )
        }

        return [...candidates.values()]
    }

    /**
     * Adds all directions a line contributes at one candidate point.
     * @param {Set<string>} directions
     * @param {{ x1: number, y1: number, x2: number, y2: number }} line
     * @param {{ x: number, y: number }} point
     * @returns {void}
     */
    static #appendDirections(directions, line, point) {
        if (line.x1 === line.x2 && line.x1 === point.x) {
            const minY = Math.min(line.y1, line.y2)
            const maxY = Math.max(line.y1, line.y2)

            if (point.y > minY + 0.01) {
                directions.add('south')
            }

            if (point.y < maxY - 0.01) {
                directions.add('north')
            }

            return
        }

        if (line.y1 === line.y2 && line.y1 === point.y) {
            const minX = Math.min(line.x1, line.x2)
            const maxX = Math.max(line.x1, line.x2)

            if (point.x > minX + 0.01) {
                directions.add('west')
            }

            if (point.x < maxX - 0.01) {
                directions.add('east')
            }
        }
    }

    /**
     * Adds the one branch direction contributed by a vertical off-sheet port.
     * @param {Set<string>} directions
     * @param {{ direction?: 'up' | 'down' }} port
     * @returns {void}
     */
    static #appendPortDirections(directions, port) {
        if (port.direction === 'up') {
            directions.add('south')
            return
        }

        if (port.direction === 'down') {
            directions.add('north')
        }
    }

    /**
     * Adds the branch direction contributed by one rendered power-port symbol.
     * @param {Set<string>} directions
     * @param {{ powerPortDirection?: 'up' | 'down' | 'left' | 'right' }} powerPort
     * @returns {void}
     */
    static #appendPowerPortDirections(directions, powerPort) {
        switch (powerPort.powerPortDirection) {
            case 'up':
                directions.add('north')
                return
            case 'down':
                directions.add('south')
                return
            case 'left':
                directions.add('west')
                return
            case 'right':
                directions.add('east')
                return
            default:
        }
    }

    /**
     * Returns true when one cross marker occupies the same point.
     * @param {{ x: number, y: number }} point
     * @param {{ x: number, y: number }[]} crosses
     * @returns {boolean}
     */
    static #hasNearbyCross(point, crosses) {
        return crosses.some(
            (cross) =>
                Math.abs(cross.x - point.x) <= 0.01 &&
                Math.abs(cross.y - point.y) <= 0.01
        )
    }

    /**
     * Returns true when one axis-aligned line passes through a candidate point.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} line
     * @param {{ x: number, y: number }} point
     * @returns {boolean}
     */
    static #lineContainsPoint(line, point) {
        if (line.x1 === line.x2 && line.x1 === point.x) {
            return (
                point.y >= Math.min(line.y1, line.y2) - 0.01 &&
                point.y <= Math.max(line.y1, line.y2) + 0.01
            )
        }

        if (line.y1 === line.y2 && line.y1 === point.y) {
            return (
                point.x >= Math.min(line.x1, line.x2) - 0.01 &&
                point.x <= Math.max(line.x1, line.x2) + 0.01
            )
        }

        return false
    }

    /**
     * Returns true when one vertical off-sheet port attaches at the point.
     * @param {{ x: number, y: number, width: number, direction?: 'up' | 'down' }} port
     * @param {{ x: number, y: number }} point
     * @returns {boolean}
     */
    static #portContainsPoint(port, point) {
        if (!SchematicJunctionRenderer.#isVerticalPort(port)) {
            return false
        }

        const connectionPoint =
            SchematicJunctionRenderer.#resolveVerticalPortConnectionPoint(port)

        return (
            Math.abs(connectionPoint.x - point.x) <= 0.01 &&
            Math.abs(connectionPoint.y - point.y) <= 0.01
        )
    }

    /**
     * Returns true when one rendered power port attaches at the candidate
     * point.
     * @param {{ x: number, y: number }} powerPort
     * @param {{ x: number, y: number }} point
     * @returns {boolean}
     */
    static #powerPortContainsPoint(powerPort, point) {
        return (
            Math.abs(powerPort.x - point.x) <= 0.01 &&
            Math.abs(powerPort.y - point.y) <= 0.01
        )
    }

    /**
     * Returns the wire attachment point for one vertical off-sheet port.
     * @param {{ x: number, y: number, width: number, direction?: 'up' | 'down' }} port
     * @returns {{ x: number, y: number }}
     */
    static #resolveVerticalPortConnectionPoint(port) {
        if (port.direction === 'down') {
            return {
                x: port.x,
                y: port.y
            }
        }

        return {
            x: port.x,
            y: port.y + port.width
        }
    }

    /**
     * Returns true when a port uses the vertical style-4 geometry.
     * @param {{ direction?: 'left' | 'right' | 'up' | 'down' }} port
     * @returns {boolean}
     */
    static #isVerticalPort(port) {
        return port.direction === 'up' || port.direction === 'down'
    }

    /**
     * Returns true when one visible text-backed power port can contribute a
     * junction branch.
     * @param {{ x: number, y: number, style?: number, powerPortDirection?: 'up' | 'down' | 'left' | 'right' } | null | undefined} powerPort
     * @returns {boolean}
     */
    static #isDrawablePowerPort(powerPort) {
        return (
            Boolean(powerPort) &&
            Number.isFinite(Number(powerPort.x)) &&
            Number.isFinite(Number(powerPort.y)) &&
            typeof powerPort.powerPortDirection === 'string'
        )
    }

    /**
     * Builds a stable map key for one point.
     * @param {{ x: number, y: number }} point
     * @returns {string}
     */
    static #pointKey(point) {
        return String(point.x) + ':' + String(point.y)
    }
}
