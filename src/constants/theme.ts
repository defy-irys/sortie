/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#4A382B',
    background: '#F4F0EA',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E9E1D7',
    textSecondary: '#857565',

    primary: '#8B6B4F',
    primaryDark: '#4A382B',
    border: '#D8C8B5',
    danger: '#B85C50',
    success: '#65836A',
    warning: '#A8752D',
    warningBackground: '#F8F0E2',
    dangerBackground: '#F8EAE8',
  },
  dark: {
    text: '#F2EAE1',
    background: '#211C18',
    backgroundElement: '#2C2520',
    backgroundSelected: '#44372D',
    textSecondary: '#B7A99A',

    primary: '#B89573',
    primaryDark: '#D7B998',
    border: '#514337',
    danger: '#E18A7D',
    success: '#91B394',
    warning: '#D7AC68',
    warningBackground: '#44372D',
    dangerBackground: '#492E2A',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
