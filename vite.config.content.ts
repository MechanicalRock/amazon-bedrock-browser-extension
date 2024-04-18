import { dirname, relative } from 'path';
import { defineConfig } from 'vite';
import Vue from '@vitejs/plugin-vue';
import Icons from 'unplugin-icons/vite';
import IconsResolver from 'unplugin-icons/resolver';
import Components from 'unplugin-vue-components/vite';
import AutoImport from 'unplugin-auto-import/vite';
import WindiCSS from 'vite-plugin-windicss';
import svgLoader from 'vite-svg-loader';
import { r, port, isDev } from './scripts/utils';
import windiConfig from './windi.config';

const sharedConfig = {
  root: r('src'),
  resolve: {
    alias: {
      '~/': `${r('src')}/`,
    },
  },
  define: {
    __DEV__: isDev,
  },
  plugins: [
    Vue(),

    svgLoader(),

    AutoImport({
      imports: [
        'vue',
        {
          'webextension-polyfill': [['default', 'browser']],
        },
      ],
      dts: r('src/auto-imports.d.ts'),
    }),

    Components({
      dirs: [r('src/components')],
      dts: true,
      resolvers: [
        IconsResolver({
          componentPrefix: '',
        }),
      ],
    }),

    Icons(),

    {
      name: 'assets-rewrite',
      enforce: 'post',
      apply: 'build',
      transformIndexHtml(html: string, { path }: { path: string }) {
        return html.replace(/"\/assets\//g, `"${relative(dirname(path), '/assets')}/`);
      },
    },
  ],
  optimizeDeps: {
    include: ['vue', '@vueuse/core'],
    exclude: ['vue-demi'],
  },
};

export default defineConfig(({ command }) => ({
  ...sharedConfig,
  base: command === 'serve' ? `http://localhost:${port}/` : '/dist/',
  server: {
    port,
    hmr: {
      host: 'localhost',
    },
  },
  build: {
    outDir: r('extension/dist'),
    emptyOutDir: false,
    sourcemap: isDev ? 'inline' : false,
    terserOptions: {
      mangle: false,
    },
    rollupOptions: {
      input: {
        background: r('src/background/main.ts'),
        options: r('src/options/index.html'),
        popup: r('src/popup/index.html'),
      },
      output: {
        entryFileNames: '[name]/[name].js',
      },
    },
  },
  plugins: [
    ...sharedConfig.plugins,

    WindiCSS({
      config: {
        ...windiConfig,
        // disable preflight to avoid css population
        preflight: false,
      },
    }),
  ],
}));
