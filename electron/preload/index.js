'use strict';

const { logger } = require('ee-core/log');

exports.preload = function (app) {
  logger.info('[preload] init finish');
};
