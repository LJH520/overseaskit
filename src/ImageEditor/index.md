# ImageEditor

图片编辑组件，封装了 `tui-image-editor`，提供导入、裁剪、旋转、文字、涂鸦、贴纸、滤镜和保存能力。

```jsx
import React from 'react';
import { ImageEditor } from '@unipus/overseaskit';

export default () => (
  <div style={{ height: 640, borderRadius: 12, overflow: 'hidden' }}>
    <ImageEditor onSave={(dataUrl) => console.log(dataUrl.slice(0, 64))} />
  </div>
);
```

## Props

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| `width` | 组件宽度 | `string \| number` | `'100%'` |
| `height` | 组件高度 | `string \| number` | `'100%'` |
| `saveFileName` | 浏览器下载时的文件名 | `string` | `'edited-image.png'` |
| `resetAfterSave` | 保存后是否重置编辑器 | `boolean` | `false` |
| `onSave` | 保存回调；未传时会优先尝试 `window.ReactNativeWebView.postMessage`，否则下载图片 | `(dataUrl: string) => void` | - |
