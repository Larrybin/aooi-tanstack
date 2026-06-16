declare module '../../dist/server/server.mjs' {
  const server: {
    fetch(request: Request): Promise<Response> | Response;
  };
  export default server;
}
