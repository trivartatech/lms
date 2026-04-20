import { Phone, Mail, MapPin, User, GitBranch, Users, MessageCircle, PhoneCall, Pencil } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { School } from '@lms/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'

interface Props {
  school: School
  onEdit: () => void
}

export function OverviewTab({ school, onEdit }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Contact Information</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" /><span>{school.contactPerson}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" />
            <span>{school.phone}</span>
            <a href={`tel:+91${school.phone.replace(/\D/g, '')}`} title="Call" className="text-blue-600 hover:opacity-70">
              <PhoneCall className="h-4 w-4" />
            </a>
            <a
              href={`https://wa.me/91${school.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              title="WhatsApp"
              className="text-green-600 hover:opacity-70"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" /><span>{school.email}</span>
          </div>
          {school.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" /><span>{school.location}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">School Details</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Client Since</span>
            <span>{formatDate(school.createdAt)}</span>
          </div>
          {school.totalStudents != null && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> Total Students
              </span>
              <span className="font-medium">{school.totalStudents.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground flex items-center gap-1">
              <GitBranch className="h-3.5 w-3.5" /> Referred By
            </span>
            <div className="flex items-center gap-1.5">
              {school.referredBySchool ? (
                <Link
                  to={`/schools/${school.referredBySchoolId}`}
                  className="text-primary hover:underline font-medium"
                >
                  {school.referredBySchool.name}
                </Link>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              )}
              <button
                onClick={onEdit}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Edit referred by"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          </div>
          {school.assignedTo && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Assigned To</span>
              <span>{school.assignedTo.name}</span>
            </div>
          )}
          {school.createdFromLeadId && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Source Lead</span>
              <Link to={`/leads/${school.createdFromLeadId}`} className="text-primary hover:underline">
                Lead #{school.createdFromLeadId}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
      {school.notes && (
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{school.notes}</p></CardContent>
        </Card>
      )}
    </div>
  )
}
