'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

export interface FilterState {
  categories: string[]
  dateRange: 'today' | 'this-weekend' | 'next-week' | 'anytime'
  priceRange: [number, number]
}

interface ModernFilterDrawerProps {
  isOpen: boolean
  onClose: () => void
  onFilterChange: (filters: FilterState) => void
  eventCount: number
  eventCounts?: {
    music: number
    food: number
    art: number
    sports: number
    markets: number
    community: number
  }
}

export default function ModernFilterDrawer({
  isOpen,
  onClose,
  onFilterChange,
  eventCount,
  eventCounts
}: ModernFilterDrawerProps) {
  const [categories, setCategories] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<'today' | 'this-weekend' | 'next-week' | 'anytime'>('anytime')
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100])

  const handleCategoryToggle = (category: string) => {
    const newCategories = categories.includes(category)
      ? categories.filter(c => c !== category)
      : [...categories, category]

    setCategories(newCategories)
    onFilterChange({ categories: newCategories, dateRange, priceRange })
  }

  const handleDateChange = (range: 'today' | 'this-weekend' | 'next-week' | 'anytime') => {
    setDateRange(range)
    onFilterChange({ categories, dateRange: range, priceRange })
  }

  const handlePriceChange = (max: number) => {
    const newRange: [number, number] = [0, max]
    setPriceRange(newRange)
    onFilterChange({ categories, dateRange, priceRange: newRange })
  }

  const handleClearAll = () => {
    setCategories([])
    setDateRange('anytime')
    setPriceRange([0, 100])
    onFilterChange({ categories: [], dateRange: 'anytime', priceRange: [0, 100] })
  }

  const hasActiveFilters = categories.length > 0 || dateRange !== 'anytime' || priceRange[1] < 100

  const categoryOptions = [
    { id: 'music', label: 'Music', icon: '🎵', count: eventCounts?.music },
    { id: 'food', label: 'Food & Drink', icon: '🍕', count: eventCounts?.food },
    { id: 'art', label: 'Arts', icon: '🎨', count: eventCounts?.art },
    { id: 'sports', label: 'Sports', icon: '⚽', count: eventCounts?.sports },
    { id: 'markets', label: 'Markets', icon: '🛍️', count: eventCounts?.markets },
    { id: 'community', label: 'Community', icon: '🤝', count: eventCounts?.community }
  ]

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-[#1a1a1a] z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          boxShadow: isOpen ? '-10px 0 40px rgba(0,0,0,0.5)' : 'none'
        }}
      >
        {/* Header - Airbnb Style */}
        <div className="relative px-6 py-5 border-b border-white/10">
          <button
            onClick={onClose}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Close filters"
          >
            <X className="w-5 h-5 text-gray-300" />
          </button>
          <h2 className="text-center text-lg font-semibold text-white">Filters</h2>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 custom-scrollbar">

          {/* Categories - Horizontal Grid (Airbnb 2025 Style) */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Category</h3>
            <div className="grid grid-cols-3 gap-3">
              {categoryOptions.map(category => {
                const isActive = categories.includes(category.id)
                return (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryToggle(category.id)}
                    className={`
                      relative p-4 rounded-xl border-2 transition-all duration-200
                      flex flex-col items-center gap-2 text-center
                      ${isActive
                        ? 'border-white bg-white/5 scale-95'
                        : 'border-gray-700 hover:border-gray-600 hover:bg-white/5'
                      }
                    `}
                  >
                    <span className="text-3xl">{category.icon}</span>
                    <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-gray-400'}`}>
                      {category.label}
                    </span>
                    {category.count !== undefined && category.count > 0 && (
                      <span className="text-[10px] text-gray-500">
                        {category.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10" />

          {/* When - Booking.com Style Pills */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">When</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'today', label: 'Today' },
                { id: 'this-weekend', label: 'This Weekend' },
                { id: 'next-week', label: 'Next Week' },
                { id: 'anytime', label: 'Anytime' }
              ].map(option => {
                const isActive = dateRange === option.id
                return (
                  <button
                    key={option.id}
                    onClick={() => handleDateChange(option.id as any)}
                    className={`
                      px-5 py-2.5 rounded-full border transition-all duration-200 font-medium text-sm
                      ${isActive
                        ? 'bg-white text-black border-white'
                        : 'bg-transparent text-gray-300 border-gray-600 hover:border-gray-500'
                      }
                    `}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10" />

          {/* Price Range - Minimalist Airbnb Style */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Price Range</h3>
              <span className="text-sm font-medium text-gray-400">
                {priceRange[1] === 100 ? '$100+' : `Up to $${priceRange[1]}`}
              </span>
            </div>

            <div className="space-y-4">
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={priceRange[1]}
                onChange={(e) => handlePriceChange(parseInt(e.target.value))}
                className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer airbnb-slider"
              />

              <div className="flex justify-between text-xs text-gray-500 font-medium">
                <span>Free</span>
                <span>$100+</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Airbnb Style */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between bg-[#1a1a1a]">
          <button
            onClick={handleClearAll}
            className={`text-sm font-semibold transition-colors ${
              hasActiveFilters
                ? 'text-white underline hover:text-gray-300'
                : 'text-gray-600 cursor-not-allowed'
            }`}
            disabled={!hasActiveFilters}
          >
            Clear all
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white text-black rounded-lg font-semibold text-sm hover:bg-gray-100 transition-colors"
          >
            Show {eventCount} events
          </button>
        </div>
      </div>

      <style jsx>{`
        .airbnb-slider::-webkit-slider-thumb {
          appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          transition: transform 0.15s ease;
        }

        .airbnb-slider::-webkit-slider-thumb:hover {
          transform: scale(1.1);
        }

        .airbnb-slider::-webkit-slider-thumb:active {
          transform: scale(1.15);
        }

        .airbnb-slider::-moz-range-thumb {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          transition: transform 0.15s ease;
        }

        .airbnb-slider::-moz-range-thumb:hover {
          transform: scale(1.1);
        }

        .airbnb-slider::-moz-range-thumb:active {
          transform: scale(1.15);
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.3);
        }
      `}</style>
    </>
  )
}
