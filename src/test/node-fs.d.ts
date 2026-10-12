// The app is typed for the browser. Tests that run in Node read a file now and then
// (the font shipped in public/); this is all of Node they need to know.
declare module 'node:fs/promises' {
  export function readFile(path: string): Promise<Uint8Array>
  export function writeFile(path: string, data: Uint8Array): Promise<void>
}
