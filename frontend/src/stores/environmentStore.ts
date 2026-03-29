// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

import { create } from 'zustand';
import {
  listEnvironments,
  listTableOverrides,
  createEnvironment,
  deleteEnvironment,
  updateEnvironment,
  createTableOverride,
  deleteTableOverride,
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
  /** Create a new environment and refresh the list. */
  addEnvironment: (name: string, fallback?: string) => Promise<void>;
  /** Delete an environment and refresh the list. */
  removeEnvironment: (name: string) => Promise<void>;
  /** Update an environment's fallback and refresh the list. */
  updateFallback: (name: string, fallback: string | null) => Promise<void>;
  /** Create a table override in the given environment and refresh overrides. */
  addTableOverride: (envName: string, tableName: string, schemaName?: string) => Promise<void>;
  /** Delete a table override from the given environment and refresh overrides. */
  removeTableOverride: (envName: string, tableName: string, schemaName?: string) => Promise<void>;
  /** Whether the environment management panel is open. */
  managementPanelOpen: boolean;
  /** Toggle the management panel. */
  setManagementPanelOpen: (open: boolean) => void;
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

  addTableOverride: async (envName: string, tableName: string, schemaName?: string) => {
    set({ error: null });
    try {
      await createTableOverride(envName, tableName, schemaName);
      // Refresh overrides if the affected environment is the active one
      if (get().activeEnvironment === envName) {
        await get().fetchTableOverrides();
      }
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  removeTableOverride: async (envName: string, tableName: string, schemaName?: string) => {
    set({ error: null });
    try {
      await deleteTableOverride(envName, tableName, schemaName);
      if (get().activeEnvironment === envName) {
        await get().fetchTableOverrides();
      }
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  managementPanelOpen: false,

  setManagementPanelOpen: (open: boolean) => {
    set({ managementPanelOpen: open });
  },

  addEnvironment: async (name: string, fallback?: string) => {
    set({ error: null });
    try {
      await createEnvironment(name, fallback);
      await get().fetchEnvironments();
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  removeEnvironment: async (name: string) => {
    set({ error: null });
    try {
      await deleteEnvironment(name);
      await get().fetchEnvironments();
      // If the deleted environment was active, switch to prod
      if (get().activeEnvironment === name) {
        await get().setActiveEnvironment('prod');
      }
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  updateFallback: async (name: string, fallback: string | null) => {
    set({ error: null });
    try {
      await updateEnvironment(name, fallback);
      await get().fetchEnvironments();
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },
}));
