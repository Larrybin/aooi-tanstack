import { createFileRoute, redirect } from '@tanstack/react-router';

import { defaultLocale } from '@/config/locale';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({
      to: '/$locale/pricing',
      params: { locale: defaultLocale },
    });
  },
});
