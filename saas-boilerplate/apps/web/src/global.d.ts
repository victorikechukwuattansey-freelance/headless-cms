interface Window {
  plausible?: (
    event: string,
    options?: { u?: string; props?: Record<string, string | number | boolean> },
  ) => void;
  gtag?: (...args: any[]) => void;
  dataLayer?: any[];
}
