<!--
SPDX-FileCopyrightText: 2026 André Fiedler

SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Examples

## Arduino Uno

The `arduino-uno` example is a browser page for loading `.SchDoc` and
`.PcbDoc` files locally and rendering the recovered schematic, PCB, BOM,
interactive Three.js PCB view, and static 3D summary outputs. It automatically
fetches the credited source schematic and source PCB from GitHub at startup.

It is based on the public
[My-Arduino-UNO-Design](https://github.com/Mehdi-KHALFALLAH/My-Arduino-UNO-Design)
Altium project by Mehdi KHALFALLAH. Credit for that Arduino Uno Altium design
belongs to Mehdi KHALFALLAH.

The example does not redistribute Mehdi KHALFALLAH's Altium project files,
screenshots, datasheets, or manufacturing outputs. The browser fetches selected
source `.SchDoc` and `.PcbDoc` files from `raw.githubusercontent.com` at runtime.
You can also load local files downloaded from the original project.

From the repository root, start the local example server:

```bash
npm start
```

Then visit:

```text
http://localhost:4173/examples/arduino-uno/
```

The server binds to `127.0.0.1` by default. Override it with `HOST` or `PORT`
when needed:

```bash
PORT=4174 npm start
```

The parser and renderers remain local-first library code. This example page
explicitly makes outbound runtime requests to `raw.githubusercontent.com` only
for the credited source demo files.
