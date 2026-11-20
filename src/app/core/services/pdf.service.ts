import { Injectable } from '@angular/core';

/**
 * Prints one document (bulletin, languages sheet...) and nothing else.
 * The element is copied into a dedicated #print-root container; while printing,
 * every other part of the page (menus, tabs, buttons, other cards) is hidden.
 * "Save as PDF" in the print dialog gives the PDF, named after the document.
 */
@Injectable({ providedIn: 'root' })
export class PdfService {
  printDocument(documentTitle: string, source?: HTMLElement | null) {
    const originalTitle = document.title;
    document.title = documentTitle;

    let root: HTMLElement | null = null;
    if (source) {
      document.getElementById('print-root')?.remove();
      root = document.createElement('div');
      root.id = 'print-root';
      // The copy keeps Angular's style attributes, so the document looks the same.
      root.appendChild(source.cloneNode(true));
      document.body.appendChild(root);
      document.body.classList.add('printing-document');
    }

    const cleanup = () => {
      document.title = originalTitle;
      root?.remove();
      document.body.classList.remove('printing-document');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  }
}
