'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useUser } from '@/context/UserContext'
import { useEventContext } from '@/context/EventContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar, 
  MapPin, 
  Users, 
  Clock, 
  Ticket,
  Share2,
  Heart,
  ArrowLeft,
  Loader2,
  CheckCircle,
  Award,
  QrCode,
  DollarSign,
  Camera,
  Download,
  XCircle
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

import { useSponsoredTransaction } from '@/hooks/useSponsoredTransaction'
import { suilensService, suiClient } from '@/lib/sui-client'
import { geocodeLocation, getOpenStreetMapEmbedUrl } from '@/lib/openstreetmap'
import { toast } from 'sonner'
import Header from '@/components/Header'
import QRScanner from '@/components/QRScanner'
import { generateEventQRCode, downloadQRCode } from '@/utils/qrCodeUtils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SlBadge } from "react-icons/sl";
import { RiNftLine } from "react-icons/ri";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export default function EventDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const eventId = params?.id as string
  const { user } = useUser()
  const { getEvent, updateEvent, fetchEvents } = useEventContext()

  const { sponsorAndExecute } = useSponsoredTransaction()

  // Helper function to format date with month name
  const formatEventDate = (date: string | number) => {
    try {
      // Handle different date formats
      let dateObj: Date
      if (typeof date === 'string') {
        // Try parsing the string date
        dateObj = new Date(date)
      } else {
        // Handle timestamp
        dateObj = new Date(date)
      }
      
      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        return date.toString() // Return original if invalid
      }

      return dateObj.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric', 
        year: 'numeric'
      })
    } catch (error) {
      console.error('Error formatting date:', error)
      return date.toString()
    }
  }
  
  const [event, setEvent] = useState<any>(null)
  const [registering, setRegistering] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showScanner, setShowScanner] = useState(false)
  const [eventQRCode, setEventQRCode] = useState<string | null>(null)
  const [generatingQR, setGeneratingQR] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimedNFT, setClaimedNFT] = useState(false)
  const [claimingPOAP, setClaimingPOAP] = useState(false)
  const [claimedPOAP, setClaimedPOAP] = useState(false)
  const [error, setError] = useState('')
  const [checkingClaims, setCheckingClaims] = useState(true)
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null)
  const [registrationData, setRegistrationData] = useState({
    name: '',
    email: '',
  })

  useEffect(() => {
    const loadEvent = async () => {
      setLoading(true)

      // First try to get from context
      let eventData = getEvent(eventId)

      // Only fetch from blockchain if not in context
      if (!eventData) {
        console.log('Event not in context, fetching from blockchain:', eventId)
        await fetchEvents()
        eventData = getEvent(eventId)
      }

      if (eventData) {
        // Check if we have a local attendance state that might not be on chain yet
        const currentEvent = event
        const checkInKey = user?.walletAddress ? `checkin_${eventId}_${user.walletAddress}_${Date.now()}` : null
        const hasSessionCheckIn = checkInKey ? sessionStorage.getItem(checkInKey) === 'true' : false

        if ((currentEvent?.attendance?.includes(user?.walletAddress) || hasSessionCheckIn) &&
            user?.walletAddress &&
            !eventData.attendance?.includes(user.walletAddress)) {
          console.log('Preserving check-in state from previous load or session')
          eventData.attendance = [...(eventData.attendance || []), user.walletAddress]
        }

        console.log('Event data loaded:', {
          id: eventData.id,
          title: eventData.title,
          totalRsvps: eventData.rsvps?.length,
          totalAttendance: eventData.attendance?.length,
          attendanceList: eventData.attendance,
          userWallet: user?.walletAddress,
          isUserRegistered: user?.walletAddress && eventData.rsvps?.includes(user.walletAddress),
          hasUserAttended: user?.walletAddress && eventData.attendance?.includes(user.walletAddress),
          hasSessionCheckIn
        })
      }

      setEvent(eventData)

      // Geocode the event location for precise map pinpointing
      if (eventData?.location) {
        geocodeLocation(eventData.location).then((coords) => {
          if (coords) {
            setCoordinates(coords)
            console.log('Geocoded location:', eventData.location, 'to coordinates:', coords)
          } else {
            console.warn('Failed to geocode location:', eventData.location)
          }
        }).catch((error) => {
          console.error('Error geocoding location:', error)
        })
      }

      setLoading(false)
    }

    loadEvent()
  }, [eventId, getEvent, fetchEvents])

  // Removed auto check-in logic to use manual confirmation flow
  // useEffect(() => {
  //   const urlParams = new URLSearchParams(window.location.search)
  //   const shouldCheckIn = urlParams.get('checkin') === 'true'

  //   if (shouldCheckIn && user?.walletAddress && event && !loading) {
  //     const isRegistered = event.rsvps?.includes(user.walletAddress)
  //     const hasAttended = event.attendance?.includes(user.walletAddress)
  //     const checkInKey = `checkin_${eventId}_${user.walletAddress}_${Date.now()}`
  //     const hasSessionCheckIn = sessionStorage.getItem(checkInKey) === 'true'

  //     // Check if event has started and ended using timestamps
  //     const now = Date.now()
  //     const eventStartTime = event?.startTimestamp || 0
  //     const eventEndTime = event?.endTimestamp || (eventStartTime ? eventStartTime + (24 * 60 * 60 * 1000) : 0) // Default to 24 hours after start
  //     const hasEventStarted = eventStartTime && now >= eventStartTime
  //     const hasEventEnded = eventEndTime && now > eventEndTime
  //     const canCheckInNow = hasEventStarted && !hasEventEnded

  //     // Only proceed if user is registered and hasn't checked in yet
  //     if (isRegistered && !hasAttended && !hasSessionCheckIn && canCheckInNow) {
  //       console.log('Auto check-in triggered from URL parameter')

  //       // Clean up URL parameter
  //       const newUrl = window.location.pathname
  //       window.history.replaceState({}, '', newUrl)

  //       // Trigger check-in
  //       handleCheckInSuccess(eventId)
  //     } else if (hasAttended || hasSessionCheckIn) {
  //       console.log('User already checked in, cleaning up URL parameter')
  //       // Clean up URL parameter if already checked in
  //       const newUrl = window.location.pathname
  //       window.history.replaceState({}, '', newUrl)
  //     }
  //   }
  // }, [user?.walletAddress, event, loading, eventId])

  // Check if user has already claimed NFTs
  useEffect(() => {
    const checkClaimStatus = async () => {
      if (!user?.walletAddress) {
        setCheckingClaims(false)
        return
      }

      try {
        // Check for Event NFTs
        const eventNFTs = await suilensService.getUserEventNFTs(user.walletAddress)
        const hasEventNFT = eventNFTs.data?.some((nft: any) => {
          const content = nft.data?.content
          return content?.fields?.event_id === eventId
        })
        setClaimedNFT(hasEventNFT || false)

        // Check for POAPs
        const userPOAPs = await suilensService.getUserPOAPs(user.walletAddress)
        const hasEventPOAP = userPOAPs.data?.some((poap: any) => {
          const content = poap.data?.content
          return content?.fields?.event_id === eventId
        })
        setClaimedPOAP(hasEventPOAP || false)
      } catch (error) {
        console.error('Error checking claim status:', error)
      } finally {
        setCheckingClaims(false)
      }
    }

    if (user?.walletAddress && eventId) {
      checkClaimStatus()
    } else {
      setCheckingClaims(false)
    }
  }, [user?.walletAddress, eventId])

  // Remove constant debug logging to reduce noise
  
  const isRegistered = event?.rsvps?.includes(user?.walletAddress)

  // Check both event attendance and session storage for check-in status
  const checkInKey = user?.walletAddress ? `checkin_${eventId}_${user.walletAddress}` : null
  const hasSessionCheckIn = checkInKey ? sessionStorage.getItem(checkInKey) === 'true' : false
  const hasAttended = event?.attendance?.includes(user?.walletAddress) || hasSessionCheckIn

  const isFull = event?.capacity && event?.rsvps?.length >= parseInt(event.capacity)
  const isEventCreator = event?.creator === user?.walletAddress

  // Check approval status for approval-required events
  const isApproved = event?.approved_attendees?.includes(user?.walletAddress)
  const isPendingApproval = event?.pending_approvals?.includes(user?.walletAddress)
  
  // Check if event has started and ended using timestamps
  const now = Date.now()
  const eventStartTime = event?.startTimestamp || 0
  const eventEndTime = event?.endTimestamp || (eventStartTime ? eventStartTime + (24 * 60 * 60 * 1000) : 0) // Default to 24 hours after start
  const hasEventStarted = eventStartTime && now >= eventStartTime
  const hasEventEnded = eventEndTime && now > eventEndTime
  const canCheckIn = hasEventStarted && !hasEventEnded

  const handleClaimNFT = async () => {
    if (!user?.walletAddress) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!isRegistered) {
      toast.error('You must be registered for this event to claim the NFT')
      return
    }

    setClaiming(true)
    setError('')

    try {
      // Create the mint NFT transaction (uses event's stored metadata including nftImageUrl)
      const tx = await suilensService.mintEventNFT(eventId)

      // Execute the transaction using sponsored transaction (gas-free)
      console.log('Attempting sponsored NFT claim...')
      const result = await sponsorAndExecute({
        tx,
        network: process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet',
        skipOnlyTransactionKind: true
      })
      console.log('NFT claim result with sponsorship:', result)

      // Check if transaction was successful
      const isSuccess = result?.effects?.status?.status === 'success' ||
                       (result && !result.error);

      if (isSuccess) {
        setClaimedNFT(true)
        toast.success('🎉 Event NFT claimed successfully!')

        // Redirect to user's profile after a delay
        setTimeout(() => {
          router.push('/profile?refresh=true')
        }, 3000)
      } else {
        throw new Error('Transaction failed')
      }
    } catch (error: any) {
      console.error('Error claiming NFT:', error)
      setError(error.message || 'Failed to claim NFT')
      toast.error('Failed to claim NFT. Please try again.')
    } finally {
      setClaiming(false)
    }
  }

  const handleClaimPOAP = async () => {
    if (!user?.walletAddress) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!hasAttended) {
      toast.error('You must check in at the event to claim the POAP')
      return
    }

    setClaimingPOAP(true)
    setError('')

    try {
      // Create the mint POAP transaction
      const tx = await suilensService.mintPOAP(eventId)

      // Execute the transaction using sponsored transaction (gas-free)
      console.log('Attempting sponsored POAP claim...')
      const packageId = process.env.NEXT_PUBLIC_PACKAGE_ID || ''
      const result = await sponsorAndExecute({
        tx,
        network: process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet',
        allowedMoveCallTargets: [`${packageId}::suilens_core::mint_event_poap`],
        allowedAddresses: [user?.walletAddress],
        skipOnlyTransactionKind: true
      })
      console.log('POAP claim result with sponsorship:', result)

      // Check if transaction was successful
      const isSuccess = result?.effects?.status?.status === 'success' ||
                       (result && !result.error);

      if (isSuccess) {
        setClaimedPOAP(true)
        toast.success('🎉 POAP Badge claimed successfully!')

        // Redirect to user's profile after a delay
        setTimeout(() => {
          router.push('/profile?refresh=true')
        }, 3000)
      } else {
        throw new Error('Transaction failed')
      }
    } catch (error: any) {
      console.error('Error claiming POAP:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        data: error.data,
        stack: error.stack
      })

      // More specific error messages
      let errorMessage = 'Failed to claim POAP. Please try again.'
      if (error.message?.includes('sponsored') || error.message?.includes('not available')) {
        errorMessage = 'Sponsored transaction not available.'
      } else if (error.message?.includes('Move call target')) {
        errorMessage = 'POAP claim function not configured for sponsorship. .'
      }

      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setClaimingPOAP(false)
    }
  }

  const handleRegister = async () => {
    if (!user?.walletAddress) {
      toast.error('Please connect your wallet first')
      router.push('/auth/signin')
      return
    }

    // Check if already registered
    if (isRegistered) {
      toast.info('You are already registered for this event')
      return
    }

    // Validate registration data
    if (!registrationData.name.trim()) {
      toast.error('Please enter your full name')
      return
    }

    if (!registrationData.email.trim()) {
      toast.error('Please enter your email address')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(registrationData.email.trim())) {
      toast.error('Please enter a valid email address')
      return
    }

    setRegistering(true)

    try {
      // Skip profile creation and directly proceed with event registration
      console.log('Skipping profile creation, proceeding directly to event registration...');

      // Get the ticket price (convert to MIST - 1 SUI = 1e9 MIST)
      const ticketPriceInMist = event.isFree ? 0 : parseInt(event.ticketPrice || '0') * 1e9;

      // Determine if we should use sponsored transaction
      // For free events: use sponsored transactions (gas-free)
      // For paid events: use non-sponsored transactions (allows proper payment collection)
      const useSponsoredTransaction = event.isFree;

      console.log(`Event type: ${event.isFree ? 'Free' : 'Paid'}, Using ${useSponsoredTransaction ? 'sponsored' : 'non-sponsored'} transaction`);

      // Create the registration transaction
      const tx = await suilensService.registerForEvent(eventId, ticketPriceInMist, useSponsoredTransaction);

      if (useSponsoredTransaction) {
        // Execute with sponsored transaction (free events)
        console.log('Attempting sponsored registration...')
        const result = await sponsorAndExecute({
          tx,
          network: process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet',
          skipOnlyTransactionKind: true
        })
        console.log('Registration result with sponsorship:', result)

        // Check if transaction was successful
        const isSuccess = result?.effects?.status?.status === 'success' ||
                         (result && !result.error);

        if (isSuccess) {
          // Update local state immediately based on approval requirement
          if (event) {
            const updatedRsvps = [...(event.rsvps || []), user.walletAddress]
            let updatedEvent = { ...event, rsvps: updatedRsvps }
            
            if (event.requiresApproval) {
              // Add to pending_approvals for approval-required events
              const updatedPendingApprovals = [...(event.pending_approvals || []), user.walletAddress]
              updatedEvent = { ...updatedEvent, pending_approvals: updatedPendingApprovals }
            } else {
              // Add to approved_attendees for non-approval events
              const updatedApprovedAttendees = [...(event.approved_attendees || []), user.walletAddress]
              updatedEvent = { ...updatedEvent, approved_attendees: updatedApprovedAttendees }
            }
            
            updateEvent(eventId, updatedEvent)
            setEvent(updatedEvent)
          }

          const successMessage = event.requiresApproval 
            ? "You've been added to the waitlist. The organizer will review your registration."
            : "Successfully registered for the event!"
          toast.success(successMessage)
          const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;


          // Save registration to database
          try {
            const registrationResponse = await fetch(`${API_BASE_URL}/api/registrations`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                eventId: eventId,
                email: registrationData.email,
                name: registrationData.name,
                userId: user?.walletAddress,
              }),
            });

            if (!registrationResponse.ok) {
              console.error('Failed to save registration to database');
            } else {
              console.log('Registration saved to database successfully');
            }
          } catch (registrationError) {
            console.error('Error saving registration to database:', registrationError);
          }

          // Refresh event data from blockchain after transaction confirms
          setTimeout(async () => {
            await refreshEventData()
          }, 3000) // Wait 3 seconds for blockchain to update
        } else {
          throw new Error('Transaction failed')
        }
      } else {
        // Execute with non-sponsored transaction (paid events)
        console.log('Attempting non-sponsored registration with payment...')
        const result = await signAndExecuteTransaction(tx)
        console.log('Registration result with payment:', result)

        // Check if transaction was successful
        const isSuccess = result?.effects?.status?.status === 'success' ||
                         (result && !result.errors);

        if (isSuccess) {
          // Update local state immediately based on approval requirement
          if (event) {
            const updatedRsvps = [...(event.rsvps || []), user.walletAddress]
            let updatedEvent = { ...event, rsvps: updatedRsvps }
            
            if (event.requiresApproval) {
              // Add to pending_approvals for approval-required events
              const updatedPendingApprovals = [...(event.pending_approvals || []), user.walletAddress]
              updatedEvent = { ...updatedEvent, pending_approvals: updatedPendingApprovals }
            } else {
              // Add to approved_attendees for non-approval events
              const updatedApprovedAttendees = [...(event.approved_attendees || []), user.walletAddress]
              updatedEvent = { ...updatedEvent, approved_attendees: updatedApprovedAttendees }
            }
            
            updateEvent(eventId, updatedEvent)
            setEvent(updatedEvent)
          }

          const successMessage = event.requiresApproval 
            ? `Payment of ${event.ticketPrice} SUI processed. You've been added to the waitlist for organizer approval.`
            : `Successfully registered for the event! Payment of ${event.ticketPrice} SUI processed.`
          toast.success(successMessage)

          // Refresh event data from blockchain after transaction confirms
          setTimeout(async () => {
            await refreshEventData()
          }, 3000) // Wait 3 seconds for blockchain to update
        } else {
          throw new Error('Transaction failed')
        }
      }
    } catch (error: any) {
      console.error('Error registering for event:', error)
      toast.error(error.message || 'Failed to register for event')
    } finally {
      setRegistering(false)
    }
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: event?.title,
        text: event?.description,
        url: window.location.href,
      })
    } else {
      navigator.clipboard.writeText(window.location.href)
      toast.success('Event link copied to clipboard!')
    }
  }

  const handleGenerateQRCode = async () => {
    setGeneratingQR(true)
    try {
      const qrCode = await generateEventQRCode(eventId)
      setEventQRCode(qrCode)
      toast.success('QR code generated successfully!')
    } catch (error) {
      console.error('Error generating QR code:', error)
      toast.error('Failed to generate QR code')
    } finally {
      setGeneratingQR(false)
    }
  }

  const handleDownloadQRCode = async () => {
    try {
      await downloadQRCode(eventId, event.title)
      toast.success('QR code downloaded!')
    } catch (error) {
      console.error('Error downloading QR code:', error)
      toast.error('Failed to download QR code')
    }
  }

  const refreshEventData = async () => {
    setRefreshing(true)
    try {
      await fetchEvents()
      const updatedEvent = getEvent(eventId)
      if (updatedEvent && user?.walletAddress) {
        // Preserve local attendance state if blockchain hasn't caught up
        // This prevents the "disappearing check-in" issue
        const userAddress = user.walletAddress
        if (event?.attendance?.includes(userAddress) && 
            !updatedEvent.attendance?.includes(userAddress)) {
          console.log('Preserving local check-in state while blockchain updates')
          updatedEvent.attendance = [...(updatedEvent.attendance || []), userAddress]
        }
        setEvent(updatedEvent)
        // Only show toast if not preserving local state
        if (!event?.attendance?.includes(userAddress) || 
            updatedEvent.attendance?.includes(userAddress)) {
          toast.success('Event data refreshed')
        }
      } else if (updatedEvent) {
        // No user logged in, just update the event
        setEvent(updatedEvent)
        toast.success('Event data refreshed')
      }
    } finally {
      setRefreshing(false)
    }
  }

  const handleCheckInSuccess = async (scannedEventId: string) => {
    if (scannedEventId === eventId && user?.walletAddress) {
      // Update local state to reflect attendance immediately
      const updatedAttendance = [...(event.attendance || []), user.walletAddress]
      
      // Store check-in state in session storage as backup
      const checkInKey = `checkin_${eventId}_${user.walletAddress}`
      sessionStorage.setItem(checkInKey, 'true')
      
      // Update both the local state and context to ensure persistence
      const updatedEvent = { ...event, attendance: updatedAttendance }
      setEvent(updatedEvent)
      updateEvent(eventId, { attendance: updatedAttendance })
      
      toast.success('✅ You have been checked in!')
      
      // Don't immediately refresh - let the local update persist
      // Only refresh after a longer delay to confirm blockchain state
      setTimeout(async () => {
        // Only refresh if still on the same event page
        if (eventId === scannedEventId) {
          await refreshEventData()
        }
      }, 5000) // Wait 5 seconds for blockchain to fully update
    }
    setShowScanner(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-12 text-center">
              <h2 className="text-xl font-semibold mb-2">Event Not Found</h2>
              <p className="text-gray-600 mb-4">The event you're looking for doesn't exist.</p>
              <Link href="/discover">
                <Button>Browse Events</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      {/* Back Button */}
      <div className="px-4 sm:px-6 pt-4">
        <Link href="/discover">
          <Button variant="secondary" size="sm" className="bg-white/90 hover:bg-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      {/* Event Content */}
      <div>
        {/* Full Width Header Banner */}
        <div className="w-full">
          <div className="w-full h-48 sm:h-64 md:h-72 lg:h-80 xl:h-[400px] 2xl:h-[450px] overflow-hidden">
            <Image
              src={event.bannerUrl}
              alt={event.title}
              width={1920}
              height={600}
              className="w-full h-full object-cover object-center"
            />
          </div>
        </div>

        {/* Event Details */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <h1 className='pb-4 sm:pb-6 text-[#101928] font-semibold text-3xl sm:text-4xl md:text-5xl'>{event.title}</h1>
          {/* Event Info Grid */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 mb-6 sm:mb-8 py-4 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center text-gray-700 space-y-2 sm:space-y-0">
              <div className='flex flex-col sm:flex-row gap-2 text-[#667185] font-normal text-base sm:text-lg'>
                <div className="flex items-center gap-2">
                  <p>{formatEventDate(event.date)}</p>
                  <span className="hidden sm:inline">|</span>
                </div>
                <div className="flex items-center gap-2">
                  <p>{event.time}</p>
                  <span className="hidden sm:inline">|</span>
                </div>
                <p className='flex items-center gap-1'> 
                  <MapPin className='w-4 h-4'/> 
                  <span className="truncate">{event.location}</span>
                </p>
              </div>
            </div>
            
            <div className="flex items-center text-gray-700">
              <Users className="w-5 h-5 mr-3 text-blue-600" />
              <p className="text-sm sm:text-base">
                {event.rsvps?.length || 0} registered
                {event.capacity && ` / ${event.capacity} spots`}
              </p>
            </div>
          </div>

          {/* About This Event */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-[#101928]">About this event</h2>
            <p className="text-gray-600 whitespace-pre-wrap leading-relaxed text-sm sm:text-base">{event.description}</p>
          </div>

          {/* Location */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Location</h2>
            <div className="flex items-center text-gray-700 mb-3 sm:mb-4">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 text-blue-600 flex-shrink-0" />
              <p className="text-sm sm:text-base">{event.location}</p>
            </div>
            {/* OpenStreetMap embed with pinpoint */}
            <div className="w-full h-40 sm:h-48 rounded-lg overflow-hidden">
              <iframe
                src={getOpenStreetMapEmbedUrl(event.location, coordinates?.lat, coordinates?.lng)}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                title="Event Location Map"
              ></iframe>
            </div>
          </div>

          {/* Registration Section */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold mb-3 sm:mb-4 text-[#101928]">Registration</h2>
            <div className="py-4 sm:py-6">
              {isRegistered ? (
                /* Registration Success Message */
                <div className={`border-l-4 ${event?.requiresApproval && isPendingApproval ? 'border-amber-500 bg-amber-50' : 'border-green-500 bg-green-50'} p-3 sm:p-4 rounded-lg`}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start sm:items-center">
                      <CheckCircle className={`w-4 h-4 sm:w-5 sm:h-5 ${event?.requiresApproval && isPendingApproval ? 'text-amber-600' : 'text-green-600'} mr-2 sm:mr-3 flex-shrink-0 mt-0.5 sm:mt-0`} />
                      <div>
                        <h3 className={`font-semibold text-sm sm:text-base ${event?.requiresApproval && isPendingApproval ? 'text-amber-800' : 'text-green-800'}`}>
                          {event?.requiresApproval && isPendingApproval ? 'Registration Pending Approval' : "You're registered"}
                        </h3>
                        <p className={`text-xs sm:text-sm mt-1 ${event?.requiresApproval && isPendingApproval ? 'text-amber-700' : 'text-green-700'}`}>
                          {event?.requiresApproval && isPendingApproval
                            ? `Your registration for ${event.title} is pending approval from the organizer. You'll be notified once approved.`
                            : `You've secured your spot for ${event.title}. See you on ${formatEventDate(event.date)} at ${event.time}, ${event.location}.`
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Registration Form */
                <form onSubmit={(e) => { e.preventDefault(); handleRegister(); }}>
                  <div className="flex flex-col gap-3 sm:gap-4">
                    <Label className="text-sm sm:text-base">
                      Full Name *
                      <Input
                        placeholder="Your Name"
                        className="my-2 sm:my-4 text-sm sm:text-base"
                        value={registrationData.name}
                        onChange={(e) => setRegistrationData({ ...registrationData, name: e.target.value })}
                        required
                      />
                    </Label>

                    <Label className="text-sm sm:text-base">
                      Email Address *
                      <Input
                        type="email"
                        placeholder="Your Email"
                        className="my-2 sm:my-4 text-sm sm:text-base"
                        value={registrationData.email}
                        onChange={(e) => setRegistrationData({ ...registrationData, email: e.target.value })}
                        required
                      />
                    </Label>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#101928] rounded-3xl py-2 sm:py-3 text-sm sm:text-base"
                    disabled={registering || isFull || isEventCreator}
                  >
                    {registering ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Registering...
                      </>
                    ) : isFull ? (
                      'Event Full'
                    ) : isEventCreator ? (
                      'Cannot Register (Event Creator)'
                    ) : (
                      'Register'
                    )}
                  </Button>
                </form>
              )}
              
              {/* Show Attended Status */}
              {hasAttended && (
                <div className="mt-3 sm:mt-4 text-center">
                  <Button 
                    variant="outline" 
                    disabled
                    className="bg-green-50 px-6 sm:px-8 py-2 rounded-full text-sm sm:text-base"
                  >
                    <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                    Checked In
                  </Button>
                </div>
              )}

              {event.requiresApproval && !isRegistered && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3">
                  <p className="text-xs sm:text-sm text-amber-700 text-center">
                    <Clock className="w-4 h-4 inline mr-1" />
                    This event requires approval from the organizer before you can claim NFTs
                  </p>
                </div>
              )}
            </div>
          </div>
          {/* NFT Rewards Section */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold mb-3 sm:mb-4 text-[#101928]">NFT Rewards</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {event.nftImageUrl && (
                <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-3 sm:p-4 relative">
                  <RiNftLine className='w-5 h-5 sm:w-6 sm:h-6 text-[#101928] absolute top-3 sm:top-4 right-3 sm:right-4'/>
                  <div className="pr-6 sm:pr-8">
                    <h3 className="font-semibold text-lg sm:text-xl text-[#101928] mb-1">Event NFT</h3>
                    <p className="text-xs sm:text-sm font-normal text-gray-600 mb-2">
                      Claim your commemorative NFT after registering
                    </p>
                    <img 
                      src={event.nftImageUrl} 
                      alt="Event NFT"
                      className="w-full h-28 sm:h-32 rounded-lg object-cover mt-2"
                    />
                    <h2 className='font-semibold text-xs sm:text-sm my-3 sm:my-4'>Requirements</h2>
                    <ul className="list-disc list-inside text-[#667185] text-xs sm:text-sm space-y-1">
                      <li>Must have registered for the event</li>
                      {event?.requiresApproval && (
                        <li className="text-amber-600 font-medium">Must be approved by event admin</li>
                      )}
                      <li>One NFT per attendee</li>
                    </ul>
                  </div>
                  <Button
                    className='mt-4 sm:mt-5 w-full text-xs sm:text-sm py-2 sm:py-3'
                    disabled={!isRegistered || claiming || claimedNFT || checkingClaims || (event?.requiresApproval && !isApproved)}
                    variant={!isRegistered || claimedNFT || (event?.requiresApproval && !isApproved) ? "outline" : "default"}
                    onClick={handleClaimNFT}
                  >
                    {!user?.walletAddress ? (
                      'Connect Wallet to Claim'
                    ) : !isRegistered ? (
                      <>
                        <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Register to Claim NFT
                      </>
                    ) : claimedNFT ? (
                      <>
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        NFT Claimed!
                      </>
                    ) : checkingClaims ? (
                      <>
                        <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                        Checking Status...
                      </>
                    ) : (event?.requiresApproval && !isApproved) ? (
                      <>
                        <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Waiting for Approval
                      </>
                    ) : claiming ? (
                      <>
                        <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                        Claiming NFT...
                      </>
                    ) : (
                      <>
                        <Ticket className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Claim NFT
                      </>
                    )}
                  </Button>
                </div>
              )}
              
              {event.poapImageUrl && (
                <div className="border border-purple-200 bg-purple-50/50 rounded-lg p-3 sm:p-4 relative">
                  
                  <SlBadge className='w-5 h-5 sm:w-6 sm:h-6 text-[#101928] absolute top-3 sm:top-4 right-3 sm:right-4'/>
                  <div className="pr-6 sm:pr-8">
                    <h3 className="font-semibold text-lg sm:text-xl mb-1">POAP Badge</h3>
                    <p className="text-xs sm:text-sm text-gray-600 mb-2">
                      Exclusive badge for attendees who check in
                    </p>
                    <img 
                      src={event.poapImageUrl} 
                      alt="POAP Badge"
                      className="w-full h-28 sm:h-32 rounded-lg object-cover mt-2"
                    />
                    <h2 className='font-semibold text-xs sm:text-sm my-3 sm:my-4'>Requirements</h2>
                    <ul className="list-disc list-inside text-[#667185] text-xs sm:text-sm space-y-1">
                      <li>Must have checked in at the event</li>
                      <li>Available after check in at Event</li>
                    </ul>
                  </div>
                  <Button
                    className='mt-4 sm:mt-5 w-full text-xs sm:text-sm py-2 sm:py-3'
                    disabled={!hasAttended || claimingPOAP || claimedPOAP}
                    variant={!hasAttended || claimedPOAP ? "outline" : "default"}
                    onClick={handleClaimPOAP}
                  >
                    {!user?.walletAddress ? (
                      'Connect Wallet to Claim'
                    ) : !hasAttended ? (
                      <>
                        <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Check-in to Claim POAP
                      </>
                    ) : claimedPOAP ? (
                      <>
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        POAP Claimed!
                      </>
                    ) : claimingPOAP ? (
                      <>
                        <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                        Claiming POAP...
                      </>
                    ) : (
                      <>
                        <Award className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Claim POAP Badge
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Event Creator QR Code Management */}
          {isEventCreator && (
            <div className="mb-6 sm:mb-8">
              <h3 className="text-base sm:text-lg font-semibold mb-3">🎫 Event Check-in QR Code</h3>
              <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                  Generate and download a QR code for attendees to check in at your event.
                  Display this QR code at the venue for attendees to scan.
                </p>
                
                {eventQRCode ? (
                  <div className="space-y-3 sm:space-y-4">
                    <div className="bg-white p-3 sm:p-4 rounded-lg flex justify-center">
                      <img 
                        src={eventQRCode} 
                        alt="Event Check-in QR Code"
                        className="w-36 h-36 sm:w-48 sm:h-48"
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button 
                        onClick={handleDownloadQRCode}
                        className="flex-1 text-xs sm:text-sm py-2 sm:py-3"
                      >
                        <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Download QR Code
                      </Button>
                      <Button 
                        onClick={handleGenerateQRCode}
                        variant="outline"
                        disabled={generatingQR}
                        className="text-xs sm:text-sm py-2 sm:py-3"
                      >
                        {generatingQR ? (
                          <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                        ) : (
                          'Regenerate'
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button 
                    onClick={handleGenerateQRCode}
                    disabled={generatingQR}
                    className="w-full text-xs sm:text-sm py-2 sm:py-3"
                  >
                    {generatingQR ? (
                      <>
                        <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                        Generating QR Code...
                      </>
                    ) : (
                      <>
                        <QrCode className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        Generate Check-in QR Code
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
      
      {/* QR Scanner Modal */}
      <QRScanner 
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onSuccess={handleCheckInSuccess}
      />
    </div>
  )
}