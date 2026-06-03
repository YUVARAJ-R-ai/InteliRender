export interface Skill {
  name: string;
  trigger: string; // e.g. 'kanban'
  description: string;
  template: string;
}

export const BUILTIN_SKILLS: Skill[] = [
  {
    name: 'Kanban Board',
    trigger: 'kanban',
    description: 'Generates a task board with structured columns and lists.',
    template: 'Create a Kanban board for '
  },
  {
    name: 'Dashboard',
    trigger: 'dashboard',
    description: 'Generates a metrics and KPI dashboard with visual charts.',
    template: 'Create a metrics dashboard showing '
  },
  {
    name: 'Gravity Simulation',
    trigger: 'gravity',
    description: 'Generates an interactive physics/orbital simulation.',
    template: 'Create an orbital gravity simulation with '
  },
  {
    name: 'Interactive Table',
    trigger: 'table',
    description: 'Generates a rich interactive data table.',
    template: 'Create a data table displaying '
  },
  {
    name: 'Timeline / Gantt',
    trigger: 'timeline',
    description: 'Generates a Gantt-style project timeline as an interactive visual.',
    template: 'Create a project timeline for '
  },
  {
    name: 'Mind Map',
    trigger: 'mindmap',
    description: 'Generates an interactive mind map for brainstorming and concept visualization.',
    template: 'Create a mind map for '
  },
  {
    name: 'Decision Matrix',
    trigger: 'matrix',
    description: 'Generates a weighted decision matrix for comparing options.',
    template: 'Create a decision matrix comparing '
  },
  {
    name: 'Flowchart',
    trigger: 'flowchart',
    description: 'Generates a flowchart or architecture diagram as an SVG visual.',
    template: 'Create a flowchart for '
  },
  {
    name: 'Pomodoro Timer',
    trigger: 'pomodoro',
    description: 'Generates an interactive Pomodoro timer with session tracking.',
    template: 'Create a pomodoro timer for '
  }
];
