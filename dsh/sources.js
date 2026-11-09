/** Scan sources for Codex + Cursor (incl. skills-cursor). */
export const SYNC_SOURCES = [
  {
    id: 'codex',
    label: 'Codex',
    userDirs: ['~/.codex/skills'],
    projectDirs: ['.codex/skills'],
  },
  {
    id: 'cursor',
    label: 'Cursor',
    userDirs: ['~/.cursor/skills', '~/.cursor/skills-cursor'],
    projectDirs: ['.cursor/skills'],
  },
];
