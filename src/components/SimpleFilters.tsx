'use client'

import { useState } from 'react'

export interface FilterState {
  categories: string[]
  dateRange: 'today' | 'this-weekend' | 'next-week' | 'anytime'
  priceRange: [number, number]
}

interface SimpleFiltersProps {
  onFilterChange: (filters: FilterState) => void
  eventCounts?: {
    music: number
    food: number
    art: number
    sports: number
    markets: number
    community: number
  }
}

export default function SimpleFilters({ onFilterChange, eventCounts }: SimpleFiltersProps) {
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
    { id: 'music', label: 'Music', icon: '🎵', count: eventCounts?.music, color: 'from-pink-500 to-purple-500' },
    { id: 'food', label: 'Food & Drink', icon: '🍕', count: eventCounts?.food, color: 'from-orange-500 to-amber-500' },
    { id: 'art', label: 'Arts & Culture', icon: '🎨', count: eventCounts?.art, color: 'from-purple-500 to-indigo-500' },
    { id: 'sports', label: 'Sports', icon: '⚽', count: eventCounts?.sports, color: 'from-green-500 to-emerald-500' },
    { id: 'markets', label: 'Markets', icon: '🌙', count: eventCounts?.markets, color: 'from-blue-500 to-cyan-500' },
    { id: 'community', label: 'Community', icon: '🤝', count: eventCounts?.community, color: 'from-cyan-500 to-teal-500' }
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header with Glassmorphism */}
      <div
        className="p-5 border-b border-white/10"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
            Filters
          </h2>
          {hasActiveFilters && (
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 text-xs font-medium text-white rounded-full bg-gradient-to-r from-red-500/20 to-pink-500/20 border border-red-400/30 hover:border-red-400/50 transition-all duration-300 backdrop-blur-sm"
              style={{
                boxShadow: '0 0 20px rgba(255,0,100,0.2)',
              }}
            >
              Clear all
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400/80 font-medium">Results update automatically</p>
      </div>

      {/* Scrollable Filters */}
      <div className="flex-1 overflow-y-auto p-5 space-y-7 custom-scrollbar">

        {/* Category - Modern Chip-based Toggles */}
        <div>
          <h3 className="text-sm font-bold text-white mb-4 tracking-wide uppercase opacity-90">Category</h3>
          <div className="flex flex-wrap gap-2.5">
            {categoryOptions.map(category => {
              const isActive = categories.includes(category.id)
              return (
                <button
                  key={category.id}
                  onClick={() => handleCategoryToggle(category.id)}
                  className={`
                    group relative px-4 py-2.5 rounded-xl font-medium text-sm
                    transition-all duration-300 ease-out
                    ${isActive
                      ? 'bg-gradient-to-r text-white scale-105'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:scale-102'
                    }
                    border ${isActive ? 'border-white/30' : 'border-white/10'}
                    backdrop-blur-sm
                  `}
                  style={{
                    ...(isActive && {
                      background: `linear-gradient(135deg, ${category.color.replace('from-', 'rgba(').replace('to-', '').split(' ')[0]}, ${category.color.split(' ')[1]})`,
                      boxShadow: '0 4px 20px rgba(0,200,255,0.3), inset 0 0 20px rgba(255,255,255,0.1)',
                    })
                  }}
                >
                  {/* Icon */}
                  <span className="text-lg mr-2">{category.icon}</span>

                  {/* Label */}
                  <span className="font-semibold">{category.label}</span>

                  {/* Count Badge */}
                  {category.count !== undefined && (
                    <span className={`
                      ml-2 px-2 py-0.5 rounded-full text-xs font-bold
                      ${isActive ? 'bg-white/20' : 'bg-cyan-500/20 text-cyan-300'}
                    `}>
                      {category.count}
                    </span>
                  )}

                  {/* Active Indicator Glow */}
                  {isActive && (
                    <div
                      className="absolute inset-0 rounded-xl opacity-50 blur-xl pointer-events-none"
                      style={{
                        background: `linear-gradient(135deg, ${category.color.split(' ')[0].replace('from-', '')}, ${category.color.split(' ')[1].replace('to-', '')})`,
                      }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/5" />

        {/* When - Modern Toggle Pills */}
        <div>
          <h3 className="text-sm font-bold text-white mb-4 tracking-wide uppercase opacity-90">When</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { id: 'today', label: 'Today', icon: '📅' },
              { id: 'this-weekend', label: 'Weekend', icon: '🎉' },
              { id: 'next-week', label: 'Next Week', icon: '📆' },
              { id: 'anytime', label: 'Anytime', icon: '🌟' }
            ].map(option => {
              const isActive = dateRange === option.id
              return (
                <button
                  key={option.id}
                  onClick={() => handleDateChange(option.id as any)}
                  className={`
                    relative px-4 py-3 rounded-xl font-semibold text-sm
                    transition-all duration-300
                    ${isActive
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white scale-105'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:scale-102'
                    }
                    border ${isActive ? 'border-cyan-400/50' : 'border-white/10'}
                    backdrop-blur-sm
                  `}
                  style={{
                    ...(isActive && {
                      boxShadow: '0 4px 20px rgba(0,200,255,0.4), inset 0 0 20px rgba(255,255,255,0.1)',
                    })
                  }}
                >
                  <span className="mr-2">{option.icon}</span>
                  {option.label}

                  {/* Active Glow */}
                  {isActive && (
                    <div
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 opacity-40 blur-xl pointer-events-none"
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/5" />

        {/* Price Range - Modern Slider */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white tracking-wide uppercase opacity-90">Price Range</h3>
            <span
              className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 px-3 py-1 rounded-full bg-white/5 backdrop-blur-sm border border-cyan-400/20"
              style={{
                boxShadow: '0 0 15px rgba(0,200,255,0.2)',
              }}
            >
              {priceRange[1] === 100 ? '$100+' : `$0 - $${priceRange[1]}`}
            </span>
          </div>

          <div className="relative">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={priceRange[1]}
              onChange={(e) => handlePriceChange(parseInt(e.target.value))}
              className="w-full h-3 rounded-full appearance-none cursor-pointer modern-slider"
              style={{
                background: `linear-gradient(to right,
                  rgba(6,182,212,0.8) 0%,
                  rgba(6,182,212,0.8) ${priceRange[1]}%,
                  rgba(255,255,255,0.1) ${priceRange[1]}%,
                  rgba(255,255,255,0.1) 100%)`
              }}
            />

            <div className="flex justify-between mt-3 text-xs font-semibold text-gray-400">
              <span>$0</span>
              <span>$100+</span>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .modern-slider::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #06b6d4, #0891b2);
          cursor: pointer;
          border: 3px solid rgba(255,255,255,0.3);
          box-shadow: 0 4px 12px rgba(0,200,255,0.4), 0 0 20px rgba(0,200,255,0.3);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .modern-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 6px 16px rgba(0,200,255,0.5), 0 0 30px rgba(0,200,255,0.4);
        }

        .modern-slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #06b6d4, #0891b2);
          cursor: pointer;
          border: 3px solid rgba(255,255,255,0.3);
          box-shadow: 0 4px 12px rgba(0,200,255,0.4), 0 0 20px rgba(0,200,255,0.3);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .modern-slider::-moz-range-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 6px 16px rgba(0,200,255,0.5), 0 0 30px rgba(0,200,255,0.4);
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, rgba(6,182,212,0.5), rgba(8,145,178,0.5));
          border-radius: 4px;
          border: 2px solid rgba(255,255,255,0.1);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, rgba(6,182,212,0.7), rgba(8,145,178,0.7));
        }
      `}</style>
    </div>
  )
}
