import { HStack, Image, Text } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, padding, resizable } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

export type NucleoBrandProps = {
  logoUri?: string;
};

const ACCENT = '#8B8FF5';

const NucleoBrandActivity = (props: NucleoBrandProps, _env: LiveActivityEnvironment) => {
  'widget';

  const Logo = ({ size = 16 }: { size?: number }) =>
    props.logoUri ? (
      <Image
        uiImage={props.logoUri}
        modifiers={[resizable(), frame({ width: size, height: size })]}
      />
    ) : null;

  return {
    banner: (
      <HStack spacing={8} modifiers={[padding({ all: 12 })]}>
        <Logo size={20} />
        <Text modifiers={[font({ weight: 'semibold', size: 14 }), foregroundStyle('#FFFFFF')]}>
          Nucleo
        </Text>
      </HStack>
    ),
    compactLeading: (
      <HStack modifiers={[padding({ leading: 2 })]}>
        <Logo size={14} />
      </HStack>
    ),
    compactTrailing: (
      <Text
        modifiers={[
          font({ weight: 'medium', size: 11 }),
          foregroundStyle(ACCENT),
          padding({ trailing: 2 }),
        ]}
      >
        Nucleo
      </Text>
    ),
    minimal: <Logo size={12} />,
    expandedLeading: (
      <HStack spacing={6} modifiers={[padding({ leading: 8 })]}>
        <Logo size={18} />
        <Text modifiers={[font({ weight: 'semibold', size: 14 }), foregroundStyle('#FFFFFF')]}>
          Nucleo
        </Text>
      </HStack>
    ),
  };
};

export default createLiveActivity<NucleoBrandProps>('NucleoBrandActivity', NucleoBrandActivity);
