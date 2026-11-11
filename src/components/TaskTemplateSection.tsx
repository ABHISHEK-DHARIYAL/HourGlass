// Purpose: Reusable task routine templates section for quickly instantiating recurring schedule blocks
import React, { useState } from 'react';
import { TaskTemplate, Recurrence } from '../types';
import { Sparkles, Trash2, Plus, Bookmark } from 'lucide-react';

interface TaskTemplateSectionProps {
  userId: string;
  templates: TaskTemplate[];
  onSelectTemplate: (template: Partial<TaskTemplate>) => void;
  onDeleteTemplate: (templateId: string) => Promise<void>;
}

const DEFAULT_TEMPLATES: Partial<TaskTemplate>[] = [
  { title: '💤 Sleep Routine', startHour: 22, endHour: 6, recurrence: Recurrence.DAILY, categoryColor: '#6366f1', priority: false, notes: 'Rest and recharge.' },
  { title: '💪 Gym Session', startHour: 7, endHour: 8, recurrence: Recurrence.DAILY, categoryColor: '#e56b55', priority: false, notes: 'Stay active!' },
  { title: '💻 Deep Work', startHour: 9, endHour: 12, recurrence: Recurrence.DAILY, categoryColor: '#2dd4bf', priority: true, notes: 'Focus block with no distractions.' },
  { title: '🥑 Meal Break', startHour: 13, endHour: 14, recurrence: Recurrence.DAILY, categoryColor: '#eab308', priority: false, notes: 'Healthy fuel.' }
];

export default function TaskTemplateSection({ userId, templates, onSelectTemplate, onDeleteTemplate }: TaskTemplateSectionProps) {
  const [error, setError] = useState<string | null>(null);

  const handleDeleteTemplate = async (e: React.MouseEvent, templateId: string) => {
    e.stopPropagation();
    try {
      await onDeleteTemplate(templateId);
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  const allTemplates = [...templates];
  
  // If user has no templates, display some useful default templates
  const displayTemplates = allTemplates.length > 0 ? allTemplates : DEFAULT_TEMPLATES;

  return (
    <div className="w-full surface-card p-3.5">
      <div className="flex items-center justify-between mb-2.5">
        <h4 className="text-xs font-bold text-ledger-paper flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-ledger-gold" />
          <span>Quick-Add Presets</span>
        </h4>
        <span className="text-[10px] text-ledger-paper-dim uppercase tracking-widest">Hour Templates</span>
      </div>

      <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto pr-1">
        {displayTemplates.map((template, idx) => {
          const col = template.categoryColor || '#e56b55';
          return (
            <button
              key={template.id || `default-${idx}`}
              onClick={() => onSelectTemplate(template)}
              className="flex items-center gap-1.5 surface-panel hover:border-ledger-coral rounded-xl px-2.5 py-1.5 text-[11px] text-ledger-paper hover:text-ledger-coral transition-all cursor-pointer group shrink-0"
              style={{ borderLeft: `3px solid ${col}` }}
            >
              <span className="truncate max-w-[120px] font-medium">
                {template.title}
              </span>
              <span className="font-mono text-[10px] text-ledger-paper-dim/70 group-hover:text-ledger-coral/70">
                ({template.startHour}:00)
              </span>

              {template.id && (
                <span
                  onClick={(e) => handleDeleteTemplate(e, template.id!)}
                  className="ml-1 text-ledger-paper-dim/50 hover:text-ledger-danger p-0.5 rounded transition-colors"
                  title="Remove Template"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
