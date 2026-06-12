'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * Reusable right-side drawer. Slides in from the right (420px wide, full height)
 * on desktop; becomes a full-width bottom sheet on mobile (< 768px).
 * Dismissible via Escape or clicking the backdrop. Overlays content (does not push).
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  // Render into a portal so the drawer overlays the full viewport regardless of
  // any transformed ancestor (a CSS transform on a parent would otherwise become
  // the containing block for `position: fixed`, clipping the drawer).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px] ir-fade-in"
        onMouseDown={onClose}
      />

      {/* Panel — right drawer on desktop, bottom sheet on mobile */}
      <div
        className="absolute bg-[#1a1a1a] border-[#2e2e2e] shadow-2xl flex flex-col
                   max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[85vh] max-md:rounded-t-2xl max-md:border-t
                   md:top-0 md:right-0 md:h-full md:w-[420px] md:border-l
                   ir-drawer-in"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#242424] shrink-0">
          <h2 className="text-[14px] font-semibold text-[#E8EDF2]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[#4B5563] hover:text-[#9CA3AF] p-1 rounded-lg hover:bg-[#242424] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
