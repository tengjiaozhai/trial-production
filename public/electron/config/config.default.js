'use strict';

const path = require('path');
const { getBaseDir, getElectronDir } = require('ee-core/ps');

module.exports = () => {
  return {
    title: '试产搭配表',
    openDevTools: false,
    singleLock: true,
    windowsOption: {
      width: 1600,
      height: 900,
      minWidth: 1000,
      minHeight: 600,
      webPreferences: {
        webSecurity: false,
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(getElectronDir(), 'preload', 'bridge.js'),
      },
      frame: true,
      show: true,
      autoHideMenuBar: true,
      icon: path.join(
        getBaseDir(),
        'build',
        'icons',
        process.platform === 'darwin' ? 'icon.icns' : 'icon.ico',
      ),
      maximized: true,
    },
    logger: {
      level: 'INFO',
      outputJSON: false,
      appLogName: 'ee.log',
      coreLogName: 'ee-core.log',
      errorLogName: 'ee-error.log',
      encoding: 'utf8',
    },
    remote: {
      enable: false,
      url: '',
    },
    mainServer: {
      indexPath: '/public/dist/index.html',
      channelSeparator: '/',
    },
  };
};
