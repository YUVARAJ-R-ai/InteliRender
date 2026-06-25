import { tool, jsonSchema } from 'ai';

export const think = tool({
  description: 'Think through complex problems step-by-step before responding or calling other tools.',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      thought: { type: 'string', description: 'Your internal reasoning' },
    },
    required: ['thought'],
    additionalProperties: false,
  } as any),
  execute: async ({ thought }: any) => {
    return { thought, acknowledged: true };
  },
} as any);
