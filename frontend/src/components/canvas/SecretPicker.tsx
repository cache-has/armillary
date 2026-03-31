// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSecretStatus, listSecrets, type SecretMetadata } from '../../api/secrets';
import './secret-picker.css';

interface SecretPickerProps {
  /** Called when the user picks a secret — receives the template string. */
  onSelect: (template: string) => void;
  /** Called when the picker closes without a selection. */
  onClose: () => void;
}

type PickerState =
  | { kind: 'loading' }
  | { kind: 'not_initialized' }
  | { kind: 'locked' }
  | { kind: 'empty' }
  | { kind: 'ready'; secrets: SecretMetadata[] };

export function SecretPicker({ onSelect, onClose }: SecretPickerProps) {
  const [state, setState] = useState<PickerState>({ kind: 'loading' });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await getSecretStatus();
        if (cancelled) return;
        if (!status.initialized) {
          setState({ kind: 'not_initialized' });
          return;
        }
        if (!status.unlocked) {
          setState({ kind: 'locked' });
          return;
        }
        const secrets = await listSecrets();
        if (cancelled) return;
        if (secrets.length === 0) {
          setState({ kind: 'empty' });
        } else {
          setState({ kind: 'ready', secrets });
        }
      } catch {
        setState({ kind: 'locked' });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const handlePick = useCallback(
    (name: string) => {
      onSelect(`{{ secret:${name} }}`);
    },
    [onSelect],
  );

  return (
    <div className="secret-picker" ref={ref}>
      <div className="secret-picker__header">Use Secret</div>
      {state.kind === 'loading' && (
        <div className="secret-picker__message">Loading...</div>
      )}
      {state.kind === 'not_initialized' && (
        <div className="secret-picker__message">
          Secret store not initialized. Open the Secrets panel to set it up.
        </div>
      )}
      {state.kind === 'locked' && (
        <div className="secret-picker__message">
          Secret store is locked. Open the Secrets panel to unlock it.
        </div>
      )}
      {state.kind === 'empty' && (
        <div className="secret-picker__message">
          No secrets stored yet. Open the Secrets panel to add one.
        </div>
      )}
      {state.kind === 'ready' && (
        <ul className="secret-picker__list">
          {state.secrets.map((s) => (
            <li key={`${s.name}:${s.environment ?? ''}`}>
              <button
                className="secret-picker__item"
                onClick={() => handlePick(s.name)}
              >
                <span className="secret-picker__name">{s.name}</span>
                {s.environment && (
                  <span className="secret-picker__env">{s.environment}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
