<!--
SPDX-FileCopyrightText: 2026 André Fiedler

SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Library Scope

Altium Toolkit provides reusable native Altium parsing and non-interactive
rendering primitives.

## In Scope

- `.SchDoc`, `.PcbDoc`, `.PcbLib`, `.PrjPcb`, and `.IntLib` parsing from
  `ArrayBuffer`
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

## Out Of Scope

- Application state management
- File picker, drag/drop, or session orchestration
- Schematic/PCB pan and zoom event controllers
- Three.js runtime, OrbitControls, canvas mounting, and picking
- STEP mesh loading and browser script injection
- Model ZIP export UI and download orchestration
- Server, deployment, and app metadata endpoints
- Native document authoring, round-trip writing, GUI automation, and compiled
  multi-sheet project netlist generation
