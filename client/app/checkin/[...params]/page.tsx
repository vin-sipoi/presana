'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, XCircle, Loader2, Smartphone, Wallet } from 'lucide-react'
import { parseEventQRCode } from '@/utils/qrCodeUtils'
import { useUser } from '@/context/UserContext'
import { useEventContext } from '@/context/EventContext'
import { useSponsoredTransaction } from '@/hooks/useSponsoredTransaction'
import { useConnectWallet } from '@mysten/dapp-kit'
import { suilensService } from '@/lib/sui-client'
import { toast } from 'sonner'
import Image from 'next/image'
import { GoogleLogin } from '@/components/auth/GoogleLogin'

export default function CheckinPage() {
  const params = useParams()
  const router = useRouter()
  const { user, setUser } = useUser()
  const { fetchEvents, updateEvent, getEvent } = useEventContext()
  const { sponsorAndExecute } = useSponsoredTransaction()
  const { mutate: connectWallet } = useConnectWallet()

  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [qrData, setQrData] = useState<any>(null)
  const [isRegistered, setIsRegistered] = useState(false)
  const [authProcessing, setAuthProcessing] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [transactionDigest, setTransactionDigest] = useState<string | null>(null)

  // Function to wait for transaction confirmation by polling blockchain
  const waitForTransactionConfirmation = async (eventId: string, userAddress: string, maxWaitTime = 60000) => {
    const startTime = Date.now()
    const pollInterval = 2000 // Check every 2 seconds

    console.log(`Waiting for attendance confirmation for user ${userAddress} in event ${eventId}...`)

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Refresh event data from blockchain
        await fetchEvents(true)

        // Check if attendance is now recorded
        const currentEvent = getEvent(eventId)
        if (currentEvent?.attendance?.includes(userAddress)) {
          console.log('✅ Attendance confirmed on blockchain!')
          return true
        }

        console.log('Attendance not yet confirmed, waiting...')
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      } catch (error) {
        console.error('Error checking transaction confirmation:', error)
        // Continue polling even if there's an error
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }
    }

    console.warn('⚠️ Transaction confirmation timeout - proceeding anyway')
    return false // Timeout reached, but don't fail the check-in
  }

  // Authentication callback removed since Enoki is no longer used

  // Removed auto-trigger check-in useEffect as per new flow
  // useEffect(() => {
  //   if (user?.walletAddress && qrData && !autoCheckinTriggered && !authProcessing) {
  //     setAutoCheckinTriggered(true)
  //     handleCheckIn()
  //   }
  // }, [user?.walletAddress, qrData, autoCheckinTriggered, authProcessing])

  // Stop auth processing when user is set
  useEffect(() => {
    if (user?.walletAddress) {
      setAuthProcessing(false)
    }
  }, [user?.walletAddress])

  useEffect(() => {
    async function processQRCode() {
      if (params?.params && Array.isArray(params.params)) {
        const [eventId, verificationCode, timestamp] = params.params
        const qrString = `https://suilens.xyz/checkin/${eventId}/${verificationCode}/${timestamp}`

        const parsed = parseEventQRCode(qrString)
        if (parsed) {
          setQrData(parsed)

        if (user?.walletAddress) {
          try {
            const registrationStatus = await suilensService.checkEventRegistration(parsed.eventId, user.walletAddress)
            if (registrationStatus.isRegistered) {
              setIsRegistered(true)
              // Redirect to confirmation page if user is already authenticated
              setRedirecting(true)
              setTimeout(() => {
                const paramArray = Array.isArray(params.params) ? params.params : [params.params]
                window.location.href = `/checkin-confirm/${paramArray.join('/')}`
              }, 100)
            } else {
              setResult('error')
              setErrorMessage('You are not registered for this event. Please register first.')
            }
          } catch (error) {
            console.error('Registration check error:', error)
            // Don't block check-in if registration check fails - let the contract handle it
            setIsRegistered(true) // Allow check-in attempt, let contract validate
            // Redirect to confirmation page if user is already authenticated
            setRedirecting(true)
            setTimeout(() => {
              const paramArray = Array.isArray(params.params) ? params.params : [params.params]
              window.location.href = `/checkin-confirm/${paramArray.join('/')}`
            }, 100)
          }
        }
        } else {
          setResult('error')
          setErrorMessage('Invalid QR code format')
        }
      }
    }

    processQRCode()
  }, [params, user])

  const handleCheckIn = async () => {
    if (!qrData || !user?.walletAddress) return

    setProcessing(true)
    setErrorMessage('')

    try {
      const tx = await suilensService.selfCheckin(
        qrData.eventId,
        qrData.verificationCode
      )

      const result = await sponsorAndExecute({ tx })
      console.log('Check-in transaction result:', result)

      // Verify transaction was actually successful by checking the result
      if (!result || !result.success) {
        throw new Error('Transaction failed to execute successfully')
      }

      // Wait for blockchain to finalize the transaction - poll until confirmed
      console.log('Waiting for blockchain to finalize check-in transaction...')
      await waitForTransactionConfirmation(qrData.eventId, user.walletAddress)

      // Refresh event data to update attendance status in admin panel
      console.log('Refreshing event data after check-in...')
      await fetchEvents(true)

      // Mark attendance locally in context to immediately update UI
      if (user?.walletAddress) {
        const currentEvent = getEvent(qrData.eventId)
        if (currentEvent) {
          const updatedAttendance = currentEvent.attendance || []
          if (!updatedAttendance.includes(user.walletAddress)) {
            updatedAttendance.push(user.walletAddress)
          }
          console.log('Updated local attendance:', updatedAttendance)
          updateEvent(qrData.eventId, {
            attendance: updatedAttendance
          })
        }

        // Set session storage for immediate UI feedback across pages
        const checkInKey = `checkin_${qrData.eventId}_${user.walletAddress}`
        sessionStorage.setItem(checkInKey, 'true')
        console.log('Set session storage for check-in:', checkInKey)
      }

      setResult('success')
      toast.success('✅ Successfully checked in!')

      // Redirect immediately now that transaction is confirmed
      console.log('Redirecting to event page after successful check-in...')
      router.push(`/event/${qrData.eventId}`)

    } catch (error: any) {
      console.error('Check-in failed:', error)
      setResult('error')

      let errorMsg = 'Failed to check in and claim POAP'

      if (error.message.includes('Invalid QR code')) {
        errorMsg = 'Invalid QR code. Please scan a valid Presana event check-in QR code.'
      } else if (error.message.includes('expired')) {
        errorMsg = 'QR code has expired. Please ask the event organizer for a new one.'
      } else if (error.message.includes('wallet')) {
        errorMsg = 'Please connect your wallet first.'
      } else if (error.message.includes('MoveAbort')) {
        if (error.message.includes(', 14)')) {
          errorMsg = 'Event has not started yet. Check-in is only available during the event.'
        } else if (error.message.includes(', 15)')) {
          errorMsg = 'Event has already ended. Check-in is no longer available.'
        } else if (error.message.includes(', 8)')) {
          errorMsg = 'You are not registered for this event. Please register first.'
        } else if (error.message.includes(', 16)')) {
          errorMsg = 'You have already checked in to this event.'
        } else if (error.message.includes(', 17)')) {
          errorMsg = 'Invalid verification code. Please use the correct QR code for this event.'
        } else {
          errorMsg = 'Check-in failed. Please try again or contact the event organizer.'
        }
      } else {
        errorMsg = error.message || 'Failed to check in and claim POAP'
      }

      setErrorMessage(errorMsg)
      toast.error(errorMsg)

      // Do not redirect on error - keep user on checkin page
    } finally {
      setProcessing(false)
    }
  }

  if (!qrData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid QR Code</h2>
            <p className="text-gray-600">This QR code is not a valid Presana check-in code.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Image
              src="https://i.ibb.co/PZHSkCVG/Suilens-Logo-Mark-Suilens-Black.png"
              alt="Presana Logo"
              width={40}
              height={40}
              className="object-contain"
            />
            <span className="text-2xl font-bold text-[#020B15]">Presana</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 py-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Smartphone className="h-5 w-5" />
              Event Check-in
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-gray-600 mb-4">
                Ready to check in to this event and claim your POAP?
              </p>

              {!user?.walletAddress ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Sign in to check in and claim your POAP.
                  </p>
                  <GoogleLogin className="w-full" />
                  <div className="text-center text-sm text-gray-500">or</div>
                  <Button onClick={() => (connectWallet as any)()} className="w-full bg-[#4DA2FF] text-white rounded-2xl flex items-center justify-center gap-2">
                    <Wallet className="w-5 h-5" />
                    Connect Wallet
                  </Button>
                </div>
              ) : authProcessing ? (
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                  <h2 className="text-xl font-semibold mb-2">Authenticating...</h2>
                  <p className="text-gray-600">Please wait while we sign you in with Google.</p>
                </div>
              ) : processing ? (
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                  <p className="text-gray-600">Processing check-in and claiming POAP...</p>
                </div>
              ) : result === 'success' ? (
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-green-600 mb-2">
                    Check-in Successful!
                  </h3>
                  <p className="text-gray-600 mb-4">
                    You have been successfully checked in! Redirecting you to claim your POAP...
                  </p>
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-gray-500">Redirecting...</span>
                  </div>
                </div>
              ) : result === 'error' ? (
                <div className="text-center">
                  <XCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-red-600 mb-2">
                    Check-in Failed
                  </h3>
                  <p className="text-gray-600 mb-4">{errorMessage}</p>
                  <Button
                    onClick={() => setResult(null)}
                    variant="outline"
                    className="w-full"
                  >
                    Try Again
                  </Button>
                </div>
              ) : redirecting ? (
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                  <h2 className="text-xl font-semibold mb-2">Redirecting...</h2>
                  <p className="text-gray-600">Taking you to the check-in confirmation page.</p>
                </div>
              ) : (
                <Button
                  onClick={handleCheckIn}
                  disabled={!user?.walletAddress}
                  className="w-full bg-[#4DA2FF] hover:bg-blue-500 disabled:opacity-50"
                >
                  Check In & Claim POAP
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
   )
}
