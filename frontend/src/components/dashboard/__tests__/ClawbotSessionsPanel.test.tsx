import { describe, expect, it } from 'vitest';
import { render, screen } from '../../../test/testUtils';
import ClawbotSessionsPanel from '../ClawbotSessionsPanel';
import { sampleRuntimeProgress } from '../../../data/sampleRuntimeProgress';

describe('ClawbotSessionsPanel', () => {
  it('renders provider split and blocker options', () => {
    render(<ClawbotSessionsPanel snapshot={sampleRuntimeProgress} />);

    expect(screen.getByText(/local: 3/i)).toBeInTheDocument();
    expect(screen.getByText(/blocker clear eta/i)).toBeInTheDocument();
    expect(screen.getByText(/mock browser fixture needs a stable local route/i)).toBeInTheDocument();
    expect(screen.getByText(/local html fixture/i)).toBeInTheDocument();
  });
});
