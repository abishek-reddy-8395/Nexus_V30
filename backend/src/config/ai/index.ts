/**
 * Nexus V30 — AI Configuration
 * Model settings, token limits, and rate limits per plan.
 */
export const aiConfig = {
  gemini: {
    model:     'gemini-pro',
    flashModel:'gemini-1.5-flash',
    maxTokens: 1000,
    temperature:0.7,
    apiKey:    process.env.GEMINI_API_KEY,
  },
  openai: {
    model:     'gpt-4-turbo-preview',
    maxTokens: 1000,
    temperature:0.7,
    apiKey:    process.env.OPENAI_API_KEY,
  },
  rateLimits: {
    free:       10,  // per minute
    pro:        30,
    enterprise: 100,
  },
};
