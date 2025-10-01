'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, XCircle, Loader2, Smartphone } from 'lucide-react'
import { parseEventQRCode } from '@/utils/qrCodeUtils'
import { useUser } from '@/context/UserContext'

// Add a local loading state for user context initialization
import { useEventContext } from '@/context/EventContext'
import { useSponsoredTransaction } from '@/hooks/useSponsoredTransaction'
import { suilensService } from '@/lib/sui-client'
import { toast } from 'sonner'
import Image from 'next/image'

export default function CheckinConfirmPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useUser()
  const [userLoading, setUserLoading] = useState(true)

  useEffect(() => {
    // User loading is complete when we have a definitive answer about user state
    // Either user exists or we've determined there's no user data
    if (user !== undefined) {
      setUserLoading(false)
      console.log('User loading complete in check-in page:', user ? 'User available' : 'No user')
    }
  }, [user])
  const { fetchEvents, updateEvent, getEvent } = useEventContext()
  const { sponsorAndExecute } = useSponsoredTransaction()

  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<'success' | 'error' | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [qrData, setQrData] = useState<any>(null)
  const [isRegistered, setIsRegistered] = useState(false)

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
              console.log('Checking registration status for:', parsed.eventId, user.walletAddress)
              const registrationStatus = await suilensService.checkEventRegistration(parsed.eventId, user.walletAddress)
              console.log('Registration status result:', registrationStatus)

              if (registrationStatus.isRegistered) {
                setIsRegistered(true)
                console.log('User is registered - allowing check-in')
              } else {
                console.log('User is not registered according to API')
                // Don't immediately block - let the contract handle validation
                // But show a warning that they might not be registered
                setIsRegistered(true) // Still allow attempt, contract will reject if not registered
                console.log('Allowing check-in attempt despite registration check failure - contract will validate')
              }
            } catch (error) {
              console.error('Registration check error:', error)
              console.log('Registration check failed, but allowing check-in attempt - contract will validate registration')
              // Don't block check-in if registration check fails - let the contract handle it
              setIsRegistered(true) // Allow check-in attempt, let contract validate
            }
          } else {
            console.log('No user wallet address available for registration check')
          }
        } else {
          setResult('error')
          setErrorMessage('Invalid QR code format')
        }
      }
    }

    processQRCode()
  }, [params, user])

  const waitForTransactionConfirmation = async (eventId: string, userAddress: string, maxWaitTime = 60000) => {
    const startTime = Date.now()
    const pollInterval = 2000 // Check every 2 seconds

    console.log(`Waiting for attendance confirmation for user ${userAddress} in event ${eventId}...`)

    while (Date.now() - startTime < maxWaitTime) {
      try {
        await fetchEvents(true)
        const currentEvent = getEvent(eventId)
        if (currentEvent?.attendance?.includes(userAddress)) {
          console.log('✅ Attendance confirmed on blockchain!')
          return true
        }
        console.log('Attendance not yet confirmed, waiting...')
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      } catch (error) {
        console.error('Error checking transaction confirmation:', error)
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }
    }

    console.warn('⚠️ Transaction confirmation timeout - proceeding anyway')
    return false
  }

  const handleCheckIn = async () => {
    if (!qrData || !user?.walletAddress) return

    // Check if user is already checked in before attempting transaction
    const currentEvent = getEvent(qrData.eventId)
    if (currentEvent?.attendance?.includes(user.walletAddress)) {
      setResult('error')
      setErrorMessage('You have already checked in to this event.')
      return
    }

    setProcessing(true)
    setErrorMessage('')
    setResult(null) // Reset result state for retry attempts

    try {
      const tx = await suilensService.selfCheckin(
        qrData.eventId,
        qrData.verificationCode
      )

      const result = await sponsorAndExecute({ tx })
      console.log('Check-in transaction result:', result)
      console.log('Full check-in result structure:', JSON.stringify(result, null, 2))

      // Check for transaction success - handle nested result structure
      const transactionResult = result?.result || result
      const hasSuccessStatus = transactionResult?.effects?.status?.status === 'success'
      const hasSuccessResult = result?.status === 'success'
      const hasNoErrors = !transactionResult?.effects?.status?.error && !transactionResult?.effects?.error
      const hasEvents = transactionResult?.events && transactionResult.events.length > 0

      // Check if this is actually a successful check-in by looking for the AttendanceMarked event
      const isCheckInEvent = transactionResult?.events?.some((event: any) => {
        const isCorrectType = event.type?.includes('AttendanceMarked') || event.type?.includes('CheckIn') || event.type?.includes('check_in')
        const isCorrectEvent = event.parsedJson?.event_id === qrData.eventId
        const isCorrectAttendee = event.parsedJson?.attendee === user.walletAddress
        console.log('Check-in event analysis:', { isCorrectType, isCorrectEvent, isCorrectAttendee, event })
        return isCorrectType && isCorrectEvent && isCorrectAttendee
      })

      // Also check for any successful transaction indicators
      const hasGasUsed = transactionResult?.effects?.gasUsed && transactionResult.effects.gasUsed.computationCost > 0
      const hasObjectChanges = transactionResult?.objectChanges && transactionResult.objectChanges.length > 0

      console.log('=== CHECK-IN SUCCESS ANALYSIS ===')
      console.log('hasSuccessStatus:', hasSuccessStatus)
      console.log('hasSuccessResult:', hasSuccessResult)
      console.log('hasNoErrors:', hasNoErrors)
      console.log('hasEvents:', hasEvents)
      console.log('isCheckInEvent:', isCheckInEvent)
      console.log('hasGasUsed:', hasGasUsed)
      console.log('hasObjectChanges:', hasObjectChanges)
      console.log('Events array:', transactionResult?.events)
      console.log('=== END ANALYSIS ===')

      // Consider it successful if we have success status OR check-in event OR gas was used (indicating execution)
      const isSuccess = hasSuccessStatus || isCheckInEvent || (hasGasUsed && hasNoErrors)

      if (!isSuccess) {
        // Provide more detailed error information
        const errorMsg = transactionResult?.effects?.status?.error ||
                        transactionResult?.effects?.error ||
                        result?.error ||
                        'Transaction failed - no success confirmation received'
        console.error('Check-in analysis failed:', {
          hasSuccessStatus,
          hasSuccessResult,
          hasNoErrors,
          hasEvents,
          isCheckInEvent,
          errorMsg
        })
        throw new Error(`Check-in transaction completed but success detection failed: ${errorMsg}`)
      }

      console.log('Waiting for blockchain to finalize check-in transaction...')
      await waitForTransactionConfirmation(qrData.eventId, user.walletAddress)

      console.log('Refreshing event data after check-in...')
      await fetchEvents(true)

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

        const checkInKey = `checkin_${qrData.eventId}_${user.walletAddress}`
        sessionStorage.setItem(checkInKey, 'true')
        console.log('Set session storage for check-in:', checkInKey)
      }

      setResult('success')
      toast.success('✅ Successfully checked in!')

      console.log('Redirecting to event page after successful check-in...')
      router.push(`/event/${qrData.eventId}`)

    } catch (error: any) {
      console.error('Check-in failed:', error)
      console.error('Full error details:', JSON.stringify(error, null, 2))
      setResult('error')

      let errorMsg = 'Failed to check in and claim POAP'

      if (error.message.includes('Invalid QR code')) {
        errorMsg = 'Invalid QR code. Please scan a valid SuiLens event check-in QR code.'
      } else if (error.message.includes('expired')) {
        errorMsg = 'QR code has expired. Please ask the event organizer for a new one.'
      } else if (error.message.includes('wallet')) {
        errorMsg = 'Please connect your wallet first.'
      } else if (error.message.includes('Sponsorship failed')) {
        errorMsg = 'Transaction sponsorship is currently unavailable. Please try again in a few minutes.'
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
      } else if (error.message.includes('success detection failed')) {
        // This is our new error type - transaction might have succeeded
        errorMsg = 'Check-in may have succeeded. Please wait a moment and try again, or check your attendance status on the event page.'
        console.log('Transaction success detection failed but transaction may have succeeded')
      } else if (error.message.includes('dry_run_failed')) {
        // This happens when the transaction fails during simulation (dry run)
        // Check if user is already checked in
        if (error.details?.includes('16') || error.message.includes('already checked')) {
          errorMsg = 'You have already checked in to this event.'
        } else {
          errorMsg = 'Check-in validation failed. Please ensure you are registered for this event and try again.'
        }
      } else {
        errorMsg = error.message || 'Failed to check in and claim POAP'
      }

      setErrorMessage(errorMsg)
      toast.error(errorMsg)
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
            <p className="text-gray-600">This QR code is not a valid SuiLens check-in code.</p>
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
              alt="Suilens Logo"
              width={40}
              height={40}
              className="object-contain"
            />
            <span className="text-2xl font-bold text-[#020B15]">Suilens</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 py-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Smartphone className="h-5 w-5" />
              Event Check-in Confirmation
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-gray-600 mb-4">
                Ready to check in to this event and claim your POAP?
              </p>

              {userLoading ? (
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                  <p className="text-gray-600">Loading user information...</p>
                </div>
              ) : !user?.walletAddress ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Sign in with Google to check in and claim your POAP.
                  </p>
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
                  <div className="space-y-3">
                    <Button
                      onClick={handleCheckIn}
                      className="w-full bg-[#4DA2FF] hover:bg-blue-500"
                    >
                      Try Again
                    </Button>
                    <Button
                      onClick={() => router.push(`/event/${qrData.eventId}`)}
                      variant="outline"
                      className="w-full"
                    >
                      Go to Event Page
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={handleCheckIn}
                  disabled={!user?.walletAddress}
                  className="w-full bg-[#4DA2FF] hover:bg-blue-500 disabled:opacity-50"
                >
                  Check In
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
