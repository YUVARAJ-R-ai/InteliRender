import { AIResponseSchema, AIResponse } from '@/types/widget';

export function parseAIResponse(rawResponse: unknown): AIResponse {
  try {
    // Attempt to parse the raw JSON against our Zod schema
    return AIResponseSchema.parse(rawResponse);
  } catch (error) {
    console.error("Failed to parse AI response into widget protocol:", error);
    throw new Error("Invalid widget protocol structure from AI.");
  }
}
