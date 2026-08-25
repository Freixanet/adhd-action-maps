import ExpoModulesCore
import UIKit

public class NucleoUIMenuModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NucleoUIMenu")

    Function("setClipboard") { (text: String) in
      UIPasteboard.general.string = text
    }

    Function("supportsMessageText") { () -> Bool in
      true
    }

    Function("supportsLiftPreview") { () -> Bool in
      true
    }

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

      Prop("openOnLongPress") { (view: NucleoUIMenuAnchorView, value: Bool?) in
        view.openOnLongPress = value ?? false
        view.rebuildMenu()
      }

      Prop("liftPreview") { (view: NucleoUIMenuAnchorView, value: Bool?) in
        view.liftPreview = value ?? false
        view.rebuildMenu()
      }

      Prop("previewCornerRadius") { (view: NucleoUIMenuAnchorView, value: Double?) in
        view.previewCornerRadius = CGFloat(value ?? 0)
      }

      Prop("previewTailRadius") { (view: NucleoUIMenuAnchorView, value: Double?) in
        view.previewTailRadius = CGFloat(value ?? 0)
      }

      Prop("sourceText") { (view: NucleoUIMenuAnchorView, text: String?) in
        view.sourceText = text ?? ""
        view.syncSourceText()
      }

      Prop("sourceColor") { (view: NucleoUIMenuAnchorView, color: UIColor?) in
        view.setSourceColor(color)
      }

      Prop("sourceFontSize") { (view: NucleoUIMenuAnchorView, size: Double?) in
        view.sourceFontSize = CGFloat(size ?? 17)
      }

      Prop("sourceLineHeight") { (view: NucleoUIMenuAnchorView, height: Double?) in
        view.sourceLineHeight = CGFloat(height ?? 24)
      }

      Prop("sourceFontFamily") { (view: NucleoUIMenuAnchorView, name: String?) in
        view.sourceFontFamily = name
      }
    }

    View(NucleoMessageTextView.self) {
      ViewName("NucleoMessageText")
      Events("onEdit", "onSize")

      Prop("text") { (view: NucleoMessageTextView, text: String?) in
        view.setText(text ?? "")
      }
      Prop("color") { (view: NucleoMessageTextView, color: UIColor?) in
        view.setUIColor(color)
      }
      Prop("fontSize") { (view: NucleoMessageTextView, size: Double?) in
        view.setFontSize(CGFloat(size ?? 17))
      }
      Prop("lineHeight") { (view: NucleoMessageTextView, height: Double?) in
        view.setLineHeight(CGFloat(height ?? 24))
      }
      Prop("fontFamily") { (view: NucleoMessageTextView, name: String?) in
        view.setFontFamily(name)
      }
      Prop("hitTestOnly") { (view: NucleoMessageTextView, value: Bool?) in
        view.setHitTestOnly(value ?? false)
      }
    }
  }
}

/// Copies the system “Preguntar a Siri” glyph once, off the context menu path.
/// Harvesting during an open `UIContextMenuInteraction` fails, so the row would
/// fall back to `sparkles` instead of the real Apple Intelligence icon.
private final class SiriAskGlyphCache: NSObject, UIEditMenuInteractionDelegate {
  static let shared = SiriAskGlyphCache()

  private(set) var title = "Preguntar a Siri"
  private(set) var image: UIImage?
  private var cachedElement: UIMenuElement?
  private var resolved = false
  private var started = false
  private var finished = false
  private var waiters: [() -> Void] = []
  private var harvestView: UITextView?
  private var harvestInteraction: UIEditMenuInteraction?
  private weak var restoreResponder: UIResponder?
  private var siriLeaf: (any UIMenuLeaf)?

  func prepare() {
    resolve { }
  }

  func resolve(_ done: @escaping () -> Void) {
    if resolved {
      done()
      return
    }
    waiters.append(done)
    startHarvest()
  }

  func store(suggestedActions: [UIMenuElement]) {
    let items = NucleoUIMenuAnchorView.collectSiriElements(suggestedActions)
    let chosen =
      items.first
      ?? NucleoUIMenuAnchorView.flattenMenuElements(suggestedActions).last { element in
        NucleoUIMenuAnchorView.isSiriElement(element)
          || NSStringFromClass(type(of: element)).contains("DeferredMenuElement")
      }
    guard let chosen else { return }
    cachedElement = chosen
    if !chosen.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      title = chosen.title
    }
    if let action = chosen as? UIAction, let glyph = action.image {
      image = glyph
    } else if let glyph = chosen.image {
      image = glyph
    }
    siriLeaf = chosen as? UIMenuLeaf ?? NucleoUIMenuAnchorView.findSiriLeaf([chosen])
    resolved = true
    let callbacks = waiters
    waiters = []
    callbacks.forEach { $0() }
  }

  var hasSystemElement: Bool { cachedElement != nil }

  fileprivate static func nativeSiriImage() -> UIImage? {
    let multicolor = UIImage.SymbolConfiguration.preferringMulticolor()
    if let siri = UIImage(systemName: "siri", withConfiguration: multicolor) {
      return siri.withRenderingMode(.alwaysOriginal)
    }
    if let intelligence = UIImage(systemName: "apple.intelligence", withConfiguration: multicolor) {
      return intelligence.withRenderingMode(.alwaysOriginal)
    }
    return UIImage(systemName: "sparkles")
  }

  private func startHarvest() {
    if started { return }
    started = true
    guard let window = NucleoUIMenuAnchorView.keyWindow() else {
      started = false
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
        self?.startHarvest()
      }
      return
    }

    restoreResponder = NucleoUIMenuAnchorView.findFirstResponder()
    let tv = UITextView(frame: CGRect(x: 12, y: 80, width: 280, height: 44))
    tv.text = "Preguntar a Siri"
    tv.font = UIFont.systemFont(ofSize: 17)
    tv.isEditable = false
    tv.isSelectable = true
    tv.isScrollEnabled = false
    tv.backgroundColor = .clear
    tv.alpha = 0.02
    window.addSubview(tv)
    tv.selectedTextRange = tv.textRange(from: tv.beginningOfDocument, to: tv.endOfDocument)
    _ = tv.becomeFirstResponder()

    let edit = UIEditMenuInteraction(delegate: self)
    tv.addInteraction(edit)
    harvestView = tv
    harvestInteraction = edit

    let config = UIEditMenuConfiguration(identifier: "nucleo.siriGlyph", sourcePoint: CGPoint(x: 4, y: 4))
    edit.presentEditMenu(with: config)

    DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) { [weak self] in
      self?.finishHarvest()
    }
  }

  func editMenuInteraction(
    _ interaction: UIEditMenuInteraction,
    menuFor configuration: UIEditMenuConfiguration,
    suggestedActions: [UIMenuElement]
  ) -> UIMenu? {
    let items = NucleoUIMenuAnchorView.collectSiriElements(suggestedActions)
    if let first = items.first {
      cachedElement = first
      if !first.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        title = first.title
      }
      if let action = first as? UIAction, let glyph = action.image {
        image = glyph
      } else if let glyph = first.image {
        image = glyph
      }
      siriLeaf = first as? UIMenuLeaf ?? NucleoUIMenuAnchorView.findSiriLeaf(items)
    }
    DispatchQueue.main.async { [weak self] in
      interaction.dismissMenu()
      self?.finishHarvest()
    }
    return UIMenu(children: [])
  }

  func editMenuInteraction(
    _ interaction: UIEditMenuInteraction,
    targetRectFor configuration: UIEditMenuConfiguration
  ) -> CGRect {
    CGRect(x: -8000, y: -8000, width: 1, height: 1)
  }

  private func finishHarvest() {
    if finished { return }
    finished = true
    harvestView?.resignFirstResponder()
    harvestView?.removeFromSuperview()
    harvestView = nil
    harvestInteraction = nil
    if let restoreResponder, restoreResponder.canBecomeFirstResponder, !restoreResponder.isFirstResponder {
      _ = restoreResponder.becomeFirstResponder()
    }
    restoreResponder = nil
    resolved = true
    let callbacks = waiters
    waiters = []
    callbacks.forEach { $0() }
  }
}

/**
 Native UIButton.menu host for composer chips.

 Keeps the software keyboard open while the menu is presented and after an
 outside tap dismisses it — only the UIMenu should close, not the keyboard.
 */
class NucleoUIMenuAnchorView: ExpoView, UIContextMenuInteractionDelegate, UIEditMenuInteractionDelegate, UITextViewDelegate, UIGestureRecognizerDelegate {
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
  var openOnLongPress = false
  var liftPreview = false
  var previewCornerRadius: CGFloat = 0
  var previewTailRadius: CGFloat = 0
  var sourceText: String = ""
  var sourceFontSize: CGFloat = 17
  var sourceLineHeight: CGFloat = 24
  var sourceFontFamily: String?
  private var sourceColor: UIColor = .label
  private var liftInteraction: UIContextMenuInteraction?
  private var liftLongPress: UILongPressGestureRecognizer?
  private var editMenuInteraction: UIEditMenuInteraction?
  private let siriTextView = UITextView()
  private var isSelecting = false
  private var suppressInputRestore = false
  private var ignoreSelectionChanges = false
  private var persistHarvestCompletion: (([UIMenuElement]) -> Void)?
  private var persistHarvestActive = false
  private weak var selectionTapMonitor: UIGestureRecognizer?
  private var selectionArmedAt: CFAbsoluteTime = 0
  private var askingSiri = false
  private var liveSiriElements: [UIMenuElement] = []

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

    clipsToBounds = false
    siriTextView.clipsToBounds = false
    siriTextView.isOpaque = false
    siriTextView.isEditable = true
    siriTextView.isSelectable = true
    siriTextView.isUserInteractionEnabled = false
    siriTextView.isScrollEnabled = false
    siriTextView.backgroundColor = .clear
    siriTextView.textColor = .clear
    siriTextView.tintColor = .clear
    siriTextView.alpha = 0.01
    siriTextView.inputView = UIView()
    siriTextView.autocorrectionType = .no
    siriTextView.spellCheckingType = .no
    siriTextView.textContainerInset = UIEdgeInsets(top: 10, left: 14, bottom: 10, right: 14)
    siriTextView.textContainer.lineFragmentPadding = 0
    siriTextView.delegate = self
    if #available(iOS 18.0, *) {
      siriTextView.writingToolsBehavior = .complete
    }
    insertSubview(siriTextView, at: 0)

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
    detachSelectionTapMonitor()
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    button.frame = bounds
    siriTextView.frame = bounds
    if isSelecting || liftPreview {
      bringSubviewToFront(siriTextView)
    } else {
      bringSubviewToFront(button)
    }
  }

  public override func didAddSubview(_ subview: UIView) {
    super.didAddSubview(subview)
    if liftPreview, subview !== siriTextView {
      bringSubviewToFront(siriTextView)
    } else if !liftPreview, subview !== button {
      bringSubviewToFront(button)
    }
  }

  func applyTheme() {
    button.accessibilityLabel = menuTitle.isEmpty ? "Menu" : menuTitle
    button.overrideUserInterfaceStyle = themeVariant == "light" ? .light : .dark
  }

  func rebuildMenu() {
    let elements = makeMenuElements()
    button.menu = UIMenu(title: menuTitle, children: elements)
    applyTheme()
    updateLiftInteraction(hasActions: !elements.isEmpty)
    if liftPreview {
      button.isHidden = true
      button.isUserInteractionEnabled = false
      button.showsMenuAsPrimaryAction = false
    } else {
      button.isHidden = false
      button.isUserInteractionEnabled = true
      // Long-press uses UIButton.menu (SF Symbols). UIContextMenuInteraction
      // on iOS 17+ presents the edit-menu bar without leading icons.
      button.showsMenuAsPrimaryAction = !openOnLongPress && !elements.isEmpty
    }
  }

  func setSourceColor(_ color: UIColor?) {
    sourceColor = color ?? .label
    applySourceTypography()
  }

  private func makePrimaryActions() -> [UIMenuElement] {
    rawActions.compactMap { action in
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
        let config = UIImage.SymbolConfiguration(pointSize: 17, weight: .medium)
        image = UIImage(systemName: symbolName, withConfiguration: config)
      }
      return UIAction(
        title: title,
        image: image,
        identifier: UIAction.Identifier(id),
        state: state
      ) { [weak self] _ in
        guard let self else { return }
        if id == "select" {
          self.suppressInputRestore = true
          self.enterSelectionMode()
          return
        }
        self.onSelect(["id": id])
        self.restoreInputIfNeeded()
        self.scheduleEndMenuSession(after: 0.4)
      }
    }
  }

  private func makeMenuElements() -> [UIMenuElement] {
    makePrimaryActions()
  }

  private func makeLiftMenu(suggestedActions: [UIMenuElement] = []) -> UIMenu {
    let primary = UIMenu(title: "", options: .displayInline, children: makePrimaryActions())
    let liveSiri = Self.decorateSiriElements(Self.collectSiriElements(suggestedActions))
    let siriChildren: [UIMenuElement] = liveSiri.isEmpty ? [fallbackSiriAction()] : liveSiri
    let siriGroup = UIMenu(title: "", options: .displayInline, children: siriChildren)
    let menu = UIMenu(title: "", children: [primary, siriGroup])
    menu.preferredElementSize = .large
    return menu
  }

  private func fallbackSiriAction() -> UIAction {
    UIAction(
      title: SiriAskGlyphCache.shared.title,
      image: SiriAskGlyphCache.nativeSiriImage(),
      identifier: UIAction.Identifier("nucleo.askSiri")
    ) { [weak self] _ in
      self?.invokeAskSiri()
    }
  }

  private func updateLiftInteraction(hasActions: Bool) {
    transform = .identity
    layer.shadowOpacity = 0
    if liftPreview, hasActions {
      if let liftLongPress {
        removeGestureRecognizer(liftLongPress)
        self.liftLongPress = nil
      }
      if liftInteraction == nil {
        let interaction = UIContextMenuInteraction(delegate: self)
        addInteraction(interaction)
        liftInteraction = interaction
      }
      if editMenuInteraction == nil {
        let edit = UIEditMenuInteraction(delegate: self)
        siriTextView.addInteraction(edit)
        editMenuInteraction = edit
      }
      if !isSelecting {
        siriTextView.isUserInteractionEnabled = false
        siriTextView.alpha = 0.01
      }
      syncSourceText()
    } else {
      if let liftLongPress {
        removeGestureRecognizer(liftLongPress)
        self.liftLongPress = nil
      }
      if let liftInteraction {
        removeInteraction(liftInteraction)
        self.liftInteraction = nil
      }
      if let editMenuInteraction {
        siriTextView.removeInteraction(editMenuInteraction)
        self.editMenuInteraction = nil
      }
      if !isSelecting {
        siriTextView.isUserInteractionEnabled = false
        siriTextView.alpha = 0.01
      }
    }
  }

  func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction,
    configurationForMenuAtLocation location: CGPoint
  ) -> UIContextMenuConfiguration? {
    guard liftPreview, !isSelecting else { return nil }
    prepareSilentSelection()
    return UIContextMenuConfiguration(identifier: nil, previewProvider: nil) { [weak self] suggestedActions in
      self?.makeLiftMenu(suggestedActions: suggestedActions)
    }
  }

  func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction,
    previewForHighlightingMenuWithConfiguration configuration: UIContextMenuConfiguration
  ) -> UITargetedPreview? {
    liftTargetedPreview()
  }

  func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction,
    previewForDismissingMenuWithConfiguration configuration: UIContextMenuConfiguration
  ) -> UITargetedPreview? {
    liftTargetedPreview()
  }

  func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction,
    willDisplayMenuFor configuration: UIContextMenuConfiguration,
    animator: UIContextMenuInteractionAnimating?
  ) {
    if let current = Self.findFirstResponder() {
      preservedInput = current
    }
    beginMenuSession()
    onPresent([
      "delayed": false,
      "keyboardHeight": 0,
      "title": menuTitle,
    ])
  }

  func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction,
    willEndFor configuration: UIContextMenuConfiguration,
    animator: UIContextMenuInteractionAnimating?
  ) {
    if isSelecting || askingSiri {
      onDismiss([:])
      return
    }
    if persistHarvestActive {
      editMenuInteraction?.dismissMenu()
      persistHarvestActive = false
      persistHarvestCompletion = nil
    }
    clearSilentSelection()
    handleMenuWillEnd()
  }

  func contextMenuInteraction(
    _ interaction: UIContextMenuInteraction,
    willPerformPreviewActionForMenuWith configuration: UIContextMenuConfiguration,
    animator: UIContextMenuInteractionCommitAnimating
  ) {
    animator.preferredCommitStyle = .dismiss
  }

  func editMenuInteraction(
    _ interaction: UIEditMenuInteraction,
    menuFor configuration: UIEditMenuConfiguration,
    suggestedActions: [UIMenuElement]
  ) -> UIMenu? {
    let identifier = configuration.identifier as? String
    if identifier == "nucleo.askSiriLive" {
      let siri = Self.decorateSiriElements(Self.collectSiriElements(suggestedActions))
      liveSiriElements = siri
      guard !siri.isEmpty else {
        askingSiri = false
        suppressInputRestore = false
        DispatchQueue.main.async { [weak self] in
          interaction.dismissMenu()
          self?.restoreInputIfNeeded()
        }
        return UIMenu(children: [])
      }
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.22) { [weak self] in
        self?.activateLiveSiri(siri)
      }
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) { [weak self] in
        interaction.dismissMenu()
        self?.finishAskSiri()
      }
      let menu = UIMenu(title: "", children: siri)
      menu.preferredElementSize = .large
      return menu
    }
    if identifier == "nucleo.persist" {
      let siri = Self.decorateSiriElements(Self.collectSiriElements(suggestedActions))
      let done = persistHarvestCompletion
      persistHarvestCompletion = nil
      if let done {
        done(siri)
        persistHarvestActive = false
        DispatchQueue.main.async {
          interaction.dismissMenu()
        }
        return UIMenu(children: [])
      }
      for element in siri {
        if let leaf = element as? UIMenuLeaf {
          leaf.performWithSender(self.siriTextView, target: self.siriTextView)
        }
      }
      DispatchQueue.main.async { [weak self] in
        interaction.dismissMenu()
        self?.suppressInputRestore = false
        self?.restoreInputIfNeeded()
      }
      return UIMenu(children: [])
    }
    if identifier == "nucleo.siriGlyph" || identifier == "nucleo.harvest" {
      SiriAskGlyphCache.shared.store(suggestedActions: suggestedActions)
      DispatchQueue.main.async {
        interaction.dismissMenu()
      }
      return UIMenu(children: [])
    }
    return UIMenu(children: [])
  }

  func editMenuInteraction(
    _ interaction: UIEditMenuInteraction,
    targetRectFor configuration: UIEditMenuConfiguration
  ) -> CGRect {
    if (configuration.identifier as? String) == "nucleo.askSiriLive" {
      return bounds
    }
    if (configuration.identifier as? String) == "nucleo.askSiri"
      || (configuration.identifier as? String) == "nucleo.siriGlyph"
      || (configuration.identifier as? String) == "nucleo.harvest"
      || (configuration.identifier as? String) == "nucleo.persist"
    {
      return CGRect(x: -8000, y: -8000, width: 1, height: 1)
    }
    return bounds
  }

  func editMenuInteraction(
    _ interaction: UIEditMenuInteraction,
    willDismissMenuFor configuration: UIEditMenuConfiguration,
    animator: UIEditMenuInteractionAnimating?
  ) {
    if (configuration.identifier as? String) == "nucleo.askSiriLive" {
      return
    }
    if isSelecting || suppressInputRestore {
      return
    }
    restoreInputIfNeeded()
    scheduleEndMenuSession(after: 0.4)
  }

  private func enterSelectionMode() {
    isSelecting = true
    suppressInputRestore = true
    persistHarvestActive = false
    persistHarvestCompletion = nil
    editMenuInteraction?.dismissMenu()
    onSelect(["id": "select"])
    revealSelection()
  }

  private func revealSelection() {
    guard !sourceText.isEmpty else { return }
    ignoreSelectionChanges = true
    selectionArmedAt = CFAbsoluteTimeGetCurrent()
    applySourceTypography()
    siriTextView.alpha = 1
    siriTextView.tintColor = .systemBlue
    siriTextView.isUserInteractionEnabled = true
    bringSubviewToFront(siriTextView)
    prepareSiriTextResponder()
    siriTextView.selectAll(nil)
    setSelectionChromeVisible(true)
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
      guard let self, self.isSelecting else { return }
      self.ignoreSelectionChanges = false
      self.attachSelectionTapMonitor()
    }
  }

  private func exitSelectionMode() {
    guard isSelecting else { return }
    isSelecting = false
    detachSelectionTapMonitor()
    clearSilentSelection()
    suppressInputRestore = false
    onSelect(["id": "selectEnd"])
    restoreInputIfNeeded()
  }

  func syncSourceText() {
    applySourceTypography()
  }

  private func clearSilentSelection() {
    ignoreSelectionChanges = true
    setSelectionChromeVisible(false)
    if let caret = siriTextView.textRange(from: siriTextView.beginningOfDocument, to: siriTextView.beginningOfDocument) {
      siriTextView.selectedTextRange = caret
    }
    siriTextView.tintColor = .clear
    applySourceTypography()
    if siriTextView.isFirstResponder {
      siriTextView.resignFirstResponder()
    }
    if liftPreview {
      siriTextView.isUserInteractionEnabled = false
      siriTextView.alpha = 0.01
    } else {
      siriTextView.isUserInteractionEnabled = false
      siriTextView.alpha = 0.01
    }
    ignoreSelectionChanges = false
  }

  private func setSelectionChromeVisible(_ visible: Bool) {
    guard #available(iOS 17.0, *) else { return }
    for interaction in siriTextView.interactions {
      guard let display = interaction as? UITextSelectionDisplayInteraction else { continue }
      display.highlightView.isHidden = !visible
      display.cursorView.isHidden = !visible
      display.handleViews.forEach { $0.isHidden = !visible }
      if visible {
        display.setNeedsSelectionUpdate()
      }
    }
  }

  private func applySourceTypography() {
    let paragraph = NSMutableParagraphStyle()
    paragraph.minimumLineHeight = sourceLineHeight
    siriTextView.attributedText = NSAttributedString(
      string: sourceText,
      attributes: [
        .font: resolvedSourceFont(),
        .foregroundColor: UIColor.clear,
        .paragraphStyle: paragraph,
      ]
    )
  }

  private func resolvedSourceFont() -> UIFont {
    let size = sourceFontSize
    guard let name = sourceFontFamily, !name.isEmpty else {
      return UIFont.systemFont(ofSize: size)
    }
    if name == "ui-rounded" || name.lowercased().contains("rounded") {
      if let descriptor = UIFont.systemFont(ofSize: size, weight: .regular).fontDescriptor.withDesign(.rounded) {
        return UIFont(descriptor: descriptor, size: size)
      }
    }
    if name == "ui-sans-serif" || name == "system-ui" || name.hasPrefix(".") {
      return UIFont.systemFont(ofSize: size)
    }
    if let exact = UIFont(name: name, size: size) {
      return exact
    }
    let familyNames = UIFont.familyNames
    for family in familyNames where family.replacingOccurrences(of: " ", with: "").localizedCaseInsensitiveContains("SourceSans") {
      if let match = UIFont.fontNames(forFamilyName: family).first, let font = UIFont(name: match, size: size) {
        return font
      }
    }
    return UIFont.systemFont(ofSize: size)
  }

  private func attachSelectionTapMonitor() {
    guard selectionTapMonitor == nil else { return }
    guard let window = Self.keyWindow() else { return }
    let press = UILongPressGestureRecognizer(target: self, action: #selector(onWindowPressDuringSelection))
    press.minimumPressDuration = 0
    press.cancelsTouchesInView = false
    press.delegate = self
    window.addGestureRecognizer(press)
    selectionTapMonitor = press
  }

  private func detachSelectionTapMonitor() {
    if let tap = selectionTapMonitor {
      tap.view?.removeGestureRecognizer(tap)
    }
    selectionTapMonitor = nil
  }

  @objc private func onWindowPressDuringSelection(_ gesture: UILongPressGestureRecognizer) {
    guard isSelecting, gesture.state == .began else { return }
    guard CFAbsoluteTimeGetCurrent() - selectionArmedAt > 0.4 else { return }
    guard let window = gesture.view else { return }
    let windowPoint = gesture.location(in: window)
    if let touched = window.hitTest(windowPoint, with: nil), Self.isTextSelectionChrome(touched) {
      return
    }
    exitSelectionMode()
  }

  func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
    if gestureRecognizer === selectionTapMonitor {
      if let view = touch.view, Self.isTextSelectionChrome(view) {
        return false
      }
      return true
    }
    return true
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    gestureRecognizer === selectionTapMonitor
  }

  func textViewDidChangeSelection(_ textView: UITextView) {
    guard isSelecting, !ignoreSelectionChanges, textView === siriTextView else { return }
    if textView.selectedRange.length == 0 {
      exitSelectionMode()
    }
  }

  func textView(_ textView: UITextView, shouldChangeTextIn range: NSRange, replacementText text: String) -> Bool {
    false
  }

  private func prepareSilentSelection() {
    applySourceTypography()
    siriTextView.tintColor = .clear
    siriTextView.alpha = 0.01
    siriTextView.isUserInteractionEnabled = isSelecting
    let payload = sourceText as NSString
    guard payload.length > 0 else { return }
    if let start = siriTextView.position(from: siriTextView.beginningOfDocument, offset: 0),
       let end = siriTextView.position(from: siriTextView.beginningOfDocument, offset: payload.length) {
      siriTextView.selectedTextRange = siriTextView.textRange(from: start, to: end)
    }
    _ = siriTextView.becomeFirstResponder()
    setSelectionChromeVisible(false)
  }

  private func prepareSiriTextResponder() {
    let payload = sourceText
    guard !payload.isEmpty else { return }
    if preservedInput == nil, let current = Self.findFirstResponder(), current !== siriTextView {
      preservedInput = current
    }
    applySourceTypography()
    if let start = siriTextView.position(from: siriTextView.beginningOfDocument, offset: 0),
       let end = siriTextView.position(from: siriTextView.beginningOfDocument, offset: (payload as NSString).length) {
      siriTextView.selectedTextRange = siriTextView.textRange(from: start, to: end)
    }
    _ = siriTextView.becomeFirstResponder()
  }

  func textView(
    _ textView: UITextView,
    editMenuForTextInRanges ranges: [NSValue],
    suggestedActions: [UIMenuElement]
  ) -> UIMenu? {
    nil
  }

  func textView(
    _ textView: UITextView,
    editMenuForTextIn range: NSRange,
    suggestedActions: [UIMenuElement]
  ) -> UIMenu? {
    nil
  }

  private func invokeAskSiri() {
    askingSiri = true
    suppressInputRestore = true
    prepareSiriTextResponder()
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
      guard let self else { return }
      guard self.askingSiri, let edit = self.editMenuInteraction, !self.sourceText.isEmpty else {
        self.finishAskSiri()
        return
      }
      self.prepareSiriTextResponder()
      let config = UIEditMenuConfiguration(identifier: "nucleo.askSiriLive", sourcePoint: CGPoint(x: 8, y: 8))
      edit.presentEditMenu(with: config)
    }
  }

  private func finishAskSiri() {
    askingSiri = false
    suppressInputRestore = false
    liveSiriElements = []
    restoreInputIfNeeded()
  }

  private func activateLiveSiri(_ elements: [UIMenuElement]) {
    for element in elements {
      if let command = element as? UICommand {
        if siriTextView.responds(to: command.action) {
          siriTextView.perform(command.action, with: command)
        }
        _ = UIApplication.shared.sendAction(command.action, to: nil, from: siriTextView, for: nil)
      }
      if let leaf = element as? UIMenuLeaf {
        leaf.performWithSender(siriTextView, target: siriTextView)
      }
    }
    activateSiriAccessibilityItem()
  }

  private func activateSiriAccessibilityItem() {
    guard let window = Self.keyWindow() else { return }
    func walk(_ view: UIView) -> Bool {
      let hay = [
        view.accessibilityLabel,
        view.accessibilityValue,
        (view as? UILabel)?.text,
        (view as? UIButton)?.currentTitle,
      ]
      .compactMap { $0?.lowercased() }
      .joined(separator: " ")
      if hay.contains("siri") || hay.contains("preguntar a") {
        if view.accessibilityActivate() {
          return true
        }
        if let control = view as? UIControl {
          control.sendActions(for: .touchUpInside)
          return true
        }
      }
      for subview in view.subviews where walk(subview) {
        return true
      }
      return false
    }
    _ = walk(window)
  }

  fileprivate static func decorateSiriElements(_ elements: [UIMenuElement]) -> [UIMenuElement] {
    let glyph = SiriAskGlyphCache.nativeSiriImage()
    for element in elements {
      if let leaf = element as? UIMenuLeaf {
        if leaf.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
          leaf.title = SiriAskGlyphCache.shared.title
        }
        if leaf.image == nil {
          leaf.image = glyph
        }
      }
    }
    return elements
  }

  fileprivate static func flattenMenuElements(_ elements: [UIMenuElement]) -> [UIMenuElement] {
    var flat: [UIMenuElement] = []
    for element in elements {
      if let menu = element as? UIMenu {
        flat.append(contentsOf: flattenMenuElements(menu.children))
      } else {
        flat.append(element)
      }
    }
    return flat
  }

  fileprivate static func collectSiriElements(_ elements: [UIMenuElement]) -> [UIMenuElement] {
    var named: [UIMenuElement] = []
    var deferred: [UIMenuElement] = []
    func walk(_ items: [UIMenuElement]) {
      for element in items {
        if isSiriElement(element) {
          named.append(element)
        }
        if NSStringFromClass(type(of: element)).contains("DeferredMenuElement") {
          deferred.append(element)
        }
        if let menu = element as? UIMenu {
          walk(menu.children)
        }
      }
    }
    walk(elements)
    if !named.isEmpty {
      return named
    }
    if let lastDeferred = deferred.last {
      return [lastDeferred]
    }
    return []
  }

  fileprivate static func findSiriLeaf(_ elements: [UIMenuElement]) -> (any UIMenuLeaf)? {
    for element in elements {
      if isSiriElement(element), let leaf = element as? UIMenuLeaf {
        return leaf
      }
      if let menu = element as? UIMenu, let nested = findSiriLeaf(menu.children) {
        return nested
      }
    }
    return nil
  }

  fileprivate static func isSiriElement(_ element: UIMenuElement) -> Bool {
    var hay = element.title.lowercased()
    if let action = element as? UIAction {
      hay += " " + action.identifier.rawValue.lowercased()
    }
    if let menu = element as? UIMenu {
      hay += " " + menu.identifier.rawValue.lowercased()
    }
    return hay.contains("siri")
      || hay.contains("preguntar a")
      || hay.contains("ask siri")
      || hay.contains("apple intelligence")
      || hay.contains("appleintelligence")
  }

  private func liftTargetedPreview() -> UITargetedPreview {
    let params = UIPreviewParameters()
    params.backgroundColor = .clear
    if previewCornerRadius > 0 {
      params.visiblePath = bubblePreviewPath()
    }
    return UITargetedPreview(view: self, parameters: params)
  }

  private func bubblePreviewPath() -> UIBezierPath {
    let rect = bounds
    let radius = max(previewCornerRadius, 0)
    let tail = previewTailRadius > 0 ? previewTailRadius : radius
    let path = UIBezierPath()
    path.move(to: CGPoint(x: rect.minX + radius, y: rect.minY))
    path.addLine(to: CGPoint(x: rect.maxX - radius, y: rect.minY))
    path.addArc(
      withCenter: CGPoint(x: rect.maxX - radius, y: rect.minY + radius),
      radius: radius,
      startAngle: -.pi / 2,
      endAngle: 0,
      clockwise: true
    )
    path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY - tail))
    path.addArc(
      withCenter: CGPoint(x: rect.maxX - tail, y: rect.maxY - tail),
      radius: tail,
      startAngle: 0,
      endAngle: .pi / 2,
      clockwise: true
    )
    path.addLine(to: CGPoint(x: rect.minX + radius, y: rect.maxY))
    path.addArc(
      withCenter: CGPoint(x: rect.minX + radius, y: rect.maxY - radius),
      radius: radius,
      startAngle: .pi / 2,
      endAngle: .pi,
      clockwise: true
    )
    path.addLine(to: CGPoint(x: rect.minX, y: rect.minY + radius))
    path.addArc(
      withCenter: CGPoint(x: rect.minX + radius, y: rect.minY + radius),
      radius: radius,
      startAngle: .pi,
      endAngle: -.pi / 2,
      clockwise: true
    )
    path.close()
    return path
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
    if isSelecting || suppressInputRestore { return }
    guard let preservedInput, preservedInput.canBecomeFirstResponder else { return }
    if !preservedInput.isFirstResponder {
      _ = preservedInput.becomeFirstResponder()
    }
  }

  fileprivate static func isTextSelectionChrome(_ view: UIView) -> Bool {
    var current: UIView? = view
    while let node = current {
      let name = NSStringFromClass(type(of: node))
      if name.contains("TextSelection")
        || name.contains("SelectionGrabber")
        || name.contains("SelectionView")
        || name.contains("UICallout")
        || name.contains("EditMenu")
        || name.contains("ContextMenu")
        || name.contains("HandleView")
        || name.contains("HighlightView")
        || name.contains("UITextSelectionHandle")
        || name.contains("Handle")
      {
        return true
      }
      current = node.superview
    }
    return false
  }

  fileprivate static func keyWindow() -> UIWindow? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }
  }

  fileprivate static func findFirstResponder() -> UIResponder? {
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

/// Selectable sent-message text. System edit menu (Copiar, Seleccionar, Preguntar a Siri)
/// plus a custom Editar action.
class NucleoMessageTextView: ExpoView, UITextViewDelegate {
  let onEdit = EventDispatcher()
  let onSize = EventDispatcher()

  private let textView = UITextView()
  private var rawText: String = ""
  private var fontSize: CGFloat = 17
  private var lineHeight: CGFloat = 24
  private var fontFamily: String?
  private var textColor: UIColor = .label
  private var hitTestOnly = false
  private var lastReportedHeight: CGFloat = 0

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    textView.backgroundColor = .clear
    textView.isEditable = false
    textView.isSelectable = true
    textView.isScrollEnabled = false
    textView.isUserInteractionEnabled = true
    textView.textContainerInset = .zero
    textView.textContainer.lineFragmentPadding = 0
    textView.showsVerticalScrollIndicator = false
    textView.showsHorizontalScrollIndicator = false
    textView.delegate = self
    textView.adjustsFontForContentSizeCategory = true
    addSubview(textView)
  }

  public override func layoutSubviews() {
    super.layoutSubviews()
    textView.frame = bounds
    reportHeightIfNeeded()
  }

  func setText(_ text: String) {
    rawText = text
    applyAttributedText()
    reportHeightIfNeeded()
  }

  func setUIColor(_ color: UIColor?) {
    textColor = color ?? .label
    applyAttributedText()
  }

  func setFontSize(_ size: CGFloat) {
    fontSize = size
    applyAttributedText()
  }

  func setLineHeight(_ height: CGFloat) {
    lineHeight = height
    applyAttributedText()
  }

  func setFontFamily(_ name: String?) {
    fontFamily = name
    applyAttributedText()
  }

  func setHitTestOnly(_ value: Bool) {
    hitTestOnly = value
    applyAttributedText()
  }

  private func applyAttributedText() {
    let paragraph = NSMutableParagraphStyle()
    paragraph.minimumLineHeight = lineHeight
    paragraph.maximumLineHeight = lineHeight
    let font: UIFont
    if let fontFamily, let custom = UIFont(name: fontFamily, size: fontSize) {
      font = custom
    } else {
      font = UIFont.systemFont(ofSize: fontSize)
    }
    textView.attributedText = NSAttributedString(
      string: rawText,
      attributes: [
        .font: font,
        .foregroundColor: hitTestOnly ? UIColor.clear : textColor,
        .paragraphStyle: paragraph,
      ]
    )
  }

  private func reportHeightIfNeeded() {
    let width = bounds.width
    guard width > 1 else { return }
    let size = textView.sizeThatFits(CGSize(width: width, height: CGFloat.greatestFiniteMagnitude))
    if abs(size.height - lastReportedHeight) > 0.5 {
      lastReportedHeight = size.height
      onSize(["height": size.height])
    }
  }

  func textView(
    _ textView: UITextView,
    editMenuForTextIn range: NSRange,
    suggestedActions: [UIMenuElement]
  ) -> UIMenu? {
    let edit = UIAction(
      title: "Editar",
      image: UIImage(systemName: "pencil"),
      identifier: UIAction.Identifier("nucleo.edit")
    ) { [weak self] _ in
      self?.onEdit([:])
    }
    var items = suggestedActions
    let insertAt = min(1, items.count)
    items.insert(edit, at: insertAt)
    return UIMenu(children: items)
  }
}

