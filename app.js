const els = {};
let simulator;
let diagEngine;
let history = [];
let diagnoses = [];
let running = false;
let timer = null;

function initElements() {
  els.snrCard = document.getElementById("snr-card");
  els.berCard = document.getElementById("ber-card");
  els.latencyCard = document.getElementById("latency-card");
  els.retriesCard = document.getElementById("retries-card");

  els.snrChart = document.getElementById("snr-chart");
  els.berChart = document.getElementById("ber-chart");
  els.latencyChart = document.getElementById("latency-chart");
  els.retriesChart = document.getElementById("retries-chart");

  els.diagPrimary = document.getElementById("diag-primary");
  els.confBars = document.getElementById("confidence-bars");
  els.actionsList = document.getElementById("actions-list");
  els.evidenceList = document.getElementById("evidence-list");

  els.accuracy = document.getElementById("accuracy");
  els.truthBody = document.getElementById("truth-body");

  els.noise = document.getElementById("noise");
  els.jammer = document.getElementById("jammer");
  els.sync = document.getElementById("sync");
  els.congestion = document.getElementById("congestion");
  els.fading = document.getElementById("fading");

  els.noiseVal = document.getElementById("noise-val");
  els.jammerVal = document.getElementById("jammer-val");
  els.syncVal = document.getElementById("sync-val");
  els.congestionVal = document.getElementById("congestion-val");
  els.fadingVal = document.getElementById("fading-val");

  document.getElementById("start-btn").addEventListener("click", () => startSimulation());
  document.getElementById("pause-btn").addEventListener("click", () => pauseSimulation());
  document.getElementById("step-btn").addEventListener("click", () => stepSimulation());
  document.getElementById("reset-btn").addEventListener("click", () => resetSimulation());

  for (const [input, label, fmt] of [
    [els.noise, els.noiseVal, (v) => v.toFixed(1)],
    [els.jammer, els.jammerVal, (v) => v.toFixed(1)],
    [els.sync, els.syncVal, (v) => v.toFixed(2)],
    [els.congestion, els.congestionVal, (v) => v.toFixed(1)],
    [els.fading, els.fadingVal, (v) => v.toFixed(1)],
  ]) {
    input.addEventListener("input", () => {
      label.textContent = fmt(parseFloat(input.value));
      updateFaultConfig();
    });
  }
}

function updateFaultConfig() {
  const cfg = new FaultConfig();
  cfg.noise_spike_level = parseFloat(els.noise.value);
  cfg.jammer_level = parseFloat(els.jammer.value);
  cfg.sync_loss_prob = parseFloat(els.sync.value);
  cfg.congestion_level = parseFloat(els.congestion.value);
  cfg.fading_severity = parseFloat(els.fading.value);
  simulator.setFaultConfig(cfg);
}

function startSimulation() {
  if (running) return;
  running = true;
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    simulateSteps(3);
    render();
  }, 250);
}

function pauseSimulation() {
  running = false;
  if (timer) clearInterval(timer);
}

function stepSimulation() {
  simulateSteps(1);
  render();
}

function resetSimulation() {
  pauseSimulation();
  history = [];
  diagnoses = [];
  render();
}

function simulateSteps(n) {
  for (let i = 0; i < n; i++) {
    const sample = simulator.step();
    history.push(sample);

    const windowStats = windowFrom(history, 20);
    const diag = diagEngine.diagnose(windowStats);
    diagnoses.push({
      t: sample.t,
      primary_cause: diag.primary_cause,
      confidence: diag.confidence,
      ranked_causes: diag.ranked_causes,
      explanation: diag.explanation,
      suggested_actions: diag.suggested_actions,
      contributing_rules: diag.contributing_rules,
      active_faults: sample.active_faults,
    });
  }
}

function render() {
  renderMetrics();
  renderCharts();
  renderDiagnosis();
  renderTruth();
}

function renderMetrics() {
  if (!history.length) {
    els.snrCard.textContent = "--";
    els.berCard.textContent = "--";
    els.latencyCard.textContent = "--";
    els.retriesCard.textContent = "--";
    return;
  }
  const latest = history[history.length - 1];
  els.snrCard.textContent = latest.snr_db.toFixed(1);
  els.berCard.textContent = latest.ber.toExponential(2);
  els.latencyCard.textContent = latest.latency_ms.toFixed(1);
  els.retriesCard.textContent = latest.retries.toFixed(0);
}

function renderCharts() {
  const maxPoints = 120;
  const slice = history.slice(-maxPoints);
  const xs = slice.map((s, idx) => idx);
  drawChart(els.snrChart, xs, slice.map((s) => s.snr_db), { color: "#60a5fa", label: "SNR" });
  drawChart(els.berChart, xs, slice.map((s) => s.ber), {
    color: "#fbbf24",
    label: "BER",
    log: true,
    min: 1e-9,
  });
  drawChart(els.latencyChart, xs, slice.map((s) => s.latency_ms), { color: "#34d399", label: "Latency" });
  drawChart(els.retriesChart, xs, slice.map((s) => s.retries), { color: "#f87171", label: "Retries" });
}

function renderDiagnosis() {
  if (!diagnoses.length) {
    els.diagPrimary.textContent = "No diagnosis yet. Press start.";
    els.confBars.innerHTML = "";
    els.actionsList.innerHTML = "";
    els.evidenceList.innerHTML = "";
    return;
  }
  const latest = diagnoses[diagnoses.length - 1];
  els.diagPrimary.textContent = `${latest.explanation}`;

  els.confBars.innerHTML = "";
  for (const [rc, conf] of latest.ranked_causes) {
    const row = document.createElement("div");
    row.className = "bar-row";
    const label = document.createElement("div");
    label.className = "label";
    label.textContent = rc.replace(/_/g, " ");
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("div");
    fill.className = "fill";
    fill.style.width = `${Math.round(conf * 100)}%`;
    bar.appendChild(fill);
    const pct = document.createElement("div");
    pct.className = "label";
    pct.style.textAlign = "right";
    pct.textContent = `${(conf * 100).toFixed(1)}%`;
    row.append(label, bar, pct);
    els.confBars.appendChild(row);
  }

  els.actionsList.innerHTML = "";
  latest.suggested_actions.forEach((a) => {
    const li = document.createElement("li");
    li.textContent = a;
    els.actionsList.appendChild(li);
  });

  els.evidenceList.innerHTML = "";
  latest.contributing_rules.forEach((ev) => {
    const li = document.createElement("li");
    li.textContent = `${ev.root_cause.replace(/_/g, " ")} (score ${ev.score.toFixed(2)}): ${ev.explanation}`;
    els.evidenceList.appendChild(li);
  });
}

function renderTruth() {
  const lastN = Math.min(40, diagnoses.length);
  const recent = diagnoses.slice(-lastN).reverse();
  els.truthBody.innerHTML = "";
  let matches = 0;

  recent.forEach((d) => {
    const tr = document.createElement("tr");
    const trueFaults = d.active_faults.length ? d.active_faults.join(", ") : "none";
    const tdT = `<td>${d.t}</td>`;
    const tdP = `<td>${d.primary_cause.replace(/_/g, " ")}</td>`;
    const tdC = `<td>${(d.confidence * 100).toFixed(1)}%</td>`;
    const tdF = `<td>${trueFaults}</td>`;
    tr.innerHTML = tdT + tdP + tdC + tdF;
    els.truthBody.appendChild(tr);

    const faultSet = new Set(d.active_faults);
    const primary = d.primary_cause;
    if ((faultSet.size === 0 && (primary === RootCause.HEALTHY || primary === RootCause.UNKNOWN)) || faultSet.has(primary)) {
      matches += 1;
    }
  });

  const accuracy = lastN ? (matches / lastN) * 100 : 0;
  els.accuracy.textContent = `Agreement (last ${lastN} samples): ${accuracy.toFixed(1)}%`;
}

function drawChart(canvas, xs, ys, { color, label, log = false, min = null }) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!ys.length) {
    ctx.fillStyle = "#475569";
    ctx.fillText("No data", 10, h / 2);
    return;
  }

  let yVals = [...ys];
  if (log) {
    const epsilon = min || 1e-9;
    yVals = yVals.map((v) => Math.log10(Math.max(v, epsilon)));
  }

  const yMin = Math.min(...yVals);
  const yMax = Math.max(...yVals);
  const xMin = 0;
  const xMax = xs.length ? xs[xs.length - 1] : 1;

  const pad = 10;
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(pad, pad, w - 2 * pad, h - 2 * pad);
  ctx.stroke();

  ctx.beginPath();
  ys.forEach((y, idx) => {
    const xv = xs[idx];
    const xNorm = (xv - xMin) / Math.max(1, xMax - xMin);
    const yv = log ? Math.log10(Math.max(y, min || 1e-9)) : y;
    const yNorm = (yv - yMin) / Math.max(1e-6, yMax - yMin);
    const px = pad + xNorm * (w - 2 * pad);
    const py = h - pad - yNorm * (h - 2 * pad);
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px system-ui";
  ctx.fillText(label, pad + 4, pad + 12);
}

function main() {
  simulator = new CommLinkSimulator();
  diagEngine = new DiagnosticEngine();
  initElements();
  updateFaultConfig();
  render();
}

document.addEventListener("DOMContentLoaded", main);
