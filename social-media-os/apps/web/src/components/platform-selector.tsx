'use client';

import { Platform } from '@social-media-os/shared';
import { cn } from '@/lib/utils';
import { PLATFORM_COLORS, PLATFORM_LABELS } from '@/lib/constants';

interface PlatformSelectorProps {
  selected: Platform[];
  onChange: (platforms: Platform[]) => void;
  error?: string;
  className?: string;
}

const platforms = Object.values(Platform);

export function PlatformSelector({ selected, onChange, error, className }: PlatformSelectorProps) {
  const toggle = (platform: Platform) => {
    if (selected.includes(platform)) {
      onChange(selected.filter((p) => p !== platform));
    } else {
      onChange([...selected, platform]);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <label className="text-sm font-medium">Platforms</label>
      <div className="flex flex-wrap gap-2">
        {platforms.map((platform) => {
          const isSelected = selected.includes(platform);
          const color = PLATFORM_COLORS[platform];
          return (
            <button
              key={platform}
              type="button"
              onClick={() => toggle(platform)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border',
                isSelected
                  ? 'text-white border-transparent'
                  : 'text-muted-foreground bg-background hover:bg-muted'
              )}
              style={isSelected ? { backgroundColor: color } : undefined}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              {PLATFORM_LABELS[platform]}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
