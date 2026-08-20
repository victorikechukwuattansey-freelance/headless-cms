'use client';

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}