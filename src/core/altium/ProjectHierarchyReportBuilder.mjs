// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Builds a read-only schematic hierarchy report from parsed project sheets.
 */
export class ProjectHierarchyReportBuilder {
    static SCHEMA_ID = 'altium-toolkit.project.hierarchy.a1'

    /**
     * Builds a schematic hierarchy report from parsed project and sheet models.
     * @param {{ projectModel?: object, documentModels?: object[] }} [options] Report options.
     * @returns {object}
     */
    static build(options = {}) {
        const project =
            options.projectModel?.project || options.projectModel || {}
        const schematicModels = (options.documentModels || []).filter(
            (model) => model?.kind === 'schematic'
        )
        const sheets = ProjectHierarchyReportBuilder.#sheetRows(
            project,
            schematicModels
        )
        const sheetByPath = new Map(
            sheets.map((sheet) => [sheet.normalizedPath, sheet])
        )
        const links = ProjectHierarchyReportBuilder.#linkRows(
            schematicModels,
            sheetByPath
        )
        const roots = ProjectHierarchyReportBuilder.#treeRoots(
            sheets,
            links,
            project
        )
        const diagnostics = ProjectHierarchyReportBuilder.#diagnostics(links)

        return {
            schema: ProjectHierarchyReportBuilder.SCHEMA_ID,
            summary: {
                sheetCount: sheets.length,
                rootSheetCount: roots.length,
                linkCount: links.length,
                resolvedLinkCount: links.filter(
                    (link) => link.status === 'resolved'
                ).length,
                missingSheetCount: links.filter(
                    (link) => link.status === 'missing'
                ).length,
                cycleCount: links.filter((link) => link.status === 'cycle')
                    .length,
                repeatedReferenceCount: links.filter(
                    (link) => link.status === 'repeated'
                ).length
            },
            hierarchyMode: {
                value: String(project?.design?.HierarchyMode || ''),
                name: ProjectHierarchyReportBuilder.#hierarchyModeName(
                    project?.design?.HierarchyMode
                )
            },
            sheets,
            links: links.sort(
                (left, right) =>
                    left.parentSheetFileName.localeCompare(
                        right.parentSheetFileName
                    ) ||
                    left.childSheetFileName.localeCompare(
                        right.childSheetFileName
                    ) ||
                    left.symbolKey.localeCompare(right.symbolKey)
            ),
            roots,
            diagnostics
        }
    }

    /**
     * Builds sheet rows from project document rows and parsed sheet models.
     * @param {object} project Parsed project model.
     * @param {object[]} schematicModels Parsed schematic models.
     * @returns {object[]}
     */
    static #sheetRows(project, schematicModels) {
        const documentsByFileName = new Map()
        const documents = (project?.documents || []).filter((document) =>
            ProjectHierarchyReportBuilder.#isSchematicDocument(document)
        )

        for (const document of documents) {
            documentsByFileName.set(
                ProjectHierarchyReportBuilder.#basename(
                    document.normalizedPath ||
                        document.path ||
                        document.fileName
                ).toLowerCase(),
                document
            )
        }

        const rows = schematicModels.map((model, index) => {
            const document = documentsByFileName.get(
                String(model.fileName || '').toLowerCase()
            )
            const normalizedPath = ProjectHierarchyReportBuilder.#normalizePath(
                document?.normalizedPath ||
                    document?.path ||
                    model.fileName ||
                    ''
            )

            return ProjectHierarchyReportBuilder.#stripUndefined({
                index,
                fileName: model.fileName || document?.fileName || '',
                title: model.summary?.title || model.fileName || '',
                documentPath: document?.path || normalizedPath,
                normalizedPath,
                uniqueId: document?.uniqueId || '',
                sheetSymbolCount: (model.schematic?.sheetSymbols || []).length,
                sheetEntryCount: (model.schematic?.sheetEntries || []).length,
                status: 'present'
            })
        })
        const modelPathKeys = new Set(
            rows.map((row) => row.normalizedPath.toLowerCase())
        )

        for (const document of documents) {
            const normalizedPath = ProjectHierarchyReportBuilder.#normalizePath(
                document.normalizedPath || document.path || document.fileName
            )
            if (modelPathKeys.has(normalizedPath.toLowerCase())) {
                continue
            }

            rows.push(
                ProjectHierarchyReportBuilder.#stripUndefined({
                    index: rows.length,
                    fileName:
                        document.fileName ||
                        ProjectHierarchyReportBuilder.#basename(normalizedPath),
                    title:
                        document.fileName ||
                        ProjectHierarchyReportBuilder.#basename(normalizedPath),
                    documentPath: document.path || normalizedPath,
                    normalizedPath,
                    uniqueId: document.uniqueId || '',
                    sheetSymbolCount: 0,
                    sheetEntryCount: 0,
                    status: 'unparsed'
                })
            )
        }

        return rows
    }

    /**
     * Builds hierarchy link rows from sheet symbols.
     * @param {object[]} schematicModels Parsed schematic models.
     * @param {Map<string, object>} sheetByPath Sheets by normalized path.
     * @returns {object[]}
     */
    static #linkRows(schematicModels, sheetByPath) {
        const modelPathByFileName = new Map(
            [...sheetByPath.values()].map((sheet) => [
                sheet.fileName.toLowerCase(),
                sheet.normalizedPath
            ])
        )
        const links = []

        for (const model of schematicModels) {
            const parentPath =
                modelPathByFileName.get(
                    String(model.fileName || '').toLowerCase()
                ) ||
                ProjectHierarchyReportBuilder.#normalizePath(model.fileName)
            const parentSheet = sheetByPath.get(parentPath) || {
                fileName: model.fileName || '',
                normalizedPath: parentPath
            }

            for (const [symbolIndex, sheetSymbol] of (
                model.schematic?.sheetSymbols || []
            ).entries()) {
                const childSheetFileName =
                    ProjectHierarchyReportBuilder.#childSheetFileName(
                        sheetSymbol
                    )
                if (!childSheetFileName) {
                    continue
                }

                const resolvedChildPath =
                    ProjectHierarchyReportBuilder.#resolveChildPath(
                        parentPath,
                        childSheetFileName,
                        modelPathByFileName
                    )
                const childSheet = sheetByPath.get(resolvedChildPath)
                const sheetEntryNames =
                    ProjectHierarchyReportBuilder.#sheetEntryNames(
                        sheetSymbol,
                        model.schematic?.sheetEntries || []
                    )

                links.push(
                    ProjectHierarchyReportBuilder.#stripUndefined({
                        key:
                            parentPath +
                            '->' +
                            resolvedChildPath +
                            '#' +
                            symbolIndex,
                        parentSheetFileName: parentSheet.fileName,
                        parentDocumentPath: parentPath,
                        childSheetFileName:
                            childSheet?.fileName ||
                            ProjectHierarchyReportBuilder.#basename(
                                childSheetFileName
                            ),
                        childDocumentPath: resolvedChildPath,
                        symbolKey:
                            sheetSymbol.uniqueId ||
                            'sheet-symbol-' + symbolIndex,
                        symbolName: sheetSymbol.name || '',
                        sheetEntryNames,
                        status: childSheet ? 'resolved' : 'missing'
                    })
                )
            }
        }

        ProjectHierarchyReportBuilder.#markTraversalStatuses(links, [
            ...sheetByPath.values()
        ])

        return links
    }

    /**
     * Updates resolved link rows with cycle and repeated-reference statuses.
     * @param {object[]} links Link rows.
     * @param {object[]} sheets Sheet rows.
     */
    static #markTraversalStatuses(links, sheets) {
        const linksByParent =
            ProjectHierarchyReportBuilder.#linksByParent(links)
        const roots = ProjectHierarchyReportBuilder.#rootSheetsFromLinks(
            sheets,
            links
        )
        const visited = new Set()

        for (const root of roots) {
            ProjectHierarchyReportBuilder.#walkLinks(
                root.normalizedPath,
                linksByParent,
                visited,
                []
            )
        }
    }

    /**
     * Walks resolved links from one parent path.
     * @param {string} parentPath Parent sheet path.
     * @param {Map<string, object[]>} linksByParent Links by parent path.
     * @param {Set<string>} visited Globally visited sheet paths.
     * @param {string[]} stack Current traversal stack.
     */
    static #walkLinks(parentPath, linksByParent, visited, stack) {
        if (stack.includes(parentPath)) {
            return
        }

        visited.add(parentPath)
        const nextStack = [...stack, parentPath]

        for (const link of linksByParent.get(parentPath) || []) {
            if (link.status !== 'resolved') {
                continue
            }

            if (nextStack.includes(link.childDocumentPath)) {
                link.status = 'cycle'
                continue
            }

            if (visited.has(link.childDocumentPath)) {
                link.status = 'repeated'
                continue
            }

            ProjectHierarchyReportBuilder.#walkLinks(
                link.childDocumentPath,
                linksByParent,
                visited,
                nextStack
            )
        }
    }

    /**
     * Builds root tree rows.
     * @param {object[]} sheets Sheet rows.
     * @param {object[]} links Link rows.
     * @param {object} project Parsed project model.
     * @returns {object[]}
     */
    static #treeRoots(sheets, links, project) {
        const sheetByPath = new Map(
            sheets.map((sheet) => [sheet.normalizedPath, sheet])
        )

        return ProjectHierarchyReportBuilder.#rootSheetsFromLinks(
            sheets,
            links,
            project
        ).map((root) =>
            ProjectHierarchyReportBuilder.#treeNode(
                root.normalizedPath,
                sheetByPath,
                links,
                []
            )
        )
    }

    /**
     * Selects likely hierarchy roots.
     * @param {object[]} sheets Sheet rows.
     * @param {object[]} links Link rows.
     * @param {object} [project] Parsed project model.
     * @returns {object[]}
     */
    static #rootSheetsFromLinks(sheets, links, project = {}) {
        const referencedPaths = new Set(
            links
                .filter((link) => link.status === 'resolved')
                .map((link) => link.childDocumentPath)
        )
        const primaryRootPath =
            ProjectHierarchyReportBuilder.#primaryProjectSheetPath(
                project,
                sheets
            )
        const rootPaths = new Set()
        if (primaryRootPath) {
            rootPaths.add(primaryRootPath)
        }

        for (const sheet of sheets) {
            if (!referencedPaths.has(sheet.normalizedPath)) {
                rootPaths.add(sheet.normalizedPath)
            }
        }

        return sheets.filter((sheet) => rootPaths.has(sheet.normalizedPath))
    }

    /**
     * Builds one tree node.
     * @param {string} path Sheet path.
     * @param {Map<string, object>} sheetByPath Sheet lookup.
     * @param {object[]} links Link rows.
     * @param {string[]} stack Current traversal stack.
     * @returns {object}
     */
    static #treeNode(path, sheetByPath, links, stack) {
        const sheet = sheetByPath.get(path)
        const childLinks = links.filter(
            (link) => link.parentDocumentPath === path
        )
        const nextStack = [...stack, path]

        return ProjectHierarchyReportBuilder.#stripUndefined({
            fileName:
                sheet?.fileName ||
                ProjectHierarchyReportBuilder.#basename(path),
            documentPath: path,
            status: sheet?.status || 'missing',
            children: childLinks.map((link) =>
                ProjectHierarchyReportBuilder.#treeChild(
                    link,
                    sheetByPath,
                    links,
                    nextStack
                )
            )
        })
    }

    /**
     * Builds one child tree node from a hierarchy link.
     * @param {object} link Link row.
     * @param {Map<string, object>} sheetByPath Sheet lookup.
     * @param {object[]} links Link rows.
     * @param {string[]} stack Current traversal stack.
     * @returns {object}
     */
    static #treeChild(link, sheetByPath, links, stack) {
        if (
            link.status !== 'resolved' ||
            stack.includes(link.childDocumentPath)
        ) {
            return {
                fileName: link.childSheetFileName,
                documentPath: link.childDocumentPath,
                status: link.status,
                children: []
            }
        }

        return ProjectHierarchyReportBuilder.#treeNode(
            link.childDocumentPath,
            sheetByPath,
            links,
            stack
        )
    }

    /**
     * Builds diagnostics for non-resolved hierarchy links.
     * @param {object[]} links Link rows.
     * @returns {object[]}
     */
    static #diagnostics(links) {
        return links
            .filter((link) => link.status !== 'resolved')
            .map((link) =>
                ProjectHierarchyReportBuilder.#stripUndefined({
                    code: 'project.hierarchy.' + link.status + '-sheet',
                    severity: 'warning',
                    parentSheetFileName: link.parentSheetFileName,
                    childSheetFileName: link.childSheetFileName,
                    symbolKey: link.symbolKey,
                    message:
                        link.status === 'missing'
                            ? 'Sheet symbol references a child sheet that was not present.'
                            : link.status === 'cycle'
                              ? 'Sheet symbol creates a recursive sheet hierarchy.'
                              : 'Sheet is referenced more than once in the hierarchy.'
                })
            )
            .map((diagnostic) =>
                diagnostic.code === 'project.hierarchy.cycle-sheet'
                    ? { ...diagnostic, code: 'project.hierarchy.cycle' }
                    : diagnostic
            )
            .map((diagnostic) =>
                diagnostic.code === 'project.hierarchy.missing-sheet'
                    ? diagnostic
                    : diagnostic
            )
            .sort(
                (left, right) =>
                    left.parentSheetFileName.localeCompare(
                        right.parentSheetFileName
                    ) ||
                    left.childSheetFileName.localeCompare(
                        right.childSheetFileName
                    ) ||
                    left.code.localeCompare(right.code)
            )
    }

    /**
     * Groups links by parent document path.
     * @param {object[]} links Link rows.
     * @returns {Map<string, object[]>}
     */
    static #linksByParent(links) {
        const byParent = new Map()

        for (const link of links) {
            byParent.set(link.parentDocumentPath, [
                ...(byParent.get(link.parentDocumentPath) || []),
                link
            ])
        }

        return byParent
    }

    /**
     * Selects the first schematic document as the primary project root.
     * @param {object} project Parsed project model.
     * @param {object[]} sheets Sheet rows.
     * @returns {string}
     */
    static #primaryProjectSheetPath(project, sheets) {
        const firstDocument = (project?.documents || []).find((document) =>
            ProjectHierarchyReportBuilder.#isSchematicDocument(document)
        )
        const firstDocumentPath = ProjectHierarchyReportBuilder.#normalizePath(
            firstDocument?.normalizedPath ||
                firstDocument?.path ||
                firstDocument?.fileName ||
                ''
        )

        if (firstDocumentPath) {
            return (
                sheets.find(
                    (sheet) =>
                        sheet.normalizedPath.toLowerCase() ===
                        firstDocumentPath.toLowerCase()
                )?.normalizedPath || ''
            )
        }

        return sheets[0]?.normalizedPath || ''
    }

    /**
     * Returns child sheet file name metadata from a sheet symbol.
     * @param {object} sheetSymbol Sheet symbol row.
     * @returns {string}
     */
    static #childSheetFileName(sheetSymbol) {
        return String(
            sheetSymbol?.fileName ||
                sheetSymbol?.sheetFileName ||
                sheetSymbol?.childSheetFileName ||
                ''
        ).trim()
    }

    /**
     * Resolves sheet-entry names owned by one sheet symbol.
     * @param {object} sheetSymbol Sheet symbol row.
     * @param {object[]} sheetEntries Sheet entries.
     * @returns {string[]}
     */
    static #sheetEntryNames(sheetSymbol, sheetEntries) {
        const ownerKeys = new Set(
            [
                sheetSymbol.ownerIndex,
                sheetSymbol.indexInSheet,
                Number.isInteger(sheetSymbol.indexInSheet)
                    ? sheetSymbol.indexInSheet + 1
                    : undefined
            ]
                .filter((value) => value !== undefined && value !== '')
                .map((value) => String(value))
        )

        return (sheetEntries || [])
            .filter((entry) => ownerKeys.has(String(entry.ownerIndex || '')))
            .map((entry) => String(entry.name || '').trim())
            .filter(Boolean)
            .sort((left, right) => left.localeCompare(right))
    }

    /**
     * Resolves a child sheet path against known sheet file names.
     * @param {string} parentPath Parent sheet path.
     * @param {string} childSheetFileName Raw child filename.
     * @param {Map<string, string>} modelPathByFileName Known sheet paths.
     * @returns {string}
     */
    static #resolveChildPath(
        parentPath,
        childSheetFileName,
        modelPathByFileName
    ) {
        const normalizedChild =
            ProjectHierarchyReportBuilder.#normalizePath(childSheetFileName)
        const byFileName = modelPathByFileName.get(
            ProjectHierarchyReportBuilder.#basename(
                normalizedChild
            ).toLowerCase()
        )
        if (byFileName) {
            return byFileName
        }
        if (normalizedChild.includes('/')) {
            return normalizedChild
        }

        const parentDirectory = parentPath.includes('/')
            ? parentPath.replace(/\/[^/]*$/u, '')
            : ''
        return parentDirectory
            ? parentDirectory + '/' + normalizedChild
            : normalizedChild
    }

    /**
     * Returns true when a project document row refers to a schematic sheet.
     * @param {object} document Project document row.
     * @returns {boolean}
     */
    static #isSchematicDocument(document) {
        const kind = String(document?.kind || '').toLowerCase()
        const path = String(
            document?.normalizedPath ||
                document?.path ||
                document?.fileName ||
                ''
        ).toLowerCase()

        return kind === 'schematic' || path.endsWith('.schdoc')
    }

    /**
     * Resolves a display name for a project hierarchy mode.
     * @param {string | number | undefined} mode Raw hierarchy mode.
     * @returns {string}
     */
    static #hierarchyModeName(mode) {
        switch (String(mode || '')) {
            case '2':
                return 'hierarchical'
            case '1':
                return 'flat'
            case '3':
                return 'global'
            default:
                return 'unspecified'
        }
    }

    /**
     * Normalizes path separators.
     * @param {unknown} path Path value.
     * @returns {string}
     */
    static #normalizePath(path) {
        return String(path || '').replace(/\\/gu, '/')
    }

    /**
     * Extracts a basename from a normalized or native path.
     * @param {unknown} path Path value.
     * @returns {string}
     */
    static #basename(path) {
        const parts =
            ProjectHierarchyReportBuilder.#normalizePath(path).split('/')
        return parts.at(-1) || ''
    }

    /**
     * Removes undefined and empty-string fields.
     * @param {object} row Source row.
     * @returns {object}
     */
    static #stripUndefined(row) {
        return Object.fromEntries(
            Object.entries(row || {}).filter(
                ([, value]) => value !== undefined && value !== ''
            )
        )
    }
}
