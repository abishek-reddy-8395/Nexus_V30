import AiAssistantPage from '../../features/ai-assistant/AiAssistantPage';
import AppShell from '../../components/AppShell';

export const metadata = { title: 'AI Copilot — NEXUS' };

export default function AIAssistantRoute() {
  return <AppShell><AiAssistantPage /></AppShell>;
}
