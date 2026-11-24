export type StudioThemeTokens = {
  bgCanvas: string;
  bgPanel: string;
  bgElevated: string;
  bgHover: string;
  borderSubtle: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentGlow: string;
};

export type StudioScene3DTheme = {
  background: string;
  fogColor: string;
  fogDensity: number;
  groundColor: string;
  gridPrimary: string;
  gridSecondary: string;
  envIntensity: number;
};

export type StudioTheme = {
  id: string;
  name: string;
  description: string;
  mode: 'dark' | 'light';
  isCustom?: boolean;
  tokens: StudioThemeTokens;
  scene3d: StudioScene3DTheme;
};

export const BUILTIN_THEMES: StudioTheme[] = [
  {
    id: 'industrial-dark',
    name: '深空工业暗灰蓝',
    description: '高对比工业数字孪生默认主题，适合长时间 3D 搭建与大屏展示',
    mode: 'dark',
    tokens: {
      bgCanvas: '#090e1a',
      bgPanel: 'rgba(15, 23, 42, 0.88)',
      bgElevated: 'rgba(22, 33, 56, 0.94)',
      bgHover: 'rgba(56, 189, 248, 0.14)',
      borderSubtle: 'rgba(148, 163, 184, 0.18)',
      borderStrong: 'rgba(56, 189, 248, 0.45)',
      textPrimary: '#f1f5f9',
      textSecondary: '#cbd5e1',
      textMuted: '#64748b',
      accent: '#38bdf8',
      accentSoft: 'rgba(56, 189, 248, 0.16)',
      accentGlow: 'rgba(56, 189, 248, 0.35)',
    },
    scene3d: {
      background: '#0a101d',
      fogColor: '#0a101d',
      fogDensity: 0.018,
      groundColor: '#111a2d',
      gridPrimary: '#243b61',
      gridSecondary: '#16233b',
      envIntensity: 0.9,
    },
  },
  {
    id: 'scada-amber',
    name: '燃气调度琥珀夜',
    description: '专为燃气输配与报警监控设计的深碳灰 + 燃气琥珀金主题',
    mode: 'dark',
    tokens: {
      bgCanvas: '#0b0e14',
      bgPanel: 'rgba(18, 22, 30, 0.9)',
      bgElevated: 'rgba(28, 33, 45, 0.95)',
      bgHover: 'rgba(245, 158, 11, 0.14)',
      borderSubtle: 'rgba(148, 163, 184, 0.16)',
      borderStrong: 'rgba(245, 158, 11, 0.45)',
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#6b7280',
      accent: '#f59e0b',
      accentSoft: 'rgba(245, 158, 11, 0.16)',
      accentGlow: 'rgba(245, 158, 11, 0.32)',
    },
    scene3d: {
      background: '#0b0e14',
      fogColor: '#0b0e14',
      fogDensity: 0.018,
      groundColor: '#141923',
      gridPrimary: '#3f3524',
      gridSecondary: '#1e222b',
      envIntensity: 0.9,
    },
  },
  {
    id: 'blueprint-light',
    name: '工程蓝图浅灰白',
    description: '高亮度工程审图与工艺规划浅色风格，适合强光办公环境',
    mode: 'light',
    tokens: {
      bgCanvas: '#e2e8f0',
      bgPanel: 'rgba(255, 255, 255, 0.92)',
      bgElevated: 'rgba(248, 250, 252, 0.98)',
      bgHover: 'rgba(2, 132, 199, 0.1)',
      borderSubtle: 'rgba(15, 23, 42, 0.12)',
      borderStrong: 'rgba(2, 132, 199, 0.48)',
      textPrimary: '#0f172a',
      textSecondary: '#334155',
      textMuted: '#64748b',
      accent: '#0284c7',
      accentSoft: 'rgba(2, 132, 199, 0.12)',
      accentGlow: 'rgba(2, 132, 199, 0.25)',
    },
    scene3d: {
      background: '#dce5f0',
      fogColor: '#dce5f0',
      fogDensity: 0.012,
      groundColor: '#cfdbe8',
      gridPrimary: '#94a8c0',
      gridSecondary: '#bccadd',
      envIntensity: 1.05,
    },
  },
];

const CUSTOM_THEMES_KEY = 'plant-studio.custom-themes.v1';

export function loadCustomThemes(): StudioTheme[] {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StudioTheme[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomThemes(themes: StudioTheme[]): void {
  try {
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes));
  } catch {
    // ignore storage errors
  }
}

export function getAllThemes(): StudioTheme[] {
  return [...BUILTIN_THEMES, ...loadCustomThemes()];
}

export function resolveThemeById(id: string, customThemes: StudioTheme[] = []): StudioTheme {
  return (
    BUILTIN_THEMES.find((t) => t.id === id) ??
    customThemes.find((t) => t.id === id) ??
    BUILTIN_THEMES[0]
  );
}

export function applyThemeTokens(theme: StudioTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const t = theme.tokens;
  root.style.setProperty('--bg-canvas', t.bgCanvas);
  root.style.setProperty('--bg-panel', t.bgPanel);
  root.style.setProperty('--bg-elevated', t.bgElevated);
  root.style.setProperty('--bg-hover', t.bgHover);
  root.style.setProperty('--border-subtle', t.borderSubtle);
  root.style.setProperty('--border-strong', t.borderStrong);
  root.style.setProperty('--text-primary', t.textPrimary);
  root.style.setProperty('--text-secondary', t.textSecondary);
  root.style.setProperty('--text-muted', t.textMuted);
  root.style.setProperty('--accent', t.accent);
  root.style.setProperty('--accent-soft', t.accentSoft);
  root.style.setProperty('--accent-glow', t.accentGlow);
  root.dataset.themeMode = theme.mode;
}
