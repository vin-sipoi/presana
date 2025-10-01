"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import api from "@/lib/api"

interface BlastEmailFormProps {
  eventId: string | null
  eventTitle: string
}

export default function BlastEmailForm({ eventId, eventTitle }: BlastEmailFormProps) {
  const [subject, setSubject] = useState("")
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const validateInputs = () => {
    if (!eventId) {
      toast({
        title: "No event selected",
        description: "Please select an event to send the blast email.",
        variant: "destructive",
      })
      return false
    }
    if (!eventTitle.trim()) {
      toast({
        title: "Missing event title",
        description: "Event title is required.",
        variant: "destructive",
      })
      return false
    }
    if (!subject.trim() || !content.trim()) {
      toast({
        title: "Missing fields",
        description: "Please fill in both subject and content.",
        variant: "destructive",
      })
      return false
    }
    if (subject.length > 100) {
      toast({
        title: "Subject too long",
        description: "Subject must be 100 characters or less.",
        variant: "destructive",
      })
      return false
    }
    if (content.length > 2000) {
      toast({
        title: "Content too long",
        description: "Content must be 2000 characters or less.",
        variant: "destructive",
      })
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateInputs()) {
      return
    }

    setLoading(true)
    try {
      const response = await api.post("/api/send-blast-email", {
        eventId,
        subject,
        content,
        title: eventTitle,
      })
      if (response.success) {
        toast({
          title: "Email blast sent",
          description: `Successfully sent to ${response.results.successful} recipients.`,
          variant: "default",
        })
        setSubject("")
        setContent("")
      } else {
        toast({
          title: "Failed to send email blast",
          description: response.message || "Unknown error",
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send email blast",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4">Send Blast Email</h2>
      <p className="mb-4 text-gray-700">Event: <strong>{eventTitle || "No event selected"}</strong></p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
            Subject
          </label>
          <Input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          placeholder="Enter email subject"
          required
          maxLength={100}
        />
      </div>
      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
          Content
        </label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Enter email content"
          rows={6}
          required
          maxLength={2000}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send Blast Email"}
        </Button>
      </div>
    </form>
  </div>
)
}
