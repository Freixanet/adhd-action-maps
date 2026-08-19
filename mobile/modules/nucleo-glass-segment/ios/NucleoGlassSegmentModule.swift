import ExpoModulesCore
import SwiftUI
import UIKit
import Combine

/**
 Visual trial: a native SwiftUI Liquid Glass track with a smaller native glass
 lens for the selected mode. `SystemSegmentedRoot` remains below as a rollback
 reference for the stock iOS segmented control.

 Both surfaces use Apple's `glassEffect`; there are no JS gradients, image
 textures, or UIKit background images in this path.
 */
public class NucleoGlassSegmentModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NucleoGlassSegment")

    Function("isAvailable") { () -> Bool in
      if #available(iOS 26.0, *) { return true }
      return false
    }

    Function("implementationMode") { () -> String in
      if #available(iOS 26.0, *) { return "native_system_segmented" }
      return "fallback_solid"
    }

    View(NucleoGlassSegmentView.self) {
      Events("onIntentChange")

      Prop("selectedIntent") { (view: NucleoGlassSegmentView, intent: String?) in
        view.applyExternalIntent(intent ?? "understand")
      }

      Prop("isEnabled") { (view: NucleoGlassSegmentView, enabled: Bool?) in
        view.model.isEnabled = enabled ?? true
      }

      Prop("themeVariant") { (view: NucleoGlassSegmentView, theme: String?) in
        view.model.themeVariant = theme ?? "auto"
      }

      Prop("trackColor") { (_: NucleoGlassSegmentView, _: String?) in }

      Prop("reduceMotion") { (_: NucleoGlassSegmentView, _: Bool?) in }
    }
  }
}

final class NucleoGlassSegmentView: ExpoView {
  let onIntentChange = EventDispatcher()
  let model = IntentSegmentModel()

  private var hostingController: UIHostingController<AnyView>?
  private var ignoreExternalUntil: CFAbsoluteTime = 0

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    clipsToBounds = false
    backgroundColor = .clear
    isOpaque = false
    isUserInteractionEnabled = true

    model.onConfirmChange = { [weak self] intent in
      guard let self else { return }
      self.ignoreExternalUntil = CFAbsoluteTimeGetCurrent() + 0.35
      self.onIntentChange([
        "intent": intent.rawValue,
        "implementation": "native_system_segmented",
      ])
    }

    if #available(iOS 26.0, *) {
      // Visual trial: native Liquid Glass track + smaller native glass lens.
      // Keep the standard Picker implementation below for an immediate rollback.
      let host = UIHostingController(rootView: AnyView(GlassCompositeSegmentedRoot(model: model)))
      if #available(iOS 16.4, *) {
        host.safeAreaRegions = []
      }
      host.view.backgroundColor = .clear
      host.view.isOpaque = false
      host.view.clipsToBounds = false
      host.view.isUserInteractionEnabled = true
      host.view.insetsLayoutMarginsFromSafeArea = false
      host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      addSubview(host.view)
      hostingController = host
    }
  }

  func applyExternalIntent(_ raw: String) {
    if CFAbsoluteTimeGetCurrent() < ignoreExternalUntil { return }
    let intent = IntentOption(rawValue: raw) ?? .understand
    DispatchQueue.main.async {
      self.model.applyExternal(intent)
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    hostingController?.view.frame = bounds
    hostingController?.view.backgroundColor = .clear
    hostingController?.view.isOpaque = false
    hostingController?.view.clipsToBounds = false
    hostingController?.view.isUserInteractionEnabled = true
    clipsToBounds = false
    backgroundColor = .clear
    isOpaque = false
  }
}

enum IntentOption: String, Equatable, CaseIterable, Hashable {
  case understand
  case apply
}

final class IntentSegmentModel: ObservableObject {
  @Published var selection: IntentOption = .understand
  @Published var isEnabled: Bool = true
  @Published var themeVariant: String = "auto"

  var onConfirmChange: ((IntentOption) -> Void)?
  private var suppressEmit = false

  func applyExternal(_ intent: IntentOption) {
    guard selection != intent else { return }
    suppressEmit = true
    selection = intent
    suppressEmit = false
  }

  func userDidSelect(_ intent: IntentOption) {
    guard isEnabled, !suppressEmit, selection != intent else { return }
    selection = intent
    onConfirmChange?(intent)
  }
}

@available(iOS 26.0, *)
struct SystemSegmentedRoot: View {
  @ObservedObject var model: IntentSegmentModel

  /// Full product width — do not shrink. Height/indicator owned by the system.
  private let outerWidth: CGFloat = 196
  /// Room for the press-expanded Liquid Glass lens outside the track.
  private let overflowPad: CGFloat = 24

  private var preferredScheme: ColorScheme? {
    switch model.themeVariant {
    case "dark": return .dark
    case "light": return .light
    default: return nil
    }
  }

  var body: some View {
    Picker("Modo", selection: binding) {
      Text("Entender").tag(IntentOption.understand)
      Text("Aplicar").tag(IntentOption.apply)
    }
    .pickerStyle(.segmented)
    .labelsHidden()
    .controlSize(.large)
    .frame(width: outerWidth)
    .disabled(!model.isEnabled)
    .opacity(model.isEnabled ? 1 : 0.4)
    .preferredColorScheme(preferredScheme)
    // Host must not clip the system lens when it blooms past the track.
    .padding(overflowPad)
    .frame(
      width: outerWidth + overflowPad * 2,
      height: 44 + overflowPad * 2
    )
  }

  private var binding: Binding<IntentOption> {
    Binding(
      get: { model.selection },
      set: { model.userDidSelect($0) }
    )
  }
}

@available(iOS 26.0, *)
private struct GlassCompositeSegmentedRoot: View {
  @ObservedObject var model: IntentSegmentModel
  @Namespace private var glassNamespace

  private let outerWidth: CGFloat = 196
  private let trackHeight: CGFloat = 44
  private let overflowPad: CGFloat = 24
  private let lensHorizontalInset: CGFloat = 10
  private let lensVerticalInset: CGFloat = 6

  private var preferredScheme: ColorScheme? {
    switch model.themeVariant {
    case "dark": return .dark
    case "light": return .light
    default: return nil
    }
  }

  var body: some View {
    ZStack {
      // Keep the track as its own native glass surface.  It is intentionally
      // not grouped with the lens: grouping overlapping effects makes iOS
      // merge them into one broad blur instead of showing a smaller thumb.
      Capsule()
        .fill(.clear)
        .frame(width: outerWidth, height: trackHeight)
        .glassEffect(.regular, in: Capsule())
        .allowsHitTesting(false)

      HStack(spacing: 0) {
        optionButton(.understand)
        optionButton(.apply)
      }
      .frame(width: outerWidth, height: trackHeight)
    }
    .animation(.snappy(duration: 0.32), value: model.selection)
    .frame(width: outerWidth + overflowPad * 2, height: trackHeight + overflowPad * 2)
    .padding(overflowPad)
    .preferredColorScheme(preferredScheme)
  }

  @ViewBuilder
  private func optionButton(_ option: IntentOption) -> some View {
    let selected = model.selection == option

    Button {
      model.userDidSelect(option)
    } label: {
      ZStack {
        if selected {
          // Deliberately smaller than the track; the system interactive glass
          // may still bloom beyond this frame while the finger is down.
          Capsule()
            .fill(.clear)
            .frame(
              width: outerWidth / 2 - lensHorizontalInset * 2,
              height: trackHeight - lensVerticalInset * 2
            )
            .glassEffect(.regular.interactive(), in: Capsule())
            .glassEffectID("selected-intent", in: glassNamespace)
        }

        Text(option == .understand ? "Entender" : "Aplicar")
          .font(.system(size: 17, weight: selected ? .semibold : .regular))
          .foregroundStyle(selected ? .primary : .secondary)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .disabled(!model.isEnabled)
    .accessibilityLabel(option == .understand ? "Entender" : "Aplicar")
    .accessibilityAddTraits(selected ? .isSelected : [])
  }
}
