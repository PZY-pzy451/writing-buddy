@echo off
chcp 65001 >nul
title Writing Buddy
setlocal

:: 项目根目录
set "ROOT=%~dp0.."

:: 隔离运行目录（避免污染正常 VS Code 配置）
set "RUN_DIR=%TEMP%\writing-buddy-playground"
set "USER_DATA=%RUN_DIR%\user-data"
set "EXT_DIR=%RUN_DIR%\extensions"

:: 预置 settings.json
set "SETTINGS_DIR=%USER_DATA%\User"
if not exist "%SETTINGS_DIR%" mkdir "%SETTINGS_DIR%"
if not exist "%SETTINGS_DIR%\settings.json" (
    echo 首次启动：写入产品配置...
    (
    echo {
    echo     "window.menuBarVisibility": "hidden",
    echo     "workbench.activityBar.location": "hidden",
    echo     "workbench.secondarySideBar.defaultVisibility": "visible",
    echo     "workbench.statusBar.visible": true,
    echo     "breadcrumbs.enabled": false,
    echo     "window.commandCenter": false,
    echo     "window.title": "${appName}",
    echo     "security.workspace.trust.enabled": false,
    echo     "security.workspace.trust.startupPrompt": "never",
    echo     "security.workspace.trust.banner": "never",
    echo     "security.workspace.trust.untrustedFiles": "open",
    echo     "chat.titleBarSignInEnabled": false,
    echo     "update.mode": "none",
    echo     "update.showReleaseNotes": false,
    echo     "workbench.editor.centeredLayoutAutoResize": true,
    echo     "workbench.editor.centeredLayoutFixedWidth": true,
    echo     "editor.fontFamily": "'Source Han Serif SC', 'Noto Serif CJK SC', 'SimSun', serif",
    echo     "editor.fontSize": 16,
    echo     "editor.lineHeight": 1.8,
    echo     "editor.lineNumbers": "off",
    echo     "editor.minimap.enabled": false,
    echo     "editor.renderWhitespace": "none",
    echo     "editor.renderLineHighlight": "none",
    echo     "editor.folding": false,
    echo     "editor.glyphMargin": false,
    echo     "editor.scrollBeyondLastLine": false,
    echo     "workbench.layoutControl.enabled": false,
    echo     "workbench.navigationControl.enabled": false,
    echo     "workbench.tips.enabled": false
    echo }
    ) > "%SETTINGS_DIR%\settings.json"
)

:: 复制 Writing Buddy 扩展
if not exist "%EXT_DIR%\writing-buddy" (
    echo 复制扩展...
    xcopy /E /I /Q "%ROOT%\extensions\writing-buddy" "%EXT_DIR%\writing-buddy"
)

:: 预置示例小说（首次）
set "STORAGE=%USER_DATA%\User\globalStorage\writing-buddy.writing-buddy"
if not exist "%STORAGE%\sample-novel" (
    echo 复制示例小说...
    mkdir "%STORAGE%" 2>nul
    xcopy /E /I /Q "%ROOT%\extensions\writing-buddy\sample-novel" "%STORAGE%\sample-novel"
)

:: 设置开发环境变量
set "VSCODE_DEV=1"
set "NODE_ENV=development"
set "ELECTRON_ENABLE_LOGGING=1"

:: 工作区路径
set "WORKSPACE=%STORAGE%\sample-novel"

echo ==========================================
echo   Writing Buddy
echo   我的小说 / 第一卷 灰城之下
echo ==========================================
echo.
echo 工作区: %WORKSPACE%
echo 配置: %SETTINGS_DIR%
echo.
echo 启动中...

:: 启动（. 是应用源码路径）
start "" "%ROOT%\.build\electron\Writing Buddy.exe" . --user-data-dir "%USER_DATA%" --extensions-dir "%EXT_DIR%" "%WORKSPACE%"

endlocal
