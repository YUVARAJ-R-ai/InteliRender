'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KanbanParams } from '@/types/widget';
import { Badge } from '@/components/ui/badge';

export function KanbanBoard({ params }: { params: KanbanParams }) {
  const [columns, setColumns] = useState(params.columns);
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
      const task = col.tasks.find(t => t.id === draggedTaskId);
      if (task) {
        taskToMove = task;
        sourceColId = col.id;
      }
    });

    if (!taskToMove || sourceColId === targetColumnId) {
      setDraggedTaskId(null);
      return;
    }

    setColumns(prevColumns => 
      prevColumns.map(col => {
        if (col.id === sourceColId) {
          return { ...col, tasks: col.tasks.filter(t => t.id !== draggedTaskId) };
        }
        if (col.id === targetColumnId) {
          return { ...col, tasks: [...col.tasks, taskToMove] };
        }
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
    <div className="flex flex-col w-full h-full p-2 overflow-x-auto select-none">
      <div className="flex space-x-4 pb-4">
        {columns.map(col => (
          <div 
            key={col.id} 
            className="flex flex-col min-w-[280px] w-[280px] bg-muted/30 rounded-xl overflow-hidden border"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="flex items-center justify-between p-3 border-b bg-muted/50">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: col.color || '#888' }} />
                <h3 className="font-semibold text-sm">{col.title}</h3>
              </div>
              <Badge variant="secondary" className="text-xs px-2 py-0 h-5">
                {col.tasks.length}
              </Badge>
            </div>
            
            <div className="flex-1 p-3 flex flex-col space-y-3 min-h-[150px]">
              <AnimatePresence>
                {col.tasks.map(task => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e as any, task.id)}
                    className={`bg-card border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors ${
                      draggedTaskId === task.id ? 'opacity-50 ring-2 ring-primary ring-offset-2' : ''
                    }`}
                  >
                    <p className="text-sm font-medium mb-3">{task.title}</p>
                    <div className="flex justify-start">
                      <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-semibold ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </Badge>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {col.tasks.length === 0 && (
                <div className="h-full flex flex-1 items-center justify-center text-muted-foreground/50 text-xs italic border-2 border-dashed border-muted-foreground/20 rounded-lg p-4">
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
