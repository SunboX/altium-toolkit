# Examples

## Arduino Uno

The `arduino-uno` example is a browser page for loading `.SchDoc` and
`.PcbDoc` files locally and rendering the recovered schematic, PCB, BOM, and
static 3D summary outputs.

It is based on the public
[My-Arduino-UNO-Design](https://github.com/Mehdi-KHALFALLAH/My-Arduino-UNO-Design)
Altium project by Mehdi KHALFALLAH. Credit for that Arduino Uno Altium design
belongs to Mehdi KHALFALLAH.

The example does not redistribute Mehdi KHALFALLAH's Altium project files,
screenshots, datasheets, or manufacturing outputs. Download source files from
the original project if you want to load them in the page.

From the repository root, serve the project with any static HTTP server and open
the page:

```bash
python3 -m http.server 4173
```

Then visit:

```text
http://localhost:4173/examples/arduino-uno/
```

The page is local-first. It does not make outbound network requests unless a
user opens the external source project link.
