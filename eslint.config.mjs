import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

import aooi from './eslint/aooi-eslint-plugin.mjs';

const noDoubleUnknownTypeAssertion = {
  selector:
    "TSAsExpression[expression.type='TSAsExpression'][expression.typeAnnotation.type='TSUnknownKeyword']",
  message:
    '禁止使用 `as unknown as` 双重断言；请改为类型守卫/parse/DTO 映射，或将断言收敛到边界适配层。',
};

const noThrowVanillaError = {
  selector: "ThrowStatement > NewExpression[callee.name='Error']",
  message:
    '禁止直接 `throw new Error(...)` 进入对外契约边界；请改为抛出 `ApiError/BusinessError/ExternalError/ActionError`（仅暴露安全的 publicMessage）。',
};

const noThrowVanillaErrorCall = {
  selector: "ThrowStatement > CallExpression[callee.name='Error']",
  message:
    '禁止直接 `throw Error(...)` 进入对外契约边界；请改为抛出 `ApiError/BusinessError/ExternalError/ActionError`（仅暴露安全的 publicMessage）。',
};

const noDirectProcessEnvAccess = {
  object: 'process',
  property: 'env',
  message:
    '非白名单运行时代码禁止直接访问或传播 `process.env`；请改走 env-contract / env helper。',
};

const noRuntimeDbConfigImportPattern = {
  regex:
    '(^@/infra/adapters/db/config(\\.[cm]?[jt]s)?$)|(^\\.{1,2}/.*?/infra/adapters/db/config(\\.[cm]?[jt]s)?$)',
  message:
    "禁止在运行时代码中导入 '@/infra/adapters/db/config'（仅用于 drizzle-kit CLI 配置）。",
};

const noRuntimeLoadDotenvImportPattern = {
  regex:
    '(^@/config/load-dotenv(\\.[cm]?[jt]s)?$)|(^\\.{1,2}/.*?/config/load-dotenv(\\.[cm]?[jt]s)?$)',
  message:
    "禁止在运行时代码中导入 '@/config/load-dotenv'（仅用于 scripts/CLI 加载本地 .env*）。",
};

const noRuntimeSiteConfigImportPattern = {
  regex: '(^@/sites/)|(^sites/)|(^\\.{1,2}/.*?/sites/)',
  message: "运行时代码禁止直接导入 'sites/**'；请统一走 '@/site'。",
};

const baseNoRestrictedImports = {
  paths: [
    {
      name: '@/infra/adapters/db/config',
      message:
        "禁止在运行时代码中导入 '@/infra/adapters/db/config'（仅用于 drizzle-kit CLI 配置）。",
    },
    {
      name: '@/config/load-dotenv',
      message:
        "禁止在运行时代码中导入 '@/config/load-dotenv'（仅用于 scripts/CLI 加载本地 .env*）。",
    },
    {
      name: '@/sites',
      message: "运行时代码禁止直接导入 '@/sites'；请统一走 '@/site'。",
    },
  ],
  patterns: [
    noRuntimeDbConfigImportPattern,
    noRuntimeLoadDotenvImportPattern,
    noRuntimeSiteConfigImportPattern,
  ],
};

const clientSurfaceNoRestrictedImports = {
  ...baseNoRestrictedImports,
  paths: [
    ...baseNoRestrictedImports.paths,
    {
      name: 'next/headers',
      message: "Client 模块禁止导入 'next/headers'（仅 Server 侧可用）。",
    },
    {
      name: 'server-only',
      message:
        "Client 模块禁止导入 'server-only'（该标记仅用于 server-only 模块）。",
    },
  ],
  patterns: [
    ...(baseNoRestrictedImports.patterns || []),
    {
      group: ['@/infra/adapters/**'],
      allowTypeImports: true,
      message:
        "Client 模块禁止导入 '@/infra/adapters/**'（外部实现适配必须保持 server-only）。",
    },
    {
      group: ['@/shared/content/**'],
      allowTypeImports: true,
      message:
        "Client 模块禁止导入 '@/shared/content/**'（content pipeline 必须保持 server-only）。",
    },
    {
      group: ['@/extensions/**/providers', '@/extensions/**/providers/**'],
      allowTypeImports: true,
      message:
        "Client 模块禁止导入 '@/extensions/**/providers*'（provider 实现必须保持 server-only）。",
    },
    {
      group: [
        '@/extensions/email/resend',
        '@/extensions/storage/s3',
        '@/extensions/storage/r2',
      ],
      allowTypeImports: true,
      message:
        'Client 模块禁止直接导入 provider 实现（请仅在 server 侧编排）。',
    },
    {
      regex: '\\.server(\\.|$)',
      allowTypeImports: true,
      message:
        "Client 模块禁止导入 '*.server'（请改为依赖 DTO/类型，或在 Server 侧调用后传入）。",
    },
  ],
};

const serverEntryNoRestrictedClientOnlyImports = {
  ...baseNoRestrictedImports,
  paths: [
    ...baseNoRestrictedImports.paths,
    {
      name: 'client-only',
      message:
        "Server 模块禁止导入 'client-only'（该包仅用于标记 client-only 模块）。",
    },
    {
      name: '@/shared/lib/api/client',
      message:
        "Server 模块禁止导入 '@/shared/lib/api/client'（这是 client-side fetch 封装）。",
    },
  ],
  patterns: [
    ...(baseNoRestrictedImports.patterns || []),
    {
      regex: '\\.client(\\.|$)',
      allowTypeImports: true,
      message:
        "Server 模块禁止导入 '*.client'（client-only 代码请通过组件边界或 props 传入）。",
    },
    {
      group: ['@/**/client/**'],
      allowTypeImports: true,
      message:
        "Server 模块禁止导入 '**/client/**'（client-only 代码请通过组件边界或 props 传入）。",
    },
  ],
};

const eslintConfig = [
  {
    ignores: [
      '**/.next/**',
      '**/.open-next/**',
      '**/.cache/**',
      '**/.tmp/**',
      '**/.wrangler/**',
      '**/node_modules/**',
      '**/.source/**',
      '**/.codex/**',
      '**/.gstack/**',
      '**/output/**',
      'src/shared/types/cloudflare.d.ts',
      'temp/**',
      'raphael-starterkit-v1-main/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    plugins: { aooi },
  },
  {
    files: [
      'src/app/api/**/*.{ts,tsx}',
      'src/domains/**/application/**/*.{ts,tsx}',
      'src/domains/**/infra/**/*.{ts,tsx}',
      'src/infra/**/*.{ts,tsx}',
      'src/extensions/**/*.{ts,tsx}',
      'src/shared/lib/api/**/*.{ts,tsx}',
    ],
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      'no-restricted-imports': ['error', baseNoRestrictedImports],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': ['error', noDoubleUnknownTypeAssertion],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx,mts,cts}', 'cloudflare/**/*.{ts,tsx,mts,cts}'],
    ignores: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/**/*.spec.ts',
      'src/**/*.spec.tsx',
      'cloudflare/**/*.test.ts',
      'cloudflare/**/*.test.tsx',
      'cloudflare/**/*.spec.ts',
      'cloudflare/**/*.spec.tsx',
      'src/config/env-contract.ts',
      'src/config/load-dotenv.ts',
      'src/config/public-env.ts',
      'src/config/server-auth-base-url.ts',
      'src/infra/adapters/db/config.ts',
      'src/infra/runtime/env.server.ts',
      'cloudflare/workers/create-server-worker.ts',
    ],
    rules: {
      'no-restricted-properties': ['error', noDirectProcessEnvAccess],
    },
  },
  {
    files: ['src/app/api/**/route.ts'],
    rules: {
      'aooi/require-withapi-route-handlers': 'error',
      'no-restricted-syntax': [
        'error',
        noDoubleUnknownTypeAssertion,
        noThrowVanillaError,
        noThrowVanillaErrorCall,
      ],
    },
  },
  {
    files: [
      'src/app/api/auth/**/route.ts',
      'src/app/api/payment/callback/route.ts',
    ],
    rules: {
      'aooi/require-withapi-route-handlers': 'off',
    },
  },
  {
    files: ['src/app/**/actions.ts', 'src/app/**/actions.tsx'],
    rules: {
      'aooi/require-withaction-server-actions': 'error',
      'no-restricted-syntax': [
        'error',
        noDoubleUnknownTypeAssertion,
        noThrowVanillaError,
        noThrowVanillaErrorCall,
      ],
    },
  },
  {
    files: [
      'src/shared/lib/api/**/*.{ts,tsx}',
      'src/shared/lib/fetch/**/*.{ts,tsx}',
      'src/app/api/**/route.ts',
    ],
    ignores: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/**/*.spec.ts',
      'src/**/*.spec.tsx',
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: process.cwd(),
      },
    },
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
    },
  },
  {
    files: ['src/extensions/**/*.{ts,tsx}'],
    ignores: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/**/*.spec.ts',
      'src/**/*.spec.tsx',
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: process.cwd(),
      },
    },
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
    },
  },
  {
    files: ['scripts/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...baseNoRestrictedImports,
          paths: baseNoRestrictedImports.paths.filter(
            (rule) => rule.name !== '@/config/load-dotenv'
          ),
          patterns: (baseNoRestrictedImports.patterns || []).filter(
            (rule) => rule !== noRuntimeLoadDotenvImportPattern
          ),
        },
      ],
    },
  },
  {
    files: ['src/infra/platform/theme/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "ImportExpression[source.type='TemplateLiteral']",
          message:
            '禁止使用模板字符串动态 import()；请改为显式映射/静态路径，避免隐式 context bundle 与无关 chunk 进入构建产物。',
        },
        noDoubleUnknownTypeAssertion,
      ],
    },
  },
  {
    files: [
      'src/**/*.client.{ts,tsx}',
      'src/**/client/**/*.{ts,tsx}',
      'src/shared/blocks/**/*.{ts,tsx}',
      'src/shared/components/**/*.{ts,tsx}',
      'src/shared/contexts/**/*.{ts,tsx}',
      'src/shared/hooks/**/*.{ts,tsx}',
      'src/themes/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: 'ImportDeclaration[source.value=/^moment/]',
          message:
            "Client surface 建议避免使用 'moment'（体积大且易造成 unused JS）。优先在 Server 侧格式化后传入，或改用更轻量库（如 date-fns/dayjs）。",
        },
        {
          selector:
            "CallExpression[callee.name='require'][arguments.0.value=/^moment/]",
          message:
            "Client surface 建议避免使用 'moment'（体积大且易造成 unused JS）。优先在 Server 侧格式化后传入，或改用更轻量库（如 date-fns/dayjs）。",
        },
        noDoubleUnknownTypeAssertion,
      ],
    },
  },
  {
    files: ['src/shared/types/blocks/**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': [
        'error',
        { allowInterfaces: 'with-single-extends' },
      ],
    },
  },
  {
    files: [
      'src/shared/blocks/**/*.{ts,tsx}',
      'src/shared/components/**/*.{ts,tsx}',
      'src/shared/contexts/**/*.{ts,tsx}',
      'src/shared/hooks/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...clientSurfaceNoRestrictedImports,
          patterns: [
            {
              regex: '^@/infra/(?!platform/(i18n/navigation|auth/client)$).*',
              message:
                "shared UI 层仅允许依赖 '@/infra/platform/i18n/navigation' 与 '@/infra/platform/auth/client'；其它 infra 依赖会扩大耦合面。",
            },
            ...(clientSurfaceNoRestrictedImports.patterns || []),
          ],
        },
      ],
    },
  },
  {
    files: ['src/themes/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...clientSurfaceNoRestrictedImports,
          patterns: [
            {
              regex: '^@/infra/(?!platform/(i18n/navigation|auth/client)$).*',
              message:
                "themes UI 层仅允许依赖 '@/infra/platform/i18n/navigation' 与 '@/infra/platform/auth/client'；其它 infra 依赖会扩大耦合面。",
            },
            ...(clientSurfaceNoRestrictedImports.patterns || []),
          ],
        },
      ],
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: [
      'src/**/*.client.{ts,tsx}',
      'src/**/client/**/*.{ts,tsx}',
      'src/app/**/error.tsx',
      'src/app/**/global-error.tsx',
      'src/shared/lib/api/client.ts',
      'src/infra/platform/theme/provider.tsx',
    ],
    rules: {
      'no-restricted-imports': ['error', clientSurfaceNoRestrictedImports],
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        serverEntryNoRestrictedClientOnlyImports,
      ],
    },
  },
  {
    files: ['src/app/**/route.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...serverEntryNoRestrictedClientOnlyImports,
          patterns: [
            ...(serverEntryNoRestrictedClientOnlyImports.patterns || []),
            {
              group: [
                '@/shared/blocks/**',
                '@/shared/components/**',
                '@/shared/contexts/**',
                '@/themes/**',
              ],
              message:
                'Route Handler 禁止依赖 UI 层（blocks/components/contexts/themes）；请将渲染/模板生成下沉到 shared/lib 或 shared/content。',
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
