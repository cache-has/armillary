// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SecretPicker } from './SecretPicker';

// Mock the secrets API
vi.mock('../../api/secrets', () => ({
  getSecretStatus: vi.fn(),
  listSecrets: vi.fn(),
}));

import { getSecretStatus, listSecrets } from '../../api/secrets';

const mockGetStatus = vi.mocked(getSecretStatus);
const mockListSecrets = vi.mocked(listSecrets);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SecretPicker', () => {
  it('shows message when store is not initialized', async () => {
    mockGetStatus.mockResolvedValue({ initialized: false, unlocked: false });
    render(<SecretPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/not initialized/i)).toBeInTheDocument();
    });
  });

  it('shows message when store is locked', async () => {
    mockGetStatus.mockResolvedValue({ initialized: true, unlocked: false });
    render(<SecretPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/locked/i)).toBeInTheDocument();
    });
  });

  it('shows message when no secrets exist', async () => {
    mockGetStatus.mockResolvedValue({ initialized: true, unlocked: true });
    mockListSecrets.mockResolvedValue([]);
    render(<SecretPicker onSelect={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/No secrets stored/i)).toBeInTheDocument();
    });
  });

  it('lists secrets and calls onSelect with template on click', async () => {
    mockGetStatus.mockResolvedValue({ initialized: true, unlocked: true });
    mockListSecrets.mockResolvedValue([
      { name: 'db_pass', environment: null, created_at: '', updated_at: '' },
      { name: 'api_key', environment: 'prod', created_at: '', updated_at: '' },
    ]);
    const onSelect = vi.fn();
    render(<SecretPicker onSelect={onSelect} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('db_pass')).toBeInTheDocument();
    });
    expect(screen.getByText('api_key')).toBeInTheDocument();
    expect(screen.getByText('prod')).toBeInTheDocument();

    fireEvent.click(screen.getByText('db_pass'));
    expect(onSelect).toHaveBeenCalledWith('{{ secret:db_pass }}');
  });

  it('closes on outside click', async () => {
    mockGetStatus.mockResolvedValue({ initialized: true, unlocked: true });
    mockListSecrets.mockResolvedValue([
      { name: 'test', environment: null, created_at: '', updated_at: '' },
    ]);
    const onClose = vi.fn();
    render(
      <div>
        <div data-testid="outside">outside</div>
        <SecretPicker onSelect={vi.fn()} onClose={onClose} />
      </div>,
    );

    await waitFor(() => {
      expect(screen.getByText('test')).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalled();
  });
});
