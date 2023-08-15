'use strict'
import fetch from 'node-fetch';
import { app, protocol, BrowserWindow, ipcMain, shell, Menu, nativeTheme, Tray, globalShortcut, clipboard, dialog } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import fs from 'fs';
import path from 'path';


const { spawn, execSync } = require('child_process');

// import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer'
const isDevelopment = process.env.NODE_ENV !== 'production'

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
])

const isMac = process.platform === 'darwin';
const defaultAskHotkey = isMac ? 'Option+K' : 'Alt+K';

let win = null
let tray = null
let isLock = false
let isQuiting = false;
let shiftMode = false;
let braindoorProcess = null;
let hideTimer
let autoHide = true
let otherBraindoor = false
let clipboardSave = null
async function createWindow(transparent = isLock, x = 1000, y = 200, w = 500, h = 1000, frame = true, shadow = true, top = false) {
  // Create the browser window.
  win = new BrowserWindow({
    x: x,
    y: y,
    width: w,
    height: h,
    frame: frame,
    transparent: transparent,
    hasShadow: shadow,
    alwaysOnTop: top,
    show: false,
    skipTaskbar: true,
    minWidth: 400,
    minHeight: 600,
    // level: 'floating',
    webPreferences: {

      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      // nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      nodeIntegration: true,
      contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION,
      enableRemoteModule: true,
      webSecurity: false,
      zoomFactor: 1.0
    }
  })
  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
    // if (!process.env.IS_TEST) win.webContents.openDevTools()
  } else {
    createProtocol('app')
    // Load the index.html when not in development
    win.loadURL('app://./index.html')
  } ``
  shiftMode = false

  win.on('close', (event) => {
    if (shiftMode) {
      win = null;
      return
    }

    if (!isQuiting) {
      event.preventDefault() // 阻止窗口关闭
      win.hide() // 隐藏窗口
    } else {
      if (braindoorProcess) {
        braindoorProcess.kill();
      }
      app.quit();
    }
  })

  // 监听窗口失去焦点的事件
  win.on('blur', () => {
    // 启动计时器，在一段时间后隐藏窗口
    // 从localStorage中获取autoHide的值，如果为true，才执行下面的自动隐藏逻辑
    if (autoHide) {
      hideTimer = setTimeout(() => {
        win.hide()
      }, 60000) // 60秒后隐藏窗口
    }
  }
  )


  win.on('focus', () => {
    // 取消计时器
    clearTimeout(hideTimer)
  })

}



// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  // 弹出提示框
  // const options = {
  //   type: 'question',
  //   buttons: ['确认', '取消'],
  //   defaultId: 0,
  //   title: '确认退出',
  //   message: '确定要关闭程序吗？',
  //   // icon: 'assets/icon.png'
  // }

  // dialog.showMessageBox(win, options).then((result) => {
  //   if (result.response === 0) {
  //     // 如果点击了确认按钮，则关闭窗口
  //     app.quit()
  //   }
  // })

  // app.quit()
  // setTimeout(() => {
  //   if (BrowserWindow.getAllWindows().length === 0) {
  //     app.quit();
  //   }
  // }, 5000); // 等待5秒钟


  // if (process.platform !== 'darwin') {
  //   app.quit()
  // }
})


app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
    win.once('ready-to-show', () => {
      win.show();
      braindoorLogToRender();
    })
  }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  clipboardSave = clipboard.readText();
  startBraindoor()
  createWindow()


  // 设置托盘
  tray = new Tray(path.join(__static, 'tray.png'))
  tray.on('click', () => {
    if (!win.isVisible()) {
      win.show() // 显示窗口
    }
    setTimeout(() => {
      win.focus()
    }, 200)
  })

  const contextMenu = Menu.buildFromTemplate([
    // { label: '显示', click: () => win.show() },
    { label: '隐藏', click: () => win.hide() },
    {
      label: '退出', click: () => {
        isQuiting = true;
        app.quit();
      }
    }
  ])
  tray.setContextMenu(contextMenu)

  win.once('ready-to-show', () => {
    win.show();
    braindoorLogToRender();
  })

  // 禁用缩放
  const defaultMenu = Menu.getApplicationMenu();
  if (defaultMenu) {
    const viewMenu = defaultMenu.items.find(item => item.label === 'View').submenu;
    if (viewMenu) {
      const reloadMenuItem = viewMenu.items.find(item => item.label === 'Reload');
      reloadMenuItem.enabled = false;
      const forceReloadMenuItem = viewMenu.items.find(item => item.label === 'Force Reload');
      forceReloadMenuItem.enabled = false;
      const zoomInMenuItem = viewMenu.items.find(item => item.label === 'Zoom In');
      zoomInMenuItem.enabled = false;
      const zoomOutMenuItem = viewMenu.items.find(item => item.label === 'Zoom Out');
      zoomOutMenuItem.enabled = false;
    }
  }

  // 全局Ask功能，注册剪贴板监控的全局快捷键
  updateAskHotkey(defaultAskHotkey);
})


// 设置全局快捷键的函数，传入快捷键参数，先注销快捷键，再注册快捷键
function updateAskHotkey(key) {
  globalShortcut.unregisterAll();
  const isRegistered = globalShortcut.register(key, () => {
    let cmd = ""
    if (isMac) {
      const scptPath = path.join(__static, 'copyCmd.scpt');
      cmd = `osascript ${scptPath}`;
    } else {
      const scptPath = path.join(__static, 'copyCmd.vbs');
      cmd = `cscript ${scptPath}`;
    }
    try {
      execSync(cmd);
    } catch (error) {
      console.error(`exec error: ${error}`);
      return;
    }

    let text = clipboard.readText();
    // 判断当前的data和clipboardSave是否相同，如果相同则怀疑新text还没有装入剪贴板，则再等待0.5秒后重新读取剪贴板内容，否则发送剪贴板内容

    text = clipboard.readText();
    win.webContents.send('clipboard-data', text);
    clipboardSave = text;
    setTimeout(() => {
      win.show();
      win.focus();
    }, 200);


  });
  if (!isRegistered) {
    console.log('全局快捷键注册失败');
  }
}

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit()
      }
    })
  } else {
    process.on('SIGTERM', () => {
      app.quit()
    })
  }
}



app.on('before-quit', () => {
  isQuiting = true;
})

app.on('will-quit', () => {
  // 注销所有快捷键
  globalShortcut.unregisterAll();
});


// 无框模式切换
ipcMain.on('render2main', (event, param1) => {
  if (param1 === 'reloadWindow') {
    if (!isLock) { //执行锁定
      const bounds = win.getBounds();
      shiftMode = true
      win.close()
      createWindow(true, bounds.x, bounds.y, bounds.width, bounds.height, false, false, true)
      isLock = true
      win.setResizable(false)
      win.once('ready-to-show', () => {
        win.show()
      })
    } else {
      const bounds = win.getBounds();
      shiftMode = true
      win.close()
      createWindow(false, bounds.x, bounds.y, bounds.width, bounds.height, true, true, false)
      isLock = false
      win.setResizable(true)
      win.once('ready-to-show', () => {
        win.show()
      })
    }
  }
})

ipcMain.on('restart-braindoor', () => {
  if (braindoorProcess) {
    braindoorProcess.kill();
    braindoorProcess = null;
  }
  setTimeout(() => {
    startBraindoor();
  }, 10000);
})


//外部打开链接
app.on('web-contents-created', (e, webContents) => {
  webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });
});


// 检查后台是否已经有可用的braindoor
const contactBrainoor = async () => {
  try {
    const response = await fetch("http://127.0.0.1:7860/run/new_page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: []
      })
    });
    //判断是否有正常的返回
    if (response.status == 200) {
      console.log('There are already available braindoor on background.');
      otherBraindoor = true;
    } else {
      otherBraindoor = false;
    }
  } catch (error) {
    console.log(error);
    otherBraindoor = false;
  }
}


// 启动braindoor
const startBraindoor = async () => {

  await contactBrainoor();
  if (otherBraindoor) {
    return;
  }

  if (braindoorProcess) {
    console.log('Braindoor is already running.');
    return;
  }
  // 如果系统进程中有其他braindoor,也退出
  let resoursePath = path.join(__dirname, '..');
  let braindoorPath = null;
  let workPath = path.join(resoursePath, 'braindoor');
  if (process.env.NODE_ENV === 'development') {
    braindoorPath = '/Users/lhan/Projects/BrainDoor/dist/braindoor/braindoor'
    braindoorProcess = spawn(braindoorPath, { shell: false });
  } else {
    braindoorPath = path.join(resoursePath, 'braindoor/braindoor');
    braindoorProcess = spawn(braindoorPath, { shell: false, cwd: workPath });
  }
  console.log('Run braindoor.');
};

const braindoorLogToRender = () => {
  if (!braindoorProcess) {
    return;
  }

  braindoorProcess.stdout.on('data', (data) => {
    console.log(`braindoor: ${data}`);
    win.webContents.send('message-from-main', `stdout: ${data}`);
  });
  braindoorProcess.stderr.on('data', (data) => {
    console.error(`braindoor: ${data}`);
    win.webContents.send('message-from-main', `${data}`);
  });
  braindoorProcess.on('close', (code) => {
    console.log(`braindoor退出，退出码 ${code}`);
    win.webContents.send('message-from-main', `braindoor退出，退出码 ${code}`);
    braindoorProcess = null;
  });
  braindoorProcess.on('error', (err) => {
    console.error(`启动braindoor出错：${err}`);
    win.webContents.send('message-from-main', `braidoor出错：${err}`);
    braindoorProcess = null;
  });
}


// 单例锁，开发时时候可以注释掉
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (win) {
      if (win.isMinimized()) {
        win.restore();
      }
      win.focus();
    }
  });
}


ipcMain.handle('get-system-theme', (event) => {
  const result = nativeTheme.shouldUseDarkColors;
  if (result) {
    return 'dark';
  } else {
    return 'light';
  }
})

// 从渲染进程获取发送过来的autoHide的值，存储到autoHide中
ipcMain.on('autoHide', (event, arg) => {
  autoHide = arg;
})



// 从渲染进程接受一个消息，从'用户文件夹/braindoor/prompts'中读取所有的txt文件，存储到一个snippets数组中，包括文件名和文件内容
// 然后把snippet返回渲染进程
ipcMain.on('request-snippets', (event, arg) => {
  const folderPath = path.join(app.getPath('home'), 'braindoor', 'prompts');
  fs.readdir(folderPath, (err, files) => {
    if (err) {
      event.reply('reply-snippets', { status: 'error', message: err.message });
    } else {
      const snippets = files.filter(file => file.endsWith('.txt')).map(file => {
        const content = fs.readFileSync(path.join(folderPath, file), 'utf-8');
        const name = file.replace('.txt', '');
        return { name: name, content: content };
      });
      event.reply('reply-snippets', { status: 'success', data: snippets });
    }
  });
});

//接受来自渲染进程的setAskHotkey消息，然后重新设置askHotkey
ipcMain.on('setAskHotkey', (event, arg) => {
  try {
    updateAskHotkey(arg);
  } catch (error) {
    dialog.showMessageBox({
      type: 'error',
      title: '设置快捷键错误',
      message: '有特殊符号不支持设置快捷键'
    });
    updateAskHotkey(defaultAskHotkey);
  }
})



app.setName('OpenCopilot')