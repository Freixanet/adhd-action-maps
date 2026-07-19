#!/usr/bin/env python3
"""Helper for automating iOS Simulator interactions via idb during the UI audit.

Single actions:
  python3 idb_helper.py tap-label "Some Label" [--udid UDID] [--contains]
  python3 idb_helper.py tap-xy X Y [--udid UDID]
  python3 idb_helper.py dump [--udid UDID]
  python3 idb_helper.py screenshot OUTPUT.png [--udid UDID]
  python3 idb_helper.py find-label "Some Label" [--udid UDID] [--contains]
  python3 idb_helper.py swipe X1 Y1 X2 Y2 [--udid UDID]
  python3 idb_helper.py text "some text" [--udid UDID]

Batch script (one step per line, drastically reduces tool round-trips):
  python3 idb_helper.py script path/to/steps.txt [--udid UDID]

  Step file syntax (one per line, '#' for comments, blank lines ignored):
    tap-label:Some Label          -> exact label match
    tap-label~:Some Label          -> substring match (contains)
    tap-xy:123,456
    swipe:x1,y1,x2,y2[,duration]
    text:hello world
    wait:1.5
    screenshot:/tmp/out.png
    dump                          -> prints all labeled elements (debug)
"""
import json
import subprocess
import sys
import time
import argparse

DEFAULT_UDID = "AA6382E2-F105-4F74-9975-2B82734F0AC5"


def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.stdout, result.stderr, result.returncode


def describe_all(udid):
    out, err, rc = run(["idb", "ui", "describe-all", "--udid", udid])
    if rc != 0:
        print(f"describe-all failed: {err}", file=sys.stderr)
        sys.exit(1)
    return json.loads(out)


def center_of(frame):
    return (frame["x"] + frame["width"] / 2, frame["y"] + frame["height"] / 2)


def find_label(elements, label, contains=False):
    matches = []
    for el in elements:
        ax_label = el.get("AXLabel") or ""
        if contains:
            if label.lower() in ax_label.lower():
                matches.append(el)
        else:
            if ax_label == label:
                matches.append(el)
    return matches


def do_tap_label(udid, label, contains=False):
    elements = describe_all(udid)
    matches = find_label(elements, label, contains=contains)
    if not matches:
        print(f"WARN: no matches for label={label!r}", file=sys.stderr)
        return False
    el = next((m for m in matches if m.get("enabled")), matches[0])
    cx, cy = center_of(el["frame"])
    _, err, rc = run(["idb", "ui", "tap", str(round(cx)), str(round(cy)), "--udid", udid])
    if rc != 0:
        print(f"tap failed: {err}", file=sys.stderr)
        return False
    print(f"Tapped {label!r} at ({cx:.1f},{cy:.1f})")
    return True


def do_tap_xy(udid, x, y):
    _, err, rc = run(["idb", "ui", "tap", str(round(x)), str(round(y)), "--udid", udid])
    if rc != 0:
        print(f"tap failed: {err}", file=sys.stderr)
        return False
    print(f"Tapped ({x},{y})")
    return True


def do_swipe(udid, x1, y1, x2, y2, duration=None):
    cmd = ["idb", "ui", "swipe", str(round(x1)), str(round(y1)), str(round(x2)), str(round(y2)), "--udid", udid]
    if duration:
        cmd += ["--duration", str(duration)]
    _, err, rc = run(cmd)
    if rc != 0:
        print(f"swipe failed: {err}", file=sys.stderr)
        return False
    print(f"Swiped ({x1},{y1})->({x2},{y2})")
    return True


def do_text(udid, text):
    _, err, rc = run(["idb", "ui", "text", text, "--udid", udid])
    if rc != 0:
        print(f"text failed: {err}", file=sys.stderr)
        return False
    print(f"Typed {text!r}")
    return True


def do_screenshot(udid, path):
    _, err, rc = run(["idb", "screenshot", "--udid", udid, path])
    if rc != 0:
        print(f"screenshot failed: {err}", file=sys.stderr)
        return False
    print(f"Saved {path}")
    return True


def do_dump(udid):
    elements = describe_all(udid)
    for el in elements:
        label = el.get("AXLabel")
        role = el.get("role")
        frame = el.get("frame")
        if label:
            cx, cy = center_of(frame)
            print(f"{role}\t{label!r}\tframe={frame}\tcenter=({cx:.1f},{cy:.1f})")


def do_tap_label_scroll(udid, label, contains=False, max_scrolls=6):
    """Scroll down incrementally until the labeled element is within the visible
    viewport (0-874 pt), then tap it. Falls back to plain tap-label if never
    found on-screen after scroll attempts."""
    for attempt in range(max_scrolls):
        elements = describe_all(udid)
        matches = find_label(elements, label, contains=contains)
        onscreen = [m for m in matches if 0 <= center_of(m["frame"])[1] <= 850]
        if onscreen:
            el = next((m for m in onscreen if m.get("enabled")), onscreen[0])
            cx, cy = center_of(el["frame"])
            _, err, rc = run(["idb", "ui", "tap", str(round(cx)), str(round(cy)), "--udid", udid])
            if rc != 0:
                print(f"tap failed: {err}", file=sys.stderr)
                return False
            print(f"Tapped {label!r} at ({cx:.1f},{cy:.1f}) after {attempt} scroll(s)")
            return True
        if matches:
            # Found but off-screen; scroll toward it.
            target_y = center_of(matches[0]["frame"])[1]
            direction = 1 if target_y > 437 else -1
        else:
            direction = 1
        run(["idb", "ui", "swipe", "201", str(700 if direction > 0 else 200),
             "201", str(200 if direction > 0 else 700), "--duration", "0.25", "--udid", udid])
        time.sleep(0.6)
    print(f"WARN: {label!r} never found on-screen after {max_scrolls} scroll attempts", file=sys.stderr)
    return False


def run_script(udid, script_path):
    with open(script_path) as f:
        lines = f.readlines()
    for lineno, raw in enumerate(lines, 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        try:
            if line == "dump":
                do_dump(udid)
            elif line.startswith("tap-label~:"):
                do_tap_label(udid, line.split(":", 1)[1], contains=True)
            elif line.startswith("tap-label:"):
                do_tap_label(udid, line.split(":", 1)[1], contains=False)
            elif line.startswith("tap-scroll~:"):
                do_tap_label_scroll(udid, line.split(":", 1)[1], contains=True)
            elif line.startswith("tap-scroll:"):
                do_tap_label_scroll(udid, line.split(":", 1)[1], contains=False)
            elif line.startswith("tap-xy:"):
                x, y = line.split(":", 1)[1].split(",")
                do_tap_xy(udid, float(x), float(y))
            elif line.startswith("swipe:"):
                parts = line.split(":", 1)[1].split(",")
                x1, y1, x2, y2 = [float(p) for p in parts[:4]]
                duration = float(parts[4]) if len(parts) > 4 else None
                do_swipe(udid, x1, y1, x2, y2, duration)
            elif line.startswith("text:"):
                do_text(udid, line.split(":", 1)[1])
            elif line.startswith("wait:"):
                secs = float(line.split(":", 1)[1])
                print(f"Waiting {secs}s")
                time.sleep(secs)
            elif line.startswith("screenshot:"):
                do_screenshot(udid, line.split(":", 1)[1])
            else:
                print(f"Line {lineno}: unknown step {line!r}", file=sys.stderr)
        except Exception as exc:
            print(f"Line {lineno} ({line!r}) failed: {exc}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "action",
        choices=["tap-label", "tap-xy", "dump", "screenshot", "find-label", "swipe", "text", "script"],
    )
    parser.add_argument("args", nargs="*")
    parser.add_argument("--udid", default=DEFAULT_UDID)
    parser.add_argument("--contains", action="store_true")
    args = parser.parse_args()
    udid = args.udid

    if args.action == "screenshot":
        do_screenshot(udid, args.args[0])
    elif args.action == "dump":
        do_dump(udid)
    elif args.action == "find-label":
        label = args.args[0]
        elements = describe_all(udid)
        matches = find_label(elements, label, contains=args.contains)
        if not matches:
            print(f"No matches for label={label!r}", file=sys.stderr)
            sys.exit(1)
        for el in matches:
            cx, cy = center_of(el["frame"])
            print(f"{el.get('role')}\t{el.get('AXLabel')!r}\tframe={el['frame']}\tcenter=({cx:.1f},{cy:.1f})")
    elif args.action == "tap-xy":
        x, y = float(args.args[0]), float(args.args[1])
        do_tap_xy(udid, x, y)
    elif args.action == "tap-label":
        do_tap_label(udid, args.args[0], contains=args.contains)
    elif args.action == "swipe":
        x1, y1, x2, y2 = [float(a) for a in args.args[:4]]
        duration = float(args.args[4]) if len(args.args) > 4 else None
        do_swipe(udid, x1, y1, x2, y2, duration)
    elif args.action == "text":
        do_text(udid, args.args[0])
    elif args.action == "script":
        run_script(udid, args.args[0])


if __name__ == "__main__":
    main()
