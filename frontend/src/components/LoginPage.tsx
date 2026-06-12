import React, { useState } from 'react';
import { login, getUserInfo } from '../lib/auth';
import type { UserInfo } from '../lib/auth';

interface LoginPageProps {
  onLoginSuccess: (token: string, user: UserInfo) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const token = await login(username, password);
      const user = await getUserInfo(token);

      // Save token
      localStorage.setItem('sso_token', token);

      // Notify parent
      onLoginSuccess(token, user);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('网络连接失败，请稍后重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center"
         style={{
           backgroundColor: '#f6f9ff',
           backgroundImage: `
             radial-gradient(circle at 8% 10%, rgba(37, 99, 235, 0.16), transparent 28%),
             radial-gradient(circle at 92% 6%, rgba(6, 182, 212, 0.18), transparent 30%),
             linear-gradient(135deg, #eef6ff 0%, #f9fbff 48%, #edf7f4 100%)
           `
         }}>
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#0B1F33] mb-2">
            试产搭配表自动生成
          </h1>
          <p className="text-sm text-gray-600">
            请使用 SSO 账号登录
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <input
              type="text"
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-3 border border-[#DDE7F3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all disabled:bg-gray-100"
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-3 border border-[#DDE7F3] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-transparent transition-all disabled:bg-gray-100"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-medium py-3 rounded-lg transition-all disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
};
