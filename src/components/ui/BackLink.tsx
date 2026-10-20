import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition-colors hover:text-ink-900">
      <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
      {label}
    </Link>
  );
}
