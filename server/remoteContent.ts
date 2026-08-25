import { secureFetch } from "./src/lib/secureFetcher";

/** Fetch public http(s) pages with SSRF guards, redirect checks, and size caps. */
export async function fetchUrlContent(url: string): Promise<string> {
  return (await secureFetch(url)).text;
}
