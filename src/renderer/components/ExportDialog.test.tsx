import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExportDialog } from './ExportDialog';

describe('ExportDialog', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // jsdom lacks these blob/object-url APIs.
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.getElementById('export-dialog-overlay')?.remove();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<ExportDialog isOpen={false} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog when open', () => {
    render(<ExportDialog isOpen onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExportDialog isOpen onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('reveals custom range inputs only for the custom option', async () => {
    const user = userEvent.setup();
    render(<ExportDialog isOpen onClose={vi.fn()} />);
    expect(screen.queryByLabelText('Start')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Time Range'), 'custom');
    expect(screen.getByLabelText('Start')).toBeInTheDocument();
    expect(screen.getByLabelText('End')).toBeInTheDocument();
  });

  it('exports and closes on success', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      blob: async () => new Blob(['a,b,c'], { type: 'text/csv' }),
    } as Response);

    render(<ExportDialog isOpen onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/export/csv?table=aircraft'),
    );
  });

  it('shows an error message and stays open when the export fails', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 } as Response);

    render(<ExportDialog isOpen onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(await screen.findByText(/Export failed with status 500/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
