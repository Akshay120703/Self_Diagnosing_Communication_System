// Simple RNG utilities (Box-Muller for normal, Knuth for Poisson)
function randn() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function poisson(lambda) {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1.0;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

const FaultType = {
  NONE: "none",
  NOISE_SPIKE: "noise_spike",
  WIDEBAND_JAMMER: "wideband_jammer",
  SYNC_LOSS: "sync_loss",
  CONGESTION: "congestion",
  FADING: "fading",
};

class FaultConfig {
  constructor() {
    this.noise_spike_level = 0.0;
    this.jammer_level = 0.0;
    this.sync_loss_prob = 0.0;
    this.congestion_level = 0.0;
    this.fading_severity = 0.0;
  }
}

class CommLinkSimulator {
  constructor() {
    this.t = 0;
    this.baseline_snr_db = 25.0;
    this.baseline_ber = 1e-6;
    this.baseline_latency_ms = 20.0;
    this.baseline_retries = 0;
    this.fault_config = new FaultConfig();
  }

  setFaultConfig(cfg) {
    this.fault_config = cfg;
  }

  step() {
    this.t += 1;
    const cfg = this.fault_config;
    const active_faults = [];

    let snr = this.baseline_snr_db + randn() * 0.3;
    let ber = Math.max(this.baseline_ber * 10 ** (randn() * 0.2), 1e-9);
    let latency = this.baseline_latency_ms + randn() * 1.0;
    let retries = this.baseline_retries;

    // Noise spike
    if (cfg.noise_spike_level > 0) {
      const noise = cfg.noise_spike_level;
      snr -= 8.0 * noise + randn() * (1.0 * noise);
      ber *= 10 ** (2.0 * noise + randn() * (0.5 * noise));
      active_faults.push(FaultType.NOISE_SPIKE);
    }

    // Wideband jammer
    if (cfg.jammer_level > 0) {
      const jam = cfg.jammer_level;
      snr -= 15.0 * jam + randn() * (2.0 * jam);
      ber *= 10 ** (3.0 * jam + randn() * (0.5 * jam));
      retries += Math.max(0, Math.round(5 * jam + poisson(2 * jam)));
      latency += 5 * jam + randn() * (2 * jam);
      active_faults.push(FaultType.WIDEBAND_JAMMER);
    }

    // Sync loss
    let sync_outage = false;
    if (cfg.sync_loss_prob > 0 && Math.random() < cfg.sync_loss_prob) {
      sync_outage = true;
      ber = 0.1 + 0.8 * Math.random();
      snr = this.baseline_snr_db + randn();
      latency += 200 + randn() * 20;
      retries += 5 + poisson(3);
      active_faults.push(FaultType.SYNC_LOSS);
    }

    // Congestion
    if (cfg.congestion_level > 0 && !sync_outage) {
      const cong = cfg.congestion_level;
      latency += 40 * cong + randn() * (10 * cong);
      retries += Math.max(0, Math.round(3 * cong + poisson(3 * cong)));
      ber *= 10 ** (0.3 * cong + randn() * (0.1 * cong));
      active_faults.push(FaultType.CONGESTION);
    }

    // Fading
    if (cfg.fading_severity > 0 && !sync_outage) {
      const fad = cfg.fading_severity;
      snr -= 5.0 * fad + Math.abs(randn() * (3.0 * fad));
      ber *= 10 ** (1.5 * fad + randn() * (0.3 * fad));
      active_faults.push(FaultType.FADING);
    }

    // Clip to realistic ranges
    snr = Math.min(Math.max(snr, -5), 40);
    ber = Math.min(Math.max(ber, 1e-9), 0.5);
    latency = Math.max(1.0, latency);
    retries = Math.max(0, Math.round(retries));

    return {
      t: this.t,
      snr_db: snr,
      ber,
      latency_ms: latency,
      retries,
      active_faults,
    };
  }
}

// expose to global scope for non-module usage
window.CommLinkSimulator = CommLinkSimulator;
window.FaultConfig = FaultConfig;
window.FaultType = FaultType;
