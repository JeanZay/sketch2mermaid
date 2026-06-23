# Sketch2Mermaid

Sketch2Mermaid v0 is an open-source, client-side web application designed to help users build visual flowchart diagrams easily and export them as clean, valid Mermaid.js markup.

## Core Scope & Limitations (v0)

- **Canvas to Mermaid Only**: Generation is unidirectionally canvas → Mermaid. Import of Mermaid markup back into the canvas is **out of scope** for v0.
- **Strictly Flowcharts**: Supports standard Mermaid flowcharts. Visual parameters like colors, custom arrows, or subgraphs are not supported in v0.
- **Layout and Positions**: All node positions are stored locally in the canonical JSON model for canvas rendering but are **strictly omitted** from the exported Mermaid code. Mermaid handles diagram layout dynamically.

## Security Model

Sketch2Mermaid is designed to run securely as a static frontend-only site:
- **No Backend**: No database, server-side processing, API keys, or user sessions.
- **Sanitized SVG Render**: Mermaid is initialized with `securityLevel: "strict"`. User inputs are fully escaped character-by-character before generation to prevent XSS vector injection.
- **Isolated Rendering**: SVG renderings are safely updated through controlled rendering paths.
- **Security Headers**: Standard HTTP security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and CSP) are applied where the hosting platform supports them.

## Local Development

### Requirements
- Node.js (version 20+ pinned in `.nvmrc`)

### Installation & Run
1. Install dependencies (commits `package-lock.json` to keep builds identical):
   ```bash
   npm ci
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Run the test suite:
   ```bash
   npm run test
   ```

### Production Build & Deployment
Build the static website files:
```bash
npm run build
```
The output directory will be `dist`.

#### Base Path Configuration
To support deployment on subpaths (e.g., GitHub Pages repository path `/sketch2mermaid/`):
- Production builds default to the `/sketch2mermaid/` base path.
- To override this base path (e.g., for custom root domain deployments `/`), set the environment variable:
  ```bash
  VITE_BASE_PATH=/ npm run build
  ```

#### Local Build Preview
To preview the production build locally:
```bash
npm run preview
```
*Note: `npm run preview` is intended for local verification only and should not be used as a production server.*
