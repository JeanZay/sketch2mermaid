<div align="center">
  <img src="public/favicon.svg" alt="Sketch2Mermaid Logo" width="120" />
  <h1>Sketch2Mermaid</h1>
  <p><strong>A builder-centric visual canvas for generating Mermaid code, tailored for AI-assisted workflows.</strong></p>
</div>

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![CI Status](https://github.com/OWNER/sketch2mermaid/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/sketch2mermaid/actions/workflows/ci.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

</div>

---

## 🎯 Vision & Positioning

**Sketch2Mermaid** bridges the gap between visual thinking and LLM-ready text output. While users can easily sketch a process, decision, or flow, Large Language Models (LLMs) parse and generate structured text far better than they analyze images. Mermaid.js is the perfect pivot format: readable by humans, versionable in Git, native to Markdown, and highly exploitable by LLMs.

Sketch2Mermaid provides a **strictly unidirectional** workflow:  
**Editor (Canvas) → Canonical JSON Model → Clean Mermaid Code**

Unlike generic diagramming tools, Sketch2Mermaid is explicitly constrained to what standard Mermaid flowcharts can express. It is an AI-ready enabler, designed to seamlessly feed diagrams into LLM prompts, documentation, or codebases without formatting errors.

## ✨ Features (v0)

- **Pure Visual Editing:** Drag-and-drop nodes, draw connections, and edit labels seamlessly.
- **Strictly Flowcharts:** Implements 6 core Mermaid flowchart shapes (`process`, `rounded`, `stadium`, `decision`, `event`, `endEvent`) and 2 edge styles (`solid`, `dotted`).
- **Deterministic Export:** Generates character-by-character accurate Mermaid.js code with proper escaping to avoid parse errors.
- **Auto-Layout Native:** Uses standard flowchart directions (`TD`, `LR`, `BT`, `RL`). Canvas positions are pure editor metadata and do not leak into the generated code.
- **Zero-Backend Security:** 100% client-side web application. No database, no telemetry, no API keys.
- **Local Persistence:** Your work is saved directly in your browser's `localStorage`.

## 🚀 Quick Start

### Requirements
- Node.js (version 20+ pinned in `.nvmrc`)

### Installation
Clone the repository and install dependencies using `npm ci` to ensure lockfile fidelity.

```bash
git clone https://github.com/yourusername/sketch2mermaid.git
cd sketch2mermaid
npm ci
```

### Development
Start the local Vite development server:

```bash
npm run dev
```

### Testing & Linting
Ensure code quality with strictly configured ESLint and Vitest. *CI requires zero warnings.*

```bash
npm run typecheck
npm run lint
npm run test
```

### Production Build
Build the static website files (output to `dist`):

```bash
npm run build
```

## 🛠️ Technology Stack

- **Core:** React 19, TypeScript, Vite
- **Canvas Engine:** `@xyflow/react` (React Flow)
- **State Management:** `zustand` (Single canonical JSON truth)
- **Mermaid Rendering:** `mermaid` (Strict security level)
- **Testing:** `vitest`

## 🛡️ Security Model

Sketch2Mermaid is built securely by design:
- **Client-Side Only:** No data ever leaves your browser.
- **Strict Execution:** Mermaid operates in `securityLevel: "strict"`.
- **Sanitized Outputs:** Custom pure functions safely escape all user inputs, preventing injection vectors and SVG XSS.

## 🤝 Contributing

We welcome contributions! Please review our [Contributing Guidelines](CONTRIBUTING.md) and our core architecture decisions in [ADR-001](ADR-001-Sketch2Mermaid.md) before opening a pull request. 
> **Note:** Bidirectional import (Mermaid to Canvas) is explicitly out of scope for v0. Please read the ADR.

## 📝 License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for more information.
