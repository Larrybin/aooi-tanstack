export type ProviderNameKeyFn = (name: unknown) => string;

export const trimmedProviderNameKey: ProviderNameKeyFn = (name) =>
  typeof name === 'string' ? name.trim() : '';

type RegistryOptions = {
  toNameKey: ProviderNameKeyFn;
};

type ErrorFactory = (name: string) => Error;

export class ProviderRegistry<T extends { readonly name: string }> {
  private providers: T[] = [];
  private readonly toNameKey: ProviderNameKeyFn;

  constructor(options: RegistryOptions) {
    this.toNameKey = options.toNameKey;
  }

  addUnique(
    provider: T,
    options: {
      invalidNameError: ErrorFactory;
      duplicateNameError: ErrorFactory;
    }
  ): void {
    const name = this.toNameKey(provider?.name);
    if (!name) {
      throw options.invalidNameError('');
    }
    if (this.has(name)) {
      throw options.duplicateNameError(name);
    }
    this.providers.push(provider);
  }

  has(name: string): boolean {
    const key = this.toNameKey(name);
    return this.providers.some((p) => this.toNameKey(p.name) === key);
  }

  get(name: string): T | undefined {
    const key = this.toNameKey(name);
    return this.providers.find((p) => this.toNameKey(p.name) === key);
  }

  getDefault(): T | undefined {
    return this.providers[0];
  }
}
