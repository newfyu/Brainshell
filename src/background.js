'use strict'
import fetch from 'node-fetch';
import { app, protocol, BrowserWindow, ipcMain, shell, Menu, nativeTheme, Tray, globalShortcut, clipboard, dialog, screen, session } from 'electron'
require('@electron/remote/main').initialize()
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import  { autoUpdater } from 'electron-updater';


const { spawn } = require('child_process');

// import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer'
const isDevelopment = process.env.NODE_ENV !== 'production'

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
])

const isMac = process.platform === 'darwin';
const defaultAskHotkey = isMac ? 'Option+C' : 'Alt+C';

let win = null
let tray = null
let isLock = false
let isQuiting = false;
let shiftMode = false;
let braindoorProcess = null;
let hideTimer
let autoHide = true;
let clipboardSave = null
let otherBraindoor = false
let winBoundSave = null
let followMode = false
let blurTimeStart = null
let isOpenExternal = true
let streaming = false;
let manual_check = false;



// 启动时删除mac已有安装包
if (isMac){
  const fileDir = path.join(app.getPath('home'), 'Library', 'Caches', 'tianshu-updater','pending')
  if (fs.existsSync(fileDir)) {
    fs.rmdirSync(fileDir, { recursive: true });
  }
}

autoUpdater.setFeedURL({
  provider: "generic", 
  url: "http://lhano.cn:8732/"
});

autoUpdater.autoDownload = false

// autoUpdater.on('error', (error) => {
//   dialog.showErrorBox('Update Error', `Message: ${error}`);
// });


autoUpdater.on("update-available", function (info) {
  
  dialog.showMessageBox({
    message: `发现新的版本，是否下载 ${info.version}。`,
    buttons: ["下载", "取消"]
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.downloadUpdate();
    }
  });
});

autoUpdater.on("update-not-available", function (info) {
  if (manual_check) {
  dialog.showMessageBox({
    message: `没有发现新版本`,
    buttons: ["OK"]
});
  }
});

autoUpdater.on("download-progress", (progressObj) => {
  const percentage = progressObj.percent / 100;
  win.setProgressBar(percentage);
});


autoUpdater.on("update-downloaded", function (info) {
  win.setProgressBar(-1);
  dialog.showMessageBox({
    message: `新版本${info.version}下载完毕，是否安装。`,
    buttons: ["安装", "取消"]
  }).then((result) => {
    if (result.response === 0) {
      if (isMac){
        // mac安装包由于没有签名，无法直接安装，只有把dmg伪造成zip，下载后改回dmg，然后运行安装
        const filePath = path.join(app.getPath('home'), 'Library', 'Caches', 'tianshu-updater','pending',`Tianshu-${info.version}-mac.zip`);
        if (fs.existsSync(filePath)) {
          const newFilePath = filePath.replace('.zip', '.dmg');
          fs.renameSync(filePath, newFilePath);
          shell.openPath(newFilePath);
          app.quit();
        }
      }else{
        autoUpdater.quitAndInstall()
      }
    }
  });
});

autoUpdater.checkForUpdatesAndNotify()

async function createWindow(transparent = isLock, x = 1000, y = 200, w = 500, h = 800, frame = true, shadow = true, top = false) {
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
    resizable: true,
    show: false,
    skipTaskbar: false,
    minWidth: 400,
    minHeight: 400,
    webPreferences: {

      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      // nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      nodeIntegration: true,
      contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION,
      enableRemoteModule: true,
      webSecurity: false,
      webviewTag: true,
      zoomFactor: 1
    }
  })
  require('@electron/remote/main').enable(win.webContents);
  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    await win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
    // await win.loadURL("https://chat.openai.com/")
    // if (!process.env.IS_TEST) win.webContents.openDevTools()
  } else {
    createProtocol('app')
    // Load the index.html when not in development
    win.loadURL('app://./index.html')

  } 
  shiftMode = false

  win.on('close', (event) => {

    if (winBoundSave) {
      win.setBounds(winBoundSave)
      followMode = false
    }

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

  win.on('hide', () => {
    // 恢复winBoundSave中储存的位置和大小
    if (winBoundSave) {
      win.setBounds(winBoundSave)
      followMode = false
      win.webContents.send('follow-mode', followMode);
    }
  })

  // 监听窗口失去焦点的事件
  win.on('blur', () => {
    // 启动计时器，在一段时间后隐藏窗口
    if (followMode && !streaming) {
      if (isMac) {
        const elapsedTime = Date.now() - blurTimeStart;
        if (elapsedTime > 1000) {
          win.hide()
        }
      } else {
        if (winBoundSave) {
          followMode = false
          win.webContents.send('follow-mode', followMode);
          win.setBounds(winBoundSave)
        }
        win.minimize()
      }
    }

    if (autoHide && isLock) {
      hideTimer = setTimeout(() => {
        if (isMac) {
          win.hide()
        } else {
          win.minimize()
        }
      }, 60000) // 60秒后隐藏窗口
    }
  }
  )

  win.on('show', () => {

    if (followMode && isMac) {
      blurTimeStart = Date.now()
    }

    setTimeout(() => {
      win.focus();
    }, 200);
  });

  win.on('focus', () => {
    // 取消计时器
    clearTimeout(hideTimer)
  })

  require('@electron/remote/main').enable(win.webContents);
}



app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win) {
    win.show();
  }
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
  require('@electron/remote/main').enable(win.webContents);


  // 设置托盘
  tray = new Tray(path.join(__static, 'tray.png'))
  tray.on('click', () => {
      win.show() // 显示窗口

    setTimeout(() => {
      win.focus()
    }, 200)
  })

  // 捕获异常
  app.on('uncaughtException', (error) => {
    console.error('Caught unhandled exception:', error);
  });

  const contextMenu = Menu.buildFromTemplate([
    // { label: '显示', click: () => win.show() },
    { label: '隐藏', click: () => win.hide() },
    { label: '复位', click: () => win.setBounds({ x: 1000, y: 200, width: 400, height: 800 }) },
    { label: '导出当前页', click: () => win.webContents.send('export-page') },
    { type: 'separator' },
    { label: '检查更新', click: () => {
      manual_check = true;
      autoUpdater.checkForUpdatesAndNotify()}
    },
    { type: 'separator' },
    { label: '重启', click: () => reloadWindow() },
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

  // 全局Chat快捷键
  updateAskHotkey(defaultAskHotkey);

})

function wait(ms) {
  const endTime = Date.now() + ms;
  while (Date.now() < endTime) {
  }
}


// 设置全局快捷键的函数，传入快捷键参数，先注销快捷键，再注册快捷键
function updateAskHotkey(key) {
  globalShortcut.unregisterAll();
  const isRegistered = globalShortcut.register(key, () => {

    //判断如果是Lock状态，1、先存储窗口的大小和位置；2、同时将窗口的大小设置为500x400；3、同时将窗口的坐标移动到鼠标位置
    if (isLock) {
      if (!followMode) {
        winBoundSave = win.getBounds();
      }

      followMode = true;
      // 发送消息给渲染进程，目前followMode的状态
      win.webContents.send('follow-mode', followMode);
    }

    let cmd = "";
    if (isMac) {
      const scptPath = path.join(__static, "copyCmd.scpt");
      cmd = `osascript ${scptPath}`;
    } else {
      const scptPath = path.join(__static, "copyCmd.vbs");
      cmd = `cscript ${scptPath}`;
    }

    try {
      const child = spawn(cmd, { shell: true });
      const timeout = setTimeout(() => {
        child.kill();
      }, 1000);

      child.on("exit", (code, signal) => {
        clearTimeout(timeout);
        let text = clipboard.readText();
        win.webContents.send("clipboard-data", text);
        clipboardSave = text;
        if (followMode) {
          if (win.isMinimized()) {
            win.restore();
          }

          const mouse = screen.getCursorScreenPoint();
          if (isMac) {
            win.setPosition(Math.floor(mouse.x), Math.floor(mouse.y - 200));
            win.setSize(400, 400);
          } else {
            win.setBounds({ x: Math.floor(mouse.x), y: Math.floor(mouse.y - 200), width: 400, height: 400 });
          }
        }
        win.show();
      });
    } catch (e) {
      console.log(e);
    }

  });
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
  if (braindoorProcess) {
    braindoorProcess.kill();
    braindoorProcess = null;
  }
  globalShortcut.unregisterAll();
  app.removeAllListeners('some-event');

  

})

app.on('will-quit', () => {
  app.removeAllListeners('some-event');
});



// 只是reload，不切换窗口模式
function reloadWindow() {
  if (isLock) { //执行锁定
    const bounds = win.getBounds();
    shiftMode = true
    win.close()
    createWindow(true, bounds.x, bounds.y, bounds.width, bounds.height, false, false, true)
    win.setResizable(false)
    win.once('ready-to-show', () => {
      win.show()
    })
  } else {
    const bounds = win.getBounds();
    shiftMode = true
    win.close()
    createWindow(false, bounds.x, bounds.y, bounds.width, bounds.height, true, true, false)
    win.setResizable(true)
    win.once('ready-to-show', () => {
      win.show()
    })
  }
}


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

// 接收来自渲染进程的消息webDrawerOpen，获得该消息后设置代理
ipcMain.on('webDrawerOpen', async (event, param1) => {
  try {
    isOpenExternal = false;

    //从~/brainoodr/config.yaml中读取proxy字段，作为代理的地址
    const configPath = path.join(app.getPath('home'), 'braindoor', 'config.yaml');
    const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
    const proxy = config.proxy;
    const proxyRules = { proxyRules: `http=${proxy};https=${proxy}` };
    await session.defaultSession.setProxy(proxyRules);
  } catch (error) {
    dialog.showErrorBox('Error', error.message);
  }
})

// 接收来自渲染进程的消息webDrawerOpen，获得该消息后取消代理
ipcMain.on('webDrawerClose', async (event, param1) => {
  isOpenExternal = true;
  const proxyRules = { proxyRules: 'direct://' };
  await session.defaultSession.setProxy(proxyRules);
})

// 外部打开链接
app.on('web-contents-created', (e, webContents) => {
  webContents.setWindowOpenHandler(({ url }) => {
    if (isOpenExternal) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
  });
  webContents.on('will-navigate', (event, url) => {
    if (isOpenExternal) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
});


//接受渲染进程发来的save-export-page消息，将提供的文件名和内容提示用户打开对话框，选择保存的位置，然后保存。arg.fileName中作为默认的文件名
ipcMain.on('save-export-page', (event, arg) => {
  const options = {
    title: '保存文件',
    defaultPath: arg.fileName,
    filters: [{ name: 'Text', extensions: ['txt'] }]
  };
  dialog.showSaveDialog(win, options).then(result => {
    if (!result.canceled) {
      fs.writeFileSync(result.filePath, arg.content);
    }
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
  let resoursePath = path.join(__dirname, '..');
  let braindoorPath = null;
  let workPath = path.join(resoursePath, 'braindoor');
  if (process.env.NODE_ENV === 'development') {
    braindoorPath = '/Users/lhan/Projects/BrainDoor/dist/braindoor/braindoor'
    braindoorProcess = spawn(braindoorPath, { shell: false, env: process.env });
  } else {
    braindoorPath = path.join(resoursePath, 'braindoor/braindoor');
    braindoorProcess = spawn(braindoorPath, { shell: false, cwd: workPath, env: process.env });
  }
  braindoorProcess.on('error', (error) => {
    console.log(`Error: ${error.message}`);
  });
  braindoorProcess.stdout.on('data', (data) => {
    console.log(`Output: ${data}`);
  });
  braindoorProcess.stderr.on('data', (data) => {
    console.log(`Error Output: ${data}`);
  });
  console.log('Run braindoor.');
  console.log('Run braindoor.');
};

const braindoorLogToRender = () => {
  if (!braindoorProcess) {
    return;
  }
  // braindoorProcess.stdout.on('data', (data) => {
  //   console.log(`braindoor: ${data}`);
  //   win.webContents.send('message-from-main', `stdout: ${data}`);
  // });
  // braindoorProcess.stderr.on('data', (data) => {
  //   console.error(`braindoor: ${data}`);
  //   win.webContents.send('message-from-main', `${data}`);
  // });
  // braindoorProcess.on('close', (code) => {
  //   console.log(`braindoor退出，退出码 ${code}`);
  //   win.webContents.send('message-from-main', `braindoor退出，退出码 ${code}`);
  //   braindoorProcess = null;
  // });
  // braindoorProcess.on('error', (err) => {
  //   console.error(`启动braindoor出错：${err}`);
  //   win.webContents.send('message-from-main', `braidoor出错：${err}`);
  //   braindoorProcess = null;
  // });
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


// 接收来自渲染进程的clickMinimize消息，先setbounds，然后minimize
ipcMain.on('clickMinimize', (event, arg) => {
  if (winBoundSave) {
    followMode = false
    win.webContents.send('follow-mode', followMode);
    win.setBounds(winBoundSave)
  }
  if (arg!="only-restore"){
    win.minimize();
  }
})

// follom-mode下提交后，取消follow-mode,然后窗口设置为winBoundSave
ipcMain.on('follow-mode-submit', (event, arg) => {
  followMode = false
  win.webContents.send('follow-mode', followMode);
  win.setBounds(winBoundSave)
}
)


// 接收来自渲染进程的zoom消息，将窗口大小设置为屏幕大小的3/4，并且居中
ipcMain.on('zoom', (event, arg) => {
  // 存储当前窗口的大小和位置
  winBoundSave = win.getBounds();
  // 获取窗口的当前位置
  const currentPoint = { x: winBoundSave.x, y: winBoundSave.y };
  // 根据窗口的位置得到最近的显示屏
  const display = screen.getDisplayNearestPoint(currentPoint);
  // 获取当前屏幕的工作区域尺寸
  const { width, height } = display.workAreaSize;
  win.setBounds({
    x: parseInt(width / 6),
    y: parseInt(height / 10),
    width: parseInt(width * 2 / 3),
    height: parseInt(height * 4 / 5)
  });
  win.center();
})

// 接收来自渲染进程的zoomRestore消息，将窗口恢复winBoundSave的大小和位置
ipcMain.on('zoomRestore', (event, arg) => {
  win.setBounds(winBoundSave);
})

// 接收来自渲染进程的streming，用于判断是否在follow模式下隐藏窗口
ipcMain.on('streaming', (event, value) => {
  streaming = value;
});

app.setName('Tianshu')