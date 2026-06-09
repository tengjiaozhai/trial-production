'use strict';

const { logger } = require('ee-core/log');
const { getConfig } = require('ee-core/config');
const { getMainWindow } = require('ee-core/electron');
const { app } = require('electron');

class Lifecycle {
  async ready() {
    logger.info('[lifecycle] ready');
  }

  async electronAppReady() {
    logger.info('[lifecycle] electron-app-ready');
  }

  async windowReady() {
    logger.info('[lifecycle] window-ready');
    const { windowsOption } = getConfig();
    const win = getMainWindow();

    if (windowsOption.show === false) {
      win.once('ready-to-show', () => {
        if (windowsOption.maximized) {
          win.maximize();
        }
        win.show();
        win.focus();
      });
    } else {
      if (windowsOption.maximized) {
        win.maximize();
      }
    }

    win.setTitle('试产搭配表智能生成助手');
  }

  async beforeClose() {
    logger.info('[lifecycle] before-close');
    return true;
  }
}

Lifecycle.toString = () => '[class Lifecycle]';

module.exports = { Lifecycle };
