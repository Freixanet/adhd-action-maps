import ExpoModulesCore
import UIKit

public class NucleoUIMenuModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NucleoUIMenu")

    View(NucleoUIMenuAnchorView.self) {
      Events("onSelect", "onPresent", "onDismiss")

      Prop("title") { (view: NucleoUIMenuAnchorView, title: String?) in
        view.menuTitle = title ?? ""
        view.rebuildMenu()
      }

      Prop("themeVariant") { (view: NucleoUIMenuAnchorView, theme: String?) in
        view.themeVariant = theme ?? "dark"
        view.applyTheme()
      }

      Prop("actions") { (view: NucleoUIMenuAnchorView, actions: [[String: Any]]?) in
        view.rawActions = actions ?? []
        view.rebuildMenu()
      }
    }
  }
}

/**
 Native UIButton.menu host for composer chips.

 Keeps the software keyboard open while the menu is presented and after an
 outside tap dismisses it — only the UIMenu should close, not the keyboard.
 */
class NucleoUIMenuAnchorView: ExpoView {
  let onSelect = EventDispatcher()
  let onPresent = EventDispatcher()
  let onDismiss = EventDispatcher()

  private let button = NucleoMenuButton(type: .custom)
  private weak var preservedInput: UIResponder?
  private var keyboardObserver: NSObjectProtocol?
  private var menuSessionActive = false
  private var sessionStartedAt: CFAbsoluteTime = 0
  private var endSessionWorkItem: DispatchWorkItem?
  private weak var dismissTapMonitor: UITapGestureRecognizer?

  var menuTitle: String = ""
  var themeVariant: String = "dark"
  var rawActions: [[String: Any]] = []

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)

    // Do not attach UIContextMenuInteraction — it blocks showsMenuAsPrimaryAction.
    button.showsMenuAsPrimaryAction = true
    button.backgroundColor = .clear
    button.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    button.isUserInteractionEnabled = true
    button.addTarget(self, action: #selector(onTouchDown), for: .touchDown)
    button.onMenuWillEnd = { [weak self] in
      self?.handleMenuWillEnd()
    }
    addSubview(button)

    keyboardObserver = NotificationCenter.default.addObserver(
      forName: UIResponder.keyboardWillHideNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      guard let self, self.menuSessionActive else { return }
      self.restoreInputIfNeeded()
    }
  }

  deinit {
    if let keyboardObserver {
      NotificationCenter.default.removeObserver(keyboardObserver)
    }
    detachDismissTapMonitor()
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    button.frame = bounds
    bringSubviewToFront(button)
  }

  public override func didAddSubview(_ subview: UIView) {
    super.didAddSubview(subview)
    if subview !== button {
      bringSubviewToFront(button)
    }
  }

  func applyTheme() {
    button.accessibilityLabel = menuTitle.isEmpty ? "Menu" : menuTitle
    button.overrideUserInterfaceStyle = themeVariant == "light" ? .light : .dark
  }

  func rebuildMenu() {
    let elements: [UIMenuElement] = rawActions.compactMap { action in
      guard let id = action["id"] as? String, !id.isEmpty else { return nil }
      let title = (action["title"] as? String) ?? id
      let stateRaw = action["state"] as? String
      var state: UIMenuElement.State = .off
      if stateRaw == "on" {
        state = .on
      } else if stateRaw == "mixed" {
        state = .mixed
      }
      var image: UIImage?
      if let symbolName = action["image"] as? String, !symbolName.isEmpty {
        image = UIImage(systemName: symbolName)
      }
      return UIAction(
        title: title,
        image: image,
        identifier: UIAction.Identifier(id),
        state: state
      ) { [weak self] _ in
        guard let self else { return }
        self.onSelect(["id": id])
        self.restoreInputIfNeeded()
        // Keep protecting briefly so the selection dismiss path does not drop the keyboard.
        self.scheduleEndMenuSession(after: 0.4)
      }
    }
    button.menu = UIMenu(title: menuTitle, children: elements)
    button.showsMenuAsPrimaryAction = !elements.isEmpty
    applyTheme()
  }

  @objc private func onTouchDown() {
    if let current = Self.findFirstResponder() {
      preservedInput = current
    }
    beginMenuSession()
    onPresent([
      "delayed": false,
      "keyboardHeight": 0,
      "title": menuTitle,
    ])
    // Reclaim first responder after UIKit's touch handling tries to resign it,
    // so the keyboard (and composer layout) stay put under the UIMenu.
    DispatchQueue.main.async { [weak self] in
      self?.restoreInputIfNeeded()
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in
      self?.restoreInputIfNeeded()
    }
  }

  private func handleMenuWillEnd() {
    restoreInputIfNeeded()
    onDismiss([:])
    // Outside-tap dismiss often delivers the same touch to RN next; keep
    // protecting long enough to ignore Keyboard.dismiss from that press.
    scheduleEndMenuSession(after: 0.45)
    DispatchQueue.main.async { [weak self] in
      self?.restoreInputIfNeeded()
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) { [weak self] in
      self?.restoreInputIfNeeded()
    }
  }

  private func beginMenuSession() {
    endSessionWorkItem?.cancel()
    endSessionWorkItem = nil
    menuSessionActive = true
    sessionStartedAt = CFAbsoluteTimeGetCurrent()
    attachDismissTapMonitor()
    // Safety net if willEnd / outside-tap never clears the session.
    scheduleEndMenuSession(after: 60)
  }

  private func scheduleEndMenuSession(after delay: TimeInterval) {
    endSessionWorkItem?.cancel()
    let work = DispatchWorkItem { [weak self] in
      guard let self else { return }
      self.menuSessionActive = false
      self.preservedInput = nil
      self.detachDismissTapMonitor()
    }
    endSessionWorkItem = work
    DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
  }

  private func attachDismissTapMonitor() {
    guard dismissTapMonitor == nil else { return }
    guard let window = Self.keyWindow() else { return }
    let tap = UITapGestureRecognizer(target: self, action: #selector(onWindowTapDuringMenu))
    tap.cancelsTouchesInView = false
    tap.delegate = button
    window.addGestureRecognizer(tap)
    dismissTapMonitor = tap
  }

  private func detachDismissTapMonitor() {
    if let tap = dismissTapMonitor {
      tap.view?.removeGestureRecognizer(tap)
    }
    dismissTapMonitor = nil
  }

  @objc private func onWindowTapDuringMenu() {
    guard menuSessionActive else { return }
    // Ignore the finger-up that opened the menu — that is not an outside dismiss.
    guard CFAbsoluteTimeGetCurrent() - sessionStartedAt > 0.3 else { return }
    // Outside taps dismiss UIMenu and often resign first responder in the same beat.
    restoreInputIfNeeded()
    DispatchQueue.main.async { [weak self] in
      self?.restoreInputIfNeeded()
    }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.08) { [weak self] in
      self?.restoreInputIfNeeded()
    }
    onDismiss([:])
    scheduleEndMenuSession(after: 0.45)
  }

  private func restoreInputIfNeeded() {
    guard let preservedInput, preservedInput.canBecomeFirstResponder else { return }
    if !preservedInput.isFirstResponder {
      _ = preservedInput.becomeFirstResponder()
    }
  }

  private static func keyWindow() -> UIWindow? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
  }

  private static func findFirstResponder() -> UIResponder? {
    let windows = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
    for window in windows {
      if let responder = findFirstResponder(in: window) {
        return responder
      }
    }
    return nil
  }

  private static func findFirstResponder(in view: UIView) -> UIResponder? {
    if view.isFirstResponder {
      return view
    }
    for subview in view.subviews {
      if let responder = findFirstResponder(in: subview) {
        return responder
      }
    }
    return nil
  }
}

/// UIButton subclass so we can observe primary-menu end when UIKit routes it
/// through the button's context-menu interaction callbacks.
private final class NucleoMenuButton: UIButton, UIGestureRecognizerDelegate {
  var onMenuWillEnd: (() -> Void)?

  override func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction,
    willEndFor configuration: UIContextMenuConfiguration,
    animator: UIContextMenuInteractionAnimating?
  ) {
    super.contextMenuInteraction(interaction, willEndFor: configuration, animator: animator)
    onMenuWillEnd?()
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    true
  }
}
