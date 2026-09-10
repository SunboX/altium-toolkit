<!--
SPDX-FileCopyrightText: 2026 André Fiedler
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Migration from 1.1.41 to 1.2.0

Version 1.2.0 adds the canonical ECAD toolkit API. Existing Altium
exports are retained under `altium-toolkit/extensions`.

Starting with 1.4.17, native implementations and assets are maintained:
reviewed bug fixes and performance improvements may change their source and
corrected behavior. Historical export signatures and public asset
entrypoints and targets remain checked. The immutable 1.1.41 source tree and manifest
remain provenance evidence, not a claim of current byte equality.

The release gate retains every historical implementation path and
compares every packed source file against a snapshot of the tested
checkout, including new helpers and workers. Public contract and
synthetic regression tests validate maintained behavior. See
[testing](testing.md) for the complete release checks.

The paged appendix maps every frozen export, static member, prototype
member, public asset, and the native implementation tree:

- [Legacy mapping 001](migration/legacy-001.md) (300 rows)
- [Legacy mapping 002](migration/legacy-002.md) (300 rows)
- [Legacy mapping 003](migration/legacy-003.md) (300 rows)
- [Legacy mapping 004](migration/legacy-004.md) (300 rows)
- [Legacy mapping 005](migration/legacy-005.md) (102 rows)
