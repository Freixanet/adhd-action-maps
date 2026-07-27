import ExpoModulesCore
import UIKit

public class NucleoGlassButtonModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NucleoGlassButton")

    Function("isAvailable") { () -> Bool in
      if #available(iOS 26.0, *) {
        return true
      }
      return false
    }

    View(NucleoGlassButtonView.self) {
      // Not "onPress": React Native already registers topPress, and a view event
      // cannot be both direct and bubbling.
      Events("onGlassPress")

      Prop("variant") { (view: NucleoGlassButtonView, variant: String?) in
        view.variant = variant ?? "glass"
      }

      Prop("cornerStyle") { (view: NucleoGlassButtonView, style: String?) in
        view.cornerStyle = style ?? "capsule"
      }

      Prop("cornerRadius") { (view: NucleoGlassButtonView, radius: Double?) in
        view.fixedCornerRadius = radius.map { CGFloat($0) }
      }

      Prop("tintColor") { (view: NucleoGlassButtonView, color: UIColor?) in
        view.glassTintColor = color
      }

      Prop("systemImage") { (view: NucleoGlassButtonView, name: String?) in
        view.systemImageName = name
      }

      Prop("symbolPointSize") { (view: NucleoGlassButtonView, size: Double?) in
        view.symbolPointSize = size.map { CGFloat($0) }
      }

      Prop("isEnabled") { (view: NucleoGlassButtonView, enabled: Bool?) in
        view.button.isEnabled = enabled ?? true
      }

      Prop("accessibilityLabelText") { (view: NucleoGlassButtonView, label: String?) in
        view.button.accessibilityLabel = label
      }
    }
  }
}

/**
 Hosts a real `UIButton` using UIKit's Liquid Glass configurations (iOS 26+),
 so the material, press morph and highlight come from UIKit rather than from JS
 layers.

 The view takes no React children: reordering subviews to keep a label on top
 desynchronises Fabric's child indices and crashes on unmount. Callers render
 the label as a sibling above this view instead.
 */
class NucleoGlassButtonView: ExpoView {
  let onGlassPress = EventDispatcher()
  let button = UIButton(type: .system)

  var variant = "glass" {
    didSet { applyConfiguration() }
  }

  var cornerStyle = "capsule" {
    didSet { applyConfiguration() }
  }

  var fixedCornerRadius: CGFloat? {
    didSet { applyConfiguration() }
  }

  var glassTintColor: UIColor? {
    didSet { applyConfiguration() }
  }

  var systemImageName: String? {
    didSet { applyConfiguration() }
  }

  var symbolPointSize: CGFloat? {
    didSet { applyConfiguration() }
  }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    button.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    button.addTarget(self, action: #selector(handleTap), for: .touchUpInside)
    addSubview(button)
    applyConfiguration()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    button.frame = bounds
  }

  @objc private func handleTap() {
    // A detached view can still deliver a queued touch; dispatching then crashes.
    guard window != nil else { return }
    onGlassPress()
  }

  @available(iOS 26.0, *)
  private func baseConfiguration() -> UIButton.Configuration {
    switch variant {
    case "prominentGlass":
      return .prominentGlass()
    case "clearGlass":
      return .clearGlass()
    case "prominentClearGlass":
      return .prominentClearGlass()
    default:
      return .glass()
    }
  }

  private func applyConfiguration() {
    guard #available(iOS 26.0, *) else {
      button.configuration = .plain()
      return
    }

    var configuration = baseConfiguration()
    configuration.contentInsets = .zero

    switch cornerStyle {
    case "fixed":
      configuration.cornerStyle = .fixed
      if let fixedCornerRadius {
        configuration.background.cornerRadius = fixedCornerRadius
      }
    case "dynamic":
      configuration.cornerStyle = .dynamic
    default:
      configuration.cornerStyle = .capsule
    }

    if let systemImageName {
      configuration.image = UIImage(systemName: systemImageName)
      if let symbolPointSize {
        configuration.preferredSymbolConfigurationForImage = UIImage.SymbolConfiguration(
          pointSize: symbolPointSize,
          weight: .medium
        )
      }
    }

    // Prominent glass derives its fill from the tint; without one it is system blue.
    configuration.baseBackgroundColor = glassTintColor
    button.configuration = configuration
    button.tintColor = glassTintColor
  }
}
