import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useI18n } from '../../i18n';
import { Button } from './Button';
import { Mascot } from './Mascot';

function CrashScreen() {
  const { t } = useI18n();
  return (
    <div className="app__main" role="alert">
      <div className="empty">
        <Mascot mood="encouraging" size={104} />
        <h1>{t('error.crash.title')}</h1>
        <p className="muted">{t('error.crash.text')}</p>
        <Button onClick={() => location.reload()}>{t('error.crash.reload')}</Button>
      </div>
    </div>
  );
}

/**
 * Last line of defence: an unexpected error while drawing a screen shows an explanation and a
 * reload button instead of a blank page. Nothing is written to storage here; user data is untouched.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unexpected error in the interface', error, info.componentStack);
  }

  render() {
    return this.state.failed ? <CrashScreen /> : this.props.children;
  }
}
