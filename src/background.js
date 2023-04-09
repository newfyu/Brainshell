'use strict'

import { app, protocol, BrowserWindow, ipcMain, Menu } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'

// import installExtension, { VUEJS3_DEVTOOLS } from 'electron-devtools-installer'
const isDevelopment = process.env.NODE_ENV !== 'production'

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
])

let win = null
let isLock = false
async function createWindow(transparent = isLock, x = 0, y = 0, w = 500, h = 900) {
  // Create the browser window.
  win = new BrowserWindow({
    x: x,
    y: y,
    width: w,
    height: h,
    frame: true,
    transparent: transparent,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: {

      // Use pluginOptions.nodeIntegration, leave this alone
      // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
      // nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      nodeIntegration: true,
      contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION,
      enableRemoteModule: true,
      webSecurity: false,
      zoomFactor:1.0
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
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})


app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
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
  createWindow()
  
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


ipcMain.on('render2main', (event, param1) => {
  console.log(param1)
  if (param1 === 'reloadWindow') {
    if (!isLock) {
      const bounds = win.getBounds();
      win.close()
      createWindow(true, bounds.x, bounds.y, bounds.width, bounds.height)
      isLock = true
      win.setResizable(false)
    } else {
      const bounds = win.getBounds();
      win.close()
      createWindow(false, bounds.x, bounds.y, bounds.width, bounds.height)
      isLock = false
      win.setResizable(true)
    }
  }
})

// app.whenReady().then(() => {
//   // 获取视图菜单
//   const template = [
//     {
//       label: 'View',
//       submenu: [],
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