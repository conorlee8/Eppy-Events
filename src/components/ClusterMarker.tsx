'use client'

import { useEffect, useState } from 'react'
import type { EventCluster } from '@/types'

interface ClusterMarkerProps {
  cluster: EventCluster
  clusterType: 'popularity' | 'neighborhood' | 'individual'
  onClick?: () => void
}

export function ClusterMarker({ cluster, clusterType, onClick }: ClusterMarkerProps) {
  const [mounted, setMounted] = useState(false)
  const eventCount = cluster.events.length

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  // Popularity-based styling
  const getPopularityLevel = () => {
    const metadata = cluster.metadata
    if (metadata?.avgPopularity) {
      if (metadata.avgPopularity >= 150) return 'mega'
      if (metadata.avgPopularity >= 100) return 'major'
      if (metadata.avgPopularity >= 50) return 'popular'
    }
    return 'regular'
  }

  const popularityLevel = getPopularityLevel()

  // Energy orb colors and sizes based on popularity
  const getOrbStyle = () => {
    switch (popularityLevel) {
      case 'mega':
        return {
          size: 60 + Math.min(eventCount * 2, 40),
          color: '#ff1744', // Red
          glow: '#ff4569',
          shadow: '0 0 30px rgba(255, 23, 68, 0.8), 0 0 60px rgba(255, 23, 68, 0.4)',
          pulseSpeed: '2s'
        }
      case 'major':
        return {
          size: 50 + Math.min(eventCount * 1.5, 30),
          color: '#d500f9', // Purple
          glow: '#e254ff',
          shadow: '0 0 25px rgba(213, 0, 249, 0.7), 0 0 50px rgba(213, 0, 249, 0.3)',
          pulseSpeed: '2.5s'
        }
      case 'popular':
        return {
          size: 40 + Math.min(eventCount, 20),
          color: '#2979ff', // Blue
          glow: '#5393ff',
          shadow: '0 0 20px rgba(41, 121, 255, 0.6), 0 0 40px rgba(41, 121, 255, 0.2)',
          pulseSpeed: '3s'
        }
      default:
        return {
          size: 35 + Math.min(eventCount * 0.5, 15),
          color: '#e0e0e0', // White/Gray
          glow: '#ffffff',
          shadow: '0 0 15px rgba(224, 224, 224, 0.5), 0 0 30px rgba(224, 224, 224, 0.2)',
          pulseSpeed: '3.5s'
        }
    }
  }

  const orbStyle = getOrbStyle()

  // Popularity Cluster - Energy Orb
  if (clusterType === 'popularity') {
    return (
      <div
        className="cluster-marker-container"
        onClick={onClick}
        style={{
          cursor: 'pointer',
          position: 'relative',
          width: `${orbStyle.size}px`,
          height: `${orbStyle.size}px`
        }}
      >
        {/* Outer glow ring */}
        <div
          className="energy-orb-glow"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: `${orbStyle.size * 1.4}px`,
            height: `${orbStyle.size * 1.4}px`,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${orbStyle.glow}40, transparent 70%)`,
            animation: `pulse ${orbStyle.pulseSpeed} ease-in-out infinite`,
            pointerEvents: 'none'
          }}
        />

        {/* Main energy orb */}
        <div
          className="energy-orb"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: `${orbStyle.size}px`,
            height: `${orbStyle.size}px`,
            borderRadius: '50%',
            background: `radial-gradient(circle at 30% 30%, ${orbStyle.glow}, ${orbStyle.color})`,
            boxShadow: orbStyle.shadow,
            animation: `float ${orbStyle.pulseSpeed} ease-in-out infinite`,
            transition: 'all 0.3s ease'
          }}
        >
          {/* Inner shine */}
          <div
            style={{
              position: 'absolute',
              top: '15%',
              left: '20%',
              width: '30%',
              height: '30%',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.6)',
              filter: 'blur(8px)'
            }}
          />

          {/* Event count */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              color: 'white',
              fontWeight: 'bold',
              fontSize: `${Math.max(12, orbStyle.size / 4)}px`,
              textShadow: '0 2px 4px rgba(0,0,0,0.5)',
              zIndex: 10
            }}
          >
            {eventCount}
          </div>
        </div>

        {/* Particle effects */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="particle"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: orbStyle.glow,
              animation: `particle-float ${2 + i}s ease-in-out infinite`,
              animationDelay: `${i * 0.5}s`,
              opacity: 0.6
            }}
          />
        ))}

        <style jsx>{`
          @keyframes pulse {
            0%, 100% {
              transform: translate(-50%, -50%) scale(1);
              opacity: 0.6;
            }
            50% {
              transform: translate(-50%, -50%) scale(1.2);
              opacity: 0.3;
            }
          }

          @keyframes float {
            0%, 100% {
              transform: translate(-50%, -50%) translateY(0px);
            }
            50% {
              transform: translate(-50%, -50%) translateY(-10px);
            }
          }

          @keyframes particle-float {
            0% {
              transform: translate(-50%, -50%) translateY(0) translateX(0);
              opacity: 0;
            }
            20% {
              opacity: 0.6;
            }
            100% {
              transform: translate(-50%, -50%) translateY(-30px) translateX(${Math.random() * 20 - 10}px);
              opacity: 0;
            }
          }
        `}</style>
      </div>
    )
  }

  // Neighborhood Cluster - 3D Icon Badge
  if (clusterType === 'neighborhood') {
    const neighborhoodName = cluster.metadata?.neighborhoodName || 'Area'
    const colorSchemes = [
      { bg: '#3b82f6', glow: '#60a5fa' }, // Blue
      { bg: '#8b5cf6', glow: '#a78bfa' }, // Purple
      { bg: '#ec4899', glow: '#f472b6' }, // Pink
      { bg: '#f59e0b', glow: '#fbbf24' }, // Orange
      { bg: '#10b981', glow: '#34d399' }, // Green
      { bg: '#06b6d4', glow: '#22d3ee' }, // Cyan
    ]

    const colorIndex = neighborhoodName.charCodeAt(0) % colorSchemes.length
    const colors = colorSchemes[colorIndex]

    return (
      <div
        className="neighborhood-marker"
        onClick={onClick}
        style={{
          cursor: 'pointer',
          position: 'relative',
          minWidth: '120px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        {/* 3D Building/Location Icon */}
        <div
          style={{
            position: 'relative',
            width: '48px',
            height: '48px',
            background: `linear-gradient(135deg, ${colors.bg}, ${colors.glow})`,
            borderRadius: '12px',
            boxShadow: `0 4px 20px ${colors.bg}60, 0 0 40px ${colors.glow}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'neighborhood-float 3s ease-in-out infinite',
            transform: 'rotateX(10deg) rotateY(-10deg)',
            transformStyle: 'preserve-3d'
          }}
        >
          {/* Simple 3D building icon */}
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
            <path d="M12 3L2 9v11a1 1 0 001 1h8v-8h2v8h8a1 1 0 001-1V9l-10-6z" />
          </svg>

          {/* Event count badge */}
          <div
            style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              background: '#ff1744',
              color: 'white',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold',
              boxShadow: '0 2px 8px rgba(255, 23, 68, 0.5)',
              border: '2px solid white'
            }}
          >
            {eventCount}
          </div>
        </div>

        {/* Neighborhood name */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            padding: '4px 12px',
            borderRadius: '12px',
            color: 'white',
            fontSize: '11px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            border: `1px solid ${colors.bg}40`
          }}
        >
          {neighborhoodName}
        </div>

        <style jsx>{`
          @keyframes neighborhood-float {
            0%, 100% {
              transform: rotateX(10deg) rotateY(-10deg) translateY(0px);
            }
            50% {
              transform: rotateX(10deg) rotateY(-10deg) translateY(-8px);
            }
          }
        `}</style>
      </div>
    )
  }

  // Individual Event - Simple marker
  return (
    <div
      className="individual-marker"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        width: '32px',
        height: '32px',
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        borderRadius: '50%',
        border: '3px solid white',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        transition: 'transform 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)'
      }}
    />
  )
}
