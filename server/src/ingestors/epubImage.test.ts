import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";

const execFileAsync = promisify(execFile);

async function buildMinimalEpub(bytesHint = 200_000): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "nucleo-epub-fix-"));
  try {
    await writeFile(path.join(dir, "mimetype"), "application/epub+zip", "utf8");
    await mkdir(path.join(dir, "META-INF"), { recursive: true });
    await writeFile(
      path.join(dir, "META-INF", "container.xml"),
      `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
      "utf8"
    );
    await mkdir(path.join(dir, "OEBPS"), { recursive: true });

    const unit =
      "El TDAH afecta la memoria de trabajo y la atención sostenida. " +
      "Cada párrafo añade evidencia distinta para evitar compresión extrema. ";
    let filler = "";
    let i = 0;
    while (Buffer.byteLength(filler, "utf8") < bytesHint) {
      filler += `${unit} [#${i}] `;
      i += 1;
    }
    const mid = Math.floor(filler.length / 2);
    const ch1 = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Uno</title></head><body><h1>Capítulo Uno</h1><p>${filler.slice(0, mid)}</p></body></html>`;
    const ch2 = `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Dos</title></head><body><h1>Capítulo Dos</h1><p>${filler.slice(mid)}</p></body></html>`;
    await writeFile(path.join(dir, "OEBPS", "ch1.xhtml"), ch1, "utf8");
    await writeFile(path.join(dir, "OEBPS", "ch2.xhtml"), ch2, "utf8");
    await writeFile(
      path.join(dir, "OEBPS", "content.opf"),
      `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Libro de prueba</dc:title>
    <dc:language>es</dc:language>
    <dc:identifier id="BookId">urn:uuid:nucleo-test</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="ch1"/>
    <itemref idref="ch2"/>
  </spine>
</package>`,
      "utf8"
    );
    await writeFile(
      path.join(dir, "OEBPS", "toc.ncx"),
      `<?xml version="1.0"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:uuid:nucleo-test"/></head>
  <docTitle><text>Libro de prueba</text></docTitle>
  <navMap>
    <navPoint id="nav1" playOrder="1">
      <navLabel><text>Capítulo Uno</text></navLabel>
      <content src="ch1.xhtml"/>
    </navPoint>
    <navPoint id="nav2" playOrder="2">
      <navLabel><text>Capítulo Dos</text></navLabel>
      <content src="ch2.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`,
      "utf8"
    );

    const out = path.join(dir, "book.epub");
    // EPUB requires mimetype first and stored uncompressed.
    await execFileAsync("zip", ["-X0", out, "mimetype"], { cwd: dir });
    await execFileAsync(
      "zip",
      ["-Xr0", out, "META-INF", "OEBPS"],
      { cwd: dir }
    );
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe("epubIngestor hierarchical chapters", () => {
  afterEach(() => {
    process.env.ENABLE_EXPANDED_INPUTS = "true";
  });

  it("parses ~200KB epub into chunks with chapterTitle", async () => {
    process.env.ENABLE_EXPANDED_INPUTS = "true";
    const buffer = await buildMinimalEpub(200_000);
    expect(buffer.byteLength).toBeGreaterThan(50_000);

    const { epubIngestor } = await import("./epubIngestor");
    const result = await epubIngestor.ingest({
      buffer,
      mime: "application/epub+zip",
      ext: "epub",
      fileName: "sample.epub",
    });

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chapters?.length).toBeGreaterThanOrEqual(2);
    expect(result.chunks.some((c) => c.loc.chapterTitle)).toBe(true);
    expect(result.chunks.every((c) => typeof c.loc.start === "number")).toBe(true);
    expect(result.metadata.type).toBe("epub");
  }, 60_000);
});

describe("imageIngestor hybrid OCR", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("returns OCR text as chunk substring", async () => {
    process.env.ENABLE_EXPANDED_INPUTS = "true";
    vi.resetModules();
    vi.doMock("tesseract.js", () => ({
      recognize: async () => ({
        data: { text: "El TDAH afecta la atención sostenida." },
      }),
    }));

    const { imageIngestor } = await import("./imageIngestor");
    const buffer = Buffer.from("fake-image-bytes");
    const result = await imageIngestor.ingest({
      buffer,
      mime: "image/jpeg",
      ext: "jpg",
      fileName: "image.jpg",
    });

    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0]!.text).toContain("TDAH");
    expect(result.chunks[0]!.loc.imageId).toBeTruthy();
  });
});
