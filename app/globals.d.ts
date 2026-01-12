// app/globals.d.ts
import "react";

// 1. Define specific interfaces for your data structures
interface ViewDesignProps {
  meta?: any; // Use your specific Meta type if known
  media?: any; // Use your specific Media type if known
  data?: any; // Matches (item.data as { design?: unknown })?.design
  config?: any; // Matches customization.config

  // Standard HTML attributes (className, style, id, etc.)
  children?: React.ReactNode;
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "p-grid": {
        src?: string;
        ref?: any;
        config?: any;
        [key: string]: any;
      };
      // 2. Assign the custom interface to the tag
      "p-viewdesign": ViewDesignProps & React.HTMLAttributes<HTMLElement>;
      "p-product-grid": any;
    }
  }
}

export {};
