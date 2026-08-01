declare module '*dist/server/entry.server.mjs' {
  const server: {
    fetch(request: Request): Promise<Response> | Response;
  };
  export default server;
}
