'use client'

import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  text?: string
  variant?: 'default' | 'pulse' | 'dots'
}

export function LoadingSpinner({ 
  size = 'md', 
  className,
  text,
  variant = 'default'
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  if (variant === 'dots') {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" />
        </div>
        {text && (
          <p className={cn('text-muted-foreground animate-pulse', textSizeClasses[size])}>
            {text}
          </p>
        )}
      </div>
    )
  }

  if (variant === 'pulse') {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
        <div className={cn(
          'rounded-full bg-primary/20 animate-pulse',
          sizeClasses[size]
        )}>
          <div className={cn(
            'rounded-full bg-primary animate-ping',
            sizeClasses[size]
          )} style={{ animationDuration: '1.5s' }} />
        </div>
        {text && (
          <p className={cn('text-muted-foreground', textSizeClasses[size])}>
            {text}
          </p>
        )}
      </div>
    )
  }

  // Default variant - smooth rotating spinner
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div className="relative">
        {/* Outer ring */}
        <div className={cn(
          'rounded-full border-4 border-primary/20',
          sizeClasses[size]
        )} />
        {/* Animated spinner with smooth easing */}
        <div 
          className={cn(
            'absolute top-0 left-0 rounded-full border-4 border-transparent border-t-primary border-r-primary',
            sizeClasses[size],
            'animate-spin'
          )}
          style={{
            animationDuration: '0.8s',
            animationTimingFunction: 'cubic-bezier(0.5, 0, 0.5, 1)'
          }}
        />
        {/* Inner glow effect */}
        <div 
          className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30 blur-sm animate-pulse',
            size === 'sm' ? 'h-1 w-1' : size === 'md' ? 'h-2 w-2' : 'h-3 w-3'
          )}
          style={{
            animationDuration: '2s',
            animationTimingFunction: 'cubic-bezier(0.4, 0, 0.6, 1)'
          }}
        />
      </div>
      {text && (
        <p className={cn('text-muted-foreground animate-pulse', textSizeClasses[size])}>
          {text}
        </p>
      )}
    </div>
  )
}

// Full page loading component
export function LoadingPage({ text = 'Chargement...' }: { text?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" variant="default" />
        <p className="text-sm text-muted-foreground animate-pulse">{text}</p>
      </div>
    </div>
  )
}

// Inline loading component
export function LoadingInline({ text, size = 'md' }: { text?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className="flex items-center justify-center py-8">
      <LoadingSpinner size={size} text={text} variant="default" />
    </div>
  )
}

