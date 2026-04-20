import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
  RefreshControl,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  TrendingUp,
  Users,
  School,
  DollarSign,
  CheckSquare,
  Briefcase,
  Calendar,
  AlertTriangle,
  Search,
} from 'lucide-react-native'
import { GlobalSearchModal } from '@/components/shared/GlobalSearchModal'
import { C } from '@/lib/colors'
import { formatCurrency, formatDate, daysFromNow } from '@/lib/utils'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import type { DashboardStats } from '@lms/shared'

// ─── Pipeline stage config ────────────────────────────────────────────────────
const STAGE_CONFIG: Record<string, { color: string; label: string }> = {
  NEW:          { color: '#64748b', label: 'New' },
  QUALIFIED:    { color: C.primary, label: 'Qualified' },
  DEMO:         { color: C.purple, label: 'Demo' },
  PROPOSAL:     { color: C.warning, label: 'Proposal' },
  NEGOTIATION:  { color: C.orange, label: 'Negotiation' },
  CLOSED_WON:   { color: C.success, label: 'Closed Won' },
  CLOSED_LOST:  { color: C.error, label: 'Closed Lost' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  bg,
  icon,
  onPress,
}: {
  label: string
  value: string | number
  color: string
  bg: string
  icon: React.ReactNode
  onPress?: () => void
}) {
  const content = (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <View style={[styles.statIconWrap, { backgroundColor: bg }]}>{icon}</View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.statCardOuter, pressed && { opacity: 0.75 }]}
      >
        {content}
      </Pressable>
    )
  }
  return <View style={styles.statCardOuter}>{content}</View>
}

function SectionCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const { width } = useWindowDimensions()
  const [showSearch, setShowSearch] = useState(false)

  const {
    data: stats,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard/stats').then((r) => r.data),
  })

  // ── Stat card definitions ─────────────────────────────────────────────────
  const statCards = [
    {
      label: 'Total Leads',
      value: stats?.totalLeads ?? 0,
      color: C.primary,
      bg: C.primaryLight,
      icon: <TrendingUp size={20} color={C.primary} />,
    },
    {
      label: 'New This Month',
      value: stats?.newLeadsThisMonth ?? 0,
      color: C.success,
      bg: C.successLight,
      icon: <Users size={20} color={C.success} />,
    },
    {
      label: 'Schools / Clients',
      value: stats?.totalSchools ?? 0,
      color: C.purple,
      bg: C.purpleLight,
      icon: <School size={20} color={C.purple} />,
    },
    {
      label: 'Total Revenue',
      value: formatCurrency(stats?.totalRevenue ?? 0),
      color: C.warning,
      bg: C.warningLight,
      icon: <DollarSign size={20} color={C.warning} />,
    },
    {
      label: 'Pending Tasks',
      value: stats?.pendingTasks ?? 0,
      color: C.error,
      bg: C.errorLight,
      icon: <CheckSquare size={20} color={C.error} />,
      onPress: () => router.push('/(app)/tasks'),
    },
    {
      label: 'Open Deals',
      value: stats?.openDeals ?? 0,
      color: C.primaryDark,
      bg: C.primaryLight,
      icon: <Briefcase size={20} color={C.primaryDark} />,
    },
  ]

  // ── Pipeline bar chart ────────────────────────────────────────────────────
  const pipeline = stats?.pipelineByStage ?? []
  const maxPipelineCount = pipeline.reduce((m, s) => Math.max(m, s.count), 1)
  // Available bar width = screen - horizontal paddings - label column - count column
  const barAreaWidth = width - 32 - 16 - 100 - 44

  // ── Upcoming renewals (next 60 days) ──────────────────────────────────────
  const renewals = (stats?.upcomingRenewals ?? []).filter(
    (r) => daysFromNow(r.renewalDate) <= 60,
  )

  // ── Top referring schools ─────────────────────────────────────────────────
  const topReferrers = stats?.topReferringSchools ?? []

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingSpinner />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={C.primary}
            colors={[C.primary]}
          />
        }
      >
        {/* ── Greeting ─────────────────────────────────────────────────── */}
        <View style={styles.greetingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>
              Hello, {user?.name?.split(' ')[0] ?? 'there'}!
            </Text>
            <Text style={styles.greetingSub}>Here's your business overview</Text>
          </View>
          <Pressable
            onPress={() => setShowSearch(true)}
            style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.8 }]}
            hitSlop={6}
          >
            <Search size={18} color={C.primary} />
          </Pressable>
        </View>

        {/* ── 6-card stat grid ─────────────────────────────────────────── */}
        <View style={styles.statGrid}>
          {statCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </View>

        {/* ── Today's Focus ────────────────────────────────────────────── */}
        <SectionCard title="Today's Focus">
          <View style={styles.todayRow}>
            <View style={styles.todayMain}>
              <Text style={styles.todayNumber}>{stats?.tasksDueToday ?? 0}</Text>
              <Text style={styles.todayLabel}>tasks due today</Text>
            </View>
            {(stats?.overdueTasksCount ?? 0) > 0 && (
              <View style={styles.overdueBadge}>
                <AlertTriangle size={13} color={C.errorText} />
                <Text style={styles.overdueText}>
                  {stats!.overdueTasksCount} overdue
                </Text>
              </View>
            )}
          </View>
          <Pressable
            onPress={() => router.push('/(app)/tasks')}
            style={({ pressed }) => [
              styles.viewAllBtn,
              pressed && { opacity: 0.75 },
            ]}
          >
            <Text style={styles.viewAllBtnText}>View all tasks</Text>
          </Pressable>
        </SectionCard>

        {/* ── Pipeline Funnel ──────────────────────────────────────────── */}
        {pipeline.length > 0 && (
          <SectionCard title="Pipeline Funnel">
            {pipeline.map((item) => {
              const cfg = STAGE_CONFIG[item.stage] ?? {
                color: C.textMuted,
                label: item.stage,
              }
              const barWidth =
                maxPipelineCount > 0
                  ? (item.count / maxPipelineCount) * barAreaWidth
                  : 0
              return (
                <View key={item.stage} style={styles.pipelineRow}>
                  <Text style={styles.pipelineLabel} numberOfLines={1}>
                    {cfg.label}
                  </Text>
                  <View style={styles.pipelineBarTrack}>
                    <View
                      style={[
                        styles.pipelineBar,
                        { width: Math.max(barWidth, 4), backgroundColor: cfg.color },
                      ]}
                    />
                  </View>
                  <Text style={[styles.pipelineCount, { color: cfg.color }]}>
                    {item.count}
                  </Text>
                </View>
              )
            })}
          </SectionCard>
        )}

        {/* ── Upcoming Renewals ────────────────────────────────────────── */}
        {renewals.length > 0 && (
          <SectionCard title="Upcoming Renewals (Next 60 Days)">
            {renewals.map((r, i) => {
              const days = daysFromNow(r.renewalDate)
              const urgent = days < 14
              return (
                <View
                  key={r.schoolId}
                  style={[
                    styles.renewalRow,
                    i < renewals.length - 1 && styles.renewalRowBorder,
                  ]}
                >
                  <View style={styles.renewalLeft}>
                    <Calendar
                      size={14}
                      color={urgent ? C.error : C.textSecondary}
                    />
                    <View style={styles.renewalInfo}>
                      <Text style={styles.renewalSchool} numberOfLines={1}>
                        {r.schoolName}
                      </Text>
                      <Text
                        style={[
                          styles.renewalDate,
                          urgent && styles.renewalDateUrgent,
                        ]}
                      >
                        {formatDate(r.renewalDate)}
                        {urgent && ` · ${days}d`}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.renewalValue}>
                    {formatCurrency(r.value)}
                  </Text>
                </View>
              )
            })}
          </SectionCard>
        )}

        {/* ── Top Referring Schools ────────────────────────────────────── */}
        {topReferrers.length > 0 && (
          <SectionCard title="Top Referring Schools">
            {topReferrers.map((s, i) => (
              <View
                key={s.id}
                style={[
                  styles.referrerRow,
                  i < topReferrers.length - 1 && styles.referrerRowBorder,
                ]}
              >
                <View style={styles.referrerRank}>
                  <Text style={styles.referrerRankText}>{i + 1}</Text>
                </View>
                <Text style={styles.referrerName} numberOfLines={1}>
                  {s.name}
                </Text>
                <View style={styles.referrerBadge}>
                  <Text style={styles.referrerBadgeText}>
                    {s.referrals} referrals
                  </Text>
                </View>
              </View>
            ))}
          </SectionCard>
        )}

        {/* ── Referral Program (4-KPI panel) ───────────────────────────── */}
        {stats && (
          <SectionCard title="Referral Program">
            <View style={styles.referralGrid}>
              <View style={styles.referralKpi}>
                <Text style={[styles.referralKpiValue, { color: C.primary }]}>
                  {stats.totalReferrals ?? 0}
                </Text>
                <Text style={styles.referralKpiLabel}>Total Referrals</Text>
                {(stats.convertedReferrals ?? 0) > 0 && (
                  <Text style={styles.referralKpiSub}>
                    {stats.convertedReferrals} converted
                  </Text>
                )}
              </View>
              <View style={styles.referralKpi}>
                <Text style={[styles.referralKpiValue, { color: C.success }]}>
                  {stats.referralConversionRate ?? 0}%
                </Text>
                <Text style={styles.referralKpiLabel}>Conversion Rate</Text>
              </View>
              <View style={styles.referralKpi}>
                <Text style={[styles.referralKpiValue, { color: C.warning }]}>
                  {formatCurrency(stats.pendingCommissionTotal ?? 0)}
                </Text>
                <Text style={styles.referralKpiLabel}>Commission Pending</Text>
              </View>
              <View style={styles.referralKpi}>
                <Text style={[styles.referralKpiValue, { color: C.purple }]}>
                  {formatCurrency(stats.paidCommissionTotal ?? 0)}
                </Text>
                <Text style={styles.referralKpiLabel}>Commission Paid</Text>
              </View>
            </View>
          </SectionCard>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <GlobalSearchModal visible={showSearch} onClose={() => setShowSearch(false)} />
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },

  // Greeting
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.primaryLight,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: C.text,
    letterSpacing: -0.5,
  },
  greetingSub: {
    fontSize: 14,
    color: C.textSecondary,
    marginTop: 2,
  },

  // Stat Grid
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCardOuter: {
    width: '47.5%',
  },
  statCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    borderTopWidth: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 3,
    fontWeight: '500',
  },

  // Section card
  sectionCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
    marginBottom: 14,
  },

  // Today's Focus
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  todayMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  todayNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: C.primary,
    letterSpacing: -1,
  },
  todayLabel: {
    fontSize: 15,
    color: C.textSecondary,
    fontWeight: '500',
  },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.errorLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  overdueText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.errorText,
  },
  viewAllBtn: {
    backgroundColor: C.primaryLight,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  viewAllBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.primary,
  },

  // Pipeline
  pipelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  pipelineLabel: {
    width: 100,
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: '500',
  },
  pipelineBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: C.grayLight,
    borderRadius: 5,
    overflow: 'hidden',
    marginRight: 8,
  },
  pipelineBar: {
    height: 10,
    borderRadius: 5,
  },
  pipelineCount: {
    width: 28,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
  },

  // Renewals
  renewalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  renewalRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  renewalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  renewalInfo: {
    flex: 1,
  },
  renewalSchool: {
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
  },
  renewalDate: {
    fontSize: 12,
    color: C.textSecondary,
    marginTop: 2,
  },
  renewalDateUrgent: {
    color: C.error,
    fontWeight: '600',
  },
  renewalValue: {
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
  },

  // Top Referrers
  referrerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  referrerRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  referrerRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  referrerRankText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.primary,
  },
  referrerName: {
    flex: 1,
    fontSize: 14,
    color: C.text,
    fontWeight: '500',
  },
  referrerBadge: {
    backgroundColor: C.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  referrerBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.primary,
  },

  // Referral Program (4-KPI grid)
  referralGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  referralKpi: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: C.bg,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  referralKpiValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  referralKpiLabel: {
    fontSize: 11,
    color: C.textSecondary,
    marginTop: 4,
    fontWeight: '600',
    textAlign: 'center',
  },
  referralKpiSub: {
    fontSize: 10,
    color: C.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },

  bottomSpacer: {
    height: 16,
  },
})
