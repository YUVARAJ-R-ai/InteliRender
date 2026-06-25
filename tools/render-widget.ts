import { tool, jsonSchema } from 'ai';
import { handleWidget } from '@/widgets/registry';

export const renderWidget = tool({
  description: 'Render an interactive visual widget. Use treemap/code-diff/timeline/network-graph for structured data; html-canvas for custom visuals (timelines, mindmaps, flowcharts, pomodoro).',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      title:       { type: 'string', description: 'Widget title' },
      type:        { type: 'string', enum: ['chart','kanban','dashboard','table','form','custom','html-canvas','treemap','code-diff','timeline','network-graph'] },
      html:        { type: 'string', description: 'Full HTML/CSS/JS for html-canvas type' },
      jsx_or_html: { type: 'string', description: 'Alias for html' },
      params:      { type: 'object', description: 'Structured data for kanban/dashboard/gravity/treemap/code-diff/timeline/network-graph widgets', additionalProperties: true },
      reasoning:   { type: 'string', description: 'Why this widget type was chosen' },
    },
    required: ['title', 'type', 'reasoning'],
    additionalProperties: false,
  } as any),
  execute: async (params: any) => handleWidget(params),
} as any);
