import { Widget } from '@/types/widget';
import { KanbanBoard } from './KanbanBoard';
import { ChartDashboard } from './ChartDashboard';
import { GravitySceneWidget } from './GravityScene';
import { HtmlCanvas } from './HtmlCanvas';

function TextWidget({ params }: { params: { content: string } }) {
  return null; // The text content is already rendered by MessageBubble
}

// Strongly typed registry ensures exhaustive matching of all Widget types at compile time
const WIDGET_REGISTRY: Record<Widget['type'], React.FC<any>> = {
  gravity: GravitySceneWidget,
  kanban: KanbanBoard,
  dashboard: ChartDashboard,
  'html-canvas': HtmlCanvas,
  text: TextWidget,
};

export function WidgetRenderer({ widget }: { widget: Widget }) {
  const Component = WIDGET_REGISTRY[widget.type];
  
  if (!Component) {
    return (
      <div className="p-4 border border-red-500 bg-red-500/10 text-red-500 rounded-lg text-sm">
        Unknown widget type: {widget.type}
      </div>
    );
  }

  return <Component params={widget.params} />;
}
