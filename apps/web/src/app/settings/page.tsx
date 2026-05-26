import { Suspense } from 'react';
import SettingsPage from '../../features/settings/SettingsPage';
import AppShell from '../../components/AppShell';

export default function Settings() {
  return <AppShell><SettingsPage /></AppShell>;
}
