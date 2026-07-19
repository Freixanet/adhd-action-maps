import SwiftUI
import UniformTypeIdentifiers

// UIKit bridge for security-scoped file URLs; SwiftUI's fileImporter presents it.
struct DocumentPicker: UIViewControllerRepresentable {
    let onSelection: (URL) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onSelection: onSelection) }
    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.pdf, .plainText, .commaSeparatedText])
        picker.delegate = context.coordinator
        return picker
    }
    func updateUIViewController(_ controller: UIDocumentPickerViewController, context: Context) {}

    final class Coordinator: NSObject, UIDocumentPickerDelegate {
        let onSelection: (URL) -> Void
        init(onSelection: @escaping (URL) -> Void) { self.onSelection = onSelection }
        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            if let url = urls.first { onSelection(url) }
        }
    }
}
