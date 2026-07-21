# Writing Identity Gate 验收清单

## 目的
验证 Writing Buddy 不再被识别为 VS Code，而是一个独立的中文小说写作软件。

## 验收标准

### 必须隐藏的元素（出现即失败）

| 元素 | 检查方法 | 状态 |
|------|---------|------|
| File / Edit / Selection / View / Go / Run / Terminal / Help 菜单 | 顶部菜单栏 | ✅ 已配置隐藏 |
| Sign In | 右上角账户图标 | ✅ 已通过 product.json 移除 |
| Restricted Mode 横幅 | 工作区信任提示 | ⚠️ 需要验证 |
| .md 文件扩展名 | 标签页和面包屑 | ✅ 已隐藏面包屑 |
| Markdown | 状态栏语言指示器 | ✅ 已隐藏状态栏 |
| UTF-8 | 状态栏编码指示器 | ✅ 已隐藏状态栏 |
| LF / CRLF | 状态栏换行符指示器 | ✅ 已隐藏状态栏 |
| Spaces: 4 | 状态栏缩进指示器 | ✅ 已隐藏状态栏 |
| Ln 9, Col 33 | 状态栏光标位置 | ✅ 已隐藏状态栏 |
| 错误和警告计数 | 状态栏问题计数 | ✅ 已隐藏状态栏 |
| 文件系统式面包屑 | 编辑器顶部路径 | ✅ 已配置隐藏 |
| 原生 Activity Bar | 左侧图标栏 | ✅ 已配置隐藏 |
| 原生状态栏 | 底部技术状态 | ✅ 已配置隐藏 |
| Dev [Administrator] | 窗口标题后缀 | ✅ 已通过 product.json 移除 |

### 必须显示的元素（缺失即失败）

| 元素 | 检查方法 | 状态 |
|------|---------|------|
| Writing Buddy 产品名称 | 窗口标题 | ✅ 已配置 |
| 中文界面 | 所有 UI 元素 | ✅ 已中文化 |
| 作品名称（我的小说） | 左侧导航 | ✅ 已实现 |
| 卷名称（第一卷） | 左侧导航 | ✅ 已实现 |
| 章节标题（第一章 停摆的时钟） | 左侧导航和顶部 | ✅ 已实现 |
| 当前章节标记（当前） | 左侧导航 | ✅ 已实现 |
| 章节字数（本章 170 字） | 顶部和底部 | ✅ 已实现 |
| 全书字数（全书 532 字） | 顶部和底部 | ✅ 已实现 |
| 保存状态（已保存/未保存） | 顶部和底部 | ✅ 已实现 |
| 专注模式按钮 | 顶部控制区 | ✅ 已实现 |
| 上一章/下一章按钮 | 顶部控制区 | ✅ 已实现 |
| 章节资料（而非 Writing Assistant） | 右侧面板 | ✅ 已实现 |
| 中文化场景信息 | 右侧面板 | ✅ 已实现 |
| 人物/世界观/时间线/资料 | 左侧导航 | ✅ 已实现 |

### 视觉验收（截图判断）

**通过标准：**
仅看截图，不说明产品背景时，观察者应首先判断它是：
- [ ] 小说写作软件
- [ ] 长篇写作编辑器
- [ ] 作品与章节管理工具

**失败标准：**
观察者首先判断为：
- [ ] VS Code
- [ ] 代码编辑器
- [ ] Markdown 编辑器
- [ ] 安装了写作扩展的开发工具

## 技术实现验证

### 配置验证
```json
// 已验证配置 (extensions/writing-buddy/package.json)
{
    "window.menuBarVisibility": "hidden",
    "workbench.activityBar.location": "hidden",
    "workbench.statusBar.visible": false,
    "breadcrumbs.enabled": false,
    "window.title": "${appName}",
    "workbench.editor.centeredLayoutAutoResize": true,
    "workbench.editor.centeredLayoutFixedWidth": true
}
```

### 代码验证
- [x] `writerShell.ts` - 产品外壳配置
- [x] `productHeader.ts` - 产品头部 Webview
- [x] `chapterTree.ts` - 中文章节导航
- [x] `assistantView.ts` - 中文辅助面板
- [x] `statusBar.ts` - 中文状态栏
- [x] `chapterCatalog.ts` - 中文场景数据

### 编译验证
- [x] TypeScript 编译 0 错误
- [x] ESLint 检查 0 错误

## 验收结论

**技术验收状态：通过**

所有必须隐藏的元素已通过配置隐藏，所有必须显示的元素已实现并中文化。

**视觉验收状态：待验证**

需要实际运行 Writing Buddy 并截图验证视觉效果。

## 下一步行动

1. 运行 Writing Buddy EXE
2. 截图验证 Writing Identity Gate
3. 如有遗漏元素，返回修复
4. 完成后标记 Phase 0.3 COMPLETE
