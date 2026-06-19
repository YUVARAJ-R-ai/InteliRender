import { tool, jsonSchema } from 'ai';

export const generateCsv = tool({
  description: 'Generate a downloadable CSV from structured data. Returns a data URI — reply with it as a markdown link: [Download CSV](dataUrl).',
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
