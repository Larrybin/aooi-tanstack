'use client';

import { site } from '@/site';

import { resolveImageSourceStrategy } from '@/shared/config/image-policy.mjs';
import { cn } from '@/shared/lib/utils';

type AppImageCommonProps = {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
  fetchPriority?: 'high' | 'low' | 'auto';
  quality?: number;
  loading?: 'eager' | 'lazy';
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  title?: string;
  sizes?: string;
};

type AppImageFixedProps = {
  width: number;
  height: number;
  fill?: never;
};

type AppImageFillProps = {
  fill: true;
  sizes: string;
  width?: never;
  height?: never;
};

export type AppImageProps = AppImageCommonProps &
  (AppImageFixedProps | AppImageFillProps);

export function AppImage({ src, alt, className, ...props }: AppImageProps) {
  const strategy = resolveImageSourceStrategy(src, {
    appOrigin: site.brand.appUrl,
  });

  if (strategy.kind === 'empty') {
    return null;
  }

  const imgProps =
    'fill' in props && props.fill
      ? {
          sizes: props.sizes,
        }
      : {
          width: props.width,
          height: props.height,
        };

  return (
    <img
      src={strategy.resolvedSrc}
      alt={alt}
      title={props.title}
      className={cn(className, 'object-cover')}
      style={props.style}
      loading={props.loading}
      fetchPriority={props.fetchPriority}
      {...imgProps}
    />
  );
}
