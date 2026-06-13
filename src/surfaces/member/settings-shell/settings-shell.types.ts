export type SettingsShellNavItem = {
  title: string;
  url: string;
  icon?: string;
  active?: boolean;
};

export type SettingsShellData = {
  title: string;
  nav: {
    items: SettingsShellNavItem[];
  };
  topNav: {
    items: SettingsShellNavItem[];
  };
};
