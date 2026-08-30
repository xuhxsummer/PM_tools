# H5 文件工具箱 UI Skill

## 1. 适用范围

本 Skill 用于所有 H5 文件工具箱相关页面，包括但不限于：

- PDF 转 Word
- Word 转 PDF
- 图片格式转换
- ZIP 解压
- PDF 合并 / 拆分
- PDF 转图片
- 图片转 PDF
- 图片压缩
- ZIP 压缩
- 二维码工具
- JSON 工具

目标是保证后续新增工具时，UI 风格、交互结构和视觉语言始终一致。

---

## 2. 核心视觉方向

整体使用「高级、克制、轻量」的现代玻璃拟态。

关键词：

- Glassmorphism
- Apple-like
- Modern
- Clean
- Minimal
- Soft
- Premium
- Mobile First

严禁：

- 廉价蓝紫渐变
- 赛博朋克风
- 过度霓虹
- 大面积高饱和颜色
- 厚重阴影
- 复杂拟物
- 过度装饰
- 过长动画
- 页面信息密度过高

UI 的目标不是“炫”，而是“舒服、清晰、高级、像正式产品”。

---

## 3. 页面背景

默认使用浅色柔和渐变背景。

建议背景由：

- 主浅色背景
- 2～3 个模糊渐变光斑
- 极轻微动态漂浮

组成。

背景不能抢占内容视觉层级。

建议：

- 光斑透明度低
- blur 80px 以上
- 动画时间 8～20 秒
- 动画位移非常轻微

---

## 4. Glass Surface

所有重要内容容器优先使用统一 Glass Surface。

基础特征：

- 半透明白色
- backdrop-filter blur
- 半透明描边
- 柔和阴影
- 大圆角
- 内部足够留白

推荐：

```css
border-radius: 20px ~ 24px;
backdrop-filter: blur(20px ~ 30px);
border: 1px solid rgba(255,255,255,0.45);
background: rgba(255,255,255,0.48);
```

不要每个组件定义不同的玻璃效果。

应统一封装：

- GlassCard
- GlassPanel
- GlassModal
- GlassBottomSheet

---

## 5. 圆角规范

推荐：

- 页面大卡片：24px
- 普通工具卡片：20px
- 上传区域：24px
- 按钮：14～18px
- 输入控件：14～16px
- Badge：999px

避免大量使用尖角组件。

---

## 6. 阴影规范

阴影必须轻。

使用柔和、大范围、低透明度阴影。

不要：

```css
box-shadow: 0 10px 20px rgba(0,0,0,0.4);
```

更倾向：

```css
box-shadow: 0 10px 40px rgba(15,23,42,0.08);
```

阴影主要作用是制造层级，而不是强调轮廓。

---

## 7. 字体层级

保持文字层级清晰。

推荐：

### Page Title

- 24～30px
- 600 / 700
- 高对比

### Section Title

- 18～20px
- 600

### Card Title

- 15～17px
- 600

### Body

- 14～16px
- 400 / 500

### Secondary

- 12～14px
- 降低透明度

不要使用大量不同字号。

---

## 8. 首页布局

首页主要包含：

1. Header
2. Hero / 简短说明
3. 隐私提示
4. Tool Grid
5. Footer

移动端 Tool Grid 默认：

2 列

间距保持舒适。

非常窄的屏幕允许降为：

1 列

PC 端设置 max-width，不要无限拉宽。

建议：

```css
max-width: 960px;
margin: 0 auto;
```

---

## 9. Tool Card

每个工具卡片必须包含：

- 图标
- 工具名称
- 简短说明

例如：

PDF 转 Word

PDF 转换为 DOCX 文档

交互：

- hover：轻微抬升
- active：轻微缩小
- tap feedback：明确但克制

Framer Motion 推荐：

```ts
whileTap={{ scale: 0.98 }}
```

不要做：

- 大幅弹跳
- 旋转
- 闪烁
- 复杂 3D

---

## 10. 图标

统一使用 Lucide React。

不要混用：

- Emoji
- Material Icon
- FontAwesome
- 自定义彩色图标

除非设计明确需要。

图标应：

- 单色
- 简洁
- 视觉重量统一

推荐：

- FileText
- FileType
- Image
- Archive
- UploadCloud
- Download
- Check
- X
- ArrowLeft

---

## 11. Tool Detail Layout

所有文件处理工具必须尽量使用统一页面骨架：

```text
Header
↓
工具名称
↓
工具说明
↓
文件上传区
↓
文件信息
↓
参数配置
↓
主要操作按钮
↓
处理状态
↓
结果
```

不要不同工具出现完全不同的布局体系。

---

## 12. 文件上传区域

Upload Area 是工具页面核心组件。

视觉：

- 大圆角
- Glass
- 虚线或极浅边界
- 中央图标
- 主文案
- 辅助说明

移动端：

点击选择文件。

PC：

支持点击和拖拽。

Hover：

边界略增强。

Drag Active：

背景稍微增强。

不要使用传统浏览器默认 file input 样式。

---

## 13. Selected File Card

选择文件之后统一显示：

- File Icon
- 文件名
- 文件大小
- 格式
- 删除按钮

如果是图片：

可以增加缩略图和尺寸。

文件名过长：

单行或双行截断。

绝对禁止撑破布局。

---

## 14. Primary Button

主按钮用于：

- 开始转换
- 开始解压
- 下载文件

特点：

- 高对比
- 大点击区域
- 大圆角
- 有轻微玻璃或实色效果
- 移动端宽度优先 100%

高度建议：

48～54px

按钮文字：

清晰直接。

不要使用：

“确认”
“提交”

这类含义不明确的文字。

应使用：

- 开始转换
- 开始解压
- 下载文件
- 再处理一个

---

## 15. Secondary Button

用于：

- 重新选择
- 取消
- 再处理一个
- 关闭

视觉优先级必须明显低于 Primary。

推荐：

- 透明 / 半透明
- 轻边框
- 不使用强烈主色

---

## 16. 取消类操作

取消按钮、返回按钮、关闭按钮：

不要与 Primary 使用同样强度的视觉。

例如：

```text
[ 开始转换 ]

重新选择
```

或：

```text
取消      确认
```

其中取消采用弱视觉。

避免两个按钮都一样抢眼。

---

## 17. Loading

如果存在真实进度：

显示 Progress Bar + 百分比。

如果没有真实进度：

必须使用 Indeterminate Loading。

严禁：

伪造：

42%
76%
98%

这会制造虚假的精确感。

Loading 文案：

- 正在转换
- 正在处理
- 正在解压

不要展示内部技术术语。

---

## 18. Success State

成功状态应具有明确正反馈。

包含：

- Check 图标
- 成功标题
- 输出文件
- 文件信息
- 下载按钮

例如：

```text
✓

转换完成

需求文档.docx
8.2 MB

[ 下载文件 ]

再转换一个
```

---

## 19. Error State

错误提示必须用户可理解。

错误类型：

- 不支持该文件
- 文件过大
- 文件已损坏
- 浏览器暂不支持
- 转换失败
- 解压失败
- 密码错误
- 内存不足

禁止把以下内容直接显示给用户：

```text
TypeError
Promise rejection
WASM Runtime Error
Stack Trace
```

开发日志可输出到 console。

---

## 20. Toast

Toast 用于轻提示：

- 已复制
- 下载已开始
- 文件已移除
- 不支持该格式

Toast 不应承担复杂错误说明。

复杂错误使用 Error State / Dialog。

---

## 21. Modal

桌面端可使用 Modal。

特点：

- Glass Surface
- 大圆角
- 背景 Blur
- 内容简洁

---

## 22. Bottom Sheet

移动端优先使用 Bottom Sheet 展示：

- 格式选择
- 参数设置
- 说明
- 次级操作

Bottom Sheet：

- 顶部圆角
- 底部考虑 safe-area
- 支持滑动关闭（如果实现稳定）

---

## 23. Select

不要直接使用浏览器原生 Select 作为最终 UI。

推荐使用：

- Glass Select
- Bottom Sheet Selector

尤其移动端优先 Bottom Sheet。

---

## 24. Slider

用于：

- 图片质量
- 压缩率

需要显示当前值：

```text
图片质量

80%
────────●────
```

不要只显示滑块而没有数值。

---

## 25. Safe Area

移动端必须处理：

```css
env(safe-area-inset-top)
env(safe-area-inset-bottom)
```

所有底部固定区域必须增加 safe area。

---

## 26. Mobile First

设计优先级：

1. 手机
2. 平板
3. PC

不要先设计桌面页面再强行压缩成手机。

移动端需要保证：

- 单手操作
- 大点击区域
- 不误触
- 文件名不溢出
- Bottom Sheet 合理
- 键盘弹起不遮挡内容

---

## 27. Animation

动画目标：

提升质感，而不是展示技术。

推荐时长：

150～300ms

允许：

- fade
- translateY 4～12px
- scale 0.98～1
- opacity
- blur transition

避免：

- bounce
- elastic
- overshoot
- 旋转
- 大距离移动

---

## 28. 页面切换

工具首页 → 工具详情页：

轻微淡入 + 上移。

返回：

快速自然。

不要做大型横向滑动或类似 PPT 的切页效果。

---

## 29. 隐私提示

如果文件完全在浏览器本地处理：

首页可显示：

「文件仅在您的设备中处理」

详情页可显示：

「文件不会上传服务器」

这种提示：

- 视觉优先级低
- 带 Shield / Lock 图标
- 不抢主操作

如果未来任何功能上传服务器：

必须重新调整对应文案。

---

## 30. Empty State

空状态需要：

- 简洁图标
- 一句话解释
- 必要操作

不要使用大面积插画。

---

## 31. Footer

Footer 保持极简。

推荐：

```text
所有文件均在您的设备本地处理

隐私安全 · 无需上传 · 无需登录
```

不要堆积：

- 公司介绍
- 营销信息
- 大量链接
- 联系电话
- 广告

除非产品后续有明确业务需求。

---

## 32. Dark Mode

第一版可暂不实现。

如果实现：

必须重新定义 Glass Surface，不要只是：

```css
filter: invert()
```

深色模式背景、玻璃、描边、字体对比度需要独立设计。

---

## 33. 组件复用要求

所有页面应优先复用：

- AppLayout
- ToolHeader
- GlassCard
- GlassPanel
- ToolCard
- FileDropzone
- SelectedFileCard
- PrimaryButton
- SecondaryButton
- ProgressIndicator
- ResultCard
- EmptyState
- ErrorState
- GlassModal
- GlassBottomSheet
- ToolPrivacyNotice

严禁复制同一个组件然后修改少量 CSS。

---

## 34. 设计 Token

推荐集中维护：

```ts
radius
spacing
blur
shadow
fontSize
fontWeight
opacity
animationDuration
```

例如：

```ts
radius.card = 24
radius.button = 16
blur.glass = 24
motion.fast = 160
motion.normal = 220
```

避免页面中大量 Magic Number。

---

## 35. 最终视觉检查

开发任何新页面后检查：

- 是否仍然像同一个产品？
- 是否有过多颜色？
- 是否有多个不同圆角体系？
- 是否有过重阴影？
- 是否出现廉价紫色渐变？
- 是否动画过多？
- 是否信息密度过高？
- 是否移动端按钮容易点击？
- 是否 safe area 正常？
- 是否文件名会撑破布局？
- 是否 Primary / Secondary 层级清晰？
- 是否用户能一眼知道下一步操作？

如果答案是否定的，则继续调整。

---

## 36. 最终目标

H5 文件工具箱的 UI 应该让用户感受到：

- 简洁
- 快
- 安全
- 本地
- 高级
- 可信
- 好用

它应该像一个真正长期使用的工具产品，而不是临时 Demo。
