'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type ShimmeringTextProps = React.HTMLAttributes<HTMLSpanElement> & {
  text: string;
  duration?: number;
  wave?: boolean;
  color?: string;
  shimmeringColor?: string;
};

function ShimmeringText({
  text,
  duration = 1.8,
  wave,
  color = 'var(--muted-foreground)',
  shimmeringColor = 'var(--foreground)',
  className,
  style,
  ...props
}: ShimmeringTextProps) {
  return (
    <span
      className={cn('animate-text-shimmer inline-block', className)}
      style={
        {
          '--shimmer-base': color,
          '--shimmer-highlight': shimmeringColor,
          '--shimmer-duration': `${duration}s`,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      {text}
    </span>
  );
}

export { ShimmeringText, type ShimmeringTextProps };

