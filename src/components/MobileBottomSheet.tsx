'use client'

import { ReactNode, useState } from 'react'
import { Drawer } from 'vaul'

interface MobileBottomSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  snapPoints?: number[]
  defaultSnap?: number
  neighborhood?: string | null
  eventCount?: number
}

export function MobileBottomSheet({
  isOpen,
  onOpenChange,
  children,
  snapPoints = [0.2, 0.5, 0.9],
  defaultSnap = 0.2,
  neighborhood,
  eventCount = 0
}: MobileBottomSheetProps) {
  const [snap, setSnap] = useState<number | string | null>(defaultSnap)

  const handleHeaderClick = () => {
    // Jump to largest snap point
    setSnap(0.9)
  }

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={onOpenChange}
      snapPoints={snapPoints}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      modal={false}
      dismissible={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/0 pointer-events-none" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 flex flex-col bg-gradient-to-b from-gray-900/98 to-gray-950/98 backdrop-blur-xl border-t border-gray-700/50 shadow-2xl shadow-black/50 rounded-t-3xl z-30">
          {/* Accessibility Title - Visually Hidden */}
          <Drawer.Title className="sr-only">
            Event Discovery Sheet - {neighborhood || 'Exploring'} - {eventCount} events
          </Drawer.Title>

          {/* Drag Handle */}
          <div
            className="flex items-center justify-center py-4 px-4 border-b border-gray-800/50 cursor-pointer active:scale-[0.98] transition-transform hover:bg-gray-800/30"
            onClick={handleHeaderClick}
          >
            <div className="flex flex-col items-center gap-2 w-full">
              <div className="flex items-center gap-2">
                <div className="w-12 h-1.5 bg-gray-600/50 rounded-full hover:bg-gray-500/70 transition-colors" />
                <div className="text-xs text-gray-500">👆 Tap to Swipe</div>
              </div>

              {/* Peek Mode Header */}
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-full">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="text-xs text-gray-400 uppercase tracking-wider">Your Location</div>
                    <div className="text-base font-bold text-white">
                      {neighborhood || 'Exploring...'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-orange-500 rounded-full" />
                    <span className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-pink-600 bg-clip-text text-transparent">
                      {eventCount}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">events nearby</div>
                </div>
              </div>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
