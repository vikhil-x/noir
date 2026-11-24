import React, { useState, useEffect, useRef } from 'react'
import {
  Globe,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Search,
  Minus,
  Square,
  Copy,
  PanelLeftClose,
  PanelLeft,
  SlidersHorizontal,
  Sun,
  Moon,
  Maximize2,
  FolderDown,
  ArrowRight,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react'
import { TabInfo } from './types/noir'

interface Space {
  id: string
  name: string
  code: string
  icon: string
}

const INITIAL_SPACES: Space[] = [
  { id: 'space_1', name: 'CORE', code: '01', icon: '●' }
]

export default function App() {
  const [tabs, setTabs] = useState<TabInfo[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  
  // Spaces: Starts with default CORE space only
  const [spaces, setSpaces] = useState<Space[]>(INITIAL_SPACES)
  const [activeSpaceId, setActiveSpaceId] = useState<string>('space_1')
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isImmersionMode, setIsImmersionMode] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [homeSearchInput, setHomeSearchInput] = useState('')
  const [isLightMode, setIsLightMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)

  // Native Adblocker Shield State
  const [adblockCount, setAdblockCount] = useState(0)
  const [isAdblockEnabled, setIsAdblockEnabled] = useState(true)
  const [showShieldPopup, setShowShieldPopup] = useState(false)

  const urlInputRef = useRef<HTMLInputElement>(null)
  const activeTab = tabs.find(t => t.id === activeTabId)

  // Notify Electron main process when layout changes (Sidebar / Immersion)
  useEffect(() => {
    window.noirAPI?.setLayout({
      isSidebarOpen,
      isImmersion: isImmersionMode
    })
  }, [isSidebarOpen, isImmersionMode])

  // Hide/Show WebContentsView when modal is open
  useEffect(() => {
    window.noirAPI?.setViewVisible(!showSettings && !showShieldPopup)
  }, [showSettings, showShieldPopup])

  // Sync address bar text when active tab changes
  useEffect(() => {
    if (activeTab?.url) {
      setUrlInput(activeTab.url)
    } else {
      setUrlInput('')
    }
  }, [activeTabId, activeTab?.url])

  // Listen to Electron events
  useEffect(() => {
    if (!window.noirAPI) return

    const unsubUpdated = window.noirAPI.onTabUpdated((updatedTab) => {
      setTabs(prev => {
        const index = prev.findIndex(t => t.id === updatedTab.id)
        if (index >= 0) {
          const next = [...prev]
          next[index] = updatedTab
          return next
        } else {
          return [...prev, updatedTab]
        }
      })
    })

    const unsubActivated = window.noirAPI.onTabActivated((tabId) => {
      setActiveTabId(tabId)
    })

    const unsubClosed = window.noirAPI.onTabClosed((closedId) => {
      setTabs(prev => prev.filter(t => t.id !== closedId))
    })

    const unsubMaximized = window.noirAPI.onMaximizedChange((max) => {
      setIsMaximized(max)
    })

    window.noirAPI.isMaximized().then(setIsMaximized)

    window.noirAPI.getAdblockStats().then(stats => {
      setIsAdblockEnabled(stats.enabled)
      setAdblockCount(stats.count)
    })

    const unsubAdblock = window.noirAPI.onAdblockCount((count: number) => {
      setAdblockCount(count)
    })

    // Global shortcut handlers forwarded from Electron before-input-event
    const unsubSwitchSpace = window.noirAPI.onShortcut('shortcut:switchSpace', (spaceIndex: number) => {
      setSpaces(currentSpaces => {
        if (currentSpaces[spaceIndex]) {
          setActiveSpaceId(currentSpaces[spaceIndex].id)
        }
        return currentSpaces
      })
    })

    const unsubOpenCommand = window.noirAPI.onShortcut('shortcut:openCommand', () => {
      urlInputRef.current?.focus()
      urlInputRef.current?.select()
    })

    const unsubCloseTab = window.noirAPI.onShortcut('shortcut:closeTab', () => {
      if (activeTabId) handleCloseTab(activeTabId)
    })

    const unsubToggleSidebar = window.noirAPI.onShortcut('shortcut:toggleSidebar', () => {
      setIsSidebarOpen(prev => !prev)
    })

    const unsubToggleImmersion = window.noirAPI.onShortcut('shortcut:toggleImmersion', () => {
      setIsImmersionMode(prev => !prev)
    })

    return () => {
      unsubUpdated()
      unsubActivated()
      unsubClosed()
      unsubMaximized()
      unsubSwitchSpace()
      unsubOpenCommand()
      unsubCloseTab()
      unsubToggleSidebar()
      unsubToggleImmersion()
      unsubAdblock()
    }
  }, [activeTabId])

  // Local window keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + 1..9 (Spaces)
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const num = parseInt(e.key, 10)
        if (num >= 1 && num <= 9) {
          e.preventDefault()
          const spaceIdx = num - 1
          if (spaces[spaceIdx]) {
            setActiveSpaceId(spaces[spaceIdx].id)
          }
          return
        }
      }

      // Ctrl + T / Ctrl + L (Focus URL pill)
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 't' || e.key.toLowerCase() === 'l')) {
        e.preventDefault()
        urlInputRef.current?.focus()
        urlInputRef.current?.select()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        setIsImmersionMode(prev => !prev)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setIsSidebarOpen(prev => !prev)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault()
        if (activeTabId) handleCloseTab(activeTabId)
      } else if (e.key === 'Escape') {
        setShowSettings(false)
        setShowShieldPopup(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTabId, spaces])

  const handleNavigate = (query: string) => {
    const target = query.trim()
    if (!target) return

    if (activeTabId && window.noirAPI) {
      window.noirAPI.navigateTab(activeTabId, target)
    } else if (window.noirAPI) {
      window.noirAPI.createTab(target, activeSpaceId, false)
    }
  }

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleNavigate(urlInput)
  }

  const handleHomeSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!homeSearchInput.trim()) return
    handleNavigate(homeSearchInput)
    setHomeSearchInput('')
  }

  const handleCreateNewTab = (url?: string) => {
    if (window.noirAPI) {
      window.noirAPI.createTab(url, activeSpaceId, false)
    }
  }

  const handleSwitchTab = (id: string) => {
    setActiveTabId(id)
    if (window.noirAPI) {
      window.noirAPI.switchTab(id)
    }
  }

  const handleCloseTab = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (window.noirAPI) {
      window.noirAPI.closeTab(id)
    }
  }

  const handleAddSpace = () => {
    if (spaces.length >= 9) return
    const nextNum = spaces.length + 1
    const code = nextNum < 10 ? `0${nextNum}` : `${nextNum}`
    const names = ['CORE', 'WORK', 'DEV', 'VAULT', 'STUDY', 'MEDIA', 'SYNC', 'OPS', 'LAB']
    const icons = ['●', '▲', '■', '◆', '◈', '✦', '▲', '●', '■']
    const newSpace: Space = {
      id: `space_${nextNum}`,
      name: names[nextNum - 1] || `SPACE ${nextNum}`,
      code,
      icon: icons[nextNum - 1] || '●'
    }
    setSpaces([...spaces, newSpace])
    setActiveSpaceId(newSpace.id)
  }

  const currentSpaceTabs = tabs.filter(t => t.spaceId === activeSpaceId && !t.pinned)
  const pinnedTabs = tabs.filter(t => t.pinned && t.spaceId === activeSpaceId)

  return (
    <div className={`h-screen w-screen flex flex-col ${isLightMode ? 'bg-[#F2F2F2] text-[#111111]' : 'bg-[#000000] text-[#FFFFFF]'} overflow-hidden select-none`}>
      {/* Top Header Bar */}
      <header className={`h-11 flex items-center justify-between px-2.5 border-b shrink-0 ${isLightMode ? 'border-[#E0E0E0] bg-[#FAFAFA]' : 'border-[#1A1A1A] bg-[#000000]'} z-40 relative`}>
        {/* Left Section: Sidebar Toggle & Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsSidebarOpen(prev => !prev)}
            className="p-1.5 hover:bg-white/10 active:bg-white/15 rounded text-white/70 hover:text-white transition-colors cursor-pointer"
            title="Toggle Sidebar (Ctrl+B)"
          >
            {isSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
          </button>

          <div className="flex items-center gap-2 select-none">
            <span className="w-2 h-2 rounded-full bg-noir-red animate-pulse" />
            <span className="font-dot text-xs tracking-wider font-bold">NOIR</span>
            <span className="text-[9px] text-white/40 font-mono">v0.1</span>
          </div>
        </div>

        {/* Draggable spacer handle 1 */}
        <div className="flex-1 h-full titlebar-drag" />

        {/* Center: Always-active, reliable Address Bar */}
        <form onSubmit={handleUrlSubmit} className="w-full max-w-md mx-2">
          <div className={`h-7 px-3 rounded-full flex items-center gap-2 transition-all ${
            isLightMode
              ? 'bg-white border border-[#D5D5D5] focus-within:border-noir-red text-[#333333]'
              : 'bg-[#0D0D0D] border border-[#222222] focus-within:border-noir-red text-white'
          }`}>
            <Search size={12} className="text-white/40 shrink-0" />
            <input
              ref={urlInputRef}
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Search Google or enter URL..."
              className="w-full bg-transparent border-none outline-none text-xs font-mono placeholder:text-white/30 text-white"
            />
            {urlInput && (
              <button
                type="submit"
                className="text-[9px] font-dot px-1.5 py-0.5 rounded bg-noir-red text-white shrink-0 hover:bg-noir-redHover"
              >
                GO
              </button>
            )}
          </div>
        </form>

        {/* Draggable spacer handle 2 */}
        <div className="flex-1 h-full titlebar-drag" />

        {/* Right Section: Navigation, Immersion & Window Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => activeTabId && window.noirAPI?.goBack(activeTabId)}
            disabled={!activeTab?.canGoBack}
            className="p-1.5 text-white/60 hover:text-white disabled:opacity-20 transition-opacity cursor-pointer"
            title="Back"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => activeTabId && window.noirAPI?.goForward(activeTabId)}
            disabled={!activeTab?.canGoForward}
            className="p-1.5 text-white/60 hover:text-white disabled:opacity-20 transition-opacity cursor-pointer"
            title="Forward"
          >
            <ChevronRight size={15} />
          </button>
          <button
            onClick={() => activeTabId && window.noirAPI?.reloadTab(activeTabId)}
            className={`p-1.5 text-white/60 hover:text-white transition-colors cursor-pointer ${activeTab?.isLoading ? 'animate-spin text-noir-red' : ''}`}
            title="Reload"
          >
            <RotateCw size={14} />
          </button>

          <div className="h-3 w-[1px] bg-white/15 mx-1" />

          {/* Immersion Mode */}
          <button
            onClick={() => setIsImmersionMode(prev => !prev)}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              isImmersionMode ? 'bg-noir-red text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title="Immersion Mode (Ctrl+S)"
          >
            <Maximize2 size={14} />
          </button>

          {/* Native Adblocker Shield Button */}
          <div className="relative">
            <button
              onClick={() => setShowShieldPopup(prev => !prev)}
              className={`h-7 px-2 rounded-full flex items-center gap-1.5 text-xs transition-all cursor-pointer border ${
                isAdblockEnabled
                  ? 'bg-[#0E0E0E] border-white/10 text-white/80 hover:border-noir-red/60 hover:text-white'
                  : 'bg-[#150A0A] border-noir-red/40 text-noir-red'
              }`}
              title="Native Ad & Tracker Shield"
            >
              {isAdblockEnabled ? (
                <ShieldCheck size={13} className="text-noir-red shrink-0" />
              ) : (
                <ShieldAlert size={13} className="text-white/40 shrink-0" />
              )}
              <span className="font-dot text-[10px] tracking-wider">{adblockCount}</span>
            </button>

            {/* Shield Dropdown Modal */}
            {showShieldPopup && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute top-9 right-0 w-64 acrylic-popup rounded-xl p-3.5 z-50 space-y-3 shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-noir-red animate-pulse" />
                    <span className="font-dot text-xs tracking-wider font-bold">NOIR SHIELD</span>
                  </div>
                  <button
                    onClick={() => setShowShieldPopup(false)}
                    className="text-white/40 hover:text-white p-0.5"
                  >
                    <X size={13} />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-white/60">Protection</span>
                    <button
                      onClick={async () => {
                        if (window.noirAPI) {
                          const updated = await window.noirAPI.toggleAdblock(!isAdblockEnabled)
                          setIsAdblockEnabled(updated)
                        }
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-dot tracking-wider cursor-pointer border transition-colors ${
                        isAdblockEnabled
                          ? 'bg-noir-red border-noir-red text-white'
                          : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
                      }`}
                    >
                      {isAdblockEnabled ? 'ACTIVE' : 'PAUSED'}
                    </button>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-center space-y-1">
                    <div className="font-dot text-xl text-white font-bold tracking-widest">{adblockCount}</div>
                    <div className="text-[9px] font-mono text-white/40">TRACKERS & ADS BLOCKED</div>
                  </div>

                  <p className="text-[9px] font-mono text-white/30 leading-relaxed">
                    Engine: WebAssembly EasyList & anti-tracking packet filter. Zero extensions required.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(prev => !prev)}
            className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Settings"
          >
            <SlidersHorizontal size={14} />
          </button>

          <div className="h-3 w-[1px] bg-white/15 mx-1" />

          {/* Window Controls: Minimize, Maximize, Close */}
          <button
            onClick={() => {
              console.log('Window: Minimize requested')
              window.noirAPI?.minimize()
            }}
            className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
            title="Minimize"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={() => {
              console.log('Window: Maximize requested')
              window.noirAPI?.maximize()
            }}
            className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Copy size={11} /> : <Square size={12} />}
          </button>
          <button
            onClick={() => {
              console.log('Window: Close requested')
              window.noirAPI?.close()
            }}
            className="p-1.5 text-white/60 hover:text-white hover:bg-noir-red rounded transition-colors cursor-pointer"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Arc-Style Vertical Sidebar with smooth slide transition */}
        <aside
          className={`border-r border-[#1A1A1A] bg-[#000000] flex flex-col justify-between shrink-0 select-none transition-all duration-200 ease-in-out z-30 ${
            isSidebarOpen && !isImmersionMode
              ? 'w-[260px] opacity-100'
              : 'w-0 overflow-hidden border-none opacity-0 pointer-events-none'
          }`}
        >
          {/* Top Section: Pinned Tabs & Vertical Tab List */}
          <div className="flex-1 flex flex-col overflow-y-auto px-2.5 pt-3 space-y-4">
            {/* Pinned Tabs Grid */}
            <div>
              <div className="flex items-center justify-between px-1.5 pb-1.5 text-[9px] font-dot text-white/40 tracking-wider">
                <span>PINNED</span>
                <span className="font-mono">{pinnedTabs.length}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {pinnedTabs.length > 0 ? (
                  pinnedTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => handleSwitchTab(tab.id)}
                      className={`h-11 rounded border flex flex-col items-center justify-center p-1 relative transition-all cursor-pointer ${
                        activeTabId === tab.id
                          ? 'bg-[#151515] border-noir-red text-white'
                          : 'bg-[#090909] border-[#222222] text-white/60 hover:border-white/30 hover:text-white'
                      }`}
                      title={tab.title}
                    >
                      {tab.favicon ? (
                        <img src={tab.favicon} alt="" className="w-4 h-4 rounded-sm" />
                      ) : (
                        <Globe size={14} />
                      )}
                      <span className="text-[8px] font-mono truncate w-full text-center mt-1">
                        {tab.title.substring(0, 4)}
                      </span>
                      {activeTabId === tab.id && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-noir-red" />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="col-span-4 py-2 border border-dashed border-white/10 rounded text-center text-[9px] text-white/30 font-mono">
                    No pinned tabs
                  </div>
                )}
              </div>
            </div>

            {/* Space Tabs Header & New Tab button */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center justify-between px-1.5 pb-2 text-[9px] font-dot text-white/40 tracking-wider">
                <span>
                  {spaces.find(s => s.id === activeSpaceId)?.name || 'CORE'} TABS
                </span>
                <button
                  onClick={() => handleCreateNewTab()}
                  className="p-1 hover:bg-white/10 active:bg-noir-red/20 rounded transition-colors text-white/60 hover:text-noir-red cursor-pointer"
                  title="New Tab (Ctrl+T)"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Vertical Tab Items */}
              <div className="space-y-1">
                {currentSpaceTabs.map(tab => {
                  const isActive = activeTabId === tab.id
                  return (
                    <div
                      key={tab.id}
                      onClick={() => handleSwitchTab(tab.id)}
                      className={`group relative h-9 px-2.5 rounded flex items-center justify-between cursor-pointer text-xs border transition-all ${
                        isActive
                          ? 'bg-[#121212] border-[#282828] text-white font-medium shadow-sm'
                          : 'bg-transparent border-transparent text-white/60 hover:bg-[#0A0A0A] hover:text-white'
                      }`}
                    >
                      {/* Red Active Indicator Bar */}
                      {isActive && (
                        <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-noir-red" />
                      )}

                      <div className="flex items-center gap-2.5 truncate flex-1 mr-2 pl-1">
                        {tab.isLoading ? (
                          <div className="w-3.5 h-3.5 rounded-full border border-noir-red border-t-transparent animate-spin shrink-0" />
                        ) : tab.favicon ? (
                          <img src={tab.favicon} alt="" className="w-3.5 h-3.5 rounded-sm shrink-0" />
                        ) : (
                          <Globe size={13} className="shrink-0 text-white/40" />
                        )}
                        <span className="truncate">{tab.title || 'Untitled'}</span>
                      </div>

                      {/* Close Tab Button */}
                      <button
                        onClick={(e) => handleCloseTab(tab.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity text-white/40 hover:text-white"
                        title="Close Tab (Ctrl+W)"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )
                })}

                {currentSpaceTabs.length === 0 && (
                  <div className="py-8 text-center text-xs text-white/20 font-mono">
                    No open tabs
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Section: Spaces Switcher (Alt + 1..9) */}
          <div className="p-2 border-t border-[#1A1A1A] bg-[#050505]">
            <div className="flex items-center justify-between px-1 pb-1.5 text-[8px] font-dot text-white/30 tracking-wider">
              <span>SPACES (ALT + 1..{spaces.length})</span>
              <span className="font-mono">{spaces.length}/9</span>
            </div>
            <div className="flex items-center gap-1">
              {spaces.map((space, idx) => {
                const isActive = activeSpaceId === space.id
                return (
                  <button
                    key={space.id}
                    onClick={() => setActiveSpaceId(space.id)}
                    className={`flex-1 py-1.5 rounded flex flex-col items-center gap-0.5 border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#161616] border-noir-red/70 text-white'
                        : 'bg-transparent border-transparent text-white/40 hover:text-white hover:bg-white/5'
                    }`}
                    title={`Switch to ${space.name} (Alt+${idx + 1})`}
                  >
                    <span className="text-[10px] leading-none">{space.icon}</span>
                    <span className="text-[8px] font-dot tracking-wider">{space.code}</span>
                  </button>
                )
              })}

              {/* Add Space button (up to 9 spaces) */}
              {spaces.length < 9 && (
                <button
                  onClick={handleAddSpace}
                  className="w-7 py-1.5 rounded border border-dashed border-white/20 text-white/40 hover:text-white hover:border-noir-red flex items-center justify-center transition-colors cursor-pointer"
                  title="Add Space"
                >
                  <Plus size={12} />
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Viewport & Empty AMOLED Home Canvas */}
        <main className="flex-1 bg-black bg-dot-pattern relative flex flex-col items-center justify-center overflow-hidden p-6">
          {(!activeTab || !activeTab.url) && (
            <div className="text-center space-y-6 max-w-md w-full z-10 select-none animate-fadeIn">
              {/* Brand Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-noir-red animate-pulse" />
                  <h1 className="font-dot text-3xl tracking-[0.25em] font-bold text-white">NOIR</h1>
                </div>
                <p className="text-xs text-white/40 font-mono tracking-wider">
                  PURE AMOLED • ZERO BLOAT • RAW UTILITY
                </p>
              </div>

              {/* Home Search Box */}
              <form onSubmit={handleHomeSearchSubmit} className="relative w-full">
                <div className="flex items-center gap-2 bg-[#0C0C0C] border border-[#222222] focus-within:border-noir-red rounded-xl px-4 py-3 shadow-2xl transition-all">
                  <Search size={16} className="text-noir-red shrink-0" />
                  <input
                    type="text"
                    value={homeSearchInput}
                    onChange={(e) => setHomeSearchInput(e.target.value)}
                    placeholder="Search Google or enter web address..."
                    className="w-full bg-transparent border-none outline-none text-white text-sm font-mono placeholder:text-white/30"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-3 py-1 bg-noir-red hover:bg-noir-redHover text-white text-xs font-dot tracking-wider rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <span>GO</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </form>

              {/* Quick Shortcuts */}
              <div className="grid grid-cols-3 gap-2 pt-2 text-[10px] font-mono text-white/30">
                <div className="p-2 rounded bg-white/5 border border-white/5">
                  <span className="text-white/60 font-semibold block">Ctrl + L</span> Focus Address
                </div>
                <div className="p-2 rounded bg-white/5 border border-white/5">
                  <span className="text-white/60 font-semibold block">Ctrl + B</span> Toggle Sidebar
                </div>
                <div className="p-2 rounded bg-white/5 border border-white/5">
                  <span className="text-white/60 font-semibold block">Alt + 1..9</span> Jump Spaces
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div
          onClick={() => setShowSettings(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md acrylic-popup rounded-2xl p-6 space-y-6"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-noir-red" />
                <h3 className="font-dot text-base tracking-wider font-bold">NOIR SETTINGS</h3>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors text-white/60 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Theme Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <div>
                  <div className="text-xs font-semibold">Color Mode</div>
                  <div className="text-[10px] text-white/40">Toggle AMOLED Black vs Stark White</div>
                </div>
                <button
                  onClick={() => setIsLightMode(prev => !prev)}
                  className="px-3 py-1.5 rounded border border-white/20 text-xs font-mono flex items-center gap-1.5 hover:border-noir-red transition-colors cursor-pointer"
                >
                  {isLightMode ? <Sun size={12} /> : <Moon size={12} />}
                  <span>{isLightMode ? 'WHITE' : 'AMOLED'}</span>
                </button>
              </div>

              {/* Arc Browser Import */}
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center gap-2">
                  <FolderDown size={14} className="text-noir-red" />
                  <span className="text-xs font-semibold">Import from Arc Browser</span>
                </div>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  Imports Spaces, Pinned Tabs, and Bookmarks from your local Arc setup on Windows.
                </p>
                <button
                  onClick={() => {
                    alert('Arc importer scanning %LOCALAPPDATA%\\TheBrowserCompany\\Arc on Phase 4.')
                  }}
                  className="w-full py-1.5 bg-white/10 hover:bg-noir-red text-white text-xs font-dot tracking-wider rounded transition-colors cursor-pointer"
                >
                  SCAN & IMPORT ARC TABS
                </button>
              </div>
            </div>

            <div className="text-center text-[10px] text-white/30 font-mono">
              NOIR Browser • Zero AI Slop • Pure Utility
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
