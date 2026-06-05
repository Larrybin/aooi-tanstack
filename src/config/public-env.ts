import { getTrimmedEnvValue } from './env-contract';

export type PublicEnvConfigs = {
  theme: string;
  locale: string;
  turnstileSiteKey: string;
};

export const DEFAULT_PUBLIC_ENV_CONFIGS: Readonly<PublicEnvConfigs> =
  Object.freeze({
    theme: 'default',
    locale: 'en',
    turnstileSiteKey: '',
  });

type ResolvePublicEnvConfigsOptions = {
  nextPublicTheme?: string | null;
  nextPublicDefaultLocale?: string | null;
  nextPublicTurnstileSiteKey?: string | null;
};

export function readPublicEnvConfigs(
  env: Partial<NodeJS.ProcessEnv> = process.env
): PublicEnvConfigs {
  return resolvePublicEnvConfigs({
    nextPublicTheme: getTrimmedEnvValue(env, 'NEXT_PUBLIC_THEME'),
    nextPublicDefaultLocale: getTrimmedEnvValue(
      env,
      'NEXT_PUBLIC_DEFAULT_LOCALE'
    ),
    nextPublicTurnstileSiteKey: getTrimmedEnvValue(
      env,
      'NEXT_PUBLIC_TURNSTILE_SITE_KEY'
    ),
  });
}

export function resolvePublicEnvConfigs(
  options: ResolvePublicEnvConfigsOptions = {}
): PublicEnvConfigs {
  return {
    theme: options.nextPublicTheme?.trim() || DEFAULT_PUBLIC_ENV_CONFIGS.theme,
    locale:
      options.nextPublicDefaultLocale?.trim() ||
      DEFAULT_PUBLIC_ENV_CONFIGS.locale,
    turnstileSiteKey:
      options.nextPublicTurnstileSiteKey?.trim() ||
      DEFAULT_PUBLIC_ENV_CONFIGS.turnstileSiteKey,
  };
}
