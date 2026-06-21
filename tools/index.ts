import { renderWidget } from '@/tools/render-widget';
import { think } from '@/tools/think';
import { calculate } from '@/tools/calculate';
import { generateCsv } from '@/tools/generate-csv';

// Built-in Next.js agent tools. Keys are the tool names the model sees and must
// stay stable (render_widget, think, calculate, generate_csv). web_search,
// browser_task, and fetch_url now live in the Python MCP server (issue #45).
export const agentTools = {
  render_widget: renderWidget,
  think,
  calculate,
  generate_csv: generateCsv,
};
