import { Link } from '@/shared/blocks/common/navigation';
import { Pagination } from '@/shared/blocks/common/pagination';
import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { Tabs } from '@/shared/blocks/common/tabs';
import { Table } from '@/shared/blocks/table/table';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { cn } from '@/shared/lib/utils';
import type {
  Button as ButtonType,
  Tab as TabType,
} from '@/shared/types/blocks/common';
import type { Table as TableType } from '@/shared/types/blocks/table';

export function TableCard<T extends object = object>({
  title,
  description,
  buttons,
  tabs,
  table,
  className,
}: {
  title?: string;
  description?: string;
  buttons?: ButtonType[];
  tabs?: TabType[];
  table: TableType<T>;
  className?: string;
}) {
  return (
    <Card className={cn(className)}>
      {(title || description || buttons) && (
        <CardHeader className="flex flex-wrap items-center gap-2">
          <div className="flex flex-col gap-2">
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <div className="flex-1"></div>
          {buttons && buttons.length > 0 && (
            <div className="flex items-center gap-2">
              {buttons.map((button, idx) => (
                <Button
                  key={idx}
                  asChild
                  variant={button.variant || 'default'}
                  size={button.size || 'sm'}
                >
                  <Link
                    href={button.url || ''}
                    target={button.target || '_self'}
                  >
                    {button.icon && <SmartIcon name={button.icon as string} />}
                    {button.title}
                  </Link>
                </Button>
              ))}
            </div>
          )}
        </CardHeader>
      )}

      {table && (
        <CardContent>
          {tabs && tabs.length > 0 ? <Tabs tabs={tabs} /> : null}
          <Table<T> {...table} />
        </CardContent>
      )}

      {table.pagination && (
        <CardFooter>
          <Pagination {...table.pagination} />
        </CardFooter>
      )}
    </Card>
  );
}
