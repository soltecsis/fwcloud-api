import 'content-disposition';

// TSOA brings @types/koa 2.x, which still refers to Options. The bundled types
// in content-disposition 2.x (used by Express 5.3) call that type CreateOptions.
// Remove this alias when the transitive Koa declarations support the new name.
declare module 'content-disposition' {
  export type Options = CreateOptions;
}
