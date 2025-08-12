import type { ApiDefinitions } from "../../server/api/types";
import type { SiteConfig } from "../types";
import { defineBaseUrl } from "../util/base-url";

export const apiClient = <T extends ApiDefinitions, K extends keyof T>(
  api: T,
  endpoints: any,
  config: SiteConfig & {
    fetch?: (arg: { url: string; body: any }) => Promise<any>;
  },
  domain?: K
) => {
  const result = {};

  type Methods = K extends string ? T[K] : T;
  type MethodKeys = keyof Methods;

  return new Proxy(
    {},
    {
      get(target, p, receiver) {
        return async (...args: any[]) => {
          const urls = domain ? endpoints[domain] : endpoints;

          const url = urls[p];
          if (typeof url !== "string") {
            throw new Error("URL not found");
          }

          let base = defineBaseUrl(config);

          // Handle "_" domain as default or first available domain
          let baseUrl: string;
          if (domain === "_" || !domain) {
            // Use default domain or first available domain
            const firstSite = Object.keys(config.sites || {})[0];
            if (firstSite) {
              const siteKey = firstSite.replace(/\./g, "_");
              baseUrl = base[siteKey];
            } else {
              // No sites configured, use a fallback
              if (typeof window !== "undefined") {
                if (window.location.protocol === "https:") {
                  baseUrl = window.location.origin;
                } else {
                  baseUrl = `http://${window.location.hostname}:${config.backend?.prodPort || 7500}`;
                }
              } else {
                baseUrl = `http://localhost:${config.backend?.devPort || config.backend?.prodPort || 7500}`;
              }
            }
          } else {
            baseUrl = base[domain as string] as string;
          }
          
          // Fallback if baseUrl is still undefined
          if (!baseUrl) {
            if (typeof window !== "undefined") {
              if (window.location.protocol === "https:") {
                baseUrl = window.location.origin;
              } else {
                baseUrl = `http://${window.location.hostname}:${config.backend?.prodPort || 7500}`;
              }
            } else {
              baseUrl = `http://localhost:${config.backend?.devPort || config.backend?.prodPort || 7500}`;
            }
          }

          const finalUrl = new URL(baseUrl);
          finalUrl.pathname = url;

          const _fetch =
            config.fetch ||
            (async () => {
              const result = await fetch(finalUrl, {
                method: "POST",
                body: JSON.stringify(args),
              });

              if (!result.ok || result.status >= 300) {
                const errorText = await result.text();
                let errorData: any = {};
                try {
                  errorData = JSON.parse(errorText);
                } catch (e) {
                  // Ignore JSON parse error
                }

                if (errorData.__error) {
                  throw new Error(errorData.__error);
                }
                // If the error is not JSON, throw the raw text
                throw new Error(errorText);
              }

              const data = await result.json();
              return data;
            });

          return await _fetch({ url: finalUrl.toString(), body: args });
        };
      },
    }
  ) as {
    [M in MethodKeys]: Methods[M] extends [...any, infer R]
      ? R extends { handler?: infer P }
        ? P
        : never
      : never;
  };
};
