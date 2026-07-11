<!--
SPDX-FileCopyrightText: 2026 André Fiedler

SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Library Scope

Altium Toolkit provides reusable native Altium parsing behind the common ECAD
toolkit API. Canonical results use CircuitJSON; source-only facts and all
historical 1.1.41 contracts remain explicit Altium extensions.

## In Scope

- Canonical `Parser`, `ProjectLoader`, error, progress, cancellation, and worker
  contracts shared with CircuitJSON, Gerber, and KiCad
- Immutable CircuitJSON document envelopes, common project envelopes, and
  reusable document contexts
- Shared CircuitJSON render, interaction, query, manufacturing, simulation,
  and data-only 3D scene services
- Exact `/extensions` preservation of audited Altium 1.1.41 behavior
- `.SchDoc`, `.PcbDoc`, `.PCBDwf`, `.SchLib`, `.PcbLib`, `.PrjPcb`, `.PrjScr`,
  and `.IntLib` parsing from `ArrayBuffer`
- OLE and binary stream helpers needed by parser recovery
- Schematic SVG rendering
- PCB SVG rendering
- BOM HTML rendering
- PCB 3D scene-description data, including board-region outline refinement and
  silkscreen drill cutout contours
- Embedded PCB/PcbLib font extraction and basic text metrics for deterministic
  SVG rendering
- Read-only PCB primitive record registry metadata and base64 raw-record
  preservation for unsupported or partially decoded PcbDoc/PcbLib streams
- Read-only PCB pad/via detail recovery, including hole tolerances,
  mask/paste semantics, stack metadata, via-protection sidecars, custom pad
  shape links, and PCB union metadata
- Static 3D summary HTML
- Parser worker entrypoint for host applications
- Optional renderer CSS
- Versioned normalized model schema identifiers and machine-readable schema
  contracts
- Source component client, source bundle exporter, generated `.SchLib` and
  `.PcbLib` byte exporters, and batch export orchestration with progress,
  checkpoint, append-skip, merged output, and retry-friendly client hooks

## Out Of Scope

- Application state management
- File picker, drag/drop, or session orchestration
- Schematic/PCB pan and zoom event controllers
- Three.js runtime, OrbitControls, canvas mounting, and picking
- STEP mesh loading and browser script injection
- Model ZIP export UI and download orchestration
- Choosing a hosted component-source provider for applications; hosts inject
  fetch and endpoint configuration explicitly
- Server, deployment, and app metadata endpoints
- Native document authoring, round-trip writing, GUI automation, and compiled
  multi-sheet project netlist generation
- Pretending an Altium-only feature exists in another source toolkit when no
  truthful CircuitJSON or native implementation is possible
