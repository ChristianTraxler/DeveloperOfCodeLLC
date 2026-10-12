// Just enough of the Deno runtime for tsc to check the Edge Functions from Node.
declare namespace Deno {
  export const env: {
    get(key: string): string | undefined
    toObject(): Record<string, string>
  }
  export function serve(handler: (req: Request, info?: unknown) => Response | Promise<Response>): unknown
}
