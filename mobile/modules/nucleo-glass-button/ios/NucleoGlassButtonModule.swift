import ExpoModulesCore
import UIKit

/**
 Product path: unmodified UIKit Liquid Glass `UIButton.Configuration`.
 - Secondary / nav / icons → `.glass()`
 - One primary CTA per screen → `.prominentGlass()`
 Never tint, overlay, or recolor the system material.
 */
public class NucleoGlassButtonModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NucleoGlassButton")

    Function("isAvailable") { () -> Bool in
      if #available(iOS 26.0, *) { return true }
      return false
    }

    Function("implementationMode") { () -> String in
      if #available(iOS 26.0, *) { return "native_system_glass" }
      return "fallback_solid"
    }

    View(NucleoGlassButtonView.self) {
      Events("onGlassPress")

      Prop("variant") { (view: NucleoGlassButtonView, variant: String?) in
        view.variant = variant ?? "glass"
      }

      Prop("title") { (view: NucleoGlassButtonView, title: String?) in
        view.titleText = title ?? ""
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

      Prop("isLoading") { (view: NucleoGlassButtonView, loading: Bool?) in
        view.isLoading = loading ?? false
      }

      Prop("accessibilityLabelText") { (view: NucleoGlassButtonView, label: String?) in
        view.button.accessibilityLabel = label
      }

      Prop("cornerStyle") { (view: NucleoGlassButtonView, style: String?) in
        view.cornerStyle = style ?? "capsule"
      }

      Prop("cornerRadius") { (view: NucleoGlassButtonView, radius: Double?) in
        view.fixedCornerRadius = radius.map { CGFloat($0) }
      }

      // Retained for bridge compatibility — intentionally ignored (no tints).
      Prop("tintColor") { (_: NucleoGlassButtonView, _: UIColor?) in }
    }
  }
}

final class NucleoGlassButtonView: ExpoView {
  let onGlassPress = EventDispatcher()
  let button = UIButton(type: .system)

  var variant = "glass" { didSet { applyConfiguration() } }
  var cornerStyle = "capsule" { didSet { applyConfiguration() } }
  var fixedCornerRadius: CGFloat? { didSet { applyConfiguration() } }
  var systemImageName: String? { didSet { applyConfiguration() } }
  var symbolPointSize: CGFloat? { didSet { applyConfiguration() } }
  var titleText = "" { didSet { applyConfiguration() } }
  var isLoading = false { didSet { applyConfiguration() } }

  private let spinner = UIActivityIndicatorView(style: .medium)

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    clipsToBounds = false
    backgroundColor = .clear
    isOpaque = false
    isUserInteractionEnabled = true

    button.clipsToBounds = false
    button.translatesAutoresizingMaskIntoConstraints = false
    button.addTarget(self, action: #selector(handleTap), for: .touchUpInside)
    addSubview(button)

    spinner.hidesWhenStopped = true
    spinner.translatesAutoresizingMaskIntoConstraints = false
    spinner.isUserInteractionEnabled = false
    addSubview(spinner)

    NSLayoutConstraint.activate([
      button.leadingAnchor.constraint(equalTo: leadingAnchor),
      button.trailingAnchor.constraint(equalTo: trailingAnchor),
      button.topAnchor.constraint(equalTo: topAnchor),
      button.bottomAnchor.constraint(equalTo: bottomAnchor),
      spinner.centerXAnchor.constraint(equalTo: centerXAnchor),
      spinner.centerYAnchor.constraint(equalTo: centerYAnchor),
    ])

    applyConfiguration()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    clipsToBounds = false
    backgroundColor = .clear
    isOpaque = false
    button.clipsToBounds = false
  }

  @objc private func handleTap() {
    guard window != nil, button.isEnabled, !isLoading else { return }
    onGlassPress()
  }

  @available(iOS 26.0, *)
  private func baseConfiguration() -> UIButton.Configuration {
    switch variant {
    case "prominent", "prominentGlass", "glassProminent":
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

    let hasTitle = !titleText.isEmpty
    let hasSymbol = systemImageName != nil

    if hasTitle {
      configuration.title = titleText
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

    // Icon-only: zero insets so circular hosts (send 38²) stay round.
    // Labeled CTAs keep comfortable padding.
    if hasTitle {
      configuration.contentInsets = NSDirectionalEdgeInsets(
        top: 12, leading: 16, bottom: 12, trailing: 16
      )
      if hasSymbol {
        configuration.imagePadding = 8
      }
    } else {
      configuration.contentInsets = .zero
    }

    // Standard glass only — never set baseBackgroundColor / tintColor.
    button.configuration = configuration
    button.tintColor = nil

    if isLoading {
      spinner.startAnimating()
      button.alpha = 0.35
    } else {
      spinner.stopAnimating()
      button.alpha = 1
    }
  }
}
