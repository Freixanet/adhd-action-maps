# Share Extension (iOS)

Product path: “Abrir en Núcleo” from Safari / YouTube / Files.

## Contract

- App Group: `group.com.freixanet.nucleo` (already used by `expo-widgets`)
- Open URL: `nucleo://import?url={encodedUrl}`
- Map deep link: `nucleo://map/{entryId}`

Parser: [`shared/shareIncoming.ts`](../../shared/shareIncoming.ts).
Client listener: [`IncomingShareListener.tsx`](../src/components/IncomingShareListener.tsx).

## Native target (after `expo prebuild`)

1. Add an iOS Share Extension target in Xcode sharing the App Group.
2. In the extension, read the shared URL/text and open:

```swift
let encoded = url.absoluteString.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
if let open = URL(string: "nucleo://import?url=\(encoded)") {
  extensionContext?.open(open, completionHandler: nil)
}
```

3. Rebuild the dev client (`expo run:ios`). Expo Go cannot host a Share Extension.

Until the native target ships, deep links and the import URL scheme work for testing.
