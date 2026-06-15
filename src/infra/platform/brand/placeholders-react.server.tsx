
import React from 'react';
import {
  replaceBrandPlaceholders,
  type BrandPlaceholderValues,
} from '@/infra/platform/brand/placeholders.server';

function replaceInStringProps(
  props: Record<string, unknown>,
  brand: BrandPlaceholderValues
): Record<string, unknown> {
  const nextProps: Record<string, unknown> = { ...props };

  for (const key of ['href', 'src', 'alt', 'title'] as const) {
    const value = props[key];
    if (typeof value === 'string') {
      nextProps[key] = replaceBrandPlaceholders(value, brand);
    }
  }

  const dangerous = props.dangerouslySetInnerHTML;
  if (
    dangerous &&
    typeof dangerous === 'object' &&
    '__html' in (dangerous as Record<string, unknown>)
  ) {
    const html = (dangerous as { __html?: unknown }).__html;
    if (typeof html === 'string') {
      nextProps.dangerouslySetInnerHTML = {
        __html: replaceBrandPlaceholders(html, brand),
      };
    }
  }

  return nextProps;
}

export function replaceBrandPlaceholdersInReactNode(
  node: React.ReactNode,
  brand: BrandPlaceholderValues
): React.ReactNode {
  if (typeof node === 'string') {
    return replaceBrandPlaceholders(node, brand);
  }

  if (
    node === null ||
    node === undefined ||
    typeof node === 'number' ||
    typeof node === 'boolean'
  ) {
    return node;
  }

  if (Array.isArray(node)) {
    return React.Children.map(node, (child) =>
      replaceBrandPlaceholdersInReactNode(child, brand)
    );
  }

  if (React.isValidElement(node)) {
    const props = (node.props ?? {}) as Record<string, unknown>;
    const nextProps = replaceInStringProps(props, brand);

    if ('children' in props) {
      nextProps.children = replaceBrandPlaceholdersInReactNode(
        props.children as React.ReactNode,
        brand
      );
    }

    return React.cloneElement(node, nextProps);
  }

  return node;
}
