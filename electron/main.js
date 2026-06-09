const { ElectronEgg } = require('ee-core');
const { Lifecycle } = require('./preload/lifecycle');
const { preload } = require('./preload');
const { logger } = require('ee-core/log');

const app = new ElectronEgg();

const life = new Lifecycle();
app.register('ready', life.ready.bind(life));

app.register('electron-app-ready', () => {
  life.electronAppReady();
});

app.register('window-ready', life.windowReady.bind(life));
app.register('before-close', life.beforeClose.bind(life));

app.register('preload', preload);

app.run();
