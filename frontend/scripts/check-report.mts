import assert from "node:assert/strict";
import { buildReportMarkdown } from "../src/lib/reportMarkdown.ts";

const simulation = {
  scenario_id: "abc",
  dataset_version: "v",
  engine_version: "2",
  budget: 100,
  spent: 95,
  remaining: 5,
  score_before: 52.55768,
  score_after: 56.54307,
  score_delta: 3.98539,
  city_before: {},
  city_after: {},
  breakdown_before: {
    weighted_average: 0,
    minimum: 0,
    weakest_district_ids: [],
    critical_count: 0,
    critical_indicators: [],
    score: 52.55768,
  },
  breakdown_after: {
    weighted_average: 0,
    minimum: 0,
    weakest_district_ids: [],
    critical_count: 0,
    critical_indicators: [],
    score: 56.54307,
  },
  districts: [],
  decisions: [
    { intervention_id: "M7", district_id: "nura" },
    { intervention_id: "M12", district_id: null },
  ],
  applied_synergies: [{ pair: ["M10", "M12"], district_id: "nura", effects: { B1: 2 } }],
  warnings: [],
};

const md = buildReportMarkdown({ team: "ILON", simulation: simulation as never });
assert.match(md, /56\.54307/);
assert.match(md, /M7/);
assert.match(md, /Синергии/);
assert.match(md, /синтетическ/i);
console.log("reportMarkdown ok");
