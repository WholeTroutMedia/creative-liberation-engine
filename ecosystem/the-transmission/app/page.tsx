import TransmissionConsole from '@/components/TransmissionConsole';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'THE TRANSMISSION — Live Feed',
  description: 'A world is broadcasting. You are receiving.',
};

export default function HomePage() {
  return <TransmissionConsole />;
}

