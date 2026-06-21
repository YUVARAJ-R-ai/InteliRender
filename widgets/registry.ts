// Per-type handlers for render_widget. Each returns the widget payload, or
// `undefined` to fall through to the raw params (matching the original if/else
// chain's behaviour exactly). Do not change these shapes — MessageBubble wraps
// the whole tool result as the widget's `params`, so nesting/flattening here is
// load-bearing (see the inline notes from the original agent route).
const widgetHandlers: Record<string, (params: any) => any | undefined> = {
  kanban: (params) => {
    // Accept columns at params.params.columns (nested) OR params.columns (flat)
    const rawColumns: any[] = params.params?.columns ?? params.columns ?? [];
    // Normalise the tasks key — model may use items/cards/todos instead of tasks
    const columns = rawColumns.map((col: any) => ({
      ...col,
      tasks: col.tasks ?? col.items ?? col.cards ?? col.todos ?? [],
    }));
    return { type: 'kanban', columns };
  },
  dashboard: (params) =>
    params.params
      ? { type: 'dashboard', kpis: params.params.kpis, chart: params.params.chart, table: params.params.table }
      : undefined,
  gravity: (params) =>
    params.params
      ? { type: 'gravity', bodies: params.params.bodies, showForceArrows: params.params.showForceArrows, showOrbitalPaths: params.params.showOrbitalPaths }
      : undefined,
  'html-canvas': (params) =>
    params.html || params.jsx_or_html
      ? { type: 'html-canvas', html: params.html || params.jsx_or_html }
      : undefined,
  // Return FLAT data (spread params.params) to match the kanban/dashboard/gravity
  // convention. MessageBubble wraps the whole tool result as the widget's `params`,
  // so nesting under a `params` key here would double-nest and break the widget
  // (and crash recharts with undefined data → "Maximum update depth exceeded").
  treemap: (params) => (params.params ? { type: 'treemap', ...params.params } : undefined),
  'code-diff': (params) => (params.params ? { type: 'code-diff', ...params.params } : undefined),
  timeline: (params) => (params.params ? { type: 'timeline', ...params.params } : undefined),
  'network-graph': (params) => (params.params ? { type: 'network-graph', ...params.params } : undefined),
};

export function handleWidget(params: any): any {
  const handler = widgetHandlers[params.type];
  const result = handler ? handler(params) : undefined;
  return result ?? params;
}
