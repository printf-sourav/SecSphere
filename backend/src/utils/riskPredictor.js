const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const SECRET_SIGNAL_REGEX = /hardcoded\s+secret|access\s+key|private\s+key|api[_\s-]?key|token|password/i;

const getImpactMultiplier = (projectContext) => {
  const impact = String(projectContext?.impact || "medium").toLowerCase();
  if (impact === "high") {
    return 1.15;
  }
  if (impact === "low") {
    return 0.95;
  }
  return 1;
};

const getRiskBand = (score) => {
  if (score >= 80) {
    return "low";
  }
  if (score >= 60) {
    return "moderate";
  }
  if (score >= 35) {
    return "high";
  }
  return "critical";
};

export const predictRiskScore = (issues, projectContext = {}) => {
  const counts = (issues || []).reduce(
    (acc, issue) => {
      const key = String(issue?.severity || "low").toLowerCase();
      if (key === "critical") {
        acc.critical += 1;
      } else if (key === "high") {
        acc.high += 1;
      } else if (key === "medium") {
        acc.medium += 1;
      } else {
        acc.low += 1;
      }

      acc.total += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0, total: 0 }
  );

  const weightedRisk =
    counts.critical * 24 +
    counts.high * 13 +
    counts.medium * 7 +
    counts.low * 3 +
    counts.total * 1.25;

  const hasHighOrCritical = counts.critical > 0 || counts.high > 0;
  const hasSecretSignal = (issues || []).some((issue) =>
    SECRET_SIGNAL_REGEX.test(String(issue?.title || ""))
  );

  let adjustedRisk = weightedRisk * getImpactMultiplier(projectContext);

  // Keep risk interpretation conservative when severe findings exist.
  if (hasHighOrCritical) {
    adjustedRisk += 6;
  }

  // Secrets are high-impact by nature; enforce stronger penalty.
  if (hasSecretSignal) {
    adjustedRisk += 22;
  }

  let predictedScore = clamp(Math.round(100 - adjustedRisk), 0, 100);

  // A project with high/critical findings should not be labeled low risk.
  if (hasHighOrCritical && predictedScore > 79) {
    predictedScore = 79;
  }

  // Secret-related findings should remain at least high risk.
  if (hasSecretSignal && predictedScore > 55) {
    predictedScore = 55;
  }

  return {
    predictedScore,
    riskBand: getRiskBand(predictedScore),
    model: "linear-risk-v2",
    features: counts,
  };
};
