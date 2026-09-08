import { defineConfig } from 'wxt';

export default defineConfig({
  targetBrowsers: ['chrome'],
  dev: {
    server: {
      port: 3000,
      strictPort: true,
    },
  },
  vite: () => ({
    server: {
      // Extension pages load Vite's dev client from localhost during development.
      cors: {
        origin: /^chrome-extension:\/\/[a-p]{32}$/,
      },
    },
  }),
  manifest: {
    name: 'Nightfall',
    author: { email: 'elyager@gmail.com' },
    homepage_url: 'https://nightfall.elyager.com/',
    minimum_chrome_version: '127',
    action: {
      default_title: 'Nightfall',
      default_icon: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    },
    permissions: ['activeTab', 'scripting', 'storage'],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    commands: {
      'toggle-nightfall': {
        suggested_key: {
          default: 'Ctrl+Shift+D',
          mac: 'Command+Shift+D',
        },
        description: 'Toggle Nightfall for the current site',
      },
    },
  },
  hooks: {
    'server:created': (_wxt, server) => {
      // WXT's default content-script refresh reloads every matching browser tab.
      // Nightfall has a disposable content-script instance, so let the background
      // worker replace it in-place on the active tab instead.
      server.reloadContentScript = () => {
        server.ws.send('nightfall:reload-active-tab');
      };
    },
    'build:manifestGenerated': (_wxt, manifest) => {
      // Runtime content scripts normally promote their matches to required host
      // access. Nightfall requests and registers each origin only when asked.
      delete manifest.host_permissions;
      if (manifest.content_scripts?.length === 0) delete manifest.content_scripts;
    },
  },
});
