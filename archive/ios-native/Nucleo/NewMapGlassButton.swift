import SwiftUI

/// A compact, floating primary action that uses only public SwiftUI APIs.
struct NewMapGlassButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            buttonLabel
        }
        .buttonStyle(FloatingActionButtonStyle())
        .accessibilityLabel("Nuevo mapa")
        .accessibilityHint("Abre un mapa nuevo")
    }

    @ViewBuilder
    private var buttonLabel: some View {
        let label = Label("Nuevo mapa", systemImage: "plus")
            .font(.subheadline.weight(.semibold))
            .labelStyle(.titleAndIcon)
            .foregroundStyle(.primary)
            .padding(.horizontal, 16)
            .frame(minHeight: 44)
            .contentShape(Capsule())

        if #available(iOS 26.0, *) {
            label
                .glassEffect(.regular.interactive(), in: Capsule())
        } else {
            label
                .background(.thinMaterial, in: Capsule())
                .overlay {
                    Capsule().strokeBorder(.primary.opacity(0.12), lineWidth: 0.5)
                }
                .shadow(color: .black.opacity(0.14), radius: 12, y: 6)
        }
    }
}

private struct FloatingActionButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.82 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.16), value: configuration.isPressed)
    }
}
