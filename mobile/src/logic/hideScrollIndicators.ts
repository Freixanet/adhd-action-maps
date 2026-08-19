import { FlatList, ScrollView, SectionList } from 'react-native';

/** Hide system scrollbars app-wide (ScrollView / lists still scroll). */
export function hideScrollIndicatorsGlobally() {
  const patch = (Component: { defaultProps?: Record<string, unknown> } | null | undefined) => {
    if (!Component) return;
    Component.defaultProps = {
      ...(Component.defaultProps ?? {}),
      showsVerticalScrollIndicator: false,
      showsHorizontalScrollIndicator: false,
    };
  };

  patch(ScrollView as typeof ScrollView & { defaultProps?: Record<string, unknown> });
  patch(FlatList as typeof FlatList & { defaultProps?: Record<string, unknown> });
  patch(SectionList as typeof SectionList & { defaultProps?: Record<string, unknown> });
}
