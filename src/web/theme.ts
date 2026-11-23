import { ref } from 'vue';

export const themes = ['green', 'warm', 'blue', 'white', 'black'] as const;
export type Theme = typeof themes[number];
const key = 'aftertaste.theme';

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(key);
    return themes.find(value => value === saved) ?? 'green';
  } catch { return 'green'; }
}

export const theme = ref(readTheme());
document.documentElement.dataset.theme = theme.value;

export function selectTheme(value: Theme): boolean {
  document.documentElement.dataset.theme = value;
  theme.value = value;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch { return false; }
}
