import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp,
  CheckCircle,
  Percent,
  DollarSign,
  Users,
  Award,
  Download,
} from 'lucide-react-native'
import { C } from '@/lib/colors'
import { formatCurrency } from '@/lib/utils'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { exportRowsAsCSV } from '@/lib/export'
import { api } from '@/lib/api'
import type { SalesReport, ReferralReport } from '@lms/shared'

// ─── Pipeline stage colors (same as dashboard) ────────────────────────────────

const STAGE_CONFIG: Record<string, { color: string; label: string }> = {
  NEW:         { color: C.slate, label: 'New' },
  QUALIFIED:   { color: C.primary, label: 'Qualified' },
  DEMO:        { color: C.purple, label: 'Demo' },
  PROPOSAL:    { color: C.warning, label: 'Proposal' },
  NEGOTIATION: { color: C.orange, label: 'Negotiation' },
  CLOSED_WON:  { color: C.success, label: 'Closed Won' },
  CLOSED_LOST: { color: C.error, label: 'Closed Lost' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  color,
  bg,
  icon,
}: {
  label: string
  value: string | number
  color: string
  bg: string
  icon: React.ReactNode
}) {
  return (
    <View style={[styles.kpiCard, { borderTopColor: color }]}>
      <View style={[styles.kpiIconWrap, { backgroundColor: bg }]}>{icon}</View>
      <Text style={[styles.kpiValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  )
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

function Divider() {
  return <View style={styles.divider} />
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ReportsScreen() {
  const {
    data: sales,
    isLoading: salesLoading,
    isError: salesError,
  } = useQuery<SalesReport>({
    queryKey: ['reports', 'sales'],
    queryFn: () => api.get('/sales').then((r) => r.data),
  })

  const {
    data: referrals,
    isLoading: referralsLoading,
    isError: referralsError,
  } = useQuery<ReferralReport>({
    queryKey: ['reports', 'referrals'],
    queryFn: () => api.get('/referrals').then((r) => r.data),
  })

  const isLoading = salesLoading || referralsLoading
  const isError = salesError || referralsError

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingSpinner />
      </SafeAreaView>
    )
  }

  if (isError || (!sales && !referrals)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState
          title="Failed to load reports"
          subtitle="Please try again later"
        />
      </SafeAreaView>
    )
  }

  // ── Sales Pipeline bars ──────────────────────────────────────────────────
  const pipeline = sales?.byStage ?? []
  const maxPipelineCount = pipeline.reduce((m, s) => Math.max(m, s.count), 1)

  // ── Salesperson table ────────────────────────────────────────────────────
  const salespeople = sales?.bySalesperson ?? []

  // ── Top referrers table ──────────────────────────────────────────────────
  const topReferrers = referrals?.topReferrers ?? []

  // ── CSV exports ──────────────────────────────────────────────────────────
  const exportSalesCSV = () => {
    if (!sales) return
    exportRowsAsCSV(
      salespeople.map((sp: any) => ({
        salesperson:    sp.name,
        leads:          sp.leads,
        converted:      sp.converted,
        conversionRate: sp.leads ? Math.round((sp.converted / sp.leads) * 100) + '%' : '0%',
        revenue:        sp.revenue,
      })),
      [
        { key: 'salesperson',    label: 'Salesperson' },
        { key: 'leads',          label: 'Leads' },
        { key: 'converted',      label: 'Converted' },
        { key: 'conversionRate', label: 'Conversion Rate' },
        { key: 'revenue',        label: 'Revenue' },
      ],
      `sales-report-${new Date().toISOString().slice(0, 10)}.csv`,
    )
  }

  const exportReferralsCSV = () => {
    if (!topReferrers.length) return
    exportRowsAsCSV(
      topReferrers.map((r) => ({
        school:         r.schoolName,
        referrals:      r.totalReferrals,
        converted:      r.converted,
        conversionRate: r.conversionRate + '%',
        revenue:        r.totalRevenue,
        commission:     r.totalCommission,
      })),
      [
        { key: 'school',         label: 'School' },
        { key: 'referrals',      label: 'Referrals' },
        { key: 'converted',      label: 'Converted' },
        { key: 'conversionRate', label: 'Conversion Rate' },
        { key: 'revenue',        label: 'Revenue' },
        { key: 'commission',     label: 'Commission' },
      ],
      `referrals-report-${new Date().toISOString().slice(0, 10)}.csv`,
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════════════════════════════════════════════════════════
            SALES SECTION
           ══════════════════════════════════════════════════════════════════ */}
        <View style={styles.reportHeader}>
          <TrendingUp size={18} color={C.primary} />
          <Text style={styles.reportHeaderText}>Sales Overview</Text>
          <Pressable
            style={({ pressed }) => [styles.exportBtn, pressed && styles.exportBtnPressed]}
            onPress={exportSalesCSV}
            disabled={!sales || salespeople.length === 0}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Export CSV"
          >
            <Download size={13} color={C.primary} />
            <Text style={styles.exportBtnText}>Export CSV</Text>
          </Pressable>
        </View>

        {/* Sales KPI Cards (2x2 grid) */}
        {sales && (
          <View style={styles.kpiGrid}>
            <KpiCard
              label="Total Leads"
              value={sales.totalLeads}
              color={C.primary}
              bg={C.primaryLight}
              icon={<TrendingUp size={18} color={C.primary} />}
            />
            <KpiCard
              label="Converted"
              value={sales.convertedLeads}
              color={C.success}
              bg={C.successLight}
              icon={<CheckCircle size={18} color={C.success} />}
            />
            <KpiCard
              label="Conversion Rate"
              value={`${(sales.conversionRate * 100).toFixed(1)}%`}
              color={C.purple}
              bg={C.purpleLight}
              icon={<Percent size={18} color={C.purple} />}
            />
            <KpiCard
              label="Total Revenue"
              value={formatCurrency(sales.totalRevenue)}
              color={C.warning}
              bg={C.warningLight}
              icon={<DollarSign size={18} color={C.warning} />}
            />
          </View>
        )}

        {/* Pipeline Distribution */}
        {pipeline.length > 0 && (
          <SectionCard title="Pipeline Distribution">
            {pipeline.map((item) => {
              const cfg = STAGE_CONFIG[item.stage] ?? {
                color: C.textMuted,
                label: item.stage,
              }
              const pct =
                maxPipelineCount > 0
                  ? Math.max((item.count / maxPipelineCount) * 100, 2)
                  : 0
              return (
                <View key={item.stage} style={styles.barRow}>
                  <Text style={styles.barLabel} numberOfLines={1}>
                    {cfg.label}
                  </Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        {
                          width: `${pct}%`,
                          backgroundColor: cfg.color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barCount, { color: cfg.color }]}>
                    {item.count}
                  </Text>
                </View>
              )
            })}
          </SectionCard>
        )}

        {/* Performance by Salesperson */}
        {salespeople.length > 0 && (
          <SectionCard title="Performance by Salesperson">
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, styles.tableColName, styles.tableHeaderText]}>
                Name
              </Text>
              <Text style={[styles.tableCell, styles.tableColNum, styles.tableHeaderText]}>
                Leads
              </Text>
              <Text style={[styles.tableCell, styles.tableColNum, styles.tableHeaderText]}>
                Won
              </Text>
              <Text style={[styles.tableCell, styles.tableColRevenue, styles.tableHeaderText]}>
                Revenue
              </Text>
            </View>
            <Divider />
            {salespeople.map((sp, i) => (
              <View key={sp.userId}>
                <View style={styles.tableRow}>
                  <View style={[styles.tableColName]}>
                    <View style={styles.spAvatar}>
                      <Text style={styles.spAvatarText}>
                        {sp.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.spName} numberOfLines={1}>
                      {sp.name}
                    </Text>
                  </View>
                  <Text style={[styles.tableCell, styles.tableColNum, styles.tableDataText]}>
                    {sp.leads}
                  </Text>
                  <View style={[styles.tableColNum, styles.alignCenter]}>
                    <View style={styles.convertedBadge}>
                      <Text style={styles.convertedBadgeText}>{sp.converted}</Text>
                    </View>
                  </View>
                  <Text
                    style={[styles.tableCell, styles.tableColRevenue, styles.tableDataText]}
                    numberOfLines={1}
                  >
                    {formatCurrency(sp.revenue)}
                  </Text>
                </View>
                {i < salespeople.length - 1 && <Divider />}
              </View>
            ))}
          </SectionCard>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            REFERRALS SECTION
           ══════════════════════════════════════════════════════════════════ */}
        <View style={[styles.reportHeader, styles.reportHeaderTop]}>
          <Award size={18} color={C.orange} />
          <Text style={[styles.reportHeaderText, { color: C.orange }]}>
            Referral Overview
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.exportBtn,
              { borderColor: C.orange },
              pressed && styles.exportBtnPressed,
            ]}
            onPress={exportReferralsCSV}
            disabled={!topReferrers.length}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Export CSV"
          >
            <Download size={13} color={C.orange} />
            <Text style={[styles.exportBtnText, { color: C.orange }]}>Export CSV</Text>
          </Pressable>
        </View>

        {/* Referral KPI Cards */}
        {referrals && (
          <View style={styles.kpiGrid}>
            <KpiCard
              label="Total Referrals"
              value={referrals.totalReferrals}
              color={C.primary}
              bg={C.primaryLight}
              icon={<Users size={18} color={C.primary} />}
            />
            <KpiCard
              label="Converted"
              value={referrals.converted}
              color={C.success}
              bg={C.successLight}
              icon={<CheckCircle size={18} color={C.success} />}
            />
            <KpiCard
              label="Conversion Rate"
              value={`${(referrals.conversionRate * 100).toFixed(1)}%`}
              color={C.purple}
              bg={C.purpleLight}
              icon={<Percent size={18} color={C.purple} />}
            />
            <KpiCard
              label="Commission Pending"
              value={formatCurrency(referrals.totalCommissionPending)}
              color={C.orange}
              bg={C.orangeLight}
              icon={<DollarSign size={18} color={C.orange} />}
            />
          </View>
        )}

        {/* Top Referring Schools */}
        {topReferrers.length > 0 && (
          <SectionCard title="Top Referring Schools">
            {/* Table header */}
            <View style={styles.tableHeader}>
              <Text
                style={[
                  styles.tableColSchool,
                  styles.tableHeaderText,
                ]}
              >
                School
              </Text>
              <Text
                style={[
                  styles.tableColRefNum,
                  styles.tableHeaderText,
                  styles.alignRight,
                ]}
              >
                Refs
              </Text>
              <Text
                style={[
                  styles.tableColRefNum,
                  styles.tableHeaderText,
                  styles.alignRight,
                ]}
              >
                Conv
              </Text>
              <Text
                style={[
                  styles.tableColRate,
                  styles.tableHeaderText,
                  styles.alignRight,
                ]}
              >
                Rate
              </Text>
              <Text
                style={[
                  styles.tableColComm,
                  styles.tableHeaderText,
                  styles.alignRight,
                ]}
              >
                Comm.
              </Text>
            </View>
            <Divider />
            {topReferrers.map((ref, i) => (
              <View key={ref.schoolId}>
                <View style={styles.tableRow}>
                  <Text
                    style={[styles.tableColSchool, styles.tableDataText]}
                    numberOfLines={1}
                  >
                    {ref.schoolName}
                  </Text>
                  <Text
                    style={[
                      styles.tableColRefNum,
                      styles.tableDataText,
                      styles.alignRight,
                    ]}
                  >
                    {ref.totalReferrals}
                  </Text>
                  <Text
                    style={[
                      styles.tableColRefNum,
                      styles.tableDataText,
                      styles.alignRight,
                      { color: C.success },
                    ]}
                  >
                    {ref.converted}
                  </Text>
                  <Text
                    style={[
                      styles.tableColRate,
                      styles.tableDataText,
                      styles.alignRight,
                    ]}
                  >
                    {(ref.conversionRate * 100).toFixed(0)}%
                  </Text>
                  <Text
                    style={[
                      styles.tableColComm,
                      styles.tableDataText,
                      styles.alignRight,
                      { color: C.warning },
                    ]}
                    numberOfLines={1}
                  >
                    {formatCurrency(ref.totalCommission)}
                  </Text>
                </View>
                {i < topReferrers.length - 1 && <Divider />}
              </View>
            ))}
          </SectionCard>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
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

  // Report section header
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  exportBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: C.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: C.surface,
  },
  exportBtnPressed: {
    opacity: 0.6,
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.primary,
  },
  reportHeaderTop: {
    marginTop: 8,
  },
  reportHeaderText: {
    fontSize: 17,
    fontWeight: '800',
    color: C.primary,
    letterSpacing: -0.3,
  },

  // KPI Grid (2-col)
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  kpiCard: {
    width: '47.5%',
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
  kpiIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  kpiLabel: {
    fontSize: 11,
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
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    marginBottom: 14,
  },

  // Bar chart
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  barLabel: {
    width: 104,
    fontSize: 12,
    color: C.textSecondary,
    fontWeight: '500',
  },
  barTrack: {
    flex: 1,
    height: 10,
    backgroundColor: C.grayLight,
    borderRadius: 5,
    overflow: 'hidden',
    marginRight: 8,
  },
  bar: {
    height: 10,
    borderRadius: 5,
  },
  barCount: {
    width: 28,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
  },

  // Table shared
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  tableCell: {
    fontSize: 13,
  },
  tableDataText: {
    fontSize: 13,
    color: C.text,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
  },

  // Salesperson table columns
  tableColName: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  tableColNum: {
    width: 44,
    textAlign: 'center',
    alignItems: 'center',
  },
  tableColRevenue: {
    width: 76,
    textAlign: 'right',
  },
  alignCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  alignRight: {
    textAlign: 'right',
  },

  spAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  spAvatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.primary,
  },
  spName: {
    flex: 1,
    fontSize: 13,
    color: C.text,
    fontWeight: '500',
  },
  convertedBadge: {
    backgroundColor: C.successLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convertedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.successText,
  },

  // Referral table columns
  tableColSchool: {
    flex: 1,
    fontSize: 13,
    color: C.text,
    fontWeight: '500',
  },
  tableColRefNum: {
    width: 38,
  },
  tableColRate: {
    width: 42,
  },
  tableColComm: {
    width: 68,
  },

  bottomSpacer: {
    height: 16,
  },
})
