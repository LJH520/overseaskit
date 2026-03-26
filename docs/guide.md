# 开发指南

`@unipus/overseaskit` 是面向出海项目的专用 React 组件库，使用 dumi 进行文档开发，使用 father 进行构建发布。

## 安装依赖

```bash
pnpm install
```

## 启动文档站点

```bash
pnpm dev
```

默认会启动 dumi 开发服务，适合边写组件边查看文档示例。

## 构建组件库

```bash
pnpm build
```

构建产物会输出到 `dist`，用于发布 npm 包。

## 组件开发约定

- 组件代码放在 `src/<ComponentName>`。
- 每个组件至少包含实现文件和 dumi 文档。
- 对外导出统一收敛在 `src/index.ts`。
- 新增静态资源时，优先使用本地资源，避免默认依赖不稳定的第三方远程地址。
- 组件设计优先考虑出海业务中的 Web、WebView 和宿主应用嵌入场景。

## 当前组件

### ImageEditor

图片编辑组件，适合出海项目中的头像编辑、海报裁剪、UGC 素材加工等场景。

```tsx
import React from 'react';
import { ImageEditor } from '@unipus/overseaskit';

export default () => (
  <div style={{ height: 640, borderRadius: 12, overflow: 'hidden' }}>
    <ImageEditor />
  </div>
);
```

## 后续建议

- 按业务域组织组件，而不是堆积通用示例组件。
- 文档优先写清楚使用场景、宿主约束和接入方式。
- 对涉及上传、导出、跨域、桥接通信的组件，优先补充真实场景说明。
