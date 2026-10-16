import { Routes } from '@angular/router';
import { Shell } from './core/layout/shell';
import { authGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in · ASSET-MANAGER',
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', title: 'Dashboard', loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage) },
      { path: 'calendar', title: 'Cashflow Calendar', loadComponent: () => import('./features/calendar/calendar.page').then((m) => m.CalendarPage) },
      { path: 'analytics', title: 'Analytics', loadComponent: () => import('./features/analytics/analytics.page').then((m) => m.AnalyticsPage) },
      { path: 'fire', title: 'FIRE', loadComponent: () => import('./features/fire/fire.page').then((m) => m.FirePage) },
      { path: 'simulator', title: 'Wealth Simulator', loadComponent: () => import('./features/simulator/simulator.page').then((m) => m.SimulatorPage) },
      { path: 'properties', title: 'Properties', loadComponent: () => import('./features/properties/properties.page').then((m) => m.PropertiesPage) },
      { path: 'agriculture', title: 'Agriculture Lands', loadComponent: () => import('./features/agriculture/agriculture.page').then((m) => m.AgriculturePage) },
      { path: 'livestock', title: 'Livestock', loadComponent: () => import('./features/livestock/livestock.page').then((m) => m.LivestockPage) },
      { path: 'lending', title: 'Private Lending', loadComponent: () => import('./features/lending/lending.page').then((m) => m.LendingPage) },
      { path: 'stocks', title: 'Stocks', loadComponent: () => import('./features/stocks/stocks.page').then((m) => m.StocksPage) },
      { path: 'mutual-funds', title: 'Mutual Funds', loadComponent: () => import('./features/mutual-funds/mutual-funds.page').then((m) => m.MutualFundsPage) },
      { path: 'fixed-deposits', title: 'Fixed Deposits', loadComponent: () => import('./features/fixed-deposits/fixed-deposits.page').then((m) => m.FixedDepositsPage) },
      { path: 'other-assets', title: 'Other Assets', loadComponent: () => import('./features/other-assets/other-assets.page').then((m) => m.OtherAssetsPage) },
      { path: 'insurance', title: 'Insurance', loadComponent: () => import('./features/insurance/insurance.page').then((m) => m.InsurancePage) },
      { path: 'vehicles', title: 'Vehicles', loadComponent: () => import('./features/vehicles/vehicles.page').then((m) => m.VehiclesPage) },
      { path: 'liabilities', title: 'Liabilities', loadComponent: () => import('./features/liabilities/liabilities.page').then((m) => m.LiabilitiesPage) },
      { path: 'goals', title: 'Goals', loadComponent: () => import('./features/goals/goals.page').then((m) => m.GoalsPage) },
      { path: 'documents', title: 'Document Vault', loadComponent: () => import('./features/documents/documents.page').then((m) => m.DocumentsPage) },
      { path: 'settings', title: 'Settings', loadComponent: () => import('./features/settings/settings.page').then((m) => m.SettingsPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
