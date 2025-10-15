'use client'

import { useState } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export function SearchBar({ value, onChange, placeholder = "Search..." }: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false)

  const handleClear = () => {
    onChange('')
  }

  return (
    <div className="relative w-full max-w-md">
      <div className={`
        relative flex items-center bg-gray-800 rounded-lg border transition-all duration-200
        ${isFocused ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-700 hover:border-gray-600'}
      `}>
        <MagnifyingGlassIcon className="absolute left-3 h-5 w-5 text-gray-400" />

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="
            w-full pl-10 pr-10 py-2.5 bg-transparent text-white placeholder-gray-400
            focus:outline-none focus:ring-0 border-0
          "
        />

        {value && (
          <button
            onClick={handleClear}
            className="absolute right-3 p-0.5 text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}