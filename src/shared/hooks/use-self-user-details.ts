'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchJson } from '@/shared/lib/api/fetch-json';
import { RequestIdError } from '@/shared/lib/api/request-id';
import type { SelfUserDetails } from '@/shared/types/auth-session';

type UseSelfUserDetailsOptions = {
  enabled?: boolean;
};

type LoadSelfUserDetailsDeps = {
  fetchSelfUserDetails: () => Promise<SelfUserDetails>;
};

type ResolveSelfUserDetailsForActionOptions = {
  currentDetails: SelfUserDetails | null;
  loadDetails: () => Promise<SelfUserDetails>;
};

export type SelfUserDetailsActionResolution =
  | {
      status: 'ready';
      details: SelfUserDetails;
    }
  | {
      status: 'auth_required';
    }
  | {
      status: 'error';
      error: unknown;
    };

const defaultDeps: LoadSelfUserDetailsDeps = {
  fetchSelfUserDetails: () =>
    fetchJson<SelfUserDetails>('/api/user/self-details', { method: 'POST' }),
};

function isTransientDetailsError(error: unknown): boolean {
  if (!(error instanceof RequestIdError)) {
    return false;
  }

  return error.status === 502 || error.status === 503;
}

export async function loadSelfUserDetails(
  deps: LoadSelfUserDetailsDeps = defaultDeps
): Promise<SelfUserDetails> {
  try {
    return await deps.fetchSelfUserDetails();
  } catch (error) {
    if (!isTransientDetailsError(error)) {
      throw error;
    }

    return deps.fetchSelfUserDetails();
  }
}

export async function resolveSelfUserDetailsForAction({
  currentDetails,
  loadDetails,
}: ResolveSelfUserDetailsForActionOptions): Promise<SelfUserDetailsActionResolution> {
  if (currentDetails) {
    return {
      status: 'ready',
      details: currentDetails,
    };
  }

  try {
    return {
      status: 'ready',
      details: await loadSelfUserDetails({
        fetchSelfUserDetails: loadDetails,
      }),
    };
  } catch (error) {
    if (error instanceof RequestIdError && error.status === 401) {
      return { status: 'auth_required' };
    }

    return {
      status: 'error',
      error,
    };
  }
}

export function useSelfUserDetails({
  enabled = false,
}: UseSelfUserDetailsOptions = {}) {
  const [data, setData] = useState<SelfUserDetails | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const didLoadRef = useRef(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextData = await loadSelfUserDetails();
      setData(nextData);
      return nextData;
    } catch (nextError) {
      setError(nextError);
      throw nextError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      didLoadRef.current = false;
      return;
    }

    if (didLoadRef.current) {
      return;
    }

    didLoadRef.current = true;
    void refresh().catch(() => undefined);
  }, [enabled, refresh]);

  return {
    data: enabled ? data : null,
    error: enabled ? error : null,
    isLoading: enabled ? isLoading : false,
    refresh,
  };
}
