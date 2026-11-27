import React from "react";
import { Loader2, AlertTriangle } from "lucide-react";

export function PageLoader({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-24 text-gray-600" role="status" aria-live="polite">
      <Loader2 className="h-5 w-5 animate-spin text-amber-600" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export function PageError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-center py-24 px-4">
      <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-5 rounded-lg max-w-lg text-center" role="alert">
        <AlertTriangle className="h-6 w-6 mx-auto mb-2" aria-hidden="true" />
        <p>{message}</p>
        <button
          type="button"
          onClick={onRetry ?? (() => window.location.reload())}
          className="mt-4 inline-block bg-white border border-red-200 text-red-700 hover:bg-red-100 font-medium px-4 py-1.5 rounded-md text-sm"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="text-center py-16 text-gray-500">{message}</div>;
}
