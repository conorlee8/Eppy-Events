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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700/50">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-white">Filters</h2>
          {hasActiveFilters && (
            <button
              onClick={handleClearAll}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors underline"
            >
              Clear all
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400">Results update automatically</p>
      </div>

      {/* Scrollable Filters */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">

        {/* Category */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Category</h3>
          <div className="space-y-2">
            {[
              { id: 'music', label: 'Music', icon: '🎵', count: eventCounts?.music },
              { id: 'food', label: 'Food & Drink', icon: '🍕', count: eventCounts?.food },
              { id: 'art', label: 'Arts & Culture', icon: '🎨', count: eventCounts?.art },
              { id: 'sports', label: 'Sports', icon: '⚽', count: eventCounts?.sports },
              { id: 'markets', label: 'markets', icon: '🌙', count: eventCounts?.markets },
              { id: 'community', label: 'Community', icon: '🤝', count: eventCounts?.community }
            ].map(category => (
              <label
                key={category.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-colors group"
              >
                <input
                  type="checkbox"
                  checked={categories.includes(category.id)}
                  onChange={() => handleCategoryToggle(category.id)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-lg">{category.icon}</span>
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors flex-1">
                  {category.label}
                </span>
                {category.count !== undefined && (
                  <span className="text-xs text-gray-500">({category.count})</span>
                )}
              </label>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700/50" />

        {/* When */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">When</h3>
          <div className="space-y-2">
            {[
              { id: 'today', label: 'Today' },
              { id: 'this-weekend', label: 'This Weekend' },
              { id: 'next-week', label: 'Next Week' },
              { id: 'anytime', label: 'Anytime' }
            ].map(option => (
              <label
                key={option.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-colors group"
              >
                <input
                  type="radio"
                  name="dateRange"
                  checked={dateRange === option.id}
                  onChange={() => handleDateChange(option.id as any)}
                  className="w-4 h-4 border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700/50" />

        {/* Price Range */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Price Range</h3>
            <span className="text-xs text-cyan-400 font-medium">
              {priceRange[1] === 100 ? '$100+' : `$0 - $${priceRange[1]}`}
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={priceRange[1]}
            onChange={(e) => handlePriceChange(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
            style={{
              background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${priceRange[1]}%, #374151 ${priceRange[1]}%, #374151 100%)`
            }}
          />

          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>$0</span>
            <span>$100+</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider-thumb::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #06b6d4;
          cursor: pointer;
          border: 2px solid #0e7490;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }

        .slider-thumb::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #06b6d4;
          cursor: pointer;
          border: 2px solid #0e7490;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,200,255,0.3);
          border-radius: 3px;
        }
      `}</style>
    </div>
  )
}
