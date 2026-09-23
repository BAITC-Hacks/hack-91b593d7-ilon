export interface Health {
  status: "ok";
  ai_provider: "demo" | "openai";
  dataset: string;
}

export interface Catalog {
  ai_mode: "demo" | "openai";
  city: {
    title: string;
    version: string;
    disclaimer: string;
    budget: number;
    currency: string;
    districts: { id: string; name: string }[];
    interventions: { id: string; name: string }[];
  };
}
