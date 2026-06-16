import React from 'react';
import { site } from '@/site';
import { Callout } from 'fumadocs-ui/components/callout';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { Heading } from 'fumadocs-ui/components/heading';
import type { MDXComponents } from 'mdx/types';

import { getDomainFromOrigin } from '@/shared/lib/support-email';

// Custom link component with nofollow for external links
const CustomLink = ({
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
  // Check if the link is external
  const isExternal = href?.startsWith('http') || href?.startsWith('//');

  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="nofollow noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    );
  }

  // Internal links
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
};

// Higher-order component to wrap any link component with nofollow logic
export function withNoFollow(
  LinkComponent: React.ComponentType<
    React.AnchorHTMLAttributes<HTMLAnchorElement>
  >
) {
  const LinkWithNoFollow = ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    // Check if the link is external
    const isExternal = href?.startsWith('http') || href?.startsWith('//');

    if (isExternal) {
      // For external links, add nofollow and pass through to the wrapped component
      return (
        <LinkComponent
          href={href}
          target="_blank"
          rel="nofollow noopener noreferrer"
          {...props}
        >
          {children}
        </LinkComponent>
      );
    }

    // For internal links, just use the wrapped component as-is
    return (
      <LinkComponent href={href} {...props}>
        {children}
      </LinkComponent>
    );
  };

  return LinkWithNoFollow;
}

function normalizePath(path: string): string {
  if (!path) return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function buildDefaultBrandMdxComponents(): MDXComponents {
  const appName = site.brand.appName;
  const appUrl = site.brand.appUrl;
  const domain = getDomainFromOrigin(appUrl);
  const supportEmail = site.brand.supportEmail;

  const AppName = () => appName;
  const AppUrl = () => appUrl;
  const AppDomain = () => domain;
  const SupportEmail = () => supportEmail;

  const SupportEmailLink = ({
    children,
  }: React.PropsWithChildren<Record<string, never>>) => (
    <a href={`mailto:${supportEmail}`} rel="nofollow noopener noreferrer">
      {children ?? supportEmail}
    </a>
  );

  const AppLink = ({
    path,
    href,
    children,
    ...props
  }: React.PropsWithChildren<
    {
      path?: string;
      href?: string;
    } & React.AnchorHTMLAttributes<HTMLAnchorElement>
  >) => {
    const resolvedHref = href
      ? href
      : appUrl
        ? `${appUrl}${normalizePath(path || '/')}`
        : normalizePath(path || '/');

    return (
      <a href={resolvedHref} {...props}>
        {children}
      </a>
    );
  };

  return {
    AppName,
    AppUrl,
    AppDomain,
    SupportEmail,
    SupportEmailLink,
    AppLink,
  };
}

type RelativeLinkSource = {
  getPageByHref: (
    href: string,
    options: { dir: string; language?: string }
  ) => { page: { url: string }; hash?: string } | null | undefined;
};

type RelativeLinkPage = {
  path: string;
  locale?: string;
};

function dirname(input: string): string {
  const normalized = input.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index <= 0 ? '' : normalized.slice(0, index);
}

function LightPre(props: React.HTMLAttributes<HTMLPreElement>) {
  return (
    <pre
      {...props}
      className={`bg-muted/40 my-4 overflow-x-auto rounded-xl border px-4 py-3 text-sm ${props.className || ''}`}
    />
  );
}

function Table(props: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="prose-no-margin relative my-6 overflow-auto">
      <table {...props} />
    </div>
  );
}

function Image(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  // MDX content may not provide stable dimensions, so keep native img with safe alt fallback.
  const className = `rounded-lg ${props.className || ''}`;

  return <img {...props} alt={props.alt || ''} className={className} />;
}

export function createRelativeLink(
  source: RelativeLinkSource,
  page: RelativeLinkPage,
  LinkComponent: React.ComponentType<
    React.AnchorHTMLAttributes<HTMLAnchorElement>
  > = CustomLink
) {
  return async function RelativeLink({
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
    let resolvedHref = href;

    if (href && href.startsWith('.')) {
      const target = source.getPageByHref(href, {
        dir: dirname(page.path),
        language: page.locale,
      });

      if (target) {
        resolvedHref = target.hash
          ? `${target.page.url}#${target.hash}`
          : target.page.url;
      }
    }

    return <LinkComponent href={resolvedHref} {...props} />;
  };
}

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  const defaultBrandComponents = buildDefaultBrandMdxComponents();
  const mergedComponents = {
    Card,
    Cards,
    Callout,
    pre: LightPre,
    img: Image,
    table: Table,
    h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
      <Heading as="h1" {...props} />
    ),
    h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
      <Heading as="h2" {...props} />
    ),
    h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
      <Heading as="h3" {...props} />
    ),
    h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
      <Heading as="h4" {...props} />
    ),
    h5: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
      <Heading as="h5" {...props} />
    ),
    h6: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
      <Heading as="h6" {...props} />
    ),
    a: CustomLink,
    ...defaultBrandComponents,
    ...components,
  };

  // If a custom 'a' component is provided, wrap it with nofollow logic
  if (components?.a && components.a !== CustomLink) {
    mergedComponents.a = withNoFollow(
      components.a as React.ComponentType<
        React.AnchorHTMLAttributes<HTMLAnchorElement>
      >
    );
  }

  return mergedComponents;
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...buildDefaultBrandMdxComponents(),
    ...components,
  };
}
