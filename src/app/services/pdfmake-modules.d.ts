/**
 * Local type declarations for the untyped PDF libraries used by pdfExport.ts.
 *
 * - `html-to-pdfmake` ships no TypeScript types.
 * - `pdfmake`'s @types package declares a *named* ESM API that does not match
 *   the runtime 0.3.x package (a single default instance), so the concrete
 *   `build/pdfmake` entry points are typed here instead.
 */

declare module "html-to-pdfmake" {
  interface HtmlToPdfmakeOptions {
    defaultStyles?: Record<string, Record<string, unknown> | null>;
    tableAutoSize?: boolean;
    imagesByReference?: boolean;
    removeExtraBlanks?: boolean;
    showHidden?: boolean;
    removeTagClasses?: boolean;
    ignoreStyles?: string[];
    fontSizes?: number[];
    replaceText?: (text: string, nodes: Element[]) => string;
    window?: Window;
  }

  interface HtmlToPdfmakeResult {
    content: any;
    images?: Record<string, string>;
  }

  function htmlToPdfmake(
    htmlText: string,
    options?: HtmlToPdfmakeOptions
  ): HtmlToPdfmakeResult;

  export default htmlToPdfmake;
}

declare module "pdfmake/build/pdfmake" {
  interface CreatedPdf {
    download(filename?: string, callback?: () => void): void;
    getBuffer(callback: (buffer: Uint8Array) => void): void;
    getDataUrl(callback: (dataUrl: string) => void): void;
    open(options?: { print?: boolean; landscape?: boolean }): void;
    print(options?: { silent?: boolean; printMode?: string }): void;
    save(filename?: string): void;
  }

  interface PdfMakeInstance {
    vfs: Record<string, string>;
    fonts: Record<string, unknown>;
    addVirtualFileSystem(vfs: Record<string, string>): void;
    addFonts(fonts: Record<string, unknown>): void;
    createPdf(documentDefinitions: any): CreatedPdf;
  }

  const pdfMake: PdfMakeInstance;
  export default pdfMake;
}

declare module "pdfmake/build/vfs_fonts" {
  const vfs: Record<string, string>;
  export default vfs;
}
