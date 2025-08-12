export type SiteConfig = {
  backend: { prodPort: number; devPort?: number };
  sites?: Record<string, SiteEntry>;
  mobile?: { enabled?: boolean };
  db?: { skip_tables?: string[]; orm?: string };
};

export type SiteEntry = {
  devPort: number;
  domains?: string[];
  mobile?: {
    enabled?: boolean;
  };
  isDefault?: boolean;
};
