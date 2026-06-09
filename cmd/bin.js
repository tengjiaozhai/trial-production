/**
 * ee-bin 配置
 * 仅适用于开发环境
 */
module.exports = {
  dev: {
    frontend: {
      directory: './frontend',
      cmd: 'npm',
      args: ['run', 'dev'],
      port: 3000,
    },
    electron: {
      directory: './',
      cmd: 'electron',
      args: ['.', '--env=local'],
      watch: false,
    },
  },

  build: {
    frontend: {
      directory: './frontend',
      cmd: 'npm',
      args: ['run', 'build'],
    },
    electron: {
      type: 'javascript',
      bundleType: 'copy',
    },
    win64: {
      cmd: 'electron-builder',
      directory: './',
      args: ['--config=./cmd/builder.json', '-w=nsis', '--x64'],
    },
    mac: {
      args: ['--config=./cmd/builder-mac.json', '-m'],
    },
  },

  move: {
    frontend_dist: {
      src: './frontend/dist',
      dest: './public/dist',
    },
  },

  start: {
    directory: './',
    cmd: 'electron',
    args: ['.', '--env=prod'],
  },
};
