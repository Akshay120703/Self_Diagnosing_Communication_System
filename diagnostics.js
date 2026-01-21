const RootCause = {
  HEALTHY: "healthy",
  NOISE_SPIKE: "noise_spike",
  WIDEBAND_JAMMER: "wideband_jammer",
  SYNC_LOSS: "sync_loss",
  CONGESTION: "congestion",
  FADING: "fading",
  UNKNOWN: "unknown",
};

function mean(arr) {
  if (!arr.length) return NaN;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr) {
  if (arr.length === 0) return NaN;
  const m = mean(arr);
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}

function maxVal(arr) {
  if (!arr.length) return NaN;
  return arr.reduce((a, b) => (b > a ? b : a), -Infinity);
}

class DiagnosticEngine {
  constructor() {
    this.good_snr_db = 20.0;
    this.moderate_snr_db = 12.0;
    this.bad_snr_db = 8.0;

    this.good_ber = 1e-5;
    this.moderate_ber = 1e-3;
    this.bad_ber = 1e-2;

    this.latency_warn_ms = 80.0;
    this.latency_bad_ms = 160.0;

    this.retries_warn = 1.0;
    this.retries_bad = 3.0;
  }

  diagnose(window) {
    const evidences = [];

    // Healthy
    if (
      window.snr_mean > this.good_snr_db &&
      window.ber_max < this.good_ber &&
      window.latency_mean < this.latency_warn_ms &&
      window.retries_mean <= this.retries_warn
    ) {
      evidences.push({
        root_cause: RootCause.HEALTHY,
        score: 1.0,
        explanation: "SNR, BER, latency, and retries are nominal.",
      });
    }

    // Noise spike
    if (
      window.snr_mean < this.good_snr_db &&
      window.snr_std > 1.5 &&
      window.ber_max > this.moderate_ber &&
      window.latency_mean < this.latency_bad_ms
    ) {
      const severity = Math.min(1.0, (this.good_snr_db - window.snr_mean) / 10.0);
      evidences.push({
        root_cause: RootCause.NOISE_SPIKE,
        score: 0.4 + 0.6 * severity,
        explanation: "Volatile SNR dips with BER bursts and modest latency suggest impulsive noise.",
      });
    }

    // Wideband jammer
    if (
      window.snr_mean < this.moderate_snr_db &&
      window.ber_mean > this.moderate_ber &&
      window.retries_mean >= this.retries_warn
    ) {
      const jammer_strength = Math.min(1.0, (this.moderate_snr_db - window.snr_mean) / 8.0);
      evidences.push({
        root_cause: RootCause.WIDEBAND_JAMMER,
        score: 0.5 + 0.5 * jammer_strength,
        explanation: "Persistently poor SNR with high BER and retries indicates strong interference/jamming.",
      });
    }

    // Sync loss
    if (window.ber_max > 0.05 && window.snr_mean >= this.moderate_snr_db) {
      const outage_severity = Math.min(1.0, (window.ber_max - 0.05) / 0.25);
      evidences.push({
        root_cause: RootCause.SYNC_LOSS,
        score: 0.6 + 0.4 * outage_severity,
        explanation: "Very high BER while RF SNR is acceptable points to framing/sync loss.",
      });
    }

    // Congestion
    if (
      window.latency_mean > this.latency_warn_ms &&
      window.retries_mean > this.retries_warn &&
      window.snr_mean > this.bad_snr_db
    ) {
      const cong_level = Math.min(1.0, (window.latency_mean - this.latency_warn_ms) / 120.0);
      evidences.push({
        root_cause: RootCause.CONGESTION,
        score: 0.4 + 0.6 * cong_level,
        explanation: "High latency and retries with tolerable RF conditions suggest congestion.",
      });
    }

    // Fading
    if (
      window.snr_mean < this.good_snr_db &&
      window.snr_std > 2.0 &&
      window.ber_mean > this.good_ber &&
      window.latency_mean < this.latency_bad_ms
    ) {
      const fade_level = Math.min(1.0, window.snr_std / 5.0);
      evidences.push({
        root_cause: RootCause.FADING,
        score: 0.3 + 0.7 * fade_level,
        explanation: "Significant SNR fluctuations with elevated BER and modest latency hint at fading.",
      });
    }

    const scores = {};
    for (const ev of evidences) {
      scores[ev.root_cause] = (scores[ev.root_cause] || 0) + ev.score;
    }

    if (!evidences && window.ber_max < this.moderate_ber && window.snr_mean > this.good_snr_db) {
      scores[RootCause.HEALTHY] = 0.8;
      evidences.push({
        root_cause: RootCause.HEALTHY,
        score: 0.8,
        explanation: "No anomaly signatures; link appears healthy.",
      });
    }

    if (Object.keys(scores).length === 0) {
      scores[RootCause.UNKNOWN] = 1.0;
      evidences.push({
        root_cause: RootCause.UNKNOWN,
        score: 1.0,
        explanation: "Patterns do not clearly match any known rule set.",
      });
    }

    const total = Object.values(scores).reduce((a, b) => a + b, 0);
    const ranked = Object.entries(scores)
      .map(([k, v]) => [k, v / total])
      .sort((a, b) => b[1] - a[1]);

    const [primary_cause, confidence] = ranked[0];

    const explanation = this._buildExplanation(primary_cause, confidence, window, evidences);
    const suggested_actions = this._suggestActions(primary_cause);

    return {
      primary_cause,
      confidence,
      ranked_causes: ranked,
      explanation,
      contributing_rules: evidences,
      suggested_actions,
    };
  }

  _buildExplanation(cause, confidence, window, evidences) {
    const confPct = Math.round(confidence * 100);
    if (cause === RootCause.HEALTHY) {
      return `Link appears healthy (SNR ≈ ${window.snr_mean.toFixed(1)} dB, BER max ≈ ${window.ber_max.toExponential(
        2
      )}, latency ≈ ${window.latency_mean.toFixed(0)} ms, retries ≈ ${window.retries_mean.toFixed(
        1
      )}). Confidence ${confPct}%.`;
    }
    const base = `Most likely root cause: ${cause.replace(/_/g, " ")} (confidence ${confPct}%). `;
    const reasons = evidences
      .filter((ev) => ev.root_cause === cause)
      .map((ev) => ev.explanation)
      .join(" ");
    return base + (reasons || "Metric patterns weakly indicate this condition.");
  }

  _suggestActions(cause) {
    switch (cause) {
      case RootCause.HEALTHY:
        return ["No immediate action required. Continue monitoring for emerging anomalies."];
      case RootCause.NOISE_SPIKE:
        return [
          "Check grounding/shielding to reduce impulsive noise coupling.",
          "Inspect nearby equipment for intermittent high-power emissions.",
          "Increase error-correction strength or interleaving depth if possible.",
        ];
      case RootCause.WIDEBAND_JAMMER:
        return [
          "Evaluate spectral environment and locate strong interferers.",
          "Switch to an alternate channel or band if available.",
          "Apply filtering/notching around the interferer.",
        ];
      case RootCause.SYNC_LOSS:
        return [
          "Verify clock stability and alignment between TX/RX.",
          "Increase preamble length or improve sync acquisition.",
          "Check for framing/configuration mismatches.",
        ];
      case RootCause.CONGESTION:
        return [
          "Reduce offered load or apply traffic shaping.",
          "Increase buffers or enable congestion control mechanisms.",
          "Distribute traffic across additional links if possible.",
        ];
      case RootCause.FADING:
        return [
          "Increase transmit power within limits.",
          "Enable diversity (spatial/frequency/time).",
          "Use more robust modulation/coding during deep fades.",
        ];
      default:
        return [
          "Capture additional diagnostics to refine the hypothesis.",
          "Consider extending the rule base for newly observed patterns.",
        ];
    }
  }
}

function windowFrom(history, windowSize = 20) {
  const slice = history.slice(-windowSize);
  const snr = slice.map((s) => s.snr_db);
  const ber = slice.map((s) => s.ber);
  const lat = slice.map((s) => s.latency_ms);
  const ret = slice.map((s) => s.retries);
  return {
    snr_mean: mean(snr),
    snr_std: std(snr),
    ber_mean: mean(ber),
    ber_max: maxVal(ber),
    latency_mean: mean(lat),
    retries_mean: mean(ret),
  };
}

// expose to global scope for non-module usage
window.RootCause = RootCause;
window.DiagnosticEngine = DiagnosticEngine;
window.windowFrom = windowFrom;
