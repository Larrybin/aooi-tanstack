'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';

export function RemoverRemoveButton({ jobId, label }: { jobId: string; label: string }) {
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    setIsRemoving(true);
    setError('');
    try {
      const response = await fetch(`/api/remover/jobs/${encodeURIComponent(jobId)}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(`Remove failed with ${response.status}`);
      window.location.reload();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Remove failed');
      setIsRemoving(false);
    }
  }
  return (
    <div>
      <button type="button" disabled={isRemoving} onClick={() => void remove()} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50">
        <Trash2 className="size-4" />
        {isRemoving ? 'Deleting...' : label}
      </button>
      {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
