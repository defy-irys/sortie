
import { Colors } from '@/constants/theme';
import { useThemePreference } from '@/hooks/theme-provider';

export function useTheme() {
  const { resolvedTheme } = useThemePreference();

  return Colors[resolvedTheme];
}
