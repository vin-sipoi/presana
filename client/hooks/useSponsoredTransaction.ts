'use client';

import { useCurrentAccount, useConnectWallet } from '@mysten/dapp-kit';
import { suiClient } from '../lib/sui-client';
import { useSignTransaction } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';
import { useState } from 'react';
import { toast } from 'sonner';
import { useUser } from '@/context/UserContext';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL

export function useSponsoredTransaction() {
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const { mutateAsync: connectWallet } = useConnectWallet();
 
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(false);

  async function sponsorAndExecute({
    tx,
    allowedMoveCallTargets,
    allowedAddresses,
    network = 'mainnet',
    skipOnlyTransactionKind = false,
  }: {
    tx: Transaction;
    allowedMoveCallTargets?: string[];
    allowedAddresses?: string[];
    network?: string;
    skipOnlyTransactionKind?: boolean;
  }) {
    console.log('🚀 Starting sponsored transaction...');

    const senderAddress = currentAccount?.address || user?.walletAddress;
    const hasWalletConnection = currentAccount || user?.walletAddress;

    if (!hasWalletConnection) {
      toast.error('Wallet connection required. Please connect your wallet to continue.');
      throw new Error('Wallet connection required.');
    }

    if (!senderAddress) {
      toast.error('No sender address available. Please connect your wallet or login with Enoki.');
      throw new Error('No sender address available.');
    }

    setIsLoading(true);

    try {


      // 1. Build transaction bytes
      let txBytes: Uint8Array;
      try {
        // First try to build transaction kind bytes
        txBytes = await tx.build({
          onlyTransactionKind: true,
          client: suiClient,
        });
      } catch (buildError: any) {
        console.log('Building transaction kind failed, trying with sender set...');
        // If it fails, set the sender and try again with transaction kind
        tx.setSender(senderAddress);
        try {
          txBytes = await tx.build({
            onlyTransactionKind: true,
            client: suiClient,
          });
        } catch (retryError: any) {
          console.log('Building transaction kind with sender also failed, trying full transaction...');
          // If that still fails, build full transaction as last resort
          txBytes = await tx.build({ client: suiClient });
        }
      }

      // Convert to base64 for sponsor API
      const txBytesBase64 = toBase64(txBytes);

      // 2. Request sponsorship
      const sponsorResponse = await fetch(`${BACKEND_URL}/api/sponsor/sponsor-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionKindBytes: txBytesBase64,
          sender: senderAddress,
          network,
          allowedAddresses: allowedAddresses || [senderAddress],
        }),
      });

      if (!sponsorResponse.ok) {
        const errorText = await sponsorResponse.text();
        console.error('Sponsorship API error:', errorText);
        throw new Error(`Sponsorship failed or is not available: ${errorText}`);
      }

      const sponsorData = await sponsorResponse.json();

      // 3. Handle sponsor response
      const { bytes: sponsorBytes, digest, requiresProfileCreation, profileTransaction } = sponsorData;

      if (requiresProfileCreation && profileTransaction) {
        return {
          success: true,
          requiresProfileCreation: true,
          profileTransaction: {
            bytes: profileTransaction.bytes,
            digest: profileTransaction.digest,
          },
          mainTransaction: { bytes: null, digest: null },
          network: sponsorData.network,
          message: sponsorData.message,
        };
      }

      if (!sponsorBytes) {
        throw new Error('No transaction bytes received from sponsor.');
      }

      let transactionBytes: Uint8Array;
      if (typeof sponsorBytes === 'string') {
        const { fromBase64 } = await import('@mysten/sui/utils');
        transactionBytes = fromBase64(sponsorBytes);
      } else if (sponsorBytes instanceof Uint8Array) {
        transactionBytes = sponsorBytes;
      } else if (Array.isArray(sponsorBytes)) {
        transactionBytes = new Uint8Array(sponsorBytes);
      } else {
        throw new Error(`Invalid bytes format received from sponsor: ${typeof sponsorBytes}`);
      }

      // 4. Sign transaction
      const transactionString = toBase64(transactionBytes);
      const signResult = await signTransaction({ transaction: transactionString });
      const signature = signResult.signature;

      if (!signature) throw new Error('Error signing transaction');

      // 5. Execute transaction via backend
      const executeResponse = await fetch(`${BACKEND_URL}/api/sponsor/execute-transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digest, signature }),
      });

      if (!executeResponse.ok) {
        const errorText = await executeResponse.text();
        throw new Error(`Execution failed: ${errorText || 'Unknown error'}`);
      }

      const result = await executeResponse.json();
      return result;
    } catch (error) {
      console.error('Sponsored transaction failed:', error);
      toast.error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  return {
    sponsorAndExecute,
    isLoading,
    isConnected: !!currentAccount || !!user?.walletAddress,
    address: currentAccount?.address || user?.walletAddress,
    currentAccount,
  };
}
