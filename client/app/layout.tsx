import { ErrorBoundary } from '@/components/ErrorBoundary';
import { EventProvider } from '@/context/EventContext';
import { WalletConnectionManager } from '@/components/WalletConnectionManager';
import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
	title: 'Suilens',
	description: 'From hosting to attending, create, join, and earn your badge with Suilens',
	generator: 'v0.dev',
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className='font-sans antialiased'>
				<ErrorBoundary>
					<Providers>
						<ErrorBoundary>
							<EventProvider>
								<WalletConnectionManager />
								{children}
								<Toaster 
									position="bottom-right"
									richColors
									closeButton
									duration={5000}
								/>
							</EventProvider>
						</ErrorBoundary>
					</Providers>
				</ErrorBoundary>
			</body>
		</html>
	);
}
