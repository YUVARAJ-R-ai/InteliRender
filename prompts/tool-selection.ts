export const TOOL_SELECTION_RULES = `TOOL SELECTION RULES:
- Kanban boards: use render_widget with type kanban. Pass columns under params.columns. Each column needs title, color, and tasks array. Each task needs title and priority (high/medium/low). Example: { type: "kanban", title: "Sprint Board", reasoning: "...", params: { columns: [{ title: "To Do", color: "#6366f1", tasks: [{ title: "Task 1", priority: "high" }] }] } }
- Dashboards: use render_widget with type dashboard and pass params.kpis / params.chart.
- Custom visuals (timelines, mindmaps, flowcharts, simulations, gravity, pomodoro, games): use render_widget with type html-canvas and generate self-contained HTML/CSS/JS.
- Web lookups: use web_search.
- Browser automation: use browser_task whenever the user says "open", "go to", "visit", "log in to", "click", "fill", or "scrape" a website — ANY request to interact with or look at a live page in a browser. When credentials are needed, ask the user for them in-chat first and explain they are used only for this session and never stored.
- Fetch full page content: use fetch_url ONLY when the user asks to read/summarize the text of an article or documentation page and no interaction is needed. If the request says open/go to/visit a site, that is browser_task — never fetch_url.
- Math / financial calculations: use calculate before building a widget with numbers.
- Export data as CSV: use generate_csv, then reply with the returned dataUrl as a markdown download link.
- Complex reasoning: use think before acting.`;
