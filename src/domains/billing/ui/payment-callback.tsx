'use client';

import { useEffect, useRef } from 'react';

import { useRouter } from '@/shared/blocks/common/navigation';
import { fetchJson, toastFetchError } from '@/shared/lib/api/fetch-json';

export function PaymentCallbackHandler({
  orderNo,
  cleanUrl,
}: {
  orderNo?: string;
  cleanUrl: string;
}) {
  const router = useRouter();
  const didRunRef = useRef(false);

  useEffect(() => {
    if (!orderNo || didRunRef.current) {
      return;
    }

    didRunRef.current = true;

    fetchJson('/api/payment/callback', {
      method: 'POST',
      body: { order_no: orderNo },
    })
      .then(() => {
        router.replace(cleanUrl);
      })
      .catch((error: unknown) => {
        toastFetchError(error, 'Failed to confirm payment');
      });
  }, [cleanUrl, orderNo, router]);

  return null;
}
