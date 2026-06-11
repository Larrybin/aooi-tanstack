interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

type R2PutValue =
  | ArrayBuffer
  | ArrayBufferView
  | Blob
  | ReadableStream
  | string
  | null;

type R2PutOptions = {
  httpMetadata?: {
    contentType?: string;
    contentDisposition?: string;
  };
};

interface R2Bucket {
  put(key: string, value: R2PutValue, options?: R2PutOptions): Promise<unknown>;
  get(key: string): Promise<unknown>;
  delete(key: string | string[]): Promise<number>;
}

interface ImagesBinding {
  input(stream: ReadableStream<Uint8Array>): {
    transform(transform: Record<string, unknown>): {
      output(options: Record<string, unknown>): {
        response(): Response;
        contentType(): string | null;
      };
    };
  };
}
