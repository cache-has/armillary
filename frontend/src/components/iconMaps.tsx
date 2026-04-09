// Copyright (c) 2026 Horizon Analytic Studios, LLC. All rights reserved.
// SPDX-License-Identifier: MIT OR Apache-2.0

import type { ReactNode } from 'react';
import {
  IconSource,
  IconTransform,
  IconSink,
  IconTest,
  IconFile,
  IconDatabase,
  IconGlobe,
  IconCode,
  IconTerminal,
} from './icons';

export const roleIcon: Record<string, ReactNode> = {
  source: <IconSource />,
  transform: <IconTransform />,
  sink: <IconSink />,
  test: <IconTest />,
};

export const paletteIcon: Record<string, ReactNode> = {
  csv: <IconFile />,
  parquet: <IconFile />,
  postgresql: <IconDatabase />,
  rest: <IconGlobe />,
  sql: <IconCode />,
  python: <IconTerminal />,
  stdout: <IconTerminal />,
  test: <IconTest />,
};
