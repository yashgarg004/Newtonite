import { ApiError } from '../api/client';

interface Props {
  error: ApiError | null;
  onDismiss?: () => void;
  onReload?: () => void;
}

export function ErrorBanner({ error, onDismiss, onReload }: Props) {
  if (!error) return null;

  let message = error.message;
  let showReload = false;

  if (error.code === 'VERSION_CONFLICT') {
    message = 'This item changed. Reload to see the latest version.';
    showReload = true;
  } else if (error.code === 'ALREADY_CLAIMED') {
    message = 'This item was already claimed by someone else.';
  }

  return (
    <div role="alert" style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '1rem', borderRadius: '4px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span>{message}</span>
      <div>
        {showReload && onReload && (
          <button onClick={onReload} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem' }}>
            Reload
          </button>
        )}
        {onDismiss && <button onClick={onDismiss}>Dismiss</button>}
      </div>
    </div>
  );
}