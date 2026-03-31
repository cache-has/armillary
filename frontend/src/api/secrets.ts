// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

const BASE = '/api/secrets';

export interface SecretStatus {
  initialized: boolean;
  unlocked: boolean;
}

export interface SecretMetadata {
  name: string;
  environment: string | null;
  created_at: string;
  updated_at: string;
}

/** Check if the store is initialized and/or unlocked. */
export async function getSecretStatus(): Promise<SecretStatus> {
  const res = await fetch(`${BASE}/status`);
  if (!res.ok) {
    throw new Error(`Failed to get secret status: ${res.status}`);
  }
  return res.json();
}

/** Initialize a new secret store. */
export async function initSecretStore(
  password: string,
  confirm: string,
): Promise<void> {
  const res = await fetch(`${BASE}/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password, confirm }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to initialize: ${res.status}`);
  }
}

/** Unlock the secret store. */
export async function unlockSecrets(password: string): Promise<void> {
  const res = await fetch(`${BASE}/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to unlock: ${res.status}`);
  }
}

/** Lock the secret store. */
export async function lockSecrets(): Promise<void> {
  const res = await fetch(`${BASE}/lock`, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Failed to lock: ${res.status}`);
  }
}

/** List all secrets (metadata only, never values). */
export async function listSecrets(): Promise<SecretMetadata[]> {
  const res = await fetch(BASE);
  if (!res.ok) {
    if (res.status === 401) throw new UnlockedRequiredError();
    throw new Error(`Failed to list secrets: ${res.status}`);
  }
  return res.json();
}

/** Create or update a secret. */
export async function setSecret(
  name: string,
  value: string,
  environment?: string | null,
): Promise<void> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, value, environment: environment ?? null }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new UnlockedRequiredError();
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to set secret: ${res.status}`);
  }
}

/** Delete a secret. */
export async function deleteSecret(
  name: string,
  environment?: string | null,
): Promise<void> {
  const qs = environment ? `?environment=${encodeURIComponent(environment)}` : '';
  const res = await fetch(`${BASE}/${encodeURIComponent(name)}${qs}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    if (res.status === 401) throw new UnlockedRequiredError();
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Failed to delete secret: ${res.status}`);
  }
}

/** Thrown when an operation requires the store to be unlocked. */
export class UnlockedRequiredError extends Error {
  constructor() {
    super('Secret store is locked');
    this.name = 'UnlockedRequiredError';
  }
}
