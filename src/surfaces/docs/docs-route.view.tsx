import { MarkdownPreview } from '@/domains/content/ui/markdown-preview';

type DocsRouteData = {
  title: string;
  description: string;
  content: string;
};

export function DocsRouteView({ data }: { data: DocsRouteData }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">{data.title}</h1>
      {data.description ? (
        <p className="mt-4 text-muted-foreground">{data.description}</p>
      ) : null}
      <article className="mt-8">
        <MarkdownPreview content={data.content} />
      </article>
    </main>
  );
}
