import React from 'react';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react-native';
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
  CpuIcon,
  Delete02Icon,
  File01Icon,
  File02Icon,
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
  PlayCircleIcon,
  PlayIcon,
  Search01Icon,
  Setting06Icon,
  SparklesIcon,
  Target01Icon,
  Tick02Icon,
  Upload01Icon,
  UserCircleIcon,
  Video01Icon,
  Wallet01Icon,
  KeyboardIcon,
} from '@hugeicons/core-free-icons';

export type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
  style?: any;
  className?: string;
};

export type AppIconComponent = React.FC<IconProps>;

function createIcon(icon: IconSvgElement, displayName: string): AppIconComponent {
  const Comp: AppIconComponent = ({
    size = 24,
    color = 'currentColor',
    strokeWidth = 2,
  }) => (
    <HugeiconsIcon icon={icon} size={size} color={color} strokeWidth={strokeWidth} />
  );
  Comp.displayName = displayName;
  return Comp;
}

/** Close / dismiss */
export const X = createIcon(Cancel01Icon, 'X');
export const Search = createIcon(Search01Icon, 'Search');
export const Settings = createIcon(Setting06Icon, 'Settings');
export const MenuTwoLines = createIcon(MenuTwoLineIcon, 'MenuTwoLines');
export const Keyboard = createIcon(KeyboardIcon, 'Keyboard');
export const Check = createIcon(Tick02Icon, 'Check');
export const CheckCircle2 = createIcon(CheckmarkCircle02Icon, 'CheckCircle2');
export const ChevronDown = createIcon(ChevronDownIcon, 'ChevronDown');
export const ChevronUp = createIcon(ChevronUpIcon, 'ChevronUp');
export const ChevronRight = createIcon(ChevronRightIcon, 'ChevronRight');
export const Plus = createIcon(Add01Icon, 'Plus');
export const ArrowUp = createIcon(ArrowUp01Icon, 'ArrowUp');
export const Play = createIcon(PlayIcon, 'Play');
export const CirclePlay = createIcon(PlayCircleIcon, 'CirclePlay');
export const Link = createIcon(Link02Icon, 'Link');
export const Link2 = createIcon(Link02Icon, 'Link2');
export const File = createIcon(File01Icon, 'File');
export const FileText = createIcon(File02Icon, 'FileText');
export const Image = createIcon(Image01Icon, 'Image');
export const Video = createIcon(Video01Icon, 'Video');
export const Upload = createIcon(Upload01Icon, 'Upload');
export const UserRound = createIcon(UserCircleIcon, 'UserRound');
export const LogIn = createIcon(Login01Icon, 'LogIn');
export const LogOut = createIcon(Logout01Icon, 'LogOut');
export const Trash2 = createIcon(Delete02Icon, 'Trash2');
export const Sparkles = createIcon(SparklesIcon, 'Sparkles');
export const MessageSquareText = createIcon(Message02Icon, 'MessageSquareText');
export const MoreHorizontal = createIcon(MoreHorizontalIcon, 'MoreHorizontal');
export const Layers = createIcon(Layers01Icon, 'Layers');
export const List = createIcon(ListViewIcon, 'List');
export const Bookmark = createIcon(Bookmark02Icon, 'Bookmark');
export const Clock = createIcon(Clock01Icon, 'Clock');
export const CircleAlert = createIcon(AlertCircleIcon, 'CircleAlert');
export const Grid = createIcon(Grid02Icon, 'Grid');
export const Cpu = createIcon(CpuIcon, 'Cpu');
export const HeartPulse = createIcon(HeartPulseIcon, 'HeartPulse');
export const Briefcase = createIcon(Briefcase01Icon, 'Briefcase');
export const BookOpen = createIcon(BookOpen01Icon, 'BookOpen');
export const Wallet = createIcon(Wallet01Icon, 'Wallet');
export const JusticeScale = createIcon(JusticeScale01Icon, 'JusticeScale');
export const BatteryLow = createIcon(BatteryLowIcon, 'BatteryLow');
export const ArrowTransfer = createIcon(ArrowDataTransferHorizontalIcon, 'ArrowTransfer');
export const Home = createIcon(Home01Icon, 'Home');
export const Notification = createIcon(Notification03Icon, 'Notification');
export const Target = createIcon(Target01Icon, 'Target');
