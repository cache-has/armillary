// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEnvironmentStore } from './environmentStore';

const mockCreateTableOverride = vi.fn().mockResolvedValue(undefined);
const mockDeleteTableOverride = vi.fn().mockResolvedValue(undefined);

vi.mock('../api/environments', () => ({
  listEnvironments: vi.fn().mockResolvedValue([
    { name: 'prod', fallback: null },
    { name: 'dev', fallback: 'prod' },
  ]),
  listTableOverrides: vi.fn().mockResolvedValue([
    { environment: 'dev', schema_name: 'public', table_name: 'users' },
  ]),
  createTableOverride: (...args: unknown[]) => mockCreateTableOverride(...args),
  deleteTableOverride: (...args: unknown[]) => mockDeleteTableOverride(...args),
}));

describe('environmentStore', () => {
  beforeEach(() => {
    useEnvironmentStore.setState({
      environments: [],
      activeEnvironment: 'dev',
      tableOverrides: [],
      loading: false,
      error: null,
    });
  });

  it('initializes with dev as active environment', () => {
    expect(useEnvironmentStore.getState().activeEnvironment).toBe('dev');
  });

  it('fetchEnvironments populates the list', async () => {
    await useEnvironmentStore.getState().fetchEnvironments();
    const { environments, loading } = useEnvironmentStore.getState();
    expect(loading).toBe(false);
    expect(environments).toHaveLength(2);
    expect(environments[0].name).toBe('prod');
    expect(environments[1].name).toBe('dev');
  });

  it('setActiveEnvironment updates state and fetches overrides', async () => {
    await useEnvironmentStore.getState().setActiveEnvironment('dev');
    const { activeEnvironment, tableOverrides } = useEnvironmentStore.getState();
    expect(activeEnvironment).toBe('dev');
    expect(tableOverrides).toHaveLength(1);
    expect(tableOverrides[0].table_name).toBe('users');
  });

  it('hasOverride returns true for overridden tables', async () => {
    await useEnvironmentStore.getState().setActiveEnvironment('dev');
    expect(useEnvironmentStore.getState().hasOverride('users')).toBe(true);
    expect(useEnvironmentStore.getState().hasOverride('orders')).toBe(false);
  });

  it('addTableOverride calls API and refreshes overrides for active env', async () => {
    useEnvironmentStore.setState({ activeEnvironment: 'dev' });
    await useEnvironmentStore.getState().addTableOverride('dev', 'orders');
    expect(mockCreateTableOverride).toHaveBeenCalledWith('dev', 'orders', undefined);
    // Should have refreshed overrides since dev is the active env
    const { tableOverrides } = useEnvironmentStore.getState();
    expect(tableOverrides).toHaveLength(1); // from mock
  });

  it('removeTableOverride calls API and refreshes overrides for active env', async () => {
    useEnvironmentStore.setState({ activeEnvironment: 'dev' });
    await useEnvironmentStore.getState().removeTableOverride('dev', 'users');
    expect(mockDeleteTableOverride).toHaveBeenCalledWith('dev', 'users', undefined);
  });

  it('addTableOverride does not refresh overrides for non-active env', async () => {
    useEnvironmentStore.setState({ activeEnvironment: 'prod', tableOverrides: [] });
    await useEnvironmentStore.getState().addTableOverride('dev', 'orders');
    expect(mockCreateTableOverride).toHaveBeenCalled();
    // Should not have refreshed since dev is not active
    expect(useEnvironmentStore.getState().tableOverrides).toHaveLength(0);
  });
});
