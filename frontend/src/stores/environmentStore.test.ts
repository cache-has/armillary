// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEnvironmentStore } from './environmentStore';

vi.mock('../api/environments', () => ({
  listEnvironments: vi.fn().mockResolvedValue([
    { name: 'prod', fallback: null },
    { name: 'dev', fallback: 'prod' },
  ]),
  listTableOverrides: vi.fn().mockResolvedValue([
    { environment: 'dev', schema_name: 'public', table_name: 'users' },
  ]),
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
});
