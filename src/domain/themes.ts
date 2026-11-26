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
  accentFg?: string;
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
    description: '高对比航天钛蓝默认主题，适合长时间 3D 搭建与大屏展示',
    mode: 'dark',
    tokens: {
      bgCanvas: '#070b14',
      bgPanel: 'rgba(13, 20, 36, 0.88)',
      bgElevated: 'rgba(19, 29, 50, 0.96)',
      bgHover: 'rgba(56, 189, 248, 0.1)',
      borderSubtle: 'rgba(148, 163, 184, 0.14)',
      borderStrong: 'rgba(56, 189, 248, 0.38)',
      textPrimary: '#f1f5f9',
      textSecondary: '#cbd5e1',
      textMuted: '#6b7c93',
      accent: '#38bdf8',
      accentSoft: 'rgba(56, 189, 248, 0.12)',
      accentGlow: 'rgba(56, 189, 248, 0.32)',
      accentFg: '#04101f',
    },
    scene3d: {
      background: '#080d18',
      fogColor: '#080d18',
      fogDensity: 0.018,
      groundColor: '#10182a',
      gridPrimary: '#243b61',
      gridSecondary: '#16233b',
      envIntensity: 0.92,
    },
  },
  {
    id: 'scada-amber',
    name: '燃气调度琥珀夜',
    description: '黑曜石炭底配钛金琥珀，专为燃气输配与调度中心定制',
    mode: 'dark',
    tokens: {
      bgCanvas: '#090b10',
      bgPanel: 'rgba(16, 19, 27, 0.9)',
      bgElevated: 'rgba(24, 28, 39, 0.96)',
      bgHover: 'rgba(245, 158, 11, 0.1)',
      borderSubtle: 'rgba(226, 195, 130, 0.12)',
      borderStrong: 'rgba(245, 158, 11, 0.42)',
      textPrimary: '#f8fafc',
      textSecondary: '#d1d5db',
      textMuted: '#788296',
      accent: '#f59e0b',
      accentSoft: 'rgba(245, 158, 11, 0.12)',
      accentGlow: 'rgba(245, 158, 11, 0.3)',
      accentFg: '#1a1002',
    },
    scene3d: {
      background: '#0a0d13',
      fogColor: '#0a0d13',
      fogDensity: 0.018,
      groundColor: '#131720',
      gridPrimary: '#473922',
      gridSecondary: '#1f232c',
      envIntensity: 0.92,
    },
  },
  {
    id: 'blueprint-light',
    name: '工程蓝图浅灰白',
    description: '瑞士精密图纸冷灰白 + 克制钴蓝主调，适合明亮办公与工程审图',
    mode: 'light',
    tokens: {
      bgCanvas: '#edf1f7',
      bgPanel: 'rgba(255, 255, 255, 0.97)',
      bgElevated: 'rgba(248, 250, 252, 0.98)',
      bgHover: 'rgba(37, 99, 235, 0.06)',
      borderSubtle: 'rgba(15, 23, 42, 0.08)',
      borderStrong: 'rgba(37, 99, 235, 0.3)',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#7c8ba1',
      accent: '#2563eb',
      accentSoft: 'rgba(37, 99, 235, 0.08)',
      accentGlow: 'rgba(37, 99, 235, 0.18)',
      accentFg: '#ffffff',
    },
    scene3d: {
      background: '#e3eaf4',
      fogColor: '#e3eaf4',
      fogDensity: 0.011,
      groundColor: '#d5dfec',
      gridPrimary: '#8ca2be',
      gridSecondary: '#bfd0e3',
      envIntensity: 1.08,
    },
  },
  {
    id: 'liquid-glass',
    name: '液态玻璃',
    description: '高透光学磨砂玻璃材质语言：极光流光底景 + 高饱和穿透折射 + 镜面高光描边',
    mode: 'light',
    tokens: {
      bgCanvas: '#e4eefc',
      bgPanel: 'rgba(255, 255, 255, 0.38)',
      bgElevated: 'rgba(255, 255, 255, 0.48)',
      bgHover: 'rgba(0, 122, 255, 0.1)',
      borderSubtle: 'rgba(255, 255, 255, 0.74)',
      borderStrong: 'rgba(0, 122, 255, 0.36)',
      textPrimary: '#0b1324',
      textSecondary: '#334155',
      textMuted: '#5e6f88',
      accent: '#007aff',
      accentSoft: 'rgba(0, 122, 255, 0.12)',
      accentGlow: 'rgba(0, 122, 255, 0.28)',
      accentFg: '#ffffff',
    },
    scene3d: {
      background: '#dce9f8',
      fogColor: '#dce9f8',
      fogDensity: 0.009,
      groundColor: '#cedef2',
      gridPrimary: '#7da6d8',
      gridSecondary: '#b6cde8',
      envIntensity: 1.22,
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
  const normalizedId = id === 'ios-liquid-glass' ? 'liquid-glass' : id;
  return (
    BUILTIN_THEMES.find((t) => t.id === normalizedId) ??
    customThemes.find((t) => t.id === normalizedId) ??
    BUILTIN_THEMES[0]
  );
}

export function applyThemeTokens(theme: StudioTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.add('theme-switching');
  const t = theme.tokens;
  const accentFg = t.accentFg ?? (theme.mode === 'light' ? '#ffffff' : '#06101f');
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
  root.style.setProperty('--accent-fg', accentFg);
  root.dataset.themeMode = theme.mode;
  root.dataset.themeId = theme.id;
  void root.offsetHeight;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove('theme-switching');
    });
  });
}
