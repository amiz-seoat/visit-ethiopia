import React from "react";

export function PageLoader({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-24 text-gray-600">
      {message}
    </div>
  );
}

export function PageError({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-24 px-4">
      <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-lg text-center">
        {message}
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-gray-500">{message}</div>
  );
}
