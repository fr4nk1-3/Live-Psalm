export type UiThemeMode = 'system' | 'light' | 'dark';

export function resolveUiTheme(mode?: UiThemeMode): 'light' | 'dark' {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

export function applyUiTheme(mode?: UiThemeMode): void {
  if (typeof document === 'undefined') return;
  const resolved = resolveUiTheme(mode);
  const root = document.documentElement;
  root.classList.toggle('light', resolved === 'light');
  root.classList.toggle('dark', resolved === 'dark');
}
