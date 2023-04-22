'use strict'

import { app, protocol, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
let path = require('path');
const { spawn } = require('child_process');

// import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer'
const isDevelopment = process.env.NODE_ENV !== 'production'

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
])

let win = null
let isLock = false
let braindoorProcess = null;
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
  }

  // win.on('closed', () => {
  //   win = null
  // })
  
  // 监听窗口关闭事件
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
  if (process.platform !== 'darwin') {
    app.quit()
  }
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
  // if (isDevelopment && !process.env.IS_TEST) {
  //   // Install Vue Devtools
  //   try {
  //     await installExtension(VUEJS3_DEVTOOLS)
  //   } catch (e) {
  //     console.error('Vue Devtools failed to install:', e.toString())
  //   }
  // }
  // if (process.env.NODE_ENV === 'development') {
  //   devtools.connect(/* host, port */)
  // }
  startBraindoor()
  createWindow()
  win.once('ready-to-show', () => {
    win.show();
    braindoorLogToRender();
  })


})

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


// lock
ipcMain.on('render2main', (event, param1) => {
  if (param1 === 'reloadWindow') {
    if (!isLock) { //执行锁定
      const bounds = win.getBounds();
      win.close()
      createWindow(true, bounds.x, bounds.y, bounds.width, bounds.height, false, false, true)
      isLock = true
      win.setResizable(false)
      win.once('ready-to-show', () => {
        win.show()
      })
      // Lock模式下失去焦点后隐藏聊天内容
      // win.on('blur', () => {
      //   setTimeout(() => {
      //     if (!win.isFocused()) {
      //       win.webContents.send('message-from-main', 'blurLongTime');
      //     }
      //   }, 120000);
      // })
    } else {
      const bounds = win.getBounds();
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

// 禁用菜单
// app.whenReady().then(() => {
//   // 获取视图菜单
//   const template = [
//     {
//       label: 'View',
//       submenu: [

//       ],
//       enabled: false // 设置为false禁用菜单
//     },
//     {label: 'Window',
//       role: 'window',
//       submenu: [
//         { label: 'Minimize', role: 'minimize' },
//         { label: 'Close', role: 'close' }
//       ]}
//   ]

//   const menu = Menu.buildFromTemplate(template)
//   Menu.setApplicationMenu(menu)
// });


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

const startBraindoor = () => {
  if (braindoorProcess) {
    console.log('Braindoor is already running.');
    return;
  }
  let resoursePath = path.join(__dirname, '..');
  let braindoorPath = null;
  let workPath = path.join(resoursePath, 'braindoor');
  if (process.env.NODE_ENV === 'development') {
    braindoorPath = '/Users/lhan/Projects/BrainDoor/dist/braindoor/braindoor'
  } else {
    braindoorPath = path.join(resoursePath, 'braindoor/braindoor');
  }

  braindoorProcess = spawn(braindoorPath, { shell: false, cwd: workPath});
  console.log('Run braindoor.');
};

const braindoorLogToRender = () => {
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

app.on('before-quit', () => {
  braindoorProcess.kill();
});

app.on('quit', () => {
  braindoorProcess.kill();
});


