import type { UserInfo } from '../lib/auth';

/**
 * 本地开发（npm run dev）登录行为。
 * 生产构建始终走 SSO，此配置不会生效。
 *
 * mode:
 * - `sso`    — 展示登录页，走正常 SSO 流程（与线上一致）
 * - `bypass` — 隐藏登录页，使用 bypassUser 直接进入应用
 */
export type LocalAuthMode = 'sso' | 'bypass';

export const LOCAL_AUTH_CONFIG = {
  /** 是否启用本地登录覆盖；关闭后与生产环境行为一致 */
  enabled: true,
  mode: 'bypass' satisfies LocalAuthMode as LocalAuthMode,
  bypassUser: {
    username: '本地开发',
    staffNo: 'DEV000',
  } satisfies UserInfo,
} as const;

type LocalAuthSettings =
  | { active: false }
  | { active: true; mode: LocalAuthMode; bypassUser: UserInfo };

function readEnvMode(): LocalAuthMode | undefined {
  const raw = import.meta.env.VITE_LOCAL_AUTH_MODE;
  if (raw === 'sso' || raw === 'bypass') {
    return raw;
  }
  return undefined;
}

/** 当前是否处于可配置的本地开发认证模式 */
export function getLocalAuthSettings(): LocalAuthSettings {
  if (!import.meta.env.DEV || !LOCAL_AUTH_CONFIG.enabled) {
    return { active: false };
  }

  return {
    active: true,
    mode: readEnvMode() ?? LOCAL_AUTH_CONFIG.mode,
    bypassUser: LOCAL_AUTH_CONFIG.bypassUser,
  };
}

/** 本地开发是否跳过登录页 */
export function shouldBypassLocalLogin(): boolean {
  const settings = getLocalAuthSettings();
  return settings.active && settings.mode === 'bypass';
}

/** 本地开发是否强制展示登录页（enabled + sso 模式） */
export function shouldForceLocalLoginPage(): boolean {
  const settings = getLocalAuthSettings();
  return settings.active && settings.mode === 'sso';
}

export function getLocalBypassUser(): UserInfo {
  return LOCAL_AUTH_CONFIG.bypassUser;
}
