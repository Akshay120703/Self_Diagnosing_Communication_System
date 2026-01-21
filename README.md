## Self-Diagnosing Communication System Simulator

This project is a **virtual communication link** that monitors its own health, detects performance degradation, and produces **human-readable root-cause explanations** grounded in communication theory.

### Core Ideas

- The simulator generates key link metrics over time:
  - **BER** (Bit Error Rate)
  - **SNR** (Signal-to-Noise Ratio)
  - **Latency**
  - **Retries / retransmissions**
- Users can **inject faults** such as noise spikes, jammers, and synchronization loss.
- A **rule-based diagnostic engine** infers likely root causes, assigns **confidence levels**, and suggests **corrective actions**.
- No black-box ML is used; inference is fully explainable via rules and lightweight decision logic.

### Features

- **Symptom dashboard**: Live plots and summary cards for BER, SNR, latency, and retries.
- **Diagnosis panel**: Plain-language description of the current suspected root cause(s).
- **Root-cause confidence meter**: Shows how strongly the rules support each hypothesis.
- **Corrective actions**: Concrete suggestions for how to mitigate the issue.
- **Fault injection controls**: Toggle and configure:
  - Noise spike
  - Wideband jammer
  - Sync loss
  - Congestion / buffer pressure

### Tech Stack

- Pure **HTML/CSS/JavaScript** (no builds, no installs, no backend).
- Everything runs client-side in the browser for demo purposes.

### Getting Started (static frontend)

1. Open `index.html` in a modern browser (Chrome/Edge/Firefox). You can double-click the file; no server or install needed.
2. Adjust fault sliders, click **Start / Continue**, and watch metrics, diagnoses, and confidence bars update live.

### High-Level Architecture

- `simulator.js`
  - Encapsulates the communication link state and fault model.
  - Produces time-series samples of BER, SNR, latency, and retries based on injected faults.
- `diagnostics.js`
  - Implements a **rule-based inference engine**.
  - Rates hypotheses (noise, jammer, sync loss, congestion, etc.) and computes confidence scores.
  - Generates human-readable explanations and corrective actions.
- `app.js`
  - Wires the simulator + diagnostics to the DOM.
  - Renders dashboards, charts, diagnosis panels, and ground-truth comparison.
- `index.html` / `style.css`
  - Static UI shell and styling; no external dependencies.

### Non-Goals

- No neural networks or opaque ML models.
- This is not a standards-compliant PHY/MAC stack; it is a **didactic simulator** designed to make reasoning and diagnostics visible.

### Next Steps / Ideas

- Add more fault types (slow fading, oscillator drift, interference from neighboring channels).
- Add a simple decision-tree-style rule layer on top of base rules to capture more complex patterns.
- Log sessions to a file for offline analysis and replay.

