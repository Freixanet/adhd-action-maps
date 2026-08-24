import React from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react-native';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import {
  resolveSfSymbolName,
  sfOpticalSize,
  sfWeightForStroke,
} from '@shared/iconAppearance';
import {
  Add01Icon,
  AlertCircleIcon,
  ArrowDataTransferHorizontalIcon,
  ArrowUp01Icon,
  BatteryLowIcon,
  Bookmark02Icon,
  BookOpen01Icon,
  Briefcase01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  Clock01Icon,
  Copy01Icon,
  CpuIcon,
  Delete02Icon,
  File01Icon,
  File02Icon,
  Edit01Icon,
  Grid02Icon,
  HeartPulseIcon,
  Home01Icon,
  Image01Icon,
  JusticeScale01Icon,
  Layers01Icon,
  Link02Icon,
  ListViewIcon,
  Login01Icon,
  Logout01Icon,
  MenuTwoLineIcon,
  Message02Icon,
  MoreHorizontalIcon,
  Notification03Icon,
  Pin02Icon,
  PlayCircleIcon,
  PlayIcon,
  Search01Icon,
  Setting06Icon,
  Share01Icon,
  SparklesIcon,
  Target01Icon,
  Tick02Icon,
  Upload01Icon,
  UserCircleIcon,
  Video01Icon,
  VolumeHighIcon,
  VolumeMute01Icon,
  Wallet01Icon,
  KeyboardIcon,
} from '@hugeicons/core-free-icons';

export type IconProps = {
  size?: number;
  color?: string;
  /** Hugeicons stroke. On iOS this maps only to SF SymbolWeight — never to `.fill`. */
  strokeWidth?: number;
  /** Use the SF `.fill` variant when one exists. Orthogonal to strokeWidth. */
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
  className?: string;
};

export type AppIconComponent = React.FC<IconProps>;

type SfNames = {
  name: SFSymbol;
  fill?: SFSymbol;
};

/** Native `SymbolModule` only exists after an iOS rebuild that links expo-symbols. */
const IOS_SF_SYMBOLS = Platform.OS === 'ios' && requireOptionalNativeModule('SymbolModule') != null;

function createIcon(
  icon: IconSvgElement,
  displayName: string,
  sf: SfNames | null
): AppIconComponent {
  const Comp: AppIconComponent = ({
    size = 24,
    color = 'currentColor',
    strokeWidth = 2,
    filled = false,
    style,
  }) => {
    const huge = (
      <HugeiconsIcon icon={icon} size={size} color={color} strokeWidth={strokeWidth} />
    );
    if (!IOS_SF_SYMBOLS || sf == null) return huge;
    const name = resolveSfSymbolName(sf, filled);
    const tint = color === 'currentColor' ? undefined : color;
    const opticalSize = sfOpticalSize(size);
    return (
      <View
        style={[
          { width: size, height: size, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
          style,
        ]}
      >
        <SymbolView
          name={name}
          size={opticalSize}
          tintColor={tint}
          weight={sfWeightForStroke(strokeWidth)}
          type="monochrome"
          style={{ width: opticalSize, height: opticalSize }}
          fallback={huge}
        />
      </View>
    );
  };
  Comp.displayName = displayName;
  return Comp;
}

/** Close / dismiss */
export const X = createIcon(Cancel01Icon, 'X', { name: 'xmark' });
export const Search = createIcon(Search01Icon, 'Search', { name: 'magnifyingglass' });
export const Settings = createIcon(Setting06Icon, 'Settings', {
  name: 'gearshape',
  fill: 'gearshape.fill',
});
export const MenuTwoLines = createIcon(MenuTwoLineIcon, 'MenuTwoLines', null);
export const Keyboard = createIcon(KeyboardIcon, 'Keyboard', { name: 'keyboard' });
export const Check = createIcon(Tick02Icon, 'Check', { name: 'checkmark' });
export const CheckCircle2 = createIcon(CheckmarkCircle02Icon, 'CheckCircle2', {
  name: 'checkmark.circle',
  fill: 'checkmark.circle.fill',
});
export const ChevronDown = createIcon(ChevronDownIcon, 'ChevronDown', {
  name: 'chevron.down',
});
export const ChevronUp = createIcon(ChevronUpIcon, 'ChevronUp', { name: 'chevron.up' });
export const ChevronRight = createIcon(ChevronRightIcon, 'ChevronRight', {
  name: 'chevron.right',
});
export const Plus = createIcon(Add01Icon, 'Plus', { name: 'plus' });
/** Compose / new chat — SF Symbol `square.and.pencil`. */
export const SquarePen = createIcon(Edit01Icon, 'SquarePen', {
  name: 'square.and.pencil',
});
export const ArrowUp = createIcon(ArrowUp01Icon, 'ArrowUp', { name: 'arrow.up' });
export const Play = createIcon(PlayIcon, 'Play', { name: 'play.fill', fill: 'play.fill' });
export const CirclePlay = createIcon(PlayCircleIcon, 'CirclePlay', {
  name: 'play.circle',
  fill: 'play.circle.fill',
});
export const Link = createIcon(Link02Icon, 'Link', { name: 'link' });
export const Link2 = createIcon(Link02Icon, 'Link2', { name: 'link' });
export const File = createIcon(File01Icon, 'File', { name: 'doc', fill: 'doc.fill' });
export const FileText = createIcon(File02Icon, 'FileText', {
  name: 'doc.text',
  fill: 'doc.text.fill',
});
export const Image = createIcon(Image01Icon, 'Image', { name: 'photo', fill: 'photo.fill' });
export const Video = createIcon(Video01Icon, 'Video', { name: 'video', fill: 'video.fill' });
export const Upload = createIcon(Upload01Icon, 'Upload', { name: 'square.and.arrow.up' });
export const UserRound = createIcon(UserCircleIcon, 'UserRound', {
  name: 'person.crop.circle',
  fill: 'person.crop.circle.fill',
});
export const LogIn = createIcon(Login01Icon, 'LogIn', {
  name: 'person.crop.circle.badge.plus',
});
export const LogOut = createIcon(Logout01Icon, 'LogOut', {
  name: 'rectangle.portrait.and.arrow.right',
});
export const Trash2 = createIcon(Delete02Icon, 'Trash2', { name: 'trash', fill: 'trash.fill' });
export const Sparkles = createIcon(SparklesIcon, 'Sparkles', { name: 'sparkles' });
export const MessageSquareText = createIcon(Message02Icon, 'MessageSquareText', {
  name: 'text.bubble',
  fill: 'text.bubble.fill',
});
export const MoreHorizontal = createIcon(MoreHorizontalIcon, 'MoreHorizontal', {
  name: 'ellipsis',
});
export const Layers = createIcon(Layers01Icon, 'Layers', { name: 'square.3.layers.3d' });
export const List = createIcon(ListViewIcon, 'List', { name: 'list.bullet' });
export const Bookmark = createIcon(Bookmark02Icon, 'Bookmark', {
  name: 'bookmark',
  fill: 'bookmark.fill',
});
export const Pin = createIcon(Pin02Icon, 'Pin', { name: 'pin', fill: 'pin.fill' });
export const Clock = createIcon(Clock01Icon, 'Clock', { name: 'clock', fill: 'clock.fill' });
export const Copy = createIcon(Copy01Icon, 'Copy', { name: 'doc.on.doc' });
export const Share = createIcon(Share01Icon, 'Share', { name: 'square.and.arrow.up' });
export const VolumeHigh = createIcon(VolumeHighIcon, 'VolumeHigh', {
  name: 'speaker.wave.2',
  fill: 'speaker.wave.2.fill',
});
export const VolumeMute = createIcon(VolumeMute01Icon, 'VolumeMute', {
  name: 'speaker.slash',
  fill: 'speaker.slash.fill',
});
export const CircleAlert = createIcon(AlertCircleIcon, 'CircleAlert', {
  name: 'exclamationmark.circle',
  fill: 'exclamationmark.circle.fill',
});
export const Grid = createIcon(Grid02Icon, 'Grid', { name: 'square.grid.2x2' });
export const Cpu = createIcon(CpuIcon, 'Cpu', { name: 'cpu' });
export const HeartPulse = createIcon(HeartPulseIcon, 'HeartPulse', {
  name: 'waveform.path.ecg',
});
export const Briefcase = createIcon(Briefcase01Icon, 'Briefcase', {
  name: 'briefcase',
  fill: 'briefcase.fill',
});
export const BookOpen = createIcon(BookOpen01Icon, 'BookOpen', { name: 'book', fill: 'book.fill' });
export const Wallet = createIcon(Wallet01Icon, 'Wallet', {
  name: 'wallet.pass',
  fill: 'wallet.pass.fill',
});
export const JusticeScale = createIcon(JusticeScale01Icon, 'JusticeScale', {
  name: 'scalemass',
  fill: 'scalemass.fill',
});
export const BatteryLow = createIcon(BatteryLowIcon, 'BatteryLow', { name: 'battery.25' });
export const ArrowTransfer = createIcon(ArrowDataTransferHorizontalIcon, 'ArrowTransfer', {
  name: 'arrow.left.arrow.right',
});
export const Home = createIcon(Home01Icon, 'Home', { name: 'house', fill: 'house.fill' });
export const Notification = createIcon(Notification03Icon, 'Notification', {
  name: 'bell',
  fill: 'bell.fill',
});
export const Target = createIcon(Target01Icon, 'Target', { name: 'target' });
