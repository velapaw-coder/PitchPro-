'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ fontSize: '3.75rem', fontWeight: 'bold', margin: 0 }}>
            Oops
          </h1>
          <p style={{ color: '#6b7280' }}>
            Something went wrong. Please try again.
          </p>
          {process.env.NODE_ENV === 'development' && error?.message ? (
            <pre
              style={{
                maxWidth: '36rem',
                overflow: 'auto',
                borderRadius: '0.375rem',
                backgroundColor: '#f3f4f6',
                padding: '0.75rem',
                fontSize: '0.75rem',
                textAlign: 'left',
                color: '#dc2626',
              }}
            >
              {error.message}
            </pre>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              type="button"
              onClick={reset}
              style={{
                borderRadius: '0.375rem',
                border: '1px solid #e5e7eb',
                padding: '0.5rem 1rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: 'pointer',
                backgroundColor: 'transparent',
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                fontSize: '0.875rem',
                textDecoration: 'underline',
                textUnderlineOffset: '4px',
              }}
            >
              Back to home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
