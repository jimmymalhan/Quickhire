import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../../test/testUtils';
import ErrorBoundary from '../ErrorBoundary';

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Normal content</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Normal content')).toBeInTheDocument();
  });

  it('renders error fallback on error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('renders custom fallback', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
  });

  it('shows reload button', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });

  it('has alert role for error state', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
