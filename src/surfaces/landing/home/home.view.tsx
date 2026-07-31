import { useEffect } from 'react';
import { getSiteProductHomeSkipLink, SiteProductHomeView } from '@/site-home';

import { isRtlLocale } from '@/config/locale';
import type { Image } from '@/shared/types/blocks/common';

import { LandingShellView } from '../shell/landing-shell.view';
import type {
  HomeButtonData,
  HomeItemData,
  HomePageData,
  HomeRouteData,
  HomeSectionData,
} from './home.types';

const SECTION_ORDER = [
  'logos',
  'introduce',
  'benefits',
  'usage',
  'features',
  'stats',
  'testimonials',
  'faq',
  'subscribe',
  'cta',
] as const;

function TextHtml({ value }: { value?: string }) {
  if (!value) {
    return null;
  }

  return <span dangerouslySetInnerHTML={{ __html: value }} />;
}

function HomeImage({ image, className }: { image?: Image; className: string }) {
  if (!image?.src) {
    return null;
  }

  return (
    <img
      className={className}
      src={image.src}
      alt={image.alt || ''}
      width={image.width}
      height={image.height}
    />
  );
}

function HomeButtons({ buttons }: { buttons?: readonly HomeButtonData[] }) {
  if (!buttons?.length) {
    return null;
  }

  return (
    <div className="home-buttons">
      {buttons.map((button) => (
        <a
          key={`${button.title ?? button.text}:${button.url ?? ''}`}
          className={`home-button ${button.variant === 'outline' ? 'secondary' : 'primary'}`}
          href={button.url || '#'}
          target={button.target}
          rel={button.target === '_blank' ? 'noreferrer' : undefined}
        >
          {button.title || button.text || button.name}
        </a>
      ))}
    </div>
  );
}

function HomeHero({ section }: { section?: HomeSectionData }) {
  if (!section) {
    return null;
  }

  return (
    <section id={section.id} className="home-hero">
      {section.label ? <p className="home-eyebrow">{section.label}</p> : null}
      <h1>
        <TextHtml value={section.title} />
      </h1>
      {section.description ? (
        <p className="home-hero-description">
          <TextHtml value={section.description} />
        </p>
      ) : null}
      <HomeButtons buttons={section.buttons} />
      <HomeImage image={section.image} className="home-hero-image" />
    </section>
  );
}

function HomeItem({ item }: { item: HomeItemData }) {
  return (
    <article className="home-item">
      <HomeImage image={item.image} className="home-item-image" />
      <h3>{item.title || item.name || item.text}</h3>
      {item.description ? (
        <p>
          <TextHtml value={item.description} />
        </p>
      ) : null}
    </article>
  );
}

function HomeSection({
  section,
  variant,
}: {
  section?: HomeSectionData;
  variant: string;
}) {
  if (!section) {
    return null;
  }

  const items = section.items ?? [];

  return (
    <section id={section.id} className={`home-section home-section-${variant}`}>
      <div className="home-section-heading">
        {section.label ? <p className="home-eyebrow">{section.label}</p> : null}
        {section.title ? (
          <h2>
            <TextHtml value={section.title} />
          </h2>
        ) : null}
        {section.description ? (
          <p>
            <TextHtml value={section.description} />
          </p>
        ) : null}
      </div>

      <HomeImage image={section.image} className="home-section-image" />

      {items.length > 0 ? (
        <div className="home-grid">
          {items.map((item) => (
            <HomeItem
              key={`${item.title ?? item.name}:${item.url ?? ''}`}
              item={item}
            />
          ))}
        </div>
      ) : null}

      <HomeButtons buttons={section.buttons} />
    </section>
  );
}

function HomeContent({ page }: { page: HomePageData }) {
  return (
    <div className="home-surface">
      <HomeHero section={page.hero} />
      {SECTION_ORDER.map((key) => (
        <HomeSection key={key} section={page[key]} variant={key} />
      ))}
    </div>
  );
}

export function HomeSurfaceView({ data }: { data: HomeRouteData }) {
  const skipLink =
    data.variant === 'product'
      ? getSiteProductHomeSkipLink(data.productHome)
      : null;
  useEffect(() => {
    document.documentElement.lang = data.locale;
    document.documentElement.dir = isRtlLocale(data.locale) ? 'rtl' : 'ltr';
  }, [data.locale]);

  return (
    <>
      {skipLink ? (
        <a
          href="#calculator"
          className="fixed top-3 left-3 z-[100] -translate-y-20 rounded-lg bg-[#173D29] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0 focus:ring-2 focus:ring-[#7ED69F] focus:ring-offset-2 focus:outline-none"
        >
          {skipLink}
        </a>
      ) : null}
      <LandingShellView shell={data.shell}>
        {data.variant === 'product' ? (
          <SiteProductHomeView
            productHome={data.productHome}
            locale={data.locale}
          />
        ) : (
          <HomeContent page={data.page} />
        )}
      </LandingShellView>
    </>
  );
}
