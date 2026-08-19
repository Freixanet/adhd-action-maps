import ExpoModulesCore
import PDFKit
import UIKit

private final class PdfThumbFailedException: Exception {
  override var reason: String { "pdf_thumb_failed" }
}

public class NucleoPdfThumbModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NucleoPdfThumb")

    AsyncFunction("renderFirstPage") { (uri: String, size: Int) -> String in
      guard let url = NucleoPdfThumbModule.fileURL(from: uri) else {
        throw PdfThumbFailedException()
      }
      guard let document = PDFDocument(url: url), let page = document.page(at: 0) else {
        throw PdfThumbFailedException()
      }

      let output = CGFloat(max(64, min(512, size)))
      let pageBox = page.bounds(for: .mediaBox)
      guard pageBox.width > 1, pageBox.height > 1 else {
        throw PdfThumbFailedException()
      }

      // Full first page fitted into the square (letterboxed on white).
      let square = CGSize(width: output, height: output)
      let pageImage = page.thumbnail(of: square, for: .mediaBox)
      guard pageImage.size.width > 1, pageImage.size.height > 1 else {
        throw PdfThumbFailedException()
      }

      let format = UIGraphicsImageRendererFormat()
      format.scale = 1
      format.opaque = true
      let renderer = UIGraphicsImageRenderer(size: square, format: format)
      let jpegImage = renderer.image { context in
        UIColor.white.setFill()
        context.fill(CGRect(origin: .zero, size: square))
        let x = (output - pageImage.size.width) / 2
        let y = (output - pageImage.size.height) / 2
        pageImage.draw(in: CGRect(
          origin: CGPoint(x: x, y: y),
          size: pageImage.size
        ))
      }

      guard let data = jpegImage.jpegData(compressionQuality: 0.84) else {
        throw PdfThumbFailedException()
      }

      let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("nucleo-pdf-fab-thumb-native", isDirectory: true)
      try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      let out = dir.appendingPathComponent("\(UUID().uuidString).jpg")
      try data.write(to: out, options: .atomic)
      return out.absoluteString
    }
  }

  private static func fileURL(from uri: String) -> URL? {
    let trimmed = uri.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.hasPrefix("file:") {
      return URL(string: trimmed)
    }
    if trimmed.hasPrefix("/") {
      return URL(fileURLWithPath: trimmed)
    }
    return nil
  }
}
