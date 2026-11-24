import { contextBridge, ipcRenderer } from 'electron'

export interface TabInfo {
  id: string
  url: string
  title: string
  favicon?: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
  spaceId: string
  pinned: boolean
}

const noirAPI = {
  // Window Controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    const sub = (_: any, val: boolean) => callback(val)
    ipcRenderer.on('window:maximizedChanged', sub)
    return () => ipcRenderer.removeListener('window:maximizedChanged', sub)
  },

  // Tabs management
  createTab: (url?: string, spaceId?: string, pinned?: boolean): Promise<string> => 
    ipcRenderer.invoke('tab:create', { url, spaceId, pinned }),
  switchTab: (id: string): Promise<boolean> => 
    ipcRenderer.invoke('tab:switch', id),
  closeTab: (id: string): Promise<boolean> => 
    ipcRenderer.invoke('tab:close', id),
  navigateTab: (id: string, url: string): Promise<void> => 
    ipcRenderer.invoke('tab:navigate', { id, url }),
  goBack: (id: string): Promise<void> => 
    ipcRenderer.invoke('tab:goBack', id),
  goForward: (id: string): Promise<void> => 
    ipcRenderer.invoke('tab:goForward', id),
  reloadTab: (id: string): Promise<void> => 
    ipcRenderer.invoke('tab:reload', id),

  // Layout & Visibility
  setLayout: (layout: { isSidebarOpen: boolean; isImmersion: boolean }) => 
    ipcRenderer.send('layout:update', layout),
  setViewVisible: (visible: boolean) => 
    ipcRenderer.send('view:setVisible', visible),

  // Events
  onTabUpdated: (callback: (tab: TabInfo) => void) => {
    const sub = (_: any, tab: TabInfo) => callback(tab)
    ipcRenderer.on('tab:updated', sub)
    return () => ipcRenderer.removeListener('tab:updated', sub)
  },
  onTabActivated: (callback: (tabId: string) => void) => {
    const sub = (_: any, tabId: string) => callback(tabId)
    ipcRenderer.on('tab:activated', sub)
    return () => ipcRenderer.removeListener('tab:activated', sub)
  },
  onTabClosed: (callback: (tabId: string) => void) => {
    const sub = (_: any, tabId: string) => callback(tabId)
    ipcRenderer.on('tab:closed', sub)
    return () => ipcRenderer.removeListener('tab:closed', sub)
  },
  onShortcut: (shortcut: string, callback: (...args: any[]) => void) => {
    const sub = (_: any, ...args: any[]) => callback(...args)
    ipcRenderer.on(shortcut, sub)
    return () => ipcRenderer.removeListener(shortcut, sub)
  }
}

contextBridge.exposeInMainWorld('noirAPI', noirAPI)
