import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '../../../test/testUtils';
import ClawbotControlPanel from '../ClawbotControlPanel';
import { sampleRuntimeProgress } from '../../../data/sampleRuntimeProgress';

const queueCommand = vi.fn();
const updateControl = vi.fn();

vi.mock('../../../services/runtimeService', () => ({
  runtimeService: {
    queueCommand: (...args: unknown[]) => queueCommand(...args),
    updateControl: (...args: unknown[]) => updateControl(...args),
  },
}));

describe('ClawbotControlPanel', () => {
  beforeEach(() => {
    queueCommand.mockReset();
    updateControl.mockReset();
    queueCommand.mockResolvedValue({
      data: sampleRuntimeProgress.orchestration,
    });
    updateControl.mockResolvedValue({
      data: sampleRuntimeProgress.orchestration,
    });
  });

  it('renders orchestration metrics and tool links', () => {
    render(<ClawbotControlPanel snapshot={sampleRuntimeProgress} />);

    expect(screen.getByText('Local control plane')).toBeInTheDocument();
    expect(screen.getByText('12/24')).toBeInTheDocument();
    expect(screen.getByText('Local Agent Runtime')).toBeInTheDocument();
  });

  it('queues a rebalance command from the control plane', async () => {
    const user = userEvent.setup();
    render(<ClawbotControlPanel snapshot={sampleRuntimeProgress} />);

    await user.click(screen.getByRole('button', { name: /rebalance blockers/i }));

    await waitFor(() => {
      expect(queueCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          label: 'rebalance-blockers',
          action: 'rebalance',
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Queued rebalance-blockers.')).toBeInTheDocument();
    });
  });

  it('updates controller settings from the local-first action', async () => {
    const user = userEvent.setup();
    render(<ClawbotControlPanel snapshot={sampleRuntimeProgress} />);

    await user.click(screen.getByRole('button', { name: /enforce local-first/i }));

    await waitFor(() => {
      expect(updateControl).toHaveBeenCalledWith(
        expect.objectContaining({
          controller: expect.objectContaining({
            preferredLane: 'local-agents',
            preferredProvider: 'local',
            cloudFallbackEnabled: false,
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText('Updated clawbot orchestration controls.'),
      ).toBeInTheDocument();
    });
  });
});
