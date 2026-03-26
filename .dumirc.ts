import { defineConfig } from 'dumi';

export default defineConfig({
  outputPath: 'docs-dist',
  themeConfig: {
    name: '@unipus/overseaskit',
  },
  styles: [
    `body .dumi-default-hero { padding-top: 120px; }
    body .dumi-default-header {
      z-index: 9999;
    }
    .dumi-default-header-left {
      width: auto !important;
      margin-right: 16px !important;
    }
    `,
  ],
});
