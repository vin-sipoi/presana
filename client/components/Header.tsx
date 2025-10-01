'use client';
import {
	useCurrentAccount,
	useDisconnectWallet,
	useConnectWallet,
} from '@mysten/dapp-kit';
import { Menu, X, Wallet } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProfileDropdown } from '../app/landing/ProfileDropDown';
import { useUser } from '@/context/UserContext';
import { WalletConnect } from '@/components/auth/WalletConnect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { GoogleLogin } from '@/components/auth/GoogleLogin';
import { Button } from '@/components/ui/button';

export default function Header() {
	const { user, logout } = useUser();
	const [showDropdown, setShowDropdown] = useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [mounted, setMounted] = useState(false);
	const account = useCurrentAccount();
	const disconnectWallet = useDisconnectWallet();
	const { mutate: connectWallet } = useConnectWallet();
	const router = useRouter();
	const pathname = usePathname();

	// Check if user is authenticated - check localStorage user or wallet connections
	const isAuthenticated = mounted && !!(user?.walletAddress || account?.address);

	// Helper function to check if a link is active
	const isLinkActive = (href: string) => {
		if (href === '/') {
			return pathname === '/';
		}
    return pathname ? pathname.startsWith(href) : false;
	};

	useEffect(() => {
		setMounted(true);
	}, []);

	// Close mobile menu when resizing to desktop
	useEffect(() => {
		const handleResize = () => {
			if (window.innerWidth >= 1024 && mobileMenuOpen) {
				setMobileMenuOpen(false);
			}
		};

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, [mobileMenuOpen]);

	// Close dropdowns when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (showDropdown && !target.closest('.profile-dropdown-container')) {
				setShowDropdown(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [showDropdown]);

	const navItems = [
		{ name: 'Home', href: '/' },
		{ name: 'Communities', href: '/communities' },
		{ name: 'Explore', href: '/discover' },
		{ name: 'Bounties', href: '/bounties' },
	];

  // Remove dashboard from the nav list when the user is not authenticated
  const filteredNavItems = navItems.filter(item => !(item.name === 'Dashboard' && !isAuthenticated));

	// Handle navigation - no authentication check for public pages
	const handleNavigation = (href: string) => {
		// Only check authentication for protected routes like dashboard
		if (href === '/dashboard' && !isAuthenticated) {
			router.push('/auth/signin');
			return;
		}
		router.push(href);
		setMobileMenuOpen(false);
	};


	return (
		<>
			<header className="bg-white sticky top-0 z-50 w-full border-b border-gray-100">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 z-20 flex-shrink-0">
            <Image
              src="https://i.ibb.co/PZHSkCVG/Suilens-Logo-Mark-Suilens-Black.png"
              alt="Suilens Logo"
              width={40}
              height={40}
              className="sm:w-7 sm:h-7 object-contain"
            />
            <span className="text-base sm:text-lg font-semibold text-[#020B15]">
              Suilens
            </span>
          </Link>

          {/* Center Nav - Desktop Only */}
          <nav className="hidden lg:flex flex-1 justify-center">
            <ul className="flex gap-6 xl:gap-8 text-sm font-medium">
              {filteredNavItems.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`transition-colors ${isLinkActive(item.href) 
                      ? 'text-black font-semibold' 
                      : 'text-gray-600 '}`}
                  >
                    {item.name === 'Explore' ? 'Discover Events' : item.name}
                  </Link>
                </li>
              ))}
              {isAuthenticated && (
                <li>
                  <Link
                    href="/dashboard"
                    className={`transition-colors ${isLinkActive('/dashboard') 
                      ? 'text-[#4DA2FF] font-semibold' 
                      : 'text-gray-600 hover:text-[#4DA2FF]'}`}
                  >
                    Dashboard
                  </Link>
                </li>
              )}
            </ul>
          </nav>

          {/* Mobile Right Side - Create Event + Menu */}
          <div className="flex lg:hidden items-center gap-2 flex-shrink-0">
            {/* Create Event Button - Mobile */}
            {isAuthenticated && (
              <Link href="/create">
                <Button className="bg-[#4DA2FF] text-white px-3 py-2 rounded-lg hover:bg-[#3B82F6] transition-colors text-xs sm:text-sm">
                  Create Event
                </Button>
              </Link>
            )}
            
            {/* Mobile menu button */}
            <button
              className="p-2 text-gray-600 hover:text-gray-900 focus:outline-none transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Right Side - Desktop */}
          <div className="hidden lg:flex items-center gap-3 xl:gap-4 flex-shrink-0">
            {!isAuthenticated ? (
              <Dialog>
                <DialogTrigger asChild> 
                  <Button className="text-white bg-[#4DA2FF] border px-4 py-2 rounded-xl hover:bg-[#3B82F6] transition-colors text-sm">
                    Sign in
                  </Button>
                </DialogTrigger>
                <DialogContent className="flex flex-col items-center w-[95%] max-w-sm mx-auto bg-white text-black">
                  <DialogHeader>
                    <DialogTitle className="text-[#1C1C1C] font-semibold text-xl sm:text-2xl">Login to SuiLens</DialogTitle>
                  </DialogHeader>
                  <div className="py-4">
                    <p className="text-sm text-[#888888] mb-6">A wallet will be assigned to you when you create an account.</p>
                    <GoogleLogin className="w-full text-[#101928] bg-white border-2 rounded-2xl flex items-center justify-center gap-2" />
                    <Button onClick={() => (connectWallet as any)()} className="w-full mt-4 bg-[#4DA2FF] text-white rounded-2xl flex items-center justify-center gap-2">
                      <Wallet className="w-5 h-5" />
                      Connect Wallet
                    </Button>
                  </div>
                  <DialogFooter />
                </DialogContent>
              </Dialog>
            ) : (
              <>
                <Link href="/create">
                  <Button className="bg-[#4DA2FF] text-white px-4 py-2 rounded-xl hover:bg-[#3B82F6] transition-colors text-sm">
                    Create Event
                  </Button>
                </Link>
                <WalletConnect />
              </>
            )}
          </div>
        </div>
      	</header>

			{/* Mobile Navigation Menu */}
			{mobileMenuOpen && (
				<div
          className={`fixed top-0 left-0 w-full bg-white shadow-md transition-transform duration-300 ${
            mobileMenuOpen ? 'translate-y-0 z-40' : '-translate-y-full'
          }`}
				>
					<div className="px-3 sm:px-4 py-4 max-h-[calc(100vh-64px)] sm:max-h-[calc(100vh-72px)] overflow-y-auto">
						<nav className="flex flex-col space-y-1">
              {filteredNavItems.map((item) => (
								<button
									key={item.name}
									onClick={() => handleNavigation(item.href)}
									className={`text-base px-3 py-3 rounded-lg text-left transition-colors ${
										isLinkActive(item.href)
											? 'font-semibold text-[#4DA2FF] bg-blue-50'
											: 'font-medium text-gray-700 hover:text-[#4DA2FF] hover:bg-gray-50'
									}`}
								>
									{item.name === 'Explore' ? 'Discover Events' : item.name}
								</button>
							))}

              {/* Dashboard link for authenticated users */}
              {isAuthenticated && (
                <button
                  onClick={() => handleNavigation('/dashboard')}
                  className={`text-base px-3 py-3 rounded-lg text-left transition-colors ${
                    isLinkActive('/dashboard')
                      ? 'font-semibold text-[#4DA2FF] bg-blue-50'
                      : 'font-medium text-gray-700 hover:text-[#4DA2FF] hover:bg-gray-50'
                  }`}
                >
                  Dashboard
                </button>
              )}

              {/* Authentication Section */}
              <div className="pt-4 mt-4 border-t border-gray-200 space-y-3">
                {!isAuthenticated ? (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="w-full bg-[#4DA2FF] text-white py-3 rounded-lg hover:bg-[#3B82F6] transition-colors text-sm font-medium">
                        Sign in
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95%] max-w-sm mx-auto bg-white text-black">
                      <DialogHeader>
                        <DialogTitle className="text-[#1C1C1C] font-semibold text-xl">Get Started On SuiLens</DialogTitle>
                      </DialogHeader>
                      <div className="py-4">
                        <p className="text-sm text-[#888888] mb-6">A wallet will be assigned to you when you create an account.</p>
                        <GoogleLogin className="w-full text-[#101928] bg-[#D0D5DD] flex items-center justify-center gap-2" />
                        <Button onClick={() => (connectWallet as any)()} className="w-full mt-4 bg-[#4DA2FF] text-white rounded-2xl flex items-center justify-center gap-2">
                          <Wallet className="w-5 h-5" />
                          Connect Wallet
                        </Button>
                      </div>
                      <DialogFooter />
                    </DialogContent>
                  </Dialog>
                ) : (
                  <div className="space-y-3">
                    {/* Show WalletConnect for authentication */}
                    <WalletConnect />
                  </div>
                )}
              </div>
						</nav>
					</div>
				</div>
			)}
		</>
	);
}