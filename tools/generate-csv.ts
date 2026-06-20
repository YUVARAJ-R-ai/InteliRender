import { tool, jsonSchema } from 'ai';

export const generateCsv = tool({
  description: 'Generate a downloadable CSV from structured data. The UI automatically renders a download button from the result, so just tell the user their CSV is ready — do NOT put a link, URL, or the data URI in your reply.',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      headers: { type: 'array', items: { type: 'string' }, description: 'Column headers' },
      rows: { type: 'array', items: { type: 'array', items: { type: 'string' } }, description: 'Data rows' },
      filename: { type: 'string', description: 'Optional suggested filename (without .csv)' },
    },
    required: ['headers', 'rows'],
    additionalProperties: false,
  } as any),
  execute: async ({ headers, rows, filename }: any) => {
    const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row: string[]) => row.map(escape).join(',')).join('\n');
    const dataUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    return { dataUrl, rowCount: rows.length, filename: (filename || 'export') + '.csv' };
  },
} as any);
