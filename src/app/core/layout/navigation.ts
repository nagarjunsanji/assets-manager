export interface NavItem {
  label: string;
  icon: string;
  route: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAVIGATION: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', icon: 'space_dashboard', route: '/dashboard' },
      { label: 'Cashflow Calendar', icon: 'calendar_month', route: '/calendar' },
      { label: 'Analytics', icon: 'monitoring', route: '/analytics' },
      { label: 'FIRE', icon: 'local_fire_department', route: '/fire' },
      { label: 'Wealth Simulator', icon: 'auto_graph', route: '/simulator' },
    ],
  },
  {
    label: 'Investments',
    items: [
      { label: 'Stocks', icon: 'candlestick_chart', route: '/stocks' },
      { label: 'Mutual Funds', icon: 'pie_chart', route: '/mutual-funds' },
      { label: 'Fixed Deposits', icon: 'savings', route: '/fixed-deposits' },
      { label: 'Other Assets', icon: 'account_balance_wallet', route: '/other-assets' },
    ],
  },
  {
    label: 'Real & Business',
    items: [
      { label: 'Properties', icon: 'apartment', route: '/properties' },
      { label: 'Agriculture Lands', icon: 'grass', route: '/agriculture' },
      { label: 'Livestock', icon: 'pets', route: '/livestock' },
      { label: 'Vehicles', icon: 'directions_car', route: '/vehicles' },
    ],
  },
  {
    label: 'Alternative & Protection',
    items: [
      { label: 'Private Lending', icon: 'handshake', route: '/lending' },
      { label: 'Insurance', icon: 'health_and_safety', route: '/insurance' },
    ],
  },
  {
    label: 'Planning',
    items: [
      { label: 'Liabilities', icon: 'credit_card', route: '/liabilities' },
      { label: 'Goals', icon: 'flag', route: '/goals' },
      { label: 'Document Vault', icon: 'folder_shared', route: '/documents' },
      { label: 'Settings', icon: 'tune', route: '/settings' },
    ],
  },
];
