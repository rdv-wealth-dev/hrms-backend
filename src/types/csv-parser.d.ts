declare module 'csv-parser' {
  import { Transform } from 'stream';

  interface Options {
    escape?: string;
    headers?: string[] | boolean;
    mapHeaders?: (args: { header: string; index: number }) => string | null;
    mapValues?: (args: { header: string; index: number; value: string }) => any;
    newline?: string;
    quote?: string;
    raw?: boolean;
    separator?: string;
    skipLines?: number;
    maxRowBytes?: number;
    strict?: boolean;
  }

  function csvParser(options?: Options | string[]): Transform;

  export = csvParser;
}
