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

    Function("supportsMultiSegment") { () -> Bool in
      if #available(iOS 26.0, *) { return true }
      return false
    }

    View(NucleoGlassSegmentView.self) {
      Events("onIntentChange")

      Prop("selectedIntent") { (view: NucleoGlassSegmentView, intent: String?) in
        view.applyExternalIntent(intent ?? "understand")
      }

      Prop("selectedId") { (view: NucleoGlassSegmentView, id: String?) in
        guard let id, !id.isEmpty else { return }
        view.applyExternalIntent(id)
      }

      Prop("optionIds") { (view: NucleoGlassSegmentView, ids: [String]?) in
        view.model.optionIds = ids ?? []
        view.refreshMultiSegmentControl()
      }

      Prop("optionLabels") { (view: NucleoGlassSegmentView, labels: [String]?) in
        view.model.optionLabels = labels ?? []
        view.refreshMultiSegmentControl()
      }

      Prop("isEnabled") { (view: NucleoGlassSegmentView, enabled: Bool?) in
        view.model.isEnabled = enabled ?? true
        view.segmentedControl?.isEnabled = view.model.isEnabled
      }

      Prop("themeVariant") { (view: NucleoGlassSegmentView, theme: String?) in
        view.model.themeVariant = theme ?? "auto"
        view.applyThemeVariant()
      }

      Prop("trackColor") { (_: NucleoGlassSegmentView, _: String?) in }

      Prop("reduceMotion") { (_: NucleoGlassSegmentView, _: Bool?) in }
    }
  }
}

final class NucleoGlassSegmentView: ExpoView {
  let onIntentChange = EventDispatcher()
  let model = IntentSegmentModel()
  var segmentedControl: UISegmentedControl?

  private var hostingController: UIHostingController<AnyView>?
  private var ignoreExternalUntil: CFAbsoluteTime = 0
  private let overflowPad: CGFloat = 24
  /// Same inner inset on the first and last titles, so left of Esencia
  /// matches right of Conceptos.
  private let titleEndInset: CGFloat = 12

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    clipsToBounds = false
    backgroundColor = .clear
    isOpaque = false
    isUserInteractionEnabled = true

    model.onConfirmChange = { [weak self] id in
      guard let self else { return }
      self.ignoreExternalUntil = CFAbsoluteTimeGetCurrent() + 0.35
      self.onIntentChange([
        "intent": id,
        "implementation": "native_system_segmented",
      ])
    }

    if #available(iOS 26.0, *) {
      let host = UIHostingController(rootView: AnyView(AdaptiveSegmentRoot(model: model)))
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
    DispatchQueue.main.async {
      self.model.applyExternalId(raw)
      self.applySelectedIndex()
    }
  }

  func applyThemeVariant() {
    switch model.themeVariant {
    case "dark": overrideUserInterfaceStyle = .dark
    case "light": overrideUserInterfaceStyle = .light
    default: overrideUserInterfaceStyle = .unspecified
    }
  }

  func refreshMultiSegmentControl() {
    let ids = model.optionIds
    let labels = model.optionLabels
    let multi = ids.count >= 2 && labels.count == ids.count
    hostingController?.view.isHidden = multi
    if !multi {
      segmentedControl?.isHidden = true
      return
    }

    let control = segmentedControl ?? UISegmentedControl()
    if segmentedControl == nil {
      control.apportionsSegmentWidthsByContent = false
      control.addTarget(self, action: #selector(onSegmentChanged(_:)), for: .valueChanged)
      addSubview(control)
      segmentedControl = control
    }
    control.isHidden = false
    control.isEnabled = model.isEnabled
    if control.numberOfSegments != labels.count {
      control.removeAllSegments()
      for (index, label) in labels.enumerated() {
        control.insertSegment(withTitle: label, at: index, animated: false)
      }
    } else {
      for (index, label) in labels.enumerated() where control.titleForSegment(at: index) != label {
        control.setTitle(label, forSegmentAt: index)
      }
    }
    applySelectedIndex()
    setNeedsLayout()
  }

  func applySelectedIndex() {
    guard let control = segmentedControl, !control.isHidden else { return }
    if let index = model.optionIds.firstIndex(of: model.selectedId) {
      control.selectedSegmentIndex = index
    }
  }

  @objc private func onSegmentChanged(_ sender: UISegmentedControl) {
    let index = sender.selectedSegmentIndex
    guard index >= 0, index < model.optionIds.count else { return }
    model.userDidSelectId(model.optionIds[index])
  }

  private func distributeSegmentWidths(_ control: UISegmentedControl) {
    let count = control.numberOfSegments
    guard count > 0, bounds.width > 1 else { return }
    let font = (control.titleTextAttributes(for: .normal)?[.font] as? UIFont)
      ?? UIFont.systemFont(ofSize: 13, weight: .regular)
    var raw: [CGFloat] = []
    for index in 0..<count {
      let title = (control.titleForSegment(at: index) ?? "") as NSString
      raw.append(title.size(withAttributes: [.font: font]).width + titleEndInset * 2)
    }
    let extra = (bounds.width - raw.reduce(0, +)) / CGFloat(count)
    for index in 0..<count {
      control.setWidth(max(raw[index] + extra, 0), forSegmentAt: index)
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
    if let control = segmentedControl, !control.isHidden {
      control.frame = CGRect(
        x: 0,
        y: overflowPad,
        width: bounds.width,
        height: max(bounds.height - overflowPad * 2, 32)
      )
      distributeSegmentWidths(control)
    }
  }
}

enum IntentOption: String, Equatable, CaseIterable, Hashable {
  case understand
  case apply
}

final class IntentSegmentModel: ObservableObject {
  @Published var selection: IntentOption = .understand
  @Published var selectedId: String = "understand"
  @Published var optionIds: [String] = []
  @Published var optionLabels: [String] = []
  @Published var isEnabled: Bool = true
  @Published var themeVariant: String = "auto"

  var onConfirmChange: ((String) -> Void)?
  private var suppressEmit = false

  func applyExternal(_ intent: IntentOption) {
    guard selection != intent else { return }
    suppressEmit = true
    selection = intent
    selectedId = intent.rawValue
    suppressEmit = false
  }

  func applyExternalId(_ id: String) {
    guard selectedId != id else { return }
    suppressEmit = true
    selectedId = id
    if let intent = IntentOption(rawValue: id) {
      selection = intent
    }
    suppressEmit = false
  }

  func userDidSelect(_ intent: IntentOption) {
    guard isEnabled, !suppressEmit, selection != intent else { return }
    selection = intent
    selectedId = intent.rawValue
    onConfirmChange?(intent.rawValue)
  }

  func userDidSelectId(_ id: String) {
    guard isEnabled, !suppressEmit, selectedId != id else { return }
    selectedId = id
    if let intent = IntentOption(rawValue: id) {
      selection = intent
    }
    onConfirmChange?(id)
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

@available(iOS 26.0, *)
struct AdaptiveSegmentRoot: View {
  @ObservedObject var model: IntentSegmentModel

  var body: some View {
    if model.optionIds.count >= 2 {
      SystemMultiSegmentedRoot(model: model)
    } else {
      GlassCompositeSegmentedRoot(model: model)
    }
  }
}

/// Stock iOS segmented `Picker` — the system owns the expanding Liquid Glass
/// lens on press and the finger-drag between segments.
@available(iOS 26.0, *)
struct SystemMultiSegmentedRoot: View {
  @ObservedObject var model: IntentSegmentModel

  private let overflowPad: CGFloat = 24

  private var preferredScheme: ColorScheme? {
    switch model.themeVariant {
    case "dark": return .dark
    case "light": return .light
    default: return nil
    }
  }

  var body: some View {
    Picker("Sección", selection: binding) {
      ForEach(Array(zip(model.optionIds, model.optionLabels)), id: \.0) { id, label in
        Text(label).tag(id)
      }
    }
    .pickerStyle(.segmented)
    .labelsHidden()
    .controlSize(.large)
    .disabled(!model.isEnabled)
    .opacity(model.isEnabled ? 1 : 0.4)
    .preferredColorScheme(preferredScheme)
    .padding(overflowPad)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  private var binding: Binding<String> {
    Binding(
      get: { model.selectedId },
      set: { model.userDidSelectId($0) }
    )
  }
}
