import { z } from 'zod';

export const GravityParamsSchema = z.object({
  bodies: z.array(z.object({
    name: z.string(),
    mass: z.number(),
    radius: z.number(),
    color: z.string(),
    initialPosition: z.tuple([z.number(), z.number(), z.number()]),
    initialVelocity: z.tuple([z.number(), z.number(), z.number()])
  })),
  showForceArrows: z.boolean(),
  showOrbitalPaths: z.boolean()
});

export const KanbanParamsSchema = z.object({
  columns: z.array(z.object({
    id: z.string(),
    title: z.string(),
    color: z.string(),
    tasks: z.array(z.object({
      id: z.string(),
      title: z.string(),
      priority: z.enum(['low', 'medium', 'high'])
    }))
  }))
});

export const DashboardParamsSchema = z.object({
  kpis: z.array(z.object({
    label: z.string(),
    value: z.string(),
    change: z.string(),
    trend: z.enum(['up', 'down', 'flat'])
  })),
  chart: z.object({
    type: z.enum(['bar', 'line', 'area']),
    title: z.string(),
    data: z.array(z.record(z.string(), z.unknown()))
  }),
  table: z.object({
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string()))
  }).optional()
});

export const TextParamsSchema = z.object({
  content: z.string()
});

export const HtmlCanvasParamsSchema = z.object({
  html: z.string().describe("The raw HTML/CSS/JS string payload to be rendered inside an iframe snippet.")
});

// Discriminated union of all widget types
export const WidgetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('gravity'), params: GravityParamsSchema }),
  z.object({ type: z.literal('kanban'), params: KanbanParamsSchema }),
  z.object({ type: z.literal('dashboard'), params: DashboardParamsSchema }),
  z.object({ type: z.literal('text'), params: TextParamsSchema }),
  z.object({ type: z.literal('html-canvas'), params: HtmlCanvasParamsSchema })
]);

// Full AI response schema
export const AIResponseSchema = z.object({
  widget: WidgetSchema,
  text: z.string()
});

export type GravityParams = z.infer<typeof GravityParamsSchema>;
export type KanbanParams = z.infer<typeof KanbanParamsSchema>;
export type DashboardParams = z.infer<typeof DashboardParamsSchema>;
export type TextParams = z.infer<typeof TextParamsSchema>;
export type HtmlCanvasParams = z.infer<typeof HtmlCanvasParamsSchema>;
export type Widget = z.infer<typeof WidgetSchema>;
export type AIResponse = z.infer<typeof AIResponseSchema>;

// Extend chat message to support our widget
export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  widget?: Widget;
};
