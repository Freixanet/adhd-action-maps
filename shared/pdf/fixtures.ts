/**
 * Deterministic PDF fixtures for S08 (pdfkit). No network.
 */

import PDFDocument from 'pdfkit';

function collectPdf(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false, margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    build(doc);
    doc.end();
  });
}

export async function fixtureTextualPdf(): Promise<Buffer> {
  return collectPdf((doc) => {
    doc.addPage();
    doc.fontSize(14).text(
      'La atención sostenida mejora cuando se reduce el ruido externo y se fija un bloque de doce minutos.',
      { width: 480 }
    );
    doc.moveDown();
    doc.text(
      'Una prueba concreta: escribe un párrafo sin abrir el correo durante ese bloque.',
      { width: 480 }
    );
  });
}

export async function fixtureMultipagePdf(): Promise<Buffer> {
  return collectPdf((doc) => {
    doc.addPage();
    doc.fontSize(14).text('Página uno: la memoria de trabajo guarda pocos elementos a la vez.', {
      width: 480,
    });
    doc.addPage();
    doc.fontSize(14).text(
      'Página dos: externalizar la lista libera capacidad para el siguiente paso.',
      { width: 480 }
    );
    doc.addPage();
    doc.fontSize(14).text(
      'Página tres: revisar al terminar el bloque qué supuesto falló, si alguno.',
      { width: 480 }
    );
  });
}

export async function fixtureUnicodePdf(): Promise<Buffer> {
  return collectPdf((doc) => {
    doc.addPage();
    doc.fontSize(14).text('Unicode café ☕ y emoji 🧠 con offsets UTF-16 en el mismo párrafo.', {
      width: 480,
    });
  });
}

/** Minimal valid PDF with no text operators — treated as empty/scanned. */
export function fixtureEmptyPagePdf(): Buffer {
  // One-page PDF with empty content stream.
  const content = `1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << >> >>endobj
4 0 obj<< /Length 0 >>stream
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000068 00000 n 
0000000125 00000 n 
0000000230 00000 n 
trailer<< /Size 5 /Root 1 0 R >>
startxref
279
%%EOF`;
  return Buffer.from(`%PDF-1.4\n${content}`, 'latin1');
}

/** Truncated after header — corrupt. */
export function fixtureCorruptPdf(): Buffer {
  return Buffer.from('%PDF-1.4\n1 0 obj<< /Type /Catalog', 'latin1');
}

/** Declares Encrypt dict — rejected as encrypted. */
export function fixtureEncryptedPdf(): Buffer {
  const body = `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>endobj
4 0 obj<< /Length 0 >>stream
endstream
endobj
5 0 obj<< /Filter /Standard /V 1 /R 2 /O (none) /U (none) /P -4 >>endobj
trailer<< /Size 6 /Root 1 0 R /Encrypt 5 0 R >>
startxref
0
%%EOF`;
  return Buffer.from(body, 'latin1');
}

export function fixtureFakeMimeBytes(): Buffer {
  return Buffer.from('not a pdf at all — just plain text pretending', 'utf8');
}

export async function fixturePartialScannedPdf(): Promise<Buffer> {
  return collectPdf((doc) => {
    doc.addPage();
    doc.fontSize(14).text(
      'Solo la primera página tiene texto nativo extraíble para S08 partial.',
      { width: 480 }
    );
    // Second page intentionally blank (no text operators) → empty/scanned slot.
    doc.addPage();
  });
}

export async function fixtureLongPagePdf(): Promise<Buffer> {
  const paragraph =
    'La memoria de trabajo sostiene pocas piezas. Externalizar la lista libera capacidad. ';
  const body = paragraph.repeat(40); // > CHUNK_SIZE so segmentation crosses boundaries
  return collectPdf((doc) => {
    doc.addPage();
    doc.fontSize(12).text(body, { width: 480 });
  });
}

export async function fixtureRepeatedTextPdf(): Promise<Buffer> {
  const line = 'Frase idéntica en páginas distintas para anclas por página.';
  return collectPdf((doc) => {
    doc.addPage();
    doc.fontSize(14).text(line, { width: 480 });
    doc.addPage();
    doc.fontSize(14).text(line, { width: 480 });
  });
}

/** 1×1 red PNG (deterministic). */
function tinyPngBuffer(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
}

/** Fully image-only PDF — no text operators; must yield PDF_SCANNED. */
export async function fixtureImageOnlyPdf(): Promise<Buffer> {
  const png = tinyPngBuffer();
  return collectPdf((doc) => {
    doc.addPage();
    doc.image(png, 100, 100, { width: 200, height: 200 });
  });
}

/** Mixed: page 1 text, page 2 image-only → partial coverage. */
export async function fixtureMixedTextAndImagePdf(): Promise<Buffer> {
  const png = tinyPngBuffer();
  return collectPdf((doc) => {
    doc.addPage();
    doc.fontSize(14).text(
      'Página textual: la memoria de trabajo guarda pocas piezas a la vez.',
      { width: 480 }
    );
    doc.addPage();
    doc.image(png, 80, 80, { width: 240, height: 240 });
  });
}

/** Deterministic PDF with > MAX_PDF_PAGES pages (slow fixture — tests only). */
export async function fixtureTooManyPagesPdf(pageCount = 401): Promise<Buffer> {
  return collectPdf((doc) => {
    for (let i = 0; i < pageCount; i += 1) {
      doc.addPage({ size: [200, 200], margin: 10 });
      doc.fontSize(8).text(`p${i + 1}`);
    }
  });
}
