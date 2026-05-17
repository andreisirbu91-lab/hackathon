// Anthropic pricing (USD per million tokens) — keep in sync with anthropic.com/pricing
// Cache write = ~1.25× input, cache read = ~0.10× input.
export type ModelPricing = {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
};

const PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-7":     { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.50 },
  "claude-sonnet-4-6":   { input: 3.0,  output: 15.0, cacheWrite: 3.75,  cacheRead: 0.30 },
  "claude-haiku-4-5":    { input: 1.0,  output: 5.0,  cacheWrite: 1.25,  cacheRead: 0.10 },
};

export function priceFor(model: string): ModelPricing {
  return PRICING[model] ?? PRICING["claude-sonnet-4-6"];
}

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

export function costOf(model: string, u: Usage): number {
  const p = priceFor(model);
  // Cache reads replace input tokens that would otherwise be billed at full rate.
  return (
    (u.input_tokens * p.input) +
    (u.output_tokens * p.output) +
    ((u.cache_creation_input_tokens ?? 0) * p.cacheWrite) +
    ((u.cache_read_input_tokens ?? 0) * p.cacheRead)
  ) / 1_000_000;
}
