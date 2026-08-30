# H5 Tools · 本地文件工具箱

面向手机浏览器的本地文件处理工具。文件内容不上传服务器，页面刷新或关闭后会立即清空；转换产物最多在当前页面内保留 10 分钟。

## 当前工具

- PDF 转 Word：提取文字并生成基础 DOCX，标记为实验性功能
- Word 转 PDF：本地渲染 DOCX 并生成 PDF，标记为实验性功能
- 图片格式转换：JPG、PNG、WebP 互转与质量设置
- ZIP 解压：读取目录、单文件下载与全部保存

## 公共能力

- Tool Registry 工具注册机制
- 统一文件选择、处理、成功、错误和结果状态
- 所有工具成功后共用双侧喝彩动画
- Blob URL 自动释放，结果 10 分钟自动清理
- iOS 风格玻璃拟态与 Safe Area 适配
- 五阶段液态水滴登录页与持续冲向屏幕的顶部泡泡

## 本地运行

```bash
npm install
npm run dev
```

生产检查：

```bash
npm run lint
npm run build
```

## 项目文档

- `docs/H5文件工具箱-开发Prompt.txt`
- `docs/h5-tools-ui-skill.md`
- `docs/水滴动画实现说明.md`

水滴旧版单层放大镜代码保留在 `src/components/intro/LiquidDropLegacy.tsx`，当前未启用，方便后续对照或恢复。
