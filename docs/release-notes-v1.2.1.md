<!--
SPDX-FileCopyrightText: 2026 André Fiedler
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Altium Toolkit 1.2.1

Version 1.2.1 removes an unused Three.js runtime dependency from the published
package. Altium parsing, canonical CircuitJSON projection, rendering contracts,
and every 1.2.0 API remain unchanged.

Three.js remains a development dependency for the repository-owned browser
examples. Consumers now install only the runtime dependencies used by the
library, avoiding a second Three.js version when the host or 3D viewer owns its
scene runtime.
