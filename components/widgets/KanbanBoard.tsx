'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KanbanParams } from '@/types/widget';
import { Badge } from '@/components/ui/badge';

// Coerce the various shapes weak models emit into the flat `columns` array the
// board renders. Handles the canonical shape plus the common "sprints" shape
// ({ sprints: [{ name, columns: { ColName: [task,...] } }], globalColumns? }),
// where columns is an object keyed by stage. Sprint tasks are pooled under the
// shared stages and tagged with their sprint so no information is lost.
function normaliseColumns(params: any): any[] {
  if (Array.isArray(params?.columns)) return params.columns;

  if (Array.isArray(params?.sprints)) {
    const stageNames: string[] =
      params.globalColumns ??
      [...new Set(params.sprints.flatMap((s: any) => Object.keys(s?.columns ?? {})))];

    return stageNames.map((stage) => ({
      title: stage,
      tasks: params.sprints.flatMap((sprint: any) => {
        const sprintTag = sprint?.name ? sprint.name.split(':')[0].trim() : '';
        return (sprint?.columns?.[stage] ?? []).map((t: any) => {
          const title = typeof t === 'string' ? t : t?.title ?? String(t);
          return {
            title: sprintTag ? `[${sprintTag}] ${title}` : title,
            priority: typeof t === 'object' ? t?.priority : undefined,
          };
        });
      }),
    }));
  }

  return [];
}

export function KanbanBoard({ params }: { params: KanbanParams }) {
  // Normalise: guarantee id + tasks exist even when the LLM omits them
  const [columns, setColumns] = useState(
    normaliseColumns(params).map((col: any, ci: number) => ({
      ...col,
      id: col.id ?? `col-${ci}`,
      color: col.color ?? '#888',
      tasks: (col.tasks ?? []).map((task: any, ti: number) => ({
        ...task,
        id: task.id ?? `task-${ci}-${ti}`,
        priority: task.priority ?? 'medium',
      })),
    }))
  );
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    if (!draggedTaskId) return;

    let taskToMove: any = null;
    let sourceColId = '';

    columns.forEach(col => {
      const task = (col.tasks ?? []).find((t: any) => t.id === draggedTaskId);
      if (task) { taskToMove = task; sourceColId = col.id; }
    });

    if (!taskToMove || sourceColId === targetColumnId) {
      setDraggedTaskId(null);
      return;
    }

    setColumns(prevColumns =>
      prevColumns.map(col => {
        const tasks = col.tasks ?? [];
        if (col.id === sourceColId) return { ...col, tasks: tasks.filter((t: any) => t.id !== draggedTaskId) };
        if (col.id === targetColumnId) return { ...col, tasks: [...tasks, taskToMove] };
        return col;
      })
    );
    
    setDraggedTaskId(null);
  };

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'high': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'low': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  return (
    // Equal-width grid: every column shares the available width so the whole board
    // is contained within the chat column — no horizontal scrolling, ever.
    // minmax(0,1fr) lets columns shrink below their content so card text wraps.
    <div className="w-full select-none">
      <div
        className="grid gap-3 items-start"
        style={{ gridTemplateColumns: `repeat(${columns.length || 1}, minmax(0, 1fr))` }}
      >
        {columns.map(col => (
          <div
            key={col.id}
            className="flex flex-col min-w-0 bg-muted/30 rounded-xl overflow-hidden border border-white/5"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-white/5 bg-muted/40 backdrop-blur-sm">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: col.color || '#888' }} />
                <h3 className="font-semibold text-[0.8125rem] tracking-tight truncate">{col.title}</h3>
              </div>
              <Badge variant="secondary" className="text-[0.6875rem] px-1.5 py-0 h-5 shrink-0 tabular-nums">
                {col.tasks.length}
              </Badge>
            </div>

            <div className="flex-1 p-2 flex flex-col gap-2 min-h-[120px]">
              <AnimatePresence>
                {col.tasks.map((task: any) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e as any, task.id)}
                    className={`bg-card border border-white/5 rounded-lg p-2.5 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/40 transition-colors ${
                      draggedTaskId === task.id ? 'opacity-50 ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
                    }`}
                  >
                    <p className="text-[0.8125rem] font-medium leading-snug mb-2 break-words">{task.title}</p>
                    <Badge variant="outline" className={`text-[0.625rem] uppercase tracking-wider font-semibold ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </Badge>
                  </motion.div>
                ))}
              </AnimatePresence>
              {col.tasks.length === 0 && (
                <div className="flex flex-1 items-center justify-center text-muted-foreground/40 text-[0.6875rem] italic border-2 border-dashed border-muted-foreground/15 rounded-lg p-3 min-h-[88px]">
                  Drop tasks here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
