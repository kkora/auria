// Report: axe results -> SARIF 2.1.0.
//
// buildSarif(analysis, { url }) -> object   for GitHub / Azure DevOps code scanning.
// Impact maps to SARIF level (critical/serious -> error, moderate -> warning,
// minor -> note); each axe node becomes a result location.
// Pure serialization — no file writes, no browser.

const LEVEL = { critical: "error", serious: "error", moderate: "warning", minor: "note" };

export function buildSarif(analysis, { url }) {
  const rules = new Map();
  const results = [];
  for (const [state, list] of Object.entries(analysis.axe)) {
    for (const v of list) {
      if (!rules.has(v.id)) rules.set(v.id, {
        id: v.id,
        shortDescription: { text: v.help },
        properties: { wcag: v.wcag },
      });
      for (const node of v.nodes || []) {
        results.push({
          ruleId: v.id,
          level: LEVEL[v.impact] || "warning",
          message: { text: `${v.help} [${state} width]` },
          locations: [{
            physicalLocation: { artifactLocation: { uri: url } },
            logicalLocations: [{ fullyQualifiedName: node }],
          }],
        });
      }
    }
  }
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: "auria", version: "1.0.0", rules: [...rules.values()] } },
      results,
    }],
  };
}
