// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds fixture coverage matrices from synthetic fixture manifests.
 */
export class FixtureCoverageMatrixBuilder {
    static SCHEMA = 'altium-toolkit.fixture-coverage-matrix.a1'

    /**
     * Builds a fixture coverage matrix report.
     * @param {{ manifest?: object, requiredCoverage?: string[], requiredContracts?: Record<string, string[]> } | object} [input]
     * @returns {object}
     */
    static build(input = {}) {
        const manifest = input.manifest || input
        const fixtures = Array.isArray(manifest.fixtures)
            ? manifest.fixtures
            : []
        const requiredCoverage = FixtureCoverageMatrixBuilder.#stringList(
            input.requiredCoverage
        )
        const requiredContracts =
            FixtureCoverageMatrixBuilder.#requiredContracts(
                input.requiredContracts
            )
        const coverage = FixtureCoverageMatrixBuilder.#coverageRows(
            fixtures,
            requiredCoverage
        )
        const contracts = FixtureCoverageMatrixBuilder.#contractRows(
            fixtures,
            requiredContracts
        )
        const missingCoverage = coverage
            .filter((entry) => entry.required && !entry.covered)
            .map((entry) => entry.tag)
        const missingContracts = contracts
            .filter((entry) => entry.required && !entry.covered)
            .map((entry) => ({
                group: entry.group,
                contract: entry.contract
            }))
        const policy = FixtureCoverageMatrixBuilder.#policy(manifest, fixtures)

        return {
            schema: FixtureCoverageMatrixBuilder.SCHEMA,
            summary: {
                fixtureCount: fixtures.length,
                coverageTagCount: coverage.length,
                contractCount: contracts.length,
                requiredCoverageCount: requiredCoverage.length,
                requiredContractCount: requiredContracts.length,
                missingCoverageCount: missingCoverage.length,
                missingContractCount: missingContracts.length,
                nativeAssetCount: policy.nativeAssetCount,
                status:
                    missingCoverage.length || missingContracts.length
                        ? 'gap'
                        : 'pass'
            },
            policy,
            coverage,
            contracts,
            missingCoverage,
            missingContracts
        }
    }

    /**
     * Builds coverage rows.
     * @param {object[]} fixtures Fixture rows.
     * @param {string[]} requiredCoverage Required coverage tags.
     * @returns {object[]}
     */
    static #coverageRows(fixtures, requiredCoverage) {
        const required = new Set(requiredCoverage)
        const fixtureKeysByTag = new Map()

        for (const fixture of fixtures) {
            for (const tag of FixtureCoverageMatrixBuilder.#stringList(
                fixture.coverage
            )) {
                FixtureCoverageMatrixBuilder.#appendKey(
                    fixtureKeysByTag,
                    tag,
                    FixtureCoverageMatrixBuilder.#fixtureKey(fixture)
                )
            }
        }

        return FixtureCoverageMatrixBuilder.#sortedUnion(
            [...fixtureKeysByTag.keys()],
            requiredCoverage
        ).map((tag) =>
            FixtureCoverageMatrixBuilder.#coverageRow(
                tag,
                fixtureKeysByTag.get(tag) || new Set(),
                required.has(tag)
            )
        )
    }

    /**
     * Builds one coverage row.
     * @param {string} tag Coverage tag.
     * @param {Set<string>} fixtureKeys Fixture keys.
     * @param {boolean} required Required flag.
     * @returns {object}
     */
    static #coverageRow(tag, fixtureKeys, required) {
        const keys = [...fixtureKeys].sort()
        return {
            tag,
            fixtureKeys: keys,
            count: keys.length,
            required,
            covered: keys.length > 0
        }
    }

    /**
     * Builds contract rows.
     * @param {object[]} fixtures Fixture rows.
     * @param {{ group: string, contract: string }[]} requiredContracts Required contracts.
     * @returns {object[]}
     */
    static #contractRows(fixtures, requiredContracts) {
        const required = new Set(
            requiredContracts.map((entry) =>
                FixtureCoverageMatrixBuilder.#contractKey(
                    entry.group,
                    entry.contract
                )
            )
        )
        const fixtureKeysByContract = new Map()

        for (const fixture of fixtures) {
            const contracts = fixture.contracts || {}
            for (const [group, groupContracts] of Object.entries(contracts)) {
                for (const contract of FixtureCoverageMatrixBuilder.#stringList(
                    groupContracts
                )) {
                    FixtureCoverageMatrixBuilder.#appendKey(
                        fixtureKeysByContract,
                        FixtureCoverageMatrixBuilder.#contractKey(
                            group,
                            contract
                        ),
                        FixtureCoverageMatrixBuilder.#fixtureKey(fixture)
                    )
                }
            }
        }

        const allKeys = FixtureCoverageMatrixBuilder.#sortedUnion(
            [...fixtureKeysByContract.keys()],
            requiredContracts.map((entry) =>
                FixtureCoverageMatrixBuilder.#contractKey(
                    entry.group,
                    entry.contract
                )
            )
        )

        return allKeys.map((key) => {
            const [group, contract] =
                FixtureCoverageMatrixBuilder.#splitContractKey(key)
            const fixtureKeys = fixtureKeysByContract.get(key) || new Set()
            return FixtureCoverageMatrixBuilder.#contractRow(
                group,
                contract,
                fixtureKeys,
                required.has(key)
            )
        })
    }

    /**
     * Builds one contract row.
     * @param {string} group Contract group.
     * @param {string} contract Contract name.
     * @param {Set<string>} fixtureKeys Fixture keys.
     * @param {boolean} required Required flag.
     * @returns {object}
     */
    static #contractRow(group, contract, fixtureKeys, required) {
        const keys = [...fixtureKeys].sort()
        return {
            group,
            contract,
            fixtureKeys: keys,
            count: keys.length,
            required,
            covered: keys.length > 0
        }
    }

    /**
     * Normalizes required contract input.
     * @param {Record<string, string[]> | undefined} requiredContracts Required contract groups.
     * @returns {{ group: string, contract: string }[]}
     */
    static #requiredContracts(requiredContracts) {
        return Object.entries(requiredContracts || {}).flatMap(
            ([group, contracts]) =>
                FixtureCoverageMatrixBuilder.#stringList(contracts).map(
                    (contract) => ({ group, contract })
                )
        )
    }

    /**
     * Builds fixture policy metadata.
     * @param {object} manifest Fixture manifest.
     * @param {object[]} fixtures Fixture rows.
     * @returns {{ assetPolicy: string, nativeAssetCount: number, compliant: boolean }}
     */
    static #policy(manifest, fixtures) {
        const assetPolicy = String(manifest.assetPolicy || '')
        const nativeAssetCount = fixtures.filter(
            (fixture) => fixture.nativeAsset
        ).length
        const compliant =
            nativeAssetCount === 0 &&
            fixtures.every(
                (fixture) =>
                    !fixture.nativeAsset &&
                    (!assetPolicy || fixture.assetPolicy === assetPolicy)
            )

        return {
            assetPolicy,
            nativeAssetCount,
            compliant
        }
    }

    /**
     * Appends one fixture key to a map of sets.
     * @param {Map<string, Set<string>>} map Destination map.
     * @param {string} tag Map key.
     * @param {string} fixtureKey Fixture key.
     * @returns {void}
     */
    static #appendKey(map, tag, fixtureKey) {
        if (!tag) return
        map.set(tag, new Set([...(map.get(tag) || []), fixtureKey]))
    }

    /**
     * Returns a fixture key.
     * @param {object} fixture Fixture row.
     * @returns {string}
     */
    static #fixtureKey(fixture) {
        return String(fixture.key || fixture.id || fixture.name || '')
    }

    /**
     * Builds a stable contract key.
     * @param {string} group Contract group.
     * @param {string} contract Contract name.
     * @returns {string}
     */
    static #contractKey(group, contract) {
        return String(group || '') + '\u0000' + String(contract || '')
    }

    /**
     * Splits one stable contract key.
     * @param {string} key Contract key.
     * @returns {[string, string]}
     */
    static #splitContractKey(key) {
        const [group, contract] = String(key).split('\u0000')
        return [group || '', contract || '']
    }

    /**
     * Builds a sorted unique array from two lists.
     * @param {string[]} first First values.
     * @param {string[]} second Second values.
     * @returns {string[]}
     */
    static #sortedUnion(first, second) {
        return [...new Set([...first, ...second])]
            .filter(Boolean)
            .sort((left, right) => left.localeCompare(right))
    }

    /**
     * Normalizes string-list input.
     * @param {unknown} value Source value.
     * @returns {string[]}
     */
    static #stringList(value) {
        return Array.isArray(value)
            ? value.map((entry) => String(entry)).filter(Boolean)
            : []
    }
}
