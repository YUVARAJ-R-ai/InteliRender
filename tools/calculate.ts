import { tool, jsonSchema } from 'ai';
import { evaluate } from 'mathjs';

export const calculate = tool({
  description: 'Evaluate a mathematical expression safely. Use for financial calculations, percentages, or any numeric computation before building a widget.',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'Math expression e.g. "50000 * 1.07^15" (use ^ for powers, sqrt(), log(), etc.)' },
      description: { type: 'string', description: 'What this calculation represents' },
    },
    required: ['expression'],
    additionalProperties: false,
  } as any),
  execute: async ({ expression, description }: any) => {
    try {
      // mathjs.evaluate is a sandboxed expression evaluator — it cannot execute
      // arbitrary JS (unlike the previous Function() approach), so no manual
      // character allow-listing is needed.
      const result = evaluate(expression);
      return { expression, result, description: description || '' };
    } catch (err: any) {
      return { error: err.message };
    }
  },
} as any);
