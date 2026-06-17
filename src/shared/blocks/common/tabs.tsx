'use client';

import { Link } from '@/shared/blocks/common/navigation';
import { ScrollArea, ScrollBar } from '@/shared/components/ui/scroll-area';
import {
  Tabs as TabsComponent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs';
import { cn } from '@/shared/lib/utils';
import type { Tab } from '@/shared/types/blocks/common';

export function Tabs({
  tabs,
  size,
}: {
  tabs: Tab[];
  size?: 'sm' | 'md' | 'lg';
}) {
  const activeTabName =
    tabs?.find((tab) => tab.is_active)?.name || tabs[0]?.name || '';

  return (
    <div className="relative mb-8">
      <ScrollArea className="w-full lg:max-w-none">
        <div className="flex items-center space-x-2">
          <TabsComponent defaultValue={activeTabName}>
            <TabsList className={cn(size === 'sm' && 'h-8')}>
              {tabs.map((tab, idx) => (
                <TabsTrigger
                  key={idx}
                  value={tab.name || ''}
                  asChild={!!tab.url}
                >
                  {tab.url ? (
                    <Link href={tab.url} target={tab.target || '_self'}>
                      {tab.title}
                    </Link>
                  ) : (
                    <span>{tab.title}</span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </TabsComponent>
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>
    </div>
  );
}
