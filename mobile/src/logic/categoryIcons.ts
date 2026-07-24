import type { DefaultMapCategory } from '@shared/categories';
import type { HistoryListFilter } from '@shared/historySearch';
import {
  BookOpen,
  Briefcase,
  Clock,
  Cpu,
  Grid,
  HeartPulse,
  JusticeScale,
  MoreHorizontal,
  UserRound,
  Wallet,
  type AppIconComponent,
} from '../icons';

const CATEGORY_ICONS: Record<DefaultMapCategory, AppIconComponent> = {
  'IA y tecnología': Cpu,
  Salud: HeartPulse,
  Negocio: Briefcase,
  Aprendizaje: BookOpen,
  Finanzas: Wallet,
  Legal: JusticeScale,
  Personal: UserRound,
  Otros: MoreHorizontal,
};

export function getHistoryFilterIcon(filter: HistoryListFilter): AppIconComponent {
  if (filter === 'all') return Grid;
  if (filter === 'incomplete') return Clock;
  return CATEGORY_ICONS[filter as DefaultMapCategory] ?? MoreHorizontal;
}
