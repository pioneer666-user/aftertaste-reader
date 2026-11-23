# D044 · 前端用色盘点

## 固定口径

从仓库根目录运行以下只读命令。第一项按每次出现计数，第二项查绘制路径和继承。第三项包含测试对颜色、合成方式和浏览器差异的假设。另查 Vite 导入的 CSS、CodeMirror 动态样式、SVG marker 的引用目标和最终画面。

```powershell
git grep -I -o -E '#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)' 504fec9 -- src/web
rg -n -i 'color|background|fill|stroke|shadow|gradient|opacity|transparent|currentcolor|canvastext|buttonface|highlight|\b(white|black|gray|red)\b|\bvar\(|:style|style=|\.css' src/web
rg -n -i 'color|paint|rgba?|stroke|fill|shadow|gradient|tint|chroma|ripple|forcedColors' tests/browser node_modules/@vue-flow/core/dist/style.css node_modules/@vue-flow/core/dist/theme-default.css
```

用候选提交替换第一项的 504fec9 可重跑结果。基线 289 处／13 个文件。按次数为 canvas.css 119、style.css 97、DependencyCard 20、BlockLocationControl 17、BlockMarginRecords 和 DependencyMiniMap 各 8、NoteBody 5、DependencyCanvas 和 QuickNote 各 4、DependencyDots 3、ReaderSidebarDivider 2、LoopThumbnail 和 BlockUnderstandingMark 各 1。候选的 210 个直接色值全部集中在 themes.css，42 个用途各有五组固定值。具名系统色按系统高对比设置绘制。

## 用途与实际落点

| 表面与路径 | 颜色的含义、来源和检查位置 |
| --- | --- |
| App.vue、i18n.ts、ThemePicker、style.css | 顶栏、六页签、宽窄菜单、键盘焦点、跳转提示、语言与主题保存反馈。原有 accent／muted／line 依次接操作、辅助文字、结构分隔；输入框和按钮边界另用 control-rim。原生输入、复选框、滚动条分别使用 color-scheme、accent-color 和 scrollbar-color。当前页带下划线，主题菜单选中项带 ✓。 |
| ReaderDocument、ReaderFileTree、ReaderSidebarDivider | 讲解纸面、源码板和固定行号、内联和围栏代码、引用、文件与目录行、占位骨架、降级诊断、选区。文件加载用层次底，问题用文案和状态色。源码板与横滚覆盖层共享同一底色。 |
| reader-corners.ts | Firefox 临时恢复元素原样式，从计算值取背景、边和焦点绘入 SVG，用 -moz-element 作 border image。根主题变化使已分配的快照失效。普通 CSS 的透明背景是该绘制路径的一部分。强制色下停用快照。 |
| DependencyCanvas、DependencyCard、DependencyEdge、canvas.css | 文件与库分开填充和描边，库依赖虚线，直接关系加粗，次要线保留 87% 不透明度。路线用暖底与 ◆，点选粗实线，框选外侧虚线。SVG 的箭头和边从同一角色取色。组、工具、按需详情、紧凑玻璃摘要和组编辑跟随根变量。 |
| DependencyDots、DependencyMiniMap、LoopThumbnail | Canvas 用同一色板的 dot、group-dot、ripple 重建重复图案，安排下一帧，装饰点和波纹按缩放及运动保留透明度。小地图使用文件、库、分组和视野色，点选形状有描边。闭环目录缩影的线继承 currentColor，节点填充取主题表面。 |
| LoopReading、LoopRelations | 第 03 步讲解、上一／下一步、提示、展开的固定源码与分支选择。浮出的源码面板与行号随已打开的步骤更新。 |
| BlockMarginRecords、BlockBookmarks、BlockUnderstandingMark、RecordEditor、ProjectBlockRecords、RecordWorkbench | 同块书签理由、页边标注、未标记／已理解／不理解保持 ○／✓／?。三态采用辅助文字、成功、错误三个独立角色。工作台的筛选、选中行、摘录、回原文、失效或保存失败与重试均沿页面角色。 |
| QuickNote、ProjectNotes、NoteBody、NoteSaveStatus、BlockLocationControl | 已打开的随手记与工作台共享色板。标签、引用卡片、预览、状态消息、选文浮条和手动复制面板继承根色。编辑器光标和自绘选区覆盖 CodeMirror 自带颜色。笔记失败与重试在隔离输入运行。 |

## 固定值、外部默认与测试假设

- transparent 表示无填充或渐变透明端；none 保留线稿内部和无描边路径；currentColor 使箭头、图标、缩影线与对应文本或按钮同步。透明度和叠层来自阴影、浮条、次要关系与装饰动画。结构分隔线不承担独立按钮的识别。禁用项同时具有禁用属性或文字说明。
- Canvas、CanvasText、ButtonText、Highlight 等系统色在强制色媒体规则中保留。系统原生选项列表随浏览器绘制。字体导入只提供字形。JS 内联布局的坐标、可见性、裁切、拖动比例和 SVG 路径不构成色板。
- Vue Flow 使用自定义文件、库、组、边和导航控件。产品禁用连线编辑、默认节点选择器和内置框选。基础样式和默认主题仍随包导入，实际边、端点与 marker 的绘制走产品规则。CodeMirror 当前启用历史、换行、引用装饰和 drawSelection；自带 gutter、搜索、高亮当前行等样式没有对应启用扩展。触屏选区把手继承 currentColor。
- 浅绿基线保留语义与主要纸色，并收深控件边界、非直接关系线和选区，统一相近表面。旧 Firefox 用例读取按钮透明背景，在实际 SVG 上分开核普通、当前、悬停与焦点。浅绿符号的固定 RGB、英文顶栏收纳边界及玻璃测试的两种 CSS 颜色序列化形式随实现校正。保留玻璃填充约 0.33、模糊 4 px 和轻高光。波纹专项按默认浅绿查实绘绿色亮点。
- [浅绿同场景对照](green-comparison.jpg) · [六页五主题](six-pages.jpg)。对比度的具体色对、构建和样本记录见[回执](handoff.md)。

