import { AlertTriangle, RotateCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { Button } from './Button';

export function ScreenErrorBoundary({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <Boundary message={t('common.screenCrashed')} reloadLabel={t('common.reload')}>
      {children}
    </Boundary>
  );
}

interface BoundaryProps {
  message: string;
  reloadLabel: string;
  children: ReactNode;
}

class Boundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex flex-col items-center gap-4 rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <p className="max-w-md text-sm font-medium text-red-900">{this.props.message}</p>
        <Button variant="secondary" icon={<RotateCw className="h-4 w-4" />} onClick={() => window.location.reload()}>
          {this.props.reloadLabel}
        </Button>
      </div>
    );
  }
}
