import type { SiteConfig, SiteEntry } from "../types";

// Type declaration for browser globals
declare const window: {
  location: {
    port: string;
    hostname: string;
    protocol: string;
    origin: string;
  };
} | undefined;

export const defineBaseUrl = <T extends SiteConfig>(config: T) => {
  let defaultSite: SiteEntry | null = null;
  let defaultSiteName = "";

  // Handle simple case when no sites defined
  if (!config.sites || Object.keys(config.sites).length === 0) {
    // Return simple URL based on current location
    return new Proxy({}, {
      get() {
        if (typeof window === "undefined") {
          return `http://localhost:${config.backend?.devPort || config.backend?.prodPort || 7500}`;
        }
        // In production (HTTPS), use current origin
        if (window.location.protocol === "https:") {
          return window.location.origin;
        }
        // In development, use configured port
        return `http://${window.location.hostname}:${config.backend?.prodPort || 7500}`;
      }
    });
  }

  if (config.sites) {
    for (const siteName in config.sites) {
      const site = config.sites[siteName];
      if (site) {
        if (site.isDefault || (site as any).default) {
          defaultSite = site;
          defaultSiteName = siteName;
        }
      }
    }
    // If no default site is marked, use the first site as default
    if (!defaultSite && Object.keys(config.sites).length > 0) {
      const firstSiteName = Object.keys(config.sites)[0];
      defaultSite = config.sites[firstSiteName];
      defaultSiteName = firstSiteName;
    }
  }

  return new Proxy(
    {},
    {
      get(target, p: keyof typeof config.sites, receiver) {
        // If we're in HTTPS (production), always use current origin
        if (typeof window !== "undefined" && window.location.protocol === "https:") {
          return window.location.origin;
        }
        
        let mode = "dev";
        if (typeof window === "undefined") {
          // Server-side rendering or Node.js environment
          const site = config.sites?.[p.replace(/_/g, ".")];
          if (mode === "dev") {
            const devPort = site?.devPort || defaultSite?.devPort || config.backend?.devPort || 3000;
            return `http://localhost:${devPort}`;
          }
          // In production, still use localhost with prod port for server-side
          const prodPort = config.backend?.prodPort || 7500;
          return `http://localhost:${prodPort}`;
        }
        if (
          (typeof window !== "undefined" && parseInt(window.location.port) === config.backend.prodPort &&
            window.location.hostname !== "localhost") ||
          (typeof window !== "undefined" && window.location.protocol === "https:")
        ) {
          mode = "prod";
        }

        let isGithubCodespace = false;
        if (typeof window !== "undefined" && window.location.hostname.endsWith("github.dev")) {
          mode = "dev";
          isGithubCodespace = true;
        }

        let isFirebaseStudio = false;
        if (typeof window !== "undefined" && window.location.hostname.endsWith(".cloudworkstations.dev")) {
          mode = "dev";
          isFirebaseStudio = true;
        }

        if (mode === "dev") {
          const site = config.sites?.[p.replace(/_/g, ".")];

          if (isGithubCodespace && site) {
            const parts = window.location.hostname.split("-");

            const lastPart = parts[parts.length - 1]!.split("-");
            lastPart[0] = site.devPort + "";
            parts[parts.length - 1] = lastPart.join("-");

            return `https://${parts.join("-")}`;
          }

          if (isFirebaseStudio && site) {
            const parts = window.location.hostname.split("-");
            parts[0] = site.devPort + "";

            return `https://${parts.join("-")}`;
          }

          let devPort = site ? site.devPort : defaultSite?.devPort;
          if (!devPort) {
            devPort = typeof window !== "undefined" ? parseInt(window.location.port) : 3000;
          }

          return `http://${typeof window !== "undefined" ? window.location.hostname : 'localhost'}:${devPort}`;
        } else {
          // Production mode
          const site = config.sites?.[p.replace(/_/g, ".")];

          // If we're in a browser, use the current origin for HTTPS
          if (typeof window !== "undefined" && window.location.protocol === "https:") {
            return window.location.origin;
          }

          if (site) {
            if (site.domains) {
              const tld = typeof window !== "undefined" ? window.location.hostname.split(".").pop() : undefined;

              for (const domain of site.domains) {
                if (tld && domain.endsWith(`.${tld}`)) {
                  const url = new URL(`${typeof window !== "undefined" ? window.location.protocol : 'https:'}//${domain}`);

                  if (typeof window !== "undefined" && window.location.port && !["443", "80"].includes(window.location.port)) {
                    url.port = window.location.port;
                  }

                  const finalUrl = url.toString();
                  return finalUrl.substring(0, finalUrl.length - 1);
                }
              }
              // If no domain matches but site has domains, use first one
              if (site.domains.length > 0) {
                return `https://${site.domains[0]}`;
              }
            }
          }
          
          // Fallback to defaultSite or current origin
          if (defaultSite?.domains?.[0]) {
            return `https://${defaultSite.domains[0]}`;
          }
          
          // Final fallback - use current origin if in browser, otherwise localhost
          if (typeof window !== "undefined") {
            return window.location.origin;
          }
          return `http://localhost:${config.backend?.prodPort || 7500}`;
        }

        // Default fallback for any unknown domain
        if (typeof window === "undefined") {
          return `http://localhost:${config.backend?.devPort || config.backend?.prodPort || 7500}`;
        }
        if (window.location.protocol === "https:") {
          return window.location.origin;
        }
        return `http://${window.location.hostname}:${config.backend?.prodPort || 7500}`;
      },
    }
  ) as unknown as {
    [K in keyof T["sites"] as K extends string
      ? K extends `${infer A}.${infer B}`
        ? `${A}_${B}`
        : K
      : K]: string;
  } & { default: string };
};
