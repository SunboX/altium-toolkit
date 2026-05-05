# Library Scope

Altium Toolkit provides reusable native Altium parsing and non-interactive
rendering primitives.

## In Scope

- `.SchDoc` and `.PcbDoc` parsing from `ArrayBuffer`
- OLE and binary stream helpers needed by parser recovery
- Schematic SVG rendering
- PCB SVG rendering
- BOM HTML rendering
- PCB 3D scene-description data
- Static 3D summary HTML
- Parser worker entrypoint for host applications
- Optional renderer CSS

## Out Of Scope

- Application state management
- File picker, drag/drop, or session orchestration
- Schematic/PCB pan and zoom event controllers
- Three.js runtime, OrbitControls, canvas mounting, and picking
- STEP mesh loading and browser script injection
- Model ZIP export UI and download orchestration
- Server, deployment, and app metadata endpoints
