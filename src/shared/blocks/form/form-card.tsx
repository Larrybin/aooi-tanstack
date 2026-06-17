import { Fragment } from 'react';

import { Link } from '@/shared/blocks/common/navigation';
import { Form } from '@/shared/blocks/form/form';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/components/ui/breadcrumb';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/utils';
import type { Crumb } from '@/shared/types/blocks/common';
import type { Form as FormType } from '@/shared/types/blocks/form';

export function FormCard<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TPassby = unknown,
>({
  title,
  description,
  crumbs,
  form,
  className,
}: {
  title?: string;
  description?: string;
  crumbs?: Crumb[];
  form: FormType<TData, TPassby>;
  className?: string;
}) {
  return (
    <Card className={cn(className)}>
      {crumbs && crumbs.length > 0 && (
        <Breadcrumb className="px-6">
          <BreadcrumbList>
            {crumbs.map((crumb, index) => (
              <Fragment key={index}>
                <BreadcrumbItem className="hidden md:block">
                  {crumb.is_active ? (
                    <BreadcrumbPage>{crumb.title}</BreadcrumbPage>
                  ) : (
                    <Link href={crumb.url || ''}>{crumb.title}</Link>
                  )}
                </BreadcrumbItem>
                {index < crumbs.length - 1 && (
                  <BreadcrumbSeparator className="hidden md:block" />
                )}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && (
            <CardDescription
              dangerouslySetInnerHTML={{ __html: description }}
            />
          )}
        </CardHeader>
      )}

      {form && (
        <CardContent>
          <Form {...form} />
        </CardContent>
      )}
    </Card>
  );
}
