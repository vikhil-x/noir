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

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface NoirAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void
  
  createTab: (url?: string, spaceId?: string, pinned?: boolean) => Promise<string>
  switchTab: (id: string) => Promise<boolean>
  closeTab: (id: string) => Promise<boolean>
  navigateTab: (id: string, url: string) => Promise<void>
  goBack: (id: string) => Promise<void>
  goForward: (id: string) => Promise<void>
  reloadTab: (id: string) => Promise<void>
  
  setLayout: (layout: { isSidebarOpen: boolean; isImmersion: boolean }) => void
  setViewVisible: (visible: boolean) => void
  
  // Adblocker
  getAdblockStats: () => Promise<{ enabled: boolean; count: number }>
  toggleAdblock: (enabled: boolean) => Promise<boolean>
  onAdblockCount: (callback: (count: number) => void) => () => void
  
  onTabUpdated: (callback: (tab: TabInfo) => void) => () => void
  onTabActivated: (callback: (tabId: string) => void) => () => void
  onTabClosed: (callback: (tabId: string) => void) => () => void
  onShortcut: (shortcut: string, callback: (...args: any[]) => void) => () => void
}

declare global {
  interface Window {
    noirAPI?: NoirAPI
  }
}
