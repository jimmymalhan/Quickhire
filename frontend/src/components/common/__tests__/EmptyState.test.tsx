import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/testUtils';
import EmptyState from '../EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState title="No results" description="Try a different search." />,
    );
    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.getByText('Try a different search.')).toBeInTheDocument();
  });

  it('renders optional action', () => {
    render(
      <EmptyState
        title="Empty"
        description="Nothing here."
        action={<button>Add item</button>}
      />,
    );
    expect(screen.getByText('Add item')).toBeInTheDocument();
  });

  it('does not render action when not provided', () => {
    render(<EmptyState title="Empty" description="Nothing here." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
