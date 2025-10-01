'use client';

import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/UserContext';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, User, Wallet } from 'lucide-react';
import Link from 'next/link';

export function WalletConnect() {
  const [mounted, setMounted] = useState(false);
  const currentAccount = useCurrentAccount();
  const { user, setUser, logout } = useUser();
  const { mutate: disconnect } = useDisconnectWallet();
  const router = useRouter();

  // Prevent hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);

  // Update user context when wallet connects
  useEffect(() => {
    if (currentAccount?.address && (!user || user.walletAddress !== currentAccount.address)) {
      console.log('Wallet connected:', currentAccount);

      setUser({
        walletAddress: currentAccount.address,
        name: currentAccount.label || 'Wallet User',
        email: '',
        emails: [],
        avatarUrl: user?.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=SuiLens',
      });
    }
  }, [currentAccount, setUser, user]);

  const handleLogout = () => {
    disconnect();
    logout();
    router.push('/');
  };

  const displayAddress = currentAccount?.address || user?.walletAddress;
  // Always show profile icon if user is authenticated (user exists)
  const isConnected = !!user;

  const handleCopyAddress = () => {
    if (displayAddress) {
      navigator.clipboard.writeText(displayAddress);
    }
  };

  // Don't render until mounted to prevent hydration errors
  if (!mounted) {
    return (
      <Button variant="default" className="flex items-center gap-2">
        <span>Loading...</span>
      </Button>
    );
  }

  if (isConnected && user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 w-8 h-8 text-black border rounded-full">
            <Avatar className="h-full w-full">
              <AvatarImage src={user.picture || user.avatarUrl} />
              <AvatarFallback className="bg-gray-200 text-black">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 bg-white">
          <DropdownMenuLabel className="text-black">My Account</DropdownMenuLabel>
          {user.email && (
            <div className="px-2 py-1">
              <p className="text-sm text-gray-600">{user.email}</p>
            </div>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile" className="flex items-center gap-2 text-black hover:bg-gray-100 cursor-pointer">
              <User className="h-4 w-4" />
              <span>Profile</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={handleCopyAddress}
            className="flex items-center justify-between gap-2 text-black hover:bg-gray-100 cursor-pointer"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Wallet className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs truncate">
                {displayAddress?.slice(0, 6)}...{displayAddress?.slice(-4)}
              </span>
            </div>
            <span className="text-xs text-gray-500">Click to copy</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={handleLogout}
            className="flex items-center gap-2 text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            <span>Disconnect</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // When not authenticated, don't render anything
  return null;
}