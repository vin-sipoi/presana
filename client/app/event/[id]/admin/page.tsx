'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useUser } from '@/context/UserContext'
import { useEventContext } from '@/context/EventContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Users,
  DollarSign,
  QrCode,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Calendar,
  MapPin,
  Ticket,
  Award,
  Settings,
  Loader2,
  Copy,
  UserCheck,
  RefreshCw,
  Wallet,
  Plus,
  Image,
  Mail,
  Send,
  BarChart3,
  X
} from 'lucide-react'
import Link from 'next/link'
import { useSponsoredTransaction } from '@/hooks/useSponsoredTransaction'
import { suilensService } from '@/lib/sui-client'
import { toast } from 'sonner'
import Header from '@/components/Header'
import { generateEventQRCode, downloadQRCode } from '@/utils/qrCodeUtils'
import { formatAddress } from '@/lib/utils'
import Sidebar from '@/components/Sidebar'

interface AttendeeData {
  address: string
  registeredAt?: string
  checkedIn: boolean
  checkedInAt?: string
  approvalStatus?: 'pending' | 'approved' | 'rejected'
}

export default function EventAdminPage() {
  const router = useRouter()
  const params = useParams()
  const eventId = (params?.id as string) || ''
  const { user } = useUser()
  const { getEvent, updateEvent, fetchEvents } = useEventContext()
  const { sponsorAndExecute } = useSponsoredTransaction()
  
  const [event, setEvent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [eventQRCode, setEventQRCode] = useState<string | null>(null)
  const [generatingQR, setGeneratingQR] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [attendeeList, setAttendeeList] = useState<AttendeeData[]>([])
  const [poapCollection, setPoapCollection] = useState<any>(null)
  const [checkingPoapStatus, setCheckingPoapStatus] = useState(false)
  const [creatingPoap, setCreatingPoap] = useState(false)
  const [approvingAttendees, setApprovingAttendees] = useState<Set<string>>(new Set())
  const [rejectingAttendees, setRejectingAttendees] = useState<Set<string>>(new Set())
  const [poapFormData, setPoapFormData] = useState({
    name: '',
    description: '',
    imageUrl: '',
    maxSupply: ''
  })

  useEffect(() => {
    const loadEvent = async () => {
      setLoading(true)
      let eventData = getEvent(eventId)

      if (!eventData) {
        await fetchEvents()
        eventData = getEvent(eventId)
      }

      if (eventData) {
        setEvent(eventData)

        // Process attendee data with proper check-in status and approval status
        console.log('=== ADMIN PAGE EVENT DATA ===')
        console.log('Event RSVPs:', eventData.rsvps)
        console.log('Event Attendance:', eventData.attendance)
        console.log('Event Pending Approvals:', eventData.pending_approvals)
        console.log('Event Approved Attendees:', eventData.approved_attendees)
        console.log('Event Requires Approval:', eventData.requiresApproval)
        console.log('=== END EVENT DATA ===')

        const attendees: AttendeeData[] = (eventData.rsvps || []).map((address: string) => {
          // Determine approval status based on event approval requirement
          let approvalStatus: 'pending' | 'approved' | 'rejected' = 'approved'
          
          if (eventData.requiresApproval) {
            if (eventData.pending_approvals?.includes(address)) {
              approvalStatus = 'pending'
            } else if (eventData.approved_attendees?.includes(address)) {
              approvalStatus = 'approved'
            } else {
              // If in rsvps but not in pending or approved, assume pending for new registrations
              approvalStatus = 'pending'
            }
          }

          return {
            address,
            registeredAt: new Date().toISOString(), // TODO: Get actual registration time from blockchain
            checkedIn: eventData.attendance?.includes(address) || false,
            checkedInAt: eventData.attendance?.includes(address) ? new Date().toISOString() : undefined,
            approvalStatus
          }
        })

        console.log('Processed attendee list:', attendees)
        setAttendeeList(attendees)

        // Set default POAP form data based on event
        setPoapFormData({
          name: `${eventData.title} POAP`,
          description: `Proof of attendance for ${eventData.title}`,
          imageUrl: eventData.poapImageUrl || '',
          maxSupply: ''
        })
      }
      setLoading(false)
    }

    loadEvent()

    // Auto-refresh attendance data every 30 seconds
    const refreshInterval = setInterval(async () => {
      if (eventId) {
        await fetchEvents(true)
        const updatedEvent = getEvent(eventId)
        if (updatedEvent) {
          setEvent(updatedEvent)
          const attendees: AttendeeData[] = (updatedEvent.rsvps || []).map((address: string) => {
            // Determine approval status based on event approval requirement
            let approvalStatus: 'pending' | 'approved' | 'rejected' = 'approved'
            
            if (updatedEvent.requiresApproval) {
              if (updatedEvent.pending_approvals?.includes(address)) {
                approvalStatus = 'pending'
              } else if (updatedEvent.approved_attendees?.includes(address)) {
                approvalStatus = 'approved'
              } else {
                // If in rsvps but not in pending or approved, assume pending for new registrations
                approvalStatus = 'pending'
              }
            }

            return {
              address,
              registeredAt: new Date().toISOString(), // TODO: Get actual registration time from blockchain
              checkedIn: updatedEvent.attendance?.includes(address) || false,
              checkedInAt: updatedEvent.attendance?.includes(address) ? new Date().toISOString() : undefined,
              approvalStatus
            }
          })
          setAttendeeList(attendees)
        }
      }
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(refreshInterval)
  }, [eventId, getEvent, fetchEvents])
  
  // Check if POAP collection exists for this event
  useEffect(() => {
    const checkPoapCollection = async () => {
      if (!eventId) return
      
      setCheckingPoapStatus(true)
      try {
        // For now, we always assume no collection exists initially
        // The collection will only exist after it's been created via createPOAPCollection
        // We store this in localStorage as a temporary solution
        const poapKey = `poap_collection_${eventId}`
        const hasCollection = localStorage.getItem(poapKey) === 'true'
        setPoapCollection(hasCollection ? { exists: true } : null)
      } catch (error) {
        console.error('Error checking POAP collection:', error)
      } finally {
        setCheckingPoapStatus(false)
      }
    }
    
    if (event) {
      checkPoapCollection()
    }
  }, [event, eventId])

  // Check if user is the event creator
  const isEventCreator = event?.creator === user?.walletAddress

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
              <Link href="/dashboard">
                <Button>Back to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!isEventCreator) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="py-12 text-center">
              <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p className="text-gray-600 mb-4">You don't have permission to manage this event.</p>
              <Link href={`/event/${eventId}`}>
                <Button>View Event Page</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
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

  const handleCreatePoapCollection = async () => {
    if (!poapFormData.name || !poapFormData.description || !poapFormData.imageUrl) {
      toast.error('Please fill in all required fields')
      return
    }
    
    setCreatingPoap(true)
    try {
      const tx = await suilensService.createPOAPCollection(eventId, {
        name: poapFormData.name,
        description: poapFormData.description,
        imageUrl: poapFormData.imageUrl,
        maxSupply: poapFormData.maxSupply ? parseInt(poapFormData.maxSupply) : undefined
      })

      const packageId = process.env.NEXT_PUBLIC_PACKAGE_ID || ''
      const result = await sponsorAndExecute({
        tx,
        allowedMoveCallTargets: [`${packageId}::suilens_poap::create_poap_collection`]
      })
      console.log('POAP collection created:', result)
      
      // Mark collection as created in localStorage
      const poapKey = `poap_collection_${eventId}`
      localStorage.setItem(poapKey, 'true')
      
      setPoapCollection({ exists: true })
      toast.success('POAP collection created successfully! Attendees can now claim their POAPs.')
    } catch (error: any) {
      console.error('Error creating POAP collection:', error)
      toast.error(error.message || 'Failed to create POAP collection')
    } finally {
      setCreatingPoap(false)
    }
  }
  
  const handleWithdrawFunds = async () => {
    setWithdrawing(true)
    try {
      const tx = await suilensService.withdrawEventFunds(eventId)
      const packageId = process.env.NEXT_PUBLIC_PACKAGE_ID || ''
      const result = await sponsorAndExecute({
        tx,
        allowedMoveCallTargets: [`${packageId}::suilens_core::withdraw_event_funds`]
      })
      console.log('Funds withdrawn:', result)
      toast.success('Event funds withdrawn successfully!')
    } catch (error: any) {
      console.error('Error withdrawing funds:', error)
      toast.error(error.message || 'Failed to withdraw funds')
    } finally {
      setWithdrawing(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  // Handle approving an attendee registration
  const handleApproveAttendee = async (attendeeAddress: string) => {
    if (!event || !user?.walletAddress) {
      toast.error('Unable to approve attendee')
      return
    }

    // Prevent multiple simultaneous approvals for the same attendee
    if (approvingAttendees.has(attendeeAddress)) {
      return
    }

    try {
      setApprovingAttendees(prev => new Set(prev).add(attendeeAddress))
      console.log('Approving attendee:', attendeeAddress)

      const tx = await suilensService.approveRegistration(eventId, attendeeAddress)
      
      const packageId = process.env.NEXT_PUBLIC_PACKAGE_ID || ''
      const result = await sponsorAndExecute({
        tx: tx,
        network: process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet',
        allowedMoveCallTargets: [`${packageId}::suilens_core::approve_registration`]
      })

      console.log('Approval result:', result)
      console.log('Full approval result structure:', JSON.stringify(result, null, 2))

      // Check for transaction success with improved logic
      const hasSuccessStatus = result?.effects?.status?.status === 'success'
      const hasSuccessResult = result?.status === 'success'
      const hasNoErrors = !result?.effects?.status?.error && !result?.effects?.error
      const hasEvents = result?.events && result.events.length > 0

      // Check if this is actually a successful approval by looking for the RegistrationApproved event
      const isApprovalEvent = result?.events?.some((event: any) => {
        const isCorrectType = event.type?.includes('RegistrationApproved')
        const isCorrectEvent = event.parsedJson?.event_id === eventId
        const isCorrectAttendee = event.parsedJson?.attendee === attendeeAddress
        console.log('Event analysis:', { isCorrectType, isCorrectEvent, isCorrectAttendee, event })
        return isCorrectType && isCorrectEvent && isCorrectAttendee
      })

      // Also check for any successful transaction indicators
      const hasGasUsed = result?.effects?.gasUsed && result.effects.gasUsed.computationCost > 0
      const hasObjectChanges = result?.objectChanges && result.objectChanges.length > 0

      console.log('=== TRANSACTION SUCCESS ANALYSIS ===')
      console.log('hasSuccessStatus:', hasSuccessStatus)
      console.log('hasSuccessResult:', hasSuccessResult)
      console.log('hasNoErrors:', hasNoErrors)
      console.log('hasEvents:', hasEvents)
      console.log('isApprovalEvent:', isApprovalEvent)
      console.log('hasGasUsed:', hasGasUsed)
      console.log('hasObjectChanges:', hasObjectChanges)
      console.log('Events array:', result?.events)
      console.log('Full result structure:', JSON.stringify(result, null, 2))
      console.log('=== END ANALYSIS ===')

      // Consider it successful if we have success status OR approval event OR gas was used (indicating execution)
      const isSuccess = hasSuccessStatus || isApprovalEvent || (hasGasUsed && hasNoErrors)

      if (isSuccess) {
        // Update local state immediately for better UX
        setAttendeeList(prevList =>
          prevList.map(attendee =>
            attendee.address === attendeeAddress
              ? { ...attendee, approvalStatus: 'approved' as const }
              : attendee
          )
        )

        toast.success('Attendee approved successfully!')

        // Refresh event data after a short delay to confirm on blockchain
        setTimeout(async () => {
          await fetchEvents(true)
          const updatedEvent = getEvent(eventId)
          if (updatedEvent) {
            setEvent(updatedEvent)
            console.log('=== POST-APPROVAL EVENT DATA ===')
            console.log('Updated RSVPs:', updatedEvent.rsvps)
            console.log('Updated Approved Attendees:', updatedEvent.approved_attendees)
            console.log('Updated Pending Approvals:', updatedEvent.pending_approvals)
            console.log('=== END POST-APPROVAL DATA ===')

            // Clean up the approving state since transaction is confirmed
            setApprovingAttendees(prev => {
              const newSet = new Set(prev)
              newSet.delete(attendeeAddress)
              return newSet
            })
          }
        }, 2000)
      } else {
        // Provide more detailed error information
        const errorMsg = result?.effects?.status?.error ||
                        result?.effects?.error ||
                        result?.error ||
                        'Transaction failed - no success confirmation received'

        console.error('Transaction analysis failed:', {
          hasSuccessStatus,
          hasSuccessResult,
          hasNoErrors,
          hasEvents,
          isApprovalEvent,
          errorMsg
        })

        // Don't throw error immediately - let the UI handle it gracefully
        console.log('Transaction completed but success detection was inconclusive, will verify with blockchain refresh')
        toast.info('Processing approval... verifying on blockchain')

        // Still refresh to check if it actually succeeded
        setTimeout(async () => {
          await fetchEvents(true)
          const updatedEvent = getEvent(eventId)
          if (updatedEvent) {
            setEvent(updatedEvent)

            // Check if attendee was actually approved despite the error
            const wasApproved = updatedEvent.approved_attendees?.includes(attendeeAddress)
            if (wasApproved) {
              setAttendeeList(prevList =>
                prevList.map(attendee =>
                  attendee.address === attendeeAddress
                    ? { ...attendee, approvalStatus: 'approved' as const }
                    : attendee
                )
              )
              toast.success('Approval confirmed on blockchain!')

              // Clean up the approving state since transaction is confirmed
              setApprovingAttendees(prev => {
                const newSet = new Set(prev)
                newSet.delete(attendeeAddress)
                return newSet
              })
            } else {
              // Clean up the approving state since transaction failed
              setApprovingAttendees(prev => {
                const newSet = new Set(prev)
                newSet.delete(attendeeAddress)
                return newSet
              })
            }
          }
        }, 2000)
      }
    } catch (error: any) {
      console.error('Error approving attendee:', error)
      toast.error(error.message || 'Failed to approve attendee')
    } finally {
      setApprovingAttendees(prev => {
        const newSet = new Set(prev)
        newSet.delete(attendeeAddress)
        return newSet
      })
    }
  }

  // Handle rejecting an attendee registration
  const handleRejectAttendee = async (attendeeAddress: string) => {
    if (!event || !user?.walletAddress) {
      toast.error('Unable to reject attendee')
      return
    }

    // Prevent multiple simultaneous rejections for the same attendee
    if (rejectingAttendees.has(attendeeAddress)) {
      return
    }

    try {
      setRejectingAttendees(prev => new Set(prev).add(attendeeAddress))
      console.log('=== REJECT ATTENDEE DEBUG ===')
      console.log('Event ID:', eventId)
      console.log('Attendee Address:', attendeeAddress)
      console.log('User Wallet Address:', user.walletAddress)
      console.log('Event Creator:', event.creator)
      console.log('Is user event creator?', user.walletAddress === event.creator)
      console.log('Event requires approval?', event.requiresApproval)
      console.log('Pending approvals:', event.pending_approvals)
      console.log('Is attendee in pending approvals?', event.pending_approvals?.includes(attendeeAddress))
      console.log('=== END DEBUG ===')

      // Validate permissions and state before attempting transaction
      if (user.walletAddress !== event.creator) {
        throw new Error('Only the event creator can reject registrations')
      }

      if (!event.requiresApproval) {
        throw new Error('This event does not require approval, so rejections are not applicable')
      }

      if (!event.pending_approvals?.includes(attendeeAddress)) {
        throw new Error('Attendee is not in the pending approvals list')
      }

      const tx = await suilensService.rejectRegistration(eventId, attendeeAddress)

      const packageId = process.env.NEXT_PUBLIC_PACKAGE_ID || ''
      const result = await sponsorAndExecute({
        tx: tx,
        network: process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet',
        allowedMoveCallTargets: [`${packageId}::suilens_core::reject_registration`]
      })

      console.log('Rejection result:', result)
      console.log('Full rejection result structure:', JSON.stringify(result, null, 2))

      // Check for transaction success with improved logic
      const hasSuccessStatus = result?.effects?.status?.status === 'success'
      const hasSuccessResult = result?.status === 'success'
      const hasNoErrors = !result?.effects?.status?.error && !result?.effects?.error
      const hasEvents = result?.events && result.events.length > 0

      // Check if this is actually a successful rejection by looking for the RegistrationRejected event
      const isRejectionEvent = result?.events?.some((event: any) => {
        const isCorrectType = event.type?.includes('RegistrationRejected')
        const isCorrectEvent = event.parsedJson?.event_id === eventId
        const isCorrectAttendee = event.parsedJson?.attendee === attendeeAddress
        console.log('Rejection event analysis:', { isCorrectType, isCorrectEvent, isCorrectAttendee, event })
        return isCorrectType && isCorrectEvent && isCorrectAttendee
      })

      // Also check for any successful transaction indicators
      const hasGasUsed = result?.effects?.gasUsed && result.effects.gasUsed.computationCost > 0
      const hasObjectChanges = result?.objectChanges && result.objectChanges.length > 0

      console.log('=== REJECTION SUCCESS ANALYSIS ===')
      console.log('hasSuccessStatus:', hasSuccessStatus)
      console.log('hasSuccessResult:', hasSuccessResult)
      console.log('hasNoErrors:', hasNoErrors)
      console.log('hasEvents:', hasEvents)
      console.log('isRejectionEvent:', isRejectionEvent)
      console.log('hasGasUsed:', hasGasUsed)
      console.log('hasObjectChanges:', hasObjectChanges)
      console.log('Events array:', result?.events)
      console.log('Full result structure:', JSON.stringify(result, null, 2))
      console.log('=== END ANALYSIS ===')

      // Consider it successful if we have success status OR rejection event OR gas was used (indicating execution)
      const isSuccess = hasSuccessStatus || isRejectionEvent || (hasGasUsed && hasNoErrors)

      if (isSuccess) {
        // Update local state immediately for better UX
        setAttendeeList(prevList =>
          prevList.map(attendee =>
            attendee.address === attendeeAddress
              ? { ...attendee, approvalStatus: 'rejected' as const }
              : attendee
          )
        )

        toast.success('Attendee registration rejected successfully!')

        // Refresh event data after a short delay to confirm on blockchain
        setTimeout(async () => {
          await fetchEvents(true)
          const updatedEvent = getEvent(eventId)
          if (updatedEvent) {
            setEvent(updatedEvent)
            console.log('=== POST-REJECTION EVENT DATA ===')
            console.log('Updated RSVPs:', updatedEvent.rsvps)
            console.log('Updated Approved Attendees:', updatedEvent.approved_attendees)
            console.log('Updated Pending Approvals:', updatedEvent.pending_approvals)
            console.log('=== END POST-REJECTION DATA ===')

            // Clean up the rejecting state since transaction is confirmed
            setRejectingAttendees(prev => {
              const newSet = new Set(prev)
              newSet.delete(attendeeAddress)
              return newSet
            })
          }
        }, 2000)
      } else {
        // Provide more detailed error information
        const errorMsg = result?.effects?.status?.error ||
                        result?.effects?.error ||
                        result?.error ||
                        'Transaction failed - no success confirmation received'

        console.error('Rejection analysis failed:', {
          hasSuccessStatus,
          hasSuccessResult,
          hasNoErrors,
          hasEvents,
          isRejectionEvent,
          errorMsg
        })

        // Don't throw error immediately - let the UI handle it gracefully
        console.log('Rejection completed but success detection was inconclusive, will verify with blockchain refresh')
        toast.info('Processing rejection... verifying on blockchain')

        // Still refresh to check if it actually succeeded
        setTimeout(async () => {
          await fetchEvents(true)
          const updatedEvent = getEvent(eventId)
          if (updatedEvent) {
            setEvent(updatedEvent)

            // Check if attendee was actually rejected despite the error
            const wasRejected = !updatedEvent.pending_approvals?.includes(attendeeAddress) &&
                               !updatedEvent.approved_attendees?.includes(attendeeAddress)

            if (wasRejected) {
              setAttendeeList(prevList =>
                prevList.map(attendee =>
                  attendee.address === attendeeAddress
                    ? { ...attendee, approvalStatus: 'rejected' as const }
                    : attendee
                )
              )
              toast.success('Rejection confirmed on blockchain!')

              // Clean up the rejecting state since transaction is confirmed
              setRejectingAttendees(prev => {
                const newSet = new Set(prev)
                newSet.delete(attendeeAddress)
                return newSet
              })
            } else {
              // Clean up the rejecting state since transaction failed
              setRejectingAttendees(prev => {
                const newSet = new Set(prev)
                newSet.delete(attendeeAddress)
                return newSet
              })
            }
          }
        }, 2000)
      }
    } catch (error: any) {
      console.error('Error rejecting attendee:', error)
      toast.error(error.message || 'Failed to reject attendee')
    } finally {
      setRejectingAttendees(prev => {
        const newSet = new Set(prev)
        newSet.delete(attendeeAddress)
        return newSet
      })
    }
  }

  
  const handleExportCSV = () => {
    if (attendeeList.length === 0) {
      toast.error('No attendees to export')
      return
    }

    // Create CSV headers - include approval status if event requires approval
    const headers = event?.requiresApproval 
      ? ['Wallet Address', 'Registration Date', 'Approval Status', 'Check-in Status', 'Check-in Date']
      : ['Wallet Address', 'Registration Date', 'Check-in Status', 'Check-in Date']

    // Convert attendee data to CSV rows
    const csvRows = attendeeList.map(attendee => {
      const baseRow = [
        attendee.address,
        attendee.registeredAt ? new Date(attendee.registeredAt).toLocaleDateString() : 'N/A',
        attendee.checkedIn ? 'Checked In' : 'Not Checked In',
        attendee.checkedInAt ? new Date(attendee.checkedInAt).toLocaleDateString() : 'N/A'
      ]
      
      return event?.requiresApproval 
        ? [baseRow[0], baseRow[1], attendee.approvalStatus || 'N/A', baseRow[2], baseRow[3]]
        : baseRow
    })

    // Combine headers and rows
    const csvContent = [headers, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `${event.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_attendees.csv`)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
    toast.success('CSV file downloaded successfully!')
  }

  // Email Blast Tab Component
  const EmailBlastTab = () => {
    const [emailSubject, setEmailSubject] = useState('')
    const [emailContent, setEmailContent] = useState('')
    const [sending, setSending] = useState(false)
    const [pushMessage, setPushMessage] = useState('')
    const [sendingPush, setSendingPush] = useState(false)

  const handleSendEmailBlast = async () => {
    if (!emailSubject.trim() || !emailContent.trim()) {
      toast.error('Please fill in both subject and content')
      return
    }

    if (attendeeList.length === 0) {
      toast.error('No registered attendees to send email to')
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/registrations/email-blast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: eventId,
          title: `Blast: ${emailSubject}`,
          subject: emailSubject,
          content: emailContent
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast.success(`Email blast sent to ${result.recipientCount} recipients!`)
        setEmailSubject('')
        setEmailContent('')
      } else {
        toast.error(result.message || 'Failed to send email blast')
      }
    } catch (error) {
      console.error('Error sending email blast:', error)
      toast.error('Failed to send email blast')
    } finally {
      setSending(false)
    }
  }

    // Improved UI feedback: disable send button while sending and show progress
    const isSendDisabled = sending || !emailSubject.trim() || !emailContent.trim()

    const handleSendPushNotification = async () => {
      if (!pushMessage.trim()) {
        toast.error('Please enter a push notification message')
        return
      }

      if (attendeeList.length === 0) {
        toast.error('No registered attendees to send push notifications to')
        return
      }

      setSendingPush(true)
      try {
        const response = await fetch('/api/registrations/push-notification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eventId: eventId,
            message: pushMessage,
            userId: user?.id
          }),
        })

        const result = await response.json()

        if (result.success) {
          toast.success(`Push notification sent to ${result.recipientCount} recipients!`)
          setPushMessage('')
        } else {
          toast.error(result.message || 'Failed to send push notification')
        }
      } catch (error) {
        console.error('Error sending push notification:', error)
        toast.error('Failed to send push notification')
      } finally {
        setSendingPush(false)
      }
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-blue-600" />
            Email Blast
          </CardTitle>
          <CardDescription>
            Send emails to all registered attendees ({attendeeList.length} recipients)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {attendeeList.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No registered attendees yet</p>
              <p className="text-sm text-gray-500 mt-2">
                Email blasts will be available once attendees register for your event
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email-subject">Subject *</Label>
                  <Input
                    id="email-subject"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Enter email subject..."
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="email-content">Content *</Label>
                  <Textarea
                    id="email-content"
                    value={emailContent}
                    onChange={(e) => setEmailContent(e.target.value)}
                    placeholder="Enter your email message..."
                    className="mt-1 min-h-[200px]"
                    rows={8}
                  />
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Email Preview</h4>
                <div className="text-sm text-blue-800">
                  <p><strong>Subject:</strong> {emailSubject || 'Your subject will appear here'}</p>
                  <p className="mt-2"><strong>Recipients:</strong> {attendeeList.length} registered attendees</p>
                </div>
              </div>

              <Button
                onClick={handleSendEmailBlast}
                disabled={sending || !emailSubject.trim() || !emailContent.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending Email Blast...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send to {attendeeList.length} Recipients
                  </>
                )}
              </Button>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Important Notes:</h4>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>Emails will be sent to all registered attendees</li>
                  <li>Make sure your content is clear and professional</li>
                  <li>Include any important event updates or reminders</li>
                  <li>This action cannot be undone</li>
                </ul>
              </div>

              {/* Push Notification Section */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Push Notifications</h3>
                <div>
                  <Label htmlFor="push-message">Message *</Label>
                  <Textarea
                    id="push-message"
                    value={pushMessage}
                    onChange={(e) => setPushMessage(e.target.value)}
                    placeholder="Enter push notification message..."
                    className="mt-1 min-h-[100px]"
                    rows={4}
                  />
                </div>
                <Button
                  onClick={handleSendPushNotification}
                  disabled={sendingPush || !pushMessage.trim()}
                  className="mt-4 w-full bg-green-600 hover:bg-green-700"
                >
                  {sendingPush ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending Push Notification...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Push Notification
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  // Calculate statistics
  const stats = {
    totalRegistered: event.rsvps?.length || 0,
    totalAttended: event.attendance?.length || 0,
    attendanceRate: event.rsvps?.length ? 
      Math.round(((event.attendance?.length || 0) / event.rsvps.length) * 100) : 0,
    totalRevenue: (event.rsvps?.length || 0) * parseFloat(event.ticketPrice || '0'),
    spotsRemaining: event.capacity ? 
      parseInt(event.capacity) - (event.rsvps?.length || 0) : 'Unlimited'
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Mobile Header */}
      <div className='flex items-center justify-between p-4 lg:hidden border-b bg-white'>
        <div className='flex items-center'>
          <img src="/suilenslogo.png" alt="" width={40} height={40}/>
          <p className='text-[#04101D] font-normal ml-2'>Suilens</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveTab(activeTab)} // This could be used to toggle mobile menu
          className="lg:hidden"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      {/* Desktop Header */}
      <div className='hidden lg:flex items-center p-4'>
        <img src="/suilenslogo.png" alt="" width={50} height={50}/>
        <p className='text-[#04101D] font-normal ml-2'>Suilens</p>
      </div>
     
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <div className='hidden lg:block mt-14'>
          <Sidebar 
            activeSection={activeTab} 
            onSectionChange={setActiveTab} 
          />
        </div>
       
        <main className="flex-1 overflow-auto">
          <div className="mx-auto px-4 lg:px-8 py-4 lg:py-8">
            {/* Header */}
            <div className="mb-4 lg:mb-6">
              <div className='flex flex-col sm:flex-row gap-2 font-medium text-sm mb-3 lg:mb-5'>
                <Link href="/dashboard" className="inline-flex items-center text-[#667185] hover:text-gray-900 mb-2 sm:mb-4">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Link>
                <p className='text-[#667185] hidden sm:block'>Dashboard / <span className='text-gray-900 font-medium'> Manage event</span></p>
              </div>
              
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-semibold text-[#101928]">Event Admin Panel</h1>
                  <p className="text-gray-600 mt-1 text-sm lg:text-base">{event.title}</p>
                </div>
              </div>
            </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Mobile Tab Navigation */}
          <div className="lg:hidden mb-4">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md bg-white"
            >
              <option value="overview">Overview</option>
              <option value="guests">Attendees</option>
              <option value="broadcast">Broadcast</option>
              <option value="poap">POAP</option>
              <option value="financials">Financials</option>
            </select>
          </div>

          {/* Desktop Tab Navigation */}
          <TabsList className="hidden lg:grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="guests">Attendees</TabsTrigger>
            <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
            <TabsTrigger value="poap">POAP</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="container space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              <Card className='border-[#E4E7EC]'>
                <CardContent className="p-4 lg:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <BarChart3 className='text-[#101928] mb-6 lg:mb-10 w-4 h-4 lg:w-5 lg:h-5'/>
                      <p className="text-xs lg:text-sm font-medium text-[#667185]">Total Registered</p>
                      <p className="pt-1 lg:pt-2 text-base lg:text-lg font-semibold text-[#101928]">{stats.totalRegistered}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 lg:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <CheckCircle className='text-[#101928] mb-6 lg:mb-10 w-4 h-4 lg:w-5 lg:h-5'/>
                      <p className="text-xs lg:text-sm font-medium text-[#667185]">Checked In</p>
                      <p className="pt-1 lg:pt-2 text-base lg:text-lg font-semibold text-[#101928]">{stats.totalAttended}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 lg:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <DollarSign className='text-[#101928] mb-6 lg:mb-10 w-4 h-4 lg:w-5 lg:h-5'/>
                      <p className="text-xs lg:text-sm font-medium text-[#667185]">Revenue</p>
                      <p className="pt-1 lg:pt-2 text-base lg:text-lg font-semibold text-[#101928]">
                        {event.isFree ? 'Free' : `$${stats.totalRevenue}`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 lg:p-6">
                  <div className="flex items-center justify-between">
                    <div className=''>
                      <img src="/spots-left.png" alt="" width={22} height={14} className='mb-6 lg:mb-10'/>
                      <p className="text-xs lg:text-sm font-medium text-[#667185]">Spots Left {stats.spotsRemaining}</p>
                      <p className="pt-1 lg:pt-2 text-base lg:text-lg font-semibold text-[#101928]">
                        {stats.spotsRemaining === 'Unlimited' ? 'No limit' : 'Available'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Event Detail */}
            <div className="bg-white p-4 lg:p-6 mt-7 rounded-lg">
              <h2 className="text-xl lg:text-2xl font-bold text-[#101928] my-4">{event.title}</h2>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-sm text-[#667185] mb-4">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{event.date ? new Date(event.date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  }) : '8th August, 2025'}</span>
                </div>
                <span className="hidden sm:inline">|</span>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{event.date ? new Date(event.date).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  }) : '10:00AM'}</span>
                </div>
                <span className="hidden sm:inline">|</span>
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{event.location || 'Lagos, Nigeria'}</span>
                </div>
              </div>
              
              <div className="border-t pt-4 mt-6 lg:mt-10">
                <h3 className="text-lg lg:text-xl font-semibold text-[#101928] mb-3">About this event</h3>
                <p className="text-[#667185] leading-relaxed text-sm lg:text-base">
                  {event.description || 'Lorem ipsum dolor sit amet consectetur. Imperdiet facilisis nibh sed facilisi velit congue curabitur. Id feugiat rhoncus risus egestas. Lorem ipsum dolor sit amet consectetur. Imperdiet facilisis nibh sed facilisi velit congue curabitur. Id'}
                </p>
              </div>
            </div>
          </TabsContent>
              {/* Mobile Tab Navigation */}
              <div className="lg:hidden mb-4">
                <select
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md bg-white"
                >
                  <option value="overview">Overview</option>
                  <option value="attendees">Attendees</option>
                  <option value="broadcast">Broadcast</option>
                  <option value="poap">POAP</option>
                  <option value="financials">Financials</option>
                </select>
              </div>



          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" onClick={() => setActiveTab('guests')}>
                  <Users className="w-4 h-4 mr-2" />
                  View Attendee List
                </Button>
                <Button variant="outline" onClick={() => setActiveTab('checkin')}>
                  <QrCode className="w-4 h-4 mr-2" />
                  Generate QR Code
                </Button>
                <Button variant="outline" onClick={() => router.push(`/event/${eventId}/edit`)}>
                  <Settings className="w-4 h-4 mr-2" />
                  Edit Event
                </Button>
                {!event.isFree && stats.totalRevenue > 0 && (
                  <Button variant="outline" onClick={() => setActiveTab('financials')}>
                    <Wallet className="w-4 h-4 mr-2" />
                    Withdraw Funds
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendees Tab */}
          <TabsContent value="guests" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {event?.requiresApproval ? 'Registration Requests' : 'Registered Attendees'}
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      {attendeeList.length} registered • {attendeeList.filter(a => a.checkedIn).length} checked in
                      {event?.requiresApproval && (
                        <> • {attendeeList.filter(a => a.approvalStatus === 'pending').length} pending approval</>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        setLoading(true)
                        console.log('Manually refreshing attendee data...')
                        try {
                          // Force refresh from blockchain with a small delay to ensure transaction finality
                          await new Promise(resolve => setTimeout(resolve, 1000))
                          await fetchEvents(true) // Force refresh from blockchain

                          const updatedEvent = getEvent(eventId)
                          if (updatedEvent) {
                            console.log('=== REFRESH BUTTON - Updated event data ===')
                            console.log('RSVPs:', updatedEvent.rsvps?.length || 0, updatedEvent.rsvps)
                            console.log('Attendance:', updatedEvent.attendance?.length || 0, updatedEvent.attendance)
                            console.log('Pending Approvals:', updatedEvent.pending_approvals?.length || 0, updatedEvent.pending_approvals)
                            console.log('Approved Attendees:', updatedEvent.approved_attendees?.length || 0, updatedEvent.approved_attendees)
                            console.log('Requires Approval:', updatedEvent.requiresApproval)
                            console.log('=== END REFRESH DATA ===')
                            setEvent(updatedEvent)
                            const attendees: AttendeeData[] = (updatedEvent.rsvps || []).map((address: string) => {
                              // Determine approval status based on event approval requirement
                              let approvalStatus: 'pending' | 'approved' | 'rejected' = 'approved'
                              
                              if (updatedEvent.requiresApproval) {
                                if (updatedEvent.pending_approvals?.includes(address)) {
                                  approvalStatus = 'pending'
                                } else if (updatedEvent.approved_attendees?.includes(address)) {
                                  approvalStatus = 'approved'
                                } else {
                                  // If in rsvps but not in pending or approved, assume pending for new registrations
                                  approvalStatus = 'pending'
                                }
                              }

                              return {
                                address,
                                registeredAt: new Date().toISOString(), // TODO: Get actual registration time from blockchain
                                checkedIn: updatedEvent.attendance?.includes(address) || false,
                                checkedInAt: updatedEvent.attendance?.includes(address) ? new Date().toISOString() : undefined,
                                approvalStatus
                              }
                            })
                            setAttendeeList(attendees)
                            toast.success(`Attendee list refreshed! ${attendees.filter(a => a.checkedIn).length}/${attendees.length} checked in`)
                          } else {
                            toast.error('Failed to refresh attendee list - event not found')
                          }
                        } catch (error) {
                          console.error('Error refreshing attendees:', error)
                          toast.error('Failed to refresh attendee list')
                        } finally {
                          setLoading(false)
                        }
                      }}
                      disabled={loading}
                      className="flex-1 sm:flex-none"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Refreshing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Refresh
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportCSV}
                      className="flex-1 sm:flex-none"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Export </span>CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {attendeeList.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No attendees registered yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[200px]">Wallet Address</TableHead>
                          <TableHead className="hidden sm:table-cell">Registration</TableHead>
                          <TableHead>Status</TableHead>
                          {event?.requiresApproval && <TableHead className="hidden md:table-cell">Approval</TableHead>}
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attendeeList.map((attendee) => (
                          <TableRow key={attendee.address}>
                            <TableCell>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <code className="text-xs break-all">{formatAddress(attendee.address)}</code>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyToClipboard(attendee.address)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {new Date(attendee.registeredAt || '').toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {/* Check-in Status */}
                                {attendee.checkedIn ? (
                                  <Badge className="bg-green-100 text-green-800 text-xs">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    <span className="hidden sm:inline">Checked In</span>
                                    <span className="sm:hidden">✓</span>
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">
                                    <Clock className="w-3 h-3 mr-1" />
                                    <span className="hidden sm:inline">Not Checked In</span>
                                    <span className="sm:hidden">-</span>
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            {/* Approval Status Column - Only show for events requiring approval */}
                            {event?.requiresApproval && (
                              <TableCell className="hidden md:table-cell">
                                <div className="flex flex-col gap-1">
                                  {attendee.approvalStatus === 'pending' && (
                                    <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                                      <Clock className="w-3 h-3 mr-1" />
                                      <span>Pending</span>
                                    </Badge>
                                  )}
                                  {attendee.approvalStatus === 'approved' && (
                                    <Badge className="bg-green-100 text-green-800 text-xs">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      <span>Approved</span>
                                    </Badge>
                                  )}
                                  {attendee.approvalStatus === 'rejected' && (
                                    <Badge className="bg-red-100 text-red-800 text-xs">
                                      <XCircle className="w-3 h-3 mr-1" />
                                      <span>Rejected</span>
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="flex gap-1">
                                {/* Show approval/rejection buttons for events requiring approval */}
                                {event?.requiresApproval && attendee.approvalStatus === 'pending' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleApproveAttendee && handleApproveAttendee(attendee.address)}
                                      className="h-7 px-2 text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                                      disabled={loading || approvingAttendees.has(attendee.address)}
                                    >
                                      {approvingAttendees.has(attendee.address) ? (
                                        <>
                                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                          <span className="hidden sm:inline">Approving...</span>
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle className="w-3 h-3 mr-1" />
                                          <span className="hidden sm:inline">Approve</span>
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleRejectAttendee && handleRejectAttendee(attendee.address)}
                                      className="h-7 px-2 text-xs bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                                      disabled={loading || rejectingAttendees.has(attendee.address)}
                                    >
                                      {rejectingAttendees.has(attendee.address) ? (
                                        <>
                                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                          <span className="hidden sm:inline">Rejecting...</span>
                                        </>
                                      ) : (
                                        <>
                                          <XCircle className="w-3 h-3 mr-1" />
                                          <span className="hidden sm:inline">Reject</span>
                                        </>
                                      )}
                                    </Button>
                                  </>
                                )}
                                {/* Show approval status on small screens within actions */}
                                {event?.requiresApproval && (
                                  <div className="md:hidden">
                                    {attendee.approvalStatus === 'pending' && (
                                      <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                                        Pending
                                      </Badge>
                                    )}
                                    {attendee.approvalStatus === 'approved' && (
                                      <Badge className="bg-green-100 text-green-800 text-xs">
                                        Approved
                                      </Badge>
                                    )}
                                    {attendee.approvalStatus === 'rejected' && (
                                      <Badge className="bg-red-100 text-red-800 text-xs">
                                        Rejected
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Check-in Tab */}
          <TabsContent value="checkin" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Send Email Blast</CardTitle>
                <CardDescription>
                  Send an email to all registered attendees for this event
                </CardDescription>
              </CardHeader>
              <CardContent>
                {eventQRCode ? (
                  <div className="space-y-6">
                    <div className="bg-white p-8 rounded-lg border flex justify-center">
                      <img 
                        src={eventQRCode} 
                        alt="Event Check-in QR Code"
                        className="w-64 h-64"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Button onClick={handleDownloadQRCode} className="w-full">
                        <Download className="w-4 h-4 mr-2" />
                        Download QR Code
                      </Button>
                      <Button 
                        onClick={handleGenerateQRCode}
                        variant="outline"
                        disabled={generatingQR}
                        className="w-full"
                      >
                        {generatingQR ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Regenerating...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Regenerate QR Code
                          </>
                        )}
                      </Button>
                    </div>
                    
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">How to use:</h4>
                      <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                        <li>Download and print this QR code</li>
                        <li>Display it prominently at your event venue</li>
                        <li>Attendees scan it using the SuiLens app to check in</li>
                        <li>Once checked in, they can claim their POAP after the event</li>
                      </ol>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <QrCode className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 mb-6">No QR code generated yet</p>
                    <Button 
                      onClick={handleGenerateQRCode}
                      disabled={generatingQR}
                      size="lg"
                    >
                      {generatingQR ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4 mr-2" />
                          Generate Check-in QR Code
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Manual Check-in</CardTitle>
                <CardDescription>
                  Manually mark attendees as present if they can't scan the QR code
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline"
                  onClick={() => setActiveTab('attendees')}
                  className="w-full"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Go to Attendee List
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* POAP Tab */}
          <TabsContent value="poap" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <Award className="h-6 w-6 text-purple-600" />
                    POAP Collection Management
                  </div>
                </CardTitle>
                <CardDescription>
                  Create and manage Proof of Attendance Protocol badges for your event
                </CardDescription>
              </CardHeader>
              <CardContent>
                {checkingPoapStatus ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                  </div>
                ) : poapCollection?.exists ? (
                  <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-green-900">POAP Collection Active</h4>
                          <p className="text-sm text-green-700 mt-1">
                            Your POAP collection is set up. Attendees who check in can now claim their POAPs.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {poapFormData.imageUrl && (
                      <div className="mt-4">
                        <p className="text-sm text-gray-600 mb-2">POAP Badge Design:</p>
                        <img 
                          src={poapFormData.imageUrl} 
                          alt="POAP Badge"
                          className="w-32 h-32 rounded-lg object-cover border"
                        />
                      </div>
                    )}
                    
                    <div className="bg-purple-50 p-4 rounded-lg mt-4">
                      <h4 className="font-medium text-purple-900 mb-2">How POAPs Work:</h4>
                      <ol className="text-sm text-purple-800 space-y-1 list-decimal list-inside">
                        <li>Attendees must check in at your event</li>
                        <li>After checking in, they can claim their POAP</li>
                        <li>Each attendee can only claim one POAP per event</li>
                        <li>POAPs serve as permanent proof of attendance on the blockchain</li>
                      </ol>
                    </div>
                    
                    {/* Add option to recreate if there's an issue */}
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-gray-600 mb-2">Having issues with POAP claiming?</p>
                      <Button 
                        onClick={() => {
                          // Clear the collection status and allow recreation
                          const poapKey = `poap_collection_${eventId}`
                          localStorage.removeItem(poapKey)
                          setPoapCollection(null)
                          toast.info('You can now recreate the POAP collection')
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Reset POAP Collection
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <Award className="h-5 w-5 text-amber-600 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-amber-900">No POAP Collection Yet</h4>
                          <p className="text-sm text-amber-700 mt-1">
                            Create a POAP collection to enable attendees to claim proof of attendance badges.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="poap-name">POAP Name *</Label>
                        <Input
                          id="poap-name"
                          value={poapFormData.name}
                          onChange={(e) => setPoapFormData({ ...poapFormData, name: e.target.value })}
                          placeholder="e.g., DevCon 2024 POAP"
                          className="mt-1"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="poap-description">Description *</Label>
                        <Textarea
                          id="poap-description"
                          value={poapFormData.description}
                          onChange={(e) => setPoapFormData({ ...poapFormData, description: e.target.value })}
                          placeholder="Describe what this POAP represents..."
                          className="mt-1"
                          rows={3}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="poap-image">Badge Image URL *</Label>
                        <Input
                          id="poap-image"
                          value={poapFormData.imageUrl}
                          onChange={(e) => setPoapFormData({ ...poapFormData, imageUrl: e.target.value })}
                          placeholder="https://example.com/poap-badge.png"
                          className="mt-1"
                        />
                        {poapFormData.imageUrl && (
                          <div className="mt-2">
                            <img 
                              src={poapFormData.imageUrl} 
                              alt="POAP Preview"
                              className="w-24 h-24 rounded-lg object-cover border"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <Label htmlFor="poap-supply">Max Supply (Optional)</Label>
                        <Input
                          id="poap-supply"
                          type="number"
                          value={poapFormData.maxSupply}
                          onChange={(e) => setPoapFormData({ ...poapFormData, maxSupply: e.target.value })}
                          placeholder="Leave empty for unlimited"
                          className="mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Limit the number of POAPs that can be claimed. Leave empty for unlimited.
                        </p>
                      </div>
                      
                      <Button 
                        onClick={handleCreatePoapCollection}
                        disabled={creatingPoap || !poapFormData.name || !poapFormData.description || !poapFormData.imageUrl}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                      >
                        {creatingPoap ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating POAP Collection...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Create POAP Collection
                          </>
                        )}
                      </Button>
                    </div>
                    
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">What are POAPs?</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        POAPs (Proof of Attendance Protocol) are special NFT badges that prove someone attended your event.
                        They're valuable digital collectibles that attendees can keep forever.
                      </p>
                      <h4 className="font-medium text-gray-900 mb-2">Benefits:</h4>
                      <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                        <li>Increase attendee engagement and retention</li>
                        <li>Create lasting memories for your community</li>
                        <li>Build on-chain reputation for attendees</li>
                        <li>Enable future token-gated experiences</li>
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Email Blast Tab */}
          <TabsContent value="broadcast" className="space-y-6">
            <EmailBlastTab />
          </TabsContent>

          {/* Financials Tab */}
          <TabsContent value="financials" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Financial Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Ticket Price</p>
                    <p className="text-2xl font-bold">
                      {event.isFree ? 'Free' : `$${event.ticketPrice}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${stats.totalRevenue}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Tickets Sold</p>
                    <p className="text-2xl font-bold">{stats.totalRegistered}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Platform Fee (5%)</p>
                    <p className="text-2xl font-bold">
                      ${(stats.totalRevenue * 0.05).toFixed(2)}
                    </p>
                  </div>
                </div>

                {!event.isFree && stats.totalRevenue > 0 && (
                  <div className="pt-6 border-t">
                    <div className="bg-green-50 p-4 rounded-lg mb-4">
                      <h4 className="font-medium text-green-900 mb-2">Available for Withdrawal</h4>
                      <p className="text-3xl font-bold text-green-600">
                        ${(stats.totalRevenue * 0.95).toFixed(2)}
                      </p>
                      <p className="text-sm text-green-700 mt-1">After 5% platform fee</p>
                    </div>

                    <Button
                      onClick={handleWithdrawFunds}
                      disabled={withdrawing}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {withdrawing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing Withdrawal...
                        </>
                      ) : (
                        <>
                          <Wallet className="w-4 h-4 mr-2" />
                          Withdraw Funds to Wallet
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Funds will be sent to your connected wallet address
                    </p>
                  </div>
                )}

                {event.isFree && (
                  <div className="bg-gray-50 p-6 rounded-lg text-center">
                    <p className="text-gray-600">This is a free event with no revenue</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
          </div>
        </main>
      </div>
    </div>
  )
}