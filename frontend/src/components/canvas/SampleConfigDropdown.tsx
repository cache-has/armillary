// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

import { useCallback, useState } from 'react';
import type { ApiSampleConfig } from '../../api/pipelines';
import { DEFAULT_SAMPLE_CONFIG } from '../../api/pipelines';
import './SampleConfigDropdown.css';

/** Preset sample size options. */
const PRESET_COUNTS = [50, 100, 200, 500, 1000] as const;

export interface SampleConfigDropdownProps {
  value: ApiSampleConfig | undefined;
  onChange: (config: ApiSampleConfig) => void;
}

export function SampleConfigDropdown({ value, onChange }: SampleConfigDropdownProps) {
  const current = value ?? DEFAULT_SAMPLE_CONFIG;
  const [showSeed, setShowSeed] = useState(false);

  // Encode the current config as a select value string.
  const selectValue = (() => {
    switch (current.mode) {
      case 'first_n':
        return `first_n:${current.count}`;
      case 'random':
        return `random:${current.count}`;
      case 'full':
        return 'full';
    }
  })();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const val = e.target.value;
      if (val === 'full') {
        onChange({ mode: 'full' });
        setShowSeed(false);
        return;
      }
      const [mode, countStr] = val.split(':');
      const count = Number(countStr);
      if (mode === 'random') {
        const seed = current.mode === 'random' ? current.seed : 42;
        onChange({ mode: 'random', count, seed });
        setShowSeed(true);
      } else {
        onChange({ mode: 'first_n', count });
        setShowSeed(false);
      }
    },
    [current, onChange],
  );

  const handleSeedChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (current.mode === 'random') {
        onChange({ mode: 'random', count: current.count, seed: Number(e.target.value) || 0 });
      }
    },
    [current, onChange],
  );

  return (
    <span className="sample-config-dropdown" data-testid="sample-config-dropdown">
      <select
        className="sample-config-dropdown__select"
        value={selectValue}
        onChange={handleChange}
        title="Configure sample size"
      >
        <optgroup label="First N rows">
          {PRESET_COUNTS.map((n) => (
            <option key={`first_n:${n}`} value={`first_n:${n}`}>
              First {n}
            </option>
          ))}
        </optgroup>
        <optgroup label="Random sample">
          {PRESET_COUNTS.map((n) => (
            <option key={`random:${n}`} value={`random:${n}`}>
              Random {n}
            </option>
          ))}
        </optgroup>
        <option value="full">Full dataset</option>
      </select>
      {(showSeed || current.mode === 'random') && current.mode === 'random' && (
        <label className="sample-config-dropdown__seed" title="Random seed for reproducibility">
          seed:
          <input
            className="sample-config-dropdown__seed-input"
            type="number"
            value={current.seed}
            onChange={handleSeedChange}
            min={0}
          />
        </label>
      )}
    </span>
  );
}
