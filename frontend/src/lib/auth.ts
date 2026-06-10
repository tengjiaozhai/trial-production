import { SSO_BASE, USAGE_URL, APP_CODE, EXT_COLUMN, APP_VERSION } from '../config/ssoConfig';

export interface UserInfo {
  username: string;
  staffNo: string;
}

export interface LoginStatus {
  isLoggedIn: boolean;
  user?: UserInfo;
}

/**
 * 登录 SSO 系统
 * @param loginId 用户名
 * @param pwd 密码
 * @returns Promise<string> token
 * @throws Error with message from SSO
 */
export async function login(loginId: string, pwd: string): Promise<string> {
  const params = new URLSearchParams();
  params.append('loginId', loginId);
  params.append('pwd', pwd);

  const response = await fetch(`${SSO_BASE}/sso/extral/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await response.json();

  if (data.code === 200 && data.data) {
    return data.data;
  }

  throw new Error(data.msg || '用户名或密码错误');
}

/**
 * 验证 token 是否有效
 * @param token SSO token
 * @returns Promise<boolean>
 */
export async function validateToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${SSO_BASE}/heartbeat`, {
      method: 'GET',
      headers: {
        'Authorization': token,
      },
    });

    const data = await response.json();
    return data.code === 200;
  } catch (error) {
    console.error('Token validation failed:', error);
    return false;
  }
}

/**
 * 获取用户信息
 * @param token SSO token
 * @returns Promise<UserInfo>
 */
export async function getUserInfo(token: string): Promise<UserInfo> {
  try {
    const response = await fetch(`${SSO_BASE}/sso/extral/user-info`, {
      method: 'GET',
      headers: {
        'Authorization': token,
      },
    });

    const data = await response.json();

    if (data.code === 200 && data.data) {
      return {
        username: data.data.username || data.data.cn || '',
        staffNo: data.data.staffNo || data.data.userCode || '',
      };
    }

    return { username: '', staffNo: '' };
  } catch (error) {
    console.error('Failed to get user info:', error);
    return { username: '', staffNo: '' };
  }
}

/**
 * 记录使用打点
 * @param username 用户名
 * @param staffNo 工号
 */
export function recordUsage(username: string, staffNo: string): void {
  fetch(USAGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      appCode: APP_CODE,
      extColumn: EXT_COLUMN,
      type: '1',
      userName: username,
      staffNo: staffNo,
      versionCode: `V${APP_VERSION}`,
    }),
  }).catch(() => {
    // Silent failure
  });
}

/**
 * 检查登录状态
 * @returns Promise<LoginStatus>
 */
export async function checkLoginStatus(): Promise<LoginStatus> {
  const token = localStorage.getItem('sso_token');

  if (!token) {
    return { isLoggedIn: false };
  }

  const isValid = await validateToken(token);

  if (!isValid) {
    localStorage.removeItem('sso_token');
    return { isLoggedIn: false };
  }

  const user = await getUserInfo(token);

  return {
    isLoggedIn: true,
    user,
  };
}
