import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function UnauthorizedPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-fadeIn">
      <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6 border-4 border-red-50">
        <ShieldAlert className="w-12 h-12 text-red-600" />
      </div>
      
      <h1 style={{ fontFamily: 'var(--font-head)' }} className="text-3xl font-extrabold text-foreground mb-4">
        403 Forbidden
      </h1>
      
      <p className="text-muted-foreground max-w-md mx-auto mb-8">
        You do not have the required administrative permissions to access this page. This action has been logged.
      </p>
      
      <button 
        onClick={onBack}
        className="flex items-center gap-2 bg-[var(--brand)] hover:bg-[var(--brand-mid)] text-white px-6 py-3 rounded-xl font-bold transition-all shadow-sm"
      >
        <ArrowLeft className="w-5 h-5" />
        Return to Safety
      </button>
    </div>
  );
}
