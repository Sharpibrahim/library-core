import React from 'react';
import { Plus, PenSquare, Upload, BarChart3 } from 'lucide-react';
import { motion } from 'motion/react';

interface QuickActionsProps {
  onUploadClick: () => void;
}

export function QuickActions({ onUploadClick }: QuickActionsProps) {
  const actions = [
    { label: 'Add New Book', icon: Plus, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Create Note', icon: PenSquare, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Upload Content', icon: Upload, color: 'text-pink-600', bg: 'bg-pink-50', onClick: onUploadClick },
    { label: 'Track Progress', icon: BarChart3, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
      {actions.map((action, index) => {
        const Icon = action.icon;
        return (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            onClick={action.onClick}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all duration-300 hover:border-primary group flex flex-col items-center text-center gap-4"
          >
            <div className={`w-14 h-14 rounded-2xl ${action.bg} ${action.color} flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-3`}>
              <Icon className="w-7 h-7" />
            </div>
            <span className="text-sm font-bold text-slate-700">{action.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
