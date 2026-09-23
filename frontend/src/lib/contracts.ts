export type Direction = "transport" | "greenery" | "social" | "safety" | "services";
export type Indicator = "T1" | "T2" | "E1" | "E2" | "S1" | "S2" | "B1" | "B2" | "C1" | "C2";
export type Scope = "district" | "city";

export interface Health {
  status: "ok";
  ai_provider: "demo" | "openai";
  dataset: string;
  engine?: string;
}

export interface Metrics {
  T1: number;
  T2: number;
  E1: number;
  E2: number;
  S1: number;
  S2: number;
  B1: number;
  B2: number;
  C1: number;
  C2: number;
}

export interface District {
  id: string;
  name: string;
  population_share: number;
  metrics: Metrics;
}

export interface Intervention {
  id: string;
  name: string;
  direction: Direction;
  scope: Scope;
  cost: number;
  lag: number;
  effects: Partial<Record<Indicator, number>>;
}

export interface Incompatibility {
  pair: [string, string];
  same_district: boolean;
  reason: string;
}

export interface Synergy {
  pair: [string, string];
  target_intervention_id: string;
  effects: Partial<Record<Indicator, number>>;
}

export interface CriticalIndicator {
  district_id: string;
  indicator: Indicator;
  value: number;
}

export interface ScoreBreakdown {
  weighted_average: number;
  minimum: number;
  weakest_district_ids: string[];
  critical_count: number;
  critical_indicators: CriticalIndicator[];
  score: number;
}

export interface Baseline {
  spent: number;
  city_metrics: Metrics;
  district_scores: Record<string, number>;
  breakdown: ScoreBreakdown;
}

export interface CityData {
  version: string;
  engine_version: string;
  title: string;
  disclaimer: string;
  budget: number;
  currency: string;
  rules: {
    decisions_count: number;
    max_per_direction: number;
    critical_threshold: number;
  };
  indicator_names: Record<Indicator, string>;
  districts: District[];
  interventions: Intervention[];
  synergies: Synergy[];
  incompatibilities: Incompatibility[];
  default_scenario: { decisions: Decision[] };
}

export interface Catalog {
  ai_mode: "demo" | "openai";
  city: CityData;
  baseline: Baseline;
}

export interface Decision {
  intervention_id: string;
  district_id?: string | null;
}

export interface DistrictResult {
  id: string;
  name: string;
  before: Metrics;
  after: Metrics;
  delta: Partial<Record<Indicator, number>>;
  score_before: number;
  score_after: number;
}

export interface AppliedSynergy {
  pair: [string, string];
  district_id: string;
  effects: Partial<Record<Indicator, number>>;
}

export interface Simulation {
  scenario_id: string;
  dataset_version: string;
  engine_version: string;
  budget: number;
  spent: number;
  remaining: number;
  score_before: number;
  score_after: number;
  score_delta: number;
  city_before: Metrics;
  city_after: Metrics;
  breakdown_before: ScoreBreakdown;
  breakdown_after: ScoreBreakdown;
  districts: DistrictResult[];
  decisions: Decision[];
  applied_synergies: AppliedSynergy[];
  warnings: string[];
}

export interface PreviewError {
  code: string;
  message: string;
  intervention_id?: string;
}

export interface PreviewResponse {
  budget: number;
  spent: number;
  remaining: number;
  valid: boolean;
  complete: boolean;
  errors: PreviewError[];
  score_before?: number | null;
  score_after?: number | null;
  score_delta?: number | null;
  warnings?: string[];
}

export interface ApiFailure {
  error?: string;
  detail?: string;
  code?: string;
}

export type CouncilRole = "urbanist" | "economist" | "resident";
export type CouncilStance = "agree" | "partly_agree" | "disagree";

export interface CouncilOpinion {
  summary: string;
  strengths: string[];
  risks: string[];
  recommendations: string[];
}

export interface CouncilReview {
  role: CouncilRole;
  name: string;
  opinion: CouncilOpinion;
}

export interface CouncilReply {
  role: CouncilRole;
  name: string;
  reply: {
    reply_to: CouncilRole;
    stance: CouncilStance;
    argument: string;
    recommendation: string;
  };
}

export type CouncilEvent =
  | { type: "simulation"; data: Simulation }
  | { type: "mode"; data: { provider: "demo" | "openai" } }
  | { type: "review"; data: CouncilReview }
  | { type: "reply"; data: CouncilReply }
  | { type: "done"; data: { scenario_id: string } }
  | { type: "error"; data: { message: string; provider: "demo" | "openai" } };

export type ChallengeStatus =
  | "score_improves"
  | "no_score_improvement"
  | "no_candidate";

export interface ChallengeReplacement {
  slot_index: number;
  removed: Decision;
  added: Decision;
}

export interface ChallengeMetricLoss {
  district_id: string;
  district_name: string;
  indicator: Indicator;
  before: number;
  after: number;
  delta: number;
}

export interface ChallengeResponse {
  status: ChallengeStatus;
  candidates_checked: number;
  original: Simulation;
  alternative: Simulation | null;
  replacement: ChallengeReplacement | null;
  metric_losses: ChallengeMetricLoss[];
  question: string;
}
