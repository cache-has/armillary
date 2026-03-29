// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

import { create } from 'zustand';
import {
  listEnvironments,
  listTableOverrides,
  type ApiEnvironment,
  type ApiTableOverride,
} from '../api/environments';

export interface EnvironmentStoreState {
  /** All available environments. */
  environments: ApiEnvironment[];
  /** The currently active environment name. */
  activeEnvironment: string;
  /** Table overrides for the active environment. */
  tableOverrides: ApiTableOverride[];
  /** Whether the environment list is loading. */
  loading: boolean;
  /** Last error from environment operations. */
  error: string | null;
}

export interface EnvironmentStoreActions {
  /** Fetch environment list from the backend. */
  fetchEnvironments: () => Promise<void>;
  /** Switch the active environment and refresh overrides. */
  setActiveEnvironment: (name: string) => Promise<void>;
  /** Fetch table overrides for the active environment. */
  fetchTableOverrides: () => Promise<void>;
  /** Check if a node (by table name) has an override in the active environment. */
  hasOverride: (tableName: string) => boolean;
}

export type EnvironmentStore = EnvironmentStoreState & EnvironmentStoreActions;

export const useEnvironmentStore = create<EnvironmentStore>((set, get) => ({
  environments: [],
  activeEnvironment: 'dev',
  tableOverrides: [],
  loading: false,
  error: null,

  fetchEnvironments: async () => {
    set({ loading: true, error: null });
    try {
      const environments = await listEnvironments();
      set({ environments, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  setActiveEnvironment: async (name: string) => {
    set({ activeEnvironment: name, error: null });
    await get().fetchTableOverrides();
  },

  fetchTableOverrides: async () => {
    const { activeEnvironment } = get();
    try {
      const tableOverrides = await listTableOverrides(activeEnvironment);
      set({ tableOverrides });
    } catch (err) {
      set({ tableOverrides: [], error: (err as Error).message });
    }
  },

  hasOverride: (tableName: string) => {
    return get().tableOverrides.some((o) => o.table_name === tableName);
  },
}));
