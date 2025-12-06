// app/globals.d.ts
declare global {
  interface HTMLElementTagNameMap {
    "p-grid": Grid;
  }
}

declare namespace React {
  namespace JSX {
    interface IntrinsicElements {
      "p-grid": {
        src?: string;
        ref?: any;
        config?: any;
        [key: string]: any;
      };
    }
  }
}

export {};
