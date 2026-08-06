import { defineConfig } from 'wxt';

export default defineConfig({
  targetBrowsers: ['chrome'],
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
    'build:manifestGenerated': (_wxt, manifest) => {
      // Runtime content scripts normally promote their matches to required host
      // access. Nightfall requests and registers each origin only when asked.
      delete manifest.host_permissions;
      if (manifest.content_scripts?.length === 0) delete manifest.content_scripts;
    },
  },
});
