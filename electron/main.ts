import { app, BrowserWindow, WebContentsView, ipcMain } from 'electron'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Prevent duplicate instances fighting over cache and SQLite database locks
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
  process.exit(0)
}

// Store user data in LOCALAPPDATA like Chrome/Arc to prevent Roaming cache access locks
const localAppData = process.env.LOCALAPPDATA || app.getPath('appData')
app.setPath('userData', path.join(localAppData, 'NOIR_Browser'))

// Hardware acceleration & GPU options for maximum fluidity
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder')
app.commandLine.appendSwitch('ignore-gpu-blocklist')
app.commandLine.appendSwitch('enable-gpu-rasterization')
app.commandLine.appendSwitch('enable-zero-copy')

let mainWindow: BrowserWindow | null = null

interface TabData {
  id: string
  view: WebContentsView
  url: string
  title: string
  favicon?: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  spaceId: string
  pinned: boolean
}

const tabs = new Map<string, TabData>()
let activeTabId: string | null = null

let layoutState = {
  isSidebarOpen: true,
  isImmersion: false,
  sidebarWidth: 260,
  topbarHeight: 44
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 920,
    minHeight: 600,
    frame: false,
    backgroundColor: '#000000',
    backgroundMaterial: 'acrylic',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Window state events
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximizedChanged', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximizedChanged', false)
  })

  // Window resize updates WebContentsView bounds
  mainWindow.on('resize', () => {
    updateActiveTabBounds()
  })

  // Relay renderer console logs to main process stdout
  mainWindow.webContents.on('console-message', (_, level, message, line, sourceId) => {
    console.log(`[Renderer]: ${message}`)
  })

  // Load renderer
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function updateActiveTabBounds() {
  if (!activeTabId || !mainWindow) return
  const tab = tabs.get(activeTabId)
  if (!tab) return

  const [winWidth, winHeight] = mainWindow.getContentSize()

  const x = layoutState.isImmersion ? 0 : (layoutState.isSidebarOpen ? layoutState.sidebarWidth : 0)
  const y = layoutState.isImmersion ? 0 : layoutState.topbarHeight
  const width = Math.max(10, winWidth - x)
  const height = Math.max(10, winHeight - y)

  tab.view.setBounds({ x, y, width, height })
}

function registerTabShortcuts(view: WebContentsView) {
  view.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return

    // Alt + 1..9 (Spaces)
    if (input.alt && !input.control && !input.meta) {
      const num = parseInt(input.key, 10)
      if (num >= 1 && num <= 9) {
        event.preventDefault()
        mainWindow?.webContents.send('shortcut:switchSpace', num - 1)
        return
      }
    }

    // Ctrl + T or Ctrl + L (Command / Address bar)
    if ((input.control || input.meta) && (input.key.toLowerCase() === 't' || input.key.toLowerCase() === 'l')) {
      event.preventDefault()
      mainWindow?.webContents.send('shortcut:openCommand')
      return
    }

    // Ctrl + W (Close Active Tab)
    if ((input.control || input.meta) && input.key.toLowerCase() === 'w') {
      event.preventDefault()
      if (activeTabId) closeTab(activeTabId)
      return
    }

    // Ctrl + B (Toggle Sidebar)
    if ((input.control || input.meta) && input.key.toLowerCase() === 'b') {
      event.preventDefault()
      mainWindow?.webContents.send('shortcut:toggleSidebar')
      return
    }

    // Ctrl + S (Toggle Immersion)
    if ((input.control || input.meta) && input.key.toLowerCase() === 's') {
      event.preventDefault()
      mainWindow?.webContents.send('shortcut:toggleImmersion')
      return
    }
  })
}

function createTab(initialUrl?: string, spaceId = 'space_1', pinned = false): string {
  const tabId = 'tab_' + Math.random().toString(36).substring(2, 9)

  const view = new WebContentsView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      spellcheck: true
    }
  })

  registerTabShortcuts(view)

  const tabData: TabData = {
    id: tabId,
    view,
    url: initialUrl || '',
    title: initialUrl ? 'Loading...' : 'New Tab',
    favicon: '',
    isLoading: !!initialUrl,
    canGoBack: false,
    canGoForward: false,
    spaceId,
    pinned
  }

  tabs.set(tabId, tabData)

  const notifyUpdated = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tab:updated', {
        id: tabData.id,
        url: tabData.url,
        title: tabData.title,
        favicon: tabData.favicon,
        isLoading: tabData.isLoading,
        canGoBack: tabData.canGoBack,
        canGoForward: tabData.canGoForward,
        spaceId: tabData.spaceId,
        pinned: tabData.pinned
      })
    }
  }

  // Send immediate tab info to renderer
  notifyUpdated()

  const { webContents } = view
  
  webContents.setWindowOpenHandler(({ url }) => {
    createTab(url, tabData.spaceId, false)
    return { action: 'deny' }
  })

  webContents.on('did-start-loading', () => {
    tabData.isLoading = true
    notifyUpdated()
  })

  webContents.on('did-stop-loading', () => {
    tabData.isLoading = false
    tabData.canGoBack = webContents.navigationHistory.canGoBack()
    tabData.canGoForward = webContents.navigationHistory.canGoForward()
    notifyUpdated()
  })

  webContents.on('page-title-updated', (_, title) => {
    tabData.title = title || 'Untitled'
    notifyUpdated()
  })

  webContents.on('page-favicon-updated', (_, favicons) => {
    if (favicons && favicons.length > 0) {
      tabData.favicon = favicons[0]
      notifyUpdated()
    }
  })

  webContents.on('did-navigate', (_, navUrl) => {
    tabData.url = navUrl
    tabData.canGoBack = webContents.navigationHistory.canGoBack()
    tabData.canGoForward = webContents.navigationHistory.canGoForward()
    notifyUpdated()
  })

  webContents.on('did-navigate-in-page', (_, navUrl) => {
    tabData.url = navUrl
    notifyUpdated()
  })

  if (initialUrl && initialUrl.trim()) {
    let target = initialUrl.trim()
    if (!target.startsWith('http://') && !target.startsWith('https://') && !target.startsWith('about:')) {
      if (target.includes('.') && !target.includes(' ')) {
        target = 'https://' + target
      } else {
        target = `https://www.google.com/search?q=${encodeURIComponent(target)}`
      }
    }
    view.webContents.loadURL(target)
  }

  switchTab(tabId)
  return tabId
}

function switchTab(tabId: string): boolean {
  if (!mainWindow || !tabs.has(tabId)) return false
  const newTab = tabs.get(tabId)!

  // Remove previous view
  if (activeTabId && activeTabId !== tabId && tabs.has(activeTabId)) {
    const prev = tabs.get(activeTabId)!
    try {
      mainWindow.contentView.removeChildView(prev.view)
    } catch (_) {}
  }

  activeTabId = tabId
  try {
    mainWindow.contentView.addChildView(newTab.view)
    updateActiveTabBounds()
    mainWindow.webContents.send('tab:activated', tabId)
  } catch (err) {
    console.error('Error attaching view:', err)
  }

  return true
}

function closeTab(tabId: string): boolean {
  if (!tabs.has(tabId) || !mainWindow) return false
  const tab = tabs.get(tabId)!
  
  if (activeTabId === tabId) {
    try {
      mainWindow.contentView.removeChildView(tab.view)
    } catch (_) {}
    
    tabs.delete(tabId)
    const remaining = Array.from(tabs.keys())
    if (remaining.length > 0) {
      switchTab(remaining[remaining.length - 1])
    } else {
      activeTabId = null
      mainWindow.webContents.send('tab:activated', null)
    }
  } else {
    tabs.delete(tabId)
  }

  mainWindow.webContents.send('tab:closed', tabId)
  return true
}

// IPC Handlers
ipcMain.on('window:minimize', () => {
  console.log('[Main] minimize window')
  mainWindow?.minimize()
})

ipcMain.on('window:maximize', () => {
  console.log('[Main] toggle maximize')
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.on('window:close', () => {
  console.log('[Main] close window')
  mainWindow?.close()
})

ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)

ipcMain.handle('tab:create', (_, { url, spaceId, pinned }) => {
  console.log('[Main] create tab:', url)
  return createTab(url, spaceId, pinned)
})

ipcMain.handle('tab:switch', (_, id: string) => switchTab(id))
ipcMain.handle('tab:close', (_, id: string) => closeTab(id))

ipcMain.handle('tab:navigate', (_, { id, url }) => {
  console.log('[Main] navigate tab:', id, url)
  let tab = tabs.get(id)
  if (!tab) {
    return createTab(url, 'space_1', false)
  }
  
  let target = (url || '').trim()
  if (!target.startsWith('http://') && !target.startsWith('https://')) {
    if (target.includes('.') && !target.includes(' ')) {
      target = 'https://' + target
    } else {
      target = `https://www.google.com/search?q=${encodeURIComponent(target)}`
    }
  }
  tab.url = target
  tab.view.webContents.loadURL(target)
  switchTab(id)
})

ipcMain.handle('tab:goBack', (_, id: string) => {
  const tab = tabs.get(id)
  if (tab && tab.view.webContents.navigationHistory.canGoBack()) {
    tab.view.webContents.navigationHistory.goBack()
  }
})

ipcMain.handle('tab:goForward', (_, id: string) => {
  const tab = tabs.get(id)
  if (tab && tab.view.webContents.navigationHistory.canGoForward()) {
    tab.view.webContents.navigationHistory.goForward()
  }
})

ipcMain.handle('tab:reload', (_, id: string) => {
  tabs.get(id)?.view.webContents.reload()
})

ipcMain.on('layout:update', (_, { isSidebarOpen, isImmersion }) => {
  layoutState.isSidebarOpen = isSidebarOpen
  layoutState.isImmersion = isImmersion
  updateActiveTabBounds()
})

ipcMain.on('view:setVisible', (_, visible: boolean) => {
  if (activeTabId && tabs.has(activeTabId)) {
    tabs.get(activeTabId)?.view.setVisible(visible)
  }
})

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.whenReady().then(() => {
  createWindow()

  // Clean startup: NO default google page! Starts clean on AMOLED canvas!
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
