import { describe, expect, it } from 'vitest';
import { render, screen } from '../../../test/testUtils';
import StakeholderViewsPanel from '../StakeholderViewsPanel';
import { sampleRuntimeProgress } from '../../../data/sampleRuntimeProgress';

describe('StakeholderViewsPanel', () => {
  it('renders role-specific realtime views', () => {
    render(<StakeholderViewsPanel snapshot={sampleRuntimeProgress} />);

    expect(screen.getByText('Realtime lens by role')).toBeInTheDocument();
    expect(screen.getByText('CTO view')).toBeInTheDocument();
    expect(screen.getByText('VP view')).toBeInTheDocument();
    expect(screen.getByText('Director view')).toBeInTheDocument();
    expect(screen.getByText('Manager view')).toBeInTheDocument();
    expect(screen.getByText('Risk posture')).toBeInTheDocument();
    expect(screen.getByText('Momentum')).toBeInTheDocument();
    expect(screen.getByText('Team health')).toBeInTheDocument();
    expect(screen.getByText('Execution focus')).toBeInTheDocument();
  });

  it('shows the canonical refresh cadence', () => {
    render(<StakeholderViewsPanel snapshot={sampleRuntimeProgress} />);

    expect(screen.getByText('10s live snapshot')).toBeInTheDocument();
  });
});
