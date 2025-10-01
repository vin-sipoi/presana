'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Check, Loader2 } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useCurrentAccount, ConnectButton } from '@mysten/dapp-kit'
import { suilensService } from '@/lib/sui-client'
import { useEventContext } from '@/context/EventContext'
import { useUser } from '@/context/UserContext'
import { useSponsoredTransaction } from '@/hooks/useSponsoredTransaction'

interface ClaimPOAPPageProps {
  params: { id: string }
}

export default function ClaimPOAPPage({ params }: ClaimPOAPPageProps) {
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eventData, setEventData] = useState<any>(null)

  const currentAccount = useCurrentAccount()
  const { sponsorAndExecute } = useSponsoredTransaction()

  const { getEvent, fetchEvents, markAttendance } = useEventContext()
  const { user } = useUser()

  useEffect(() => {
    const loadEventData = async () => {
      // Always fetch fresh data to ensure attendance records are up to date
      console.log('Fetching fresh event data for POAP claiming...')
      await fetchEvents(true) // Force refresh from blockchain
      const event = getEvent(params.id)

      if (event) {
        setEventData(event)
        console.log('Event data loaded:', {
          id: event.id,
          title: event.title,
          attendance: event.attendance,
          rsvps: event.rsvps,
          userAddress: user?.walletAddress
        })
      } else {
        setError('Event not found')
      }
    }

    loadEventData()
  }, [params.id, getEvent, fetchEvents, user?.walletAddress])

  const handleCheckInAndClaim = async () => {
    if (!currentAccount) {
      alert('Please connect your wallet first')
      return
    }

    if (!eventData) {
      setError('Event data not available')
      return
    }

    // Check if event has started
    const now = Date.now()
    if (eventData.startTimestamp && now < eventData.startTimestamp) {
      setError('The event has not started yet. You cannot claim the POAP before the event starts.')
      return
    }

    // Remove POAP collection check, use event's poapTemplate as POAP details
    if (!eventData.poapTemplate) {
      setError('POAP details are not available for this event.')
      return
    }

    setClaiming(true)
    setError(null)

    let attempts = 0
    const maxAttempts = 3

    const attemptClaim = async () => {
      try {
        const senderAddress = currentAccount.address

        // Check if user is registered for the event
        const isRegistered = eventData.rsvps?.includes(senderAddress) ||
                            eventData.approved_attendees?.includes(senderAddress)

        if (!isRegistered) {
          setError('You must be registered for the event before claiming your POAP.')
          return
        }

        // Check attendance using session storage as primary method
        const checkInKey = `checkin_${params.id}_${senderAddress}`
        const hasSessionCheckIn = sessionStorage.getItem(checkInKey) === 'true'

        // Also check frontend attendance data as backup
        const hasFrontendAttendance = eventData.attendance?.includes(senderAddress)

        // If neither session nor frontend shows attendance, try to refresh data
        if (!hasSessionCheckIn && !hasFrontendAttendance) {
          console.log('No attendance found, refreshing event data...')
          await fetchEvents(true) // Force refresh
          const refreshedEvent = getEvent(params.id)

          if (refreshedEvent?.attendance?.includes(senderAddress)) {
            console.log('Attendance found after refresh')
          } else {
            setError('You must check in to the event before claiming your POAP. Please scan the event QR code first.')
            return
          }
        }

        console.log('Proceeding with POAP claim - user has attendance record')

        // Add significant delay before claiming to ensure check-in is finalized
        if (attempts > 0) {
          const delaySeconds = attempts === 1 ? 10 : attempts === 2 ? 20 : 30
          console.log(`Retry attempt ${attempts}, waiting ${delaySeconds} seconds for blockchain finalization...`)
          setError(`Claim failed, retrying in ${delaySeconds} seconds...`)

          // Force refresh blockchain state before retry
          console.log('Forcing blockchain state refresh before retry...')
          await fetchEvents(true) // Force refresh from blockchain

          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000))
        }

        // Then mint POAP
        const tx = await suilensService.mintPOAP(params.id)

        // Execute the transaction using sponsored transaction (gas-free)
        console.log('Attempting sponsored POAP claim...')
        const packageId = process.env.NEXT_PUBLIC_PACKAGE_ID || ''
        const result = await sponsorAndExecute({
          tx,
          network: process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet',
          allowedMoveCallTargets: [`${packageId}::suilens_core::mint_event_poap`],
          allowedAddresses: [currentAccount.address],
        })

        console.log('Mint POAP transaction result:', result)

        // Clear the check-in session storage after successful claim
        sessionStorage.removeItem(checkInKey)

        setClaimed(true)
      } catch (error: any) {
        console.error('Error claiming POAP:', error)

        attempts++

        let errorMsg = 'Failed to claim POAP. Please try again.'

        // Handle specific Move contract errors
        if (error.message?.includes('MoveAbort')) {
          if (error.message.includes(', 23)') || error.message.includes('E_NOT_ATTENDEE')) {
            errorMsg = 'You must check in to the event before claiming your POAP. Please scan the event QR code first.'
          } else if (error.message.includes(', 14)') || error.message.includes('E_EVENT_NOT_STARTED')) {
            errorMsg = 'The event has not started yet. You cannot claim the POAP before the event starts.'
          } else if (error.message.includes(', 9)') || error.message.includes('E_NOT_REGISTERED')) {
            errorMsg = 'You are not registered for this event. Please register first.'
          } else {
            errorMsg = 'Transaction failed. Please check your registration status and try again.'
          }
        } else if (error.message?.includes('dry_run_failed')) {
          if (attempts < maxAttempts) {
            console.log(`Dry run failed, attempt ${attempts}/${maxAttempts}, retrying...`)
            return attemptClaim() // Retry with delay
          } else {
            errorMsg = 'Transaction validation failed after multiple attempts. Please ensure you have checked in to the event and try again later.'
          }
        } else if (error.message?.includes('Sponsorship failed')) {
          errorMsg = 'Transaction sponsorship failed. Please try again in a moment.'
        }

        setError(errorMsg)
        setClaiming(false) // Stop claiming on final error
      }
    }

    // Start the claim attempt
    await attemptClaim()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center">
              <Image
                src="https://i.ibb.co/PZHSkCVG/Suilens-Logo-Mark-Suilens-Black.png"
                alt="Suilens Logo"
                width={60}
                height={60}
                className="object-contain"
              />
            </div>
            <span className="text-2xl font-bold text-[#020B15]">Suilens</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Claim Your POAP
            </h1>
            <p className="text-gray-600 text-lg">
              Claim your Proof of Attendance Protocol NFT for attending this event
            </p>
          </div>

          {eventData && (
            <div className="bg-white rounded-xl shadow-lg border p-8 mb-8">
              <div className="mb-6">
                <img
                  src={eventData.poapTemplate || 'https://i.ibb.co/POAP456/default-poap.jpg'}
                  alt="Event POAP"
                  className="w-48 h-48 mx-auto rounded-lg object-cover"
                />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                {eventData.title}
              </h2>
              <p className="text-gray-600 mb-6">
                {eventData.description}
              </p>

              {!currentAccount ? (
                <ConnectButton />
              ) : !claimed ? (
                <div>
                  <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-700 text-sm">
                      Wallet connected: {currentAccount?.address.slice(0, 6)}...{currentAccount?.address.slice(-4)}
                    </p>
                  </div>
                  <Button
                    onClick={handleCheckInAndClaim}
                    disabled={claiming}
                    className="bg-[#4DA2FF] hover:bg-blue-500 transition-colors text-white px-8 py-3 rounded-xl text-lg disabled:opacity-50"
                  >
                    {claiming ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Claiming POAP...
                      </>
                    ) : (
                      'Claim POAP'
                    )}
                  </Button>
                </div>
              ) : (
                <div className="text-center">
                  <div className="mb-4">
                    <Check className="w-16 h-16 mx-auto text-green-600" />
                  </div>
                  <h3 className="text-2xl font-semibold text-green-600 mb-2">
                    POAP Claimed Successfully!
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Your POAP NFT has been minted and transferred to your wallet.
                  </p>
                  <Link href="/dashboard">
                    <Button className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded-lg">
                      View in Dashboard
                    </Button>
                  </Link>
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}
            </div>
          )}

          <div className="text-center text-gray-500 text-sm">
            <p>
              Need help? <Link href="/support" className="text-blue-600 hover:underline">Contact Support</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
