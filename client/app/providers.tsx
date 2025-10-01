'use client';

import dynamic from 'next/dynamic';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getFullnodeUrl } from '@mysten/sui/client';
import { useSuiClientContext } from '@mysten/dapp-kit';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

// Dynamically import providers that use sessionStorage or window, disabling SSR
const SuiClientProvider = dynamic(() => import('@mysten/dapp-kit').then(mod => mod.SuiClientProvider), { ssr: false });
const WalletProvider = dynamic(() => import('@mysten/dapp-kit').then(mod => mod.WalletProvider), { ssr: false });

import { UserProvider } from '../context/UserContext';
import { EventProvider } from '../context/EventContext';

// Initialize QueryClient
const queryClient = new QueryClient();

// Define Sui networks
const networks = {
	devnet: { url: getFullnodeUrl('devnet') },
	mainnet: { url: getFullnodeUrl('mainnet') },
	testnet: { url: getFullnodeUrl('testnet') },
};

export default function Providers({ children }: { children: ReactNode }) {
	const [theme, setTheme] = useState('system');

	useEffect(() => {
		const body = window.document.body;

		const initialTheme = localStorage.getItem('suilens-theme') || 'system';
		setTheme(initialTheme);

		const applyTheme = (themeValue: string) => {
			if (themeValue === 'light') {
				body.classList.add('theme-light');
				body.classList.remove('theme-dark');
			} else if (themeValue === 'dark') {
				body.classList.add('theme-dark');
				body.classList.remove('theme-light');
			} else {
				// system
				body.classList.remove('theme-light');
				body.classList.remove('theme-dark');
			}
		};

		applyTheme(initialTheme);

		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleChange = (e: MediaQueryListEvent) => {
			if (theme === 'system') {
				if (e.matches) {
					body.classList.add('theme-dark');
					body.classList.remove('theme-light');
				} else {
					body.classList.add('theme-light');
					body.classList.remove('theme-dark');
				}
			}
		};

		mediaQuery.addEventListener('change', handleChange);

		return () => {
			mediaQuery.removeEventListener('change', handleChange);
		};
	}, [theme]);

	return (
		<QueryClientProvider client={queryClient}>
			<SuiClientProvider networks={networks} defaultNetwork="mainnet">
				<WalletProvider autoConnect={true} storageKey="sui-wallet-kit">
					<UserProvider>
						<EventProvider>{children}</EventProvider>
					</UserProvider>
				</WalletProvider>
			</SuiClientProvider>
		</QueryClientProvider>
	);
}
