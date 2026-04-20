import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { C } from '@/lib/colors'
import { formatDateTime } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { api } from '@/lib/api'
import type { TimelineEvent } from '@lms/shared'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ActivityResponse {
  data: TimelineEvent[]
  total: number
  page: number
  limit: number
}

// ─── Event type config ────────────────────────────────────────────────────────

const EVENT_TYPE_COLOR: Record<string, string> = {
  LEAD_CREATED:     C.primary,
  LEAD_CONVERTED:   C.success,
  STAGE_CHANGED:    C.purple,
  REFERRAL_CREATED: C.orange,
  TASK_COMPLETED:   C.success,
  NOTE_ADDED:       C.warning,
  CALL_LOGGED:      C.cyan,
  MEETING_SCHEDULED:C.violet,
}

function getEventColor(type: string): string {
  return EVENT_TYPE_COLOR[type] ?? C.textMuted
}

// ─── Single event row ─────────────────────────────────────────────────────────

function EventRow({
  event,
  isLast,
}: {
  event: TimelineEvent
  isLast: boolean
}) {
  const dotColor = getEventColor(event.eventType)

  const entityName = (event as any).lead?.schoolName
    ?? (event as any).school?.name
    ?? null

  return (
    <View style={styles.eventRow}>
      {/* Timeline spine */}
      <View style={styles.spine}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        {!isLast && <View style={styles.line} />}
      </View>

      {/* Content */}
      <View style={[styles.eventContent, isLast && styles.eventContentLast]}>
        {/* Top row: badge + entity */}
        <View style={styles.eventTopRow}>
          <StatusBadge status={event.eventType} size="sm" />
          {entityName ? (
            <Text style={styles.entityName} numberOfLines={1}>
              {entityName}
            </Text>
          ) : null}
        </View>

        {/* Description */}
        <Text style={styles.eventDescription}>{event.description}</Text>

        {/* Footer: user + timestamp */}
        <View style={styles.eventFooter}>
          {event.createdBy ? (
            <View style={styles.userPill}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {event.createdBy.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.userName} numberOfLines={1}>
                {event.createdBy.name}
              </Text>
            </View>
          ) : null}
          <Text style={styles.eventTime}>
            {formatDateTime(event.createdAt)}
          </Text>
        </View>
      </View>
    </View>
  )
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

const PAGE_LIMIT = 20

export default function ActivityScreen() {
  const [page, setPage] = useState(1)
  const [allEvents, setAllEvents] = useState<TimelineEvent[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // First page via useQuery (handles loading/error states)
  const { isLoading, isError, refetch } = useQuery<ActivityResponse>({
    queryKey: ['activity', 1],
    queryFn: () =>
      api.get('/activity', { params: { page: 1, limit: PAGE_LIMIT } }).then((r) => r.data),
    onSuccess: (data: ActivityResponse) => {
      setAllEvents(data.data)
      setTotalCount(data.total)
      setPage(1)
    },
  } as any)

  const hasMore = allEvents.length < totalCount

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    try {
      const nextPage = page + 1
      const res: ActivityResponse = await api
        .get('/activity', { params: { page: nextPage, limit: PAGE_LIMIT } })
        .then((r) => r.data)
      setAllEvents((prev) => [...prev, ...res.data])
      setPage(nextPage)
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, hasMore, page])

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingSpinner />
      </SafeAreaView>
    )
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="Failed to load activity"
          subtitle="Pull down to retry"
        />
      </SafeAreaView>
    )
  }

  const renderItem = ({ item, index }: { item: TimelineEvent; index: number }) => (
    <EventRow event={item} isLast={index === allEvents.length - 1} />
  )

  const renderFooter = () => {
    if (isLoadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={C.primary} />
        </View>
      )
    }
    if (hasMore) {
      return (
        <Pressable
          onPress={loadMore}
          style={({ pressed }) => [
            styles.loadMoreBtn,
            pressed && { opacity: 0.75 },
          ]}
        >
          <Text style={styles.loadMoreText}>Load More</Text>
        </Pressable>
      )
    }
    if (allEvents.length > 0) {
      return (
        <View style={styles.endCaption}>
          <Text style={styles.endCaptionText}>All {totalCount} events loaded</Text>
        </View>
      )
    }
    return null
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity Log</Text>
        {totalCount > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{totalCount} events</Text>
          </View>
        )}
      </View>

      {/* ── List ────────────────────────────────────────────────────────── */}
      <FlatList
        data={allEvents}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState
            title="No activity yet"
            subtitle="Actions taken on leads and schools will appear here"
          />
        }
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onRefresh={refetch}
        refreshing={isLoading}
      />
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
  },
  countBadge: {
    backgroundColor: C.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.primary,
  },

  // List
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Event row
  eventRow: {
    flexDirection: 'row',
  },

  // Timeline spine
  spine: {
    width: 28,
    alignItems: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    zIndex: 1,
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: C.border,
    marginTop: 2,
  },

  // Event content bubble
  eventContent: {
    flex: 1,
    marginLeft: 10,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  eventContentLast: {
    marginBottom: 0,
  },

  eventTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  entityName: {
    flex: 1,
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: '500',
  },

  eventDescription: {
    fontSize: 14,
    color: C.text,
    lineHeight: 20,
    marginBottom: 8,
  },

  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
  },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  userAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 10,
    fontWeight: '700',
    color: C.primary,
  },
  userName: {
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: '500',
    maxWidth: 140,
  },
  eventTime: {
    fontSize: 11,
    color: C.textMuted,
  },

  // Load more / footer
  loadMoreBtn: {
    marginTop: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.primary,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  endCaption: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  endCaptionText: {
    fontSize: 12,
    color: C.textMuted,
  },
})
