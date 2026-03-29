// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

const BASE = '/api/environments';

export interface ApiEnvironment {
  name: string;
  fallback: string | null;
}

export interface ApiTableOverride {
  environment: string;
  schema_name: string;
  table_name: string;
}

export interface ApiResolveEntry {
  environment: string;
  has_override: boolean;
}

export interface ApiResolveResponse {
  table: string;
  chain: ApiResolveEntry[];
}

/** Fetch all environments. */
export async function listEnvironments(): Promise<ApiEnvironment[]> {
  const res = await fetch(BASE);
  if (!res.ok) {
    throw new Error(`Failed to list environments: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Create a new environment. */
export async function createEnvironment(
  name: string,
  fallback?: string,
): Promise<ApiEnvironment> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, fallback }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to create environment: ${res.status}`);
  }
  return res.json();
}

/** Delete an environment. */
export async function deleteEnvironment(name: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to delete environment: ${res.status}`);
  }
}

/** Update an environment's fallback chain. */
export async function updateEnvironment(
  name: string,
  fallback: string | null,
): Promise<ApiEnvironment> {
  const res = await fetch(`${BASE}/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fallback }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to update environment: ${res.status}`);
  }
  return res.json();
}

/** List table overrides for an environment. */
export async function listTableOverrides(
  envName: string,
): Promise<ApiTableOverride[]> {
  const res = await fetch(`${BASE}/${encodeURIComponent(envName)}/tables`);
  if (!res.ok) {
    throw new Error(`Failed to list table overrides: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Resolve a table through the fallback chain. */
export async function resolveTable(
  table: string,
  environment?: string,
): Promise<ApiResolveResponse> {
  const params = environment ? `?environment=${encodeURIComponent(environment)}` : '';
  const res = await fetch(`${BASE}/resolve/${encodeURIComponent(table)}${params}`);
  if (!res.ok) {
    throw new Error(`Failed to resolve table: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
