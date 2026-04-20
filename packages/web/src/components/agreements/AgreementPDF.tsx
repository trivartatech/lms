import { Document, Page, Text, View, StyleSheet, pdf, Image, Font } from '@react-pdf/renderer'
import type { Agreement } from '@lms/shared'
import { registerPdfFonts } from '@/lib/pdfFonts'
// @ts-ignore
import trivartaLogo from '../../assets/trivarta-logo.png'

// ─── Colours ─────────────────────────────────────────────────────────────────
const BLUE       = '#1e40af'
const LIGHT_BLUE = '#dbeafe'
const GREY       = '#6b7280'
const DARK       = '#111827'
const RED        = '#dc2626'
const LH_NAVY    = '#1c3557'
const LH_SALMON  = '#d9826a'

const PROVIDER_ADDRESS = '1st Floor, D.R.M. Hospital Building, K.S.R.T.C. Depot Road, Chitradurga – 577501'
const PROVIDER_GSTIN   = 'GSTIN: 29AALCT0157H1Z4'
const PROVIDER_STATE   = 'State: Karnataka (Code: 29)'
const PROVIDER_CONTACT = 'Contact: 8660234313 / 9743136128'

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Page — paddingTop:0 because the fixed Header is first in flow and
  // react-pdf reserves its height on every page automatically.
  page: {
    fontFamily: 'NotoSans',
    fontSize: 10,
    color: DARK,
    paddingTop: 0,
    paddingBottom: 76,       // reserved for footer
    paddingHorizontal: 40,
  },

  // ── Letterhead header ────────────────────────────────────────────
  headerStripe: {
    flexDirection: 'row',
    height: 10,
    marginHorizontal: -40,
  },
  headerStripeNav:    { width: '35%', backgroundColor: LH_NAVY },
  headerStripeSalmon: { flex: 1,      backgroundColor: LH_SALMON },
  headerBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
  },
  headerLogo:    { width: 115, height: 46, objectFit: 'contain' },
  headerAddr:    { alignItems: 'flex-end' },
  headerAddrTxt: { fontSize: 7.5, color: '#333', lineHeight: 1.55 },
  headerDivider: { borderBottomWidth: 0.5, borderBottomColor: '#aaa', marginBottom: 0 },
  headerAccent:  { borderBottomWidth: 2, borderBottomColor: BLUE, marginBottom: 8 },

  // ── Watermark ────────────────────────────────────────────────────
  watermark: {
    position: 'absolute',
    top: '30%',
    left: 50,
    right: 50,
    alignItems: 'center',
    opacity: 0.05,
  },
  watermarkImg: { width: 320, height: 128 },

  // ── Footer ───────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 40,
    paddingBottom: 8,
    paddingTop: 5,
    borderTopWidth: 0.75,
    borderTopColor: '#111',
  },
  footerText:    { fontSize: 7, color: '#444', textAlign: 'center', lineHeight: 1.55 },
  footerWebsite: { fontSize: 7, color: '#444', textAlign: 'center', marginTop: 1 },

  // ── Typography ───────────────────────────────────────────────────
  docTitle:    { fontSize: 14, fontFamily: 'NotoSansBold', color: BLUE, textAlign: 'center', marginTop: 4, marginBottom: 2 },
  docSubtitle: { fontSize: 9,  color: GREY, textAlign: 'center', marginBottom: 6 },
  body:        { fontSize: 10, marginBottom: 4, lineHeight: 1.5 },
  between:     { fontSize: 11, fontFamily: 'NotoSansBold', color: DARK, textAlign: 'center', marginVertical: 6 },
  partyName:   { fontSize: 11, fontFamily: 'NotoSansBold', color: BLUE, marginBottom: 2 },
  italic:      { fontStyle: 'italic', color: GREY },

  sectionTitle:    { fontSize: 11, fontFamily: 'NotoSansBold', color: BLUE, marginTop: 10, marginBottom: 4 },
  subSectionTitle: { fontSize: 10, fontFamily: 'NotoSansBold', color: DARK, marginTop: 6,  marginBottom: 3 },

  // ── Bullet list ──────────────────────────────────────────────────
  bulletRow:  { flexDirection: 'row', marginBottom: 3, paddingLeft: 8 },
  bullet:     { width: 12, fontSize: 10 },
  bulletText: { flex: 1, fontSize: 10, lineHeight: 1.4 },

  // ── Table rows ───────────────────────────────────────────────────
  tableRow:   { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingVertical: 4 },
  tableLabel: { width: '55%', fontSize: 10, color: GREY },
  tableValue: { width: '45%', fontSize: 10, fontFamily: 'NotoSansBold' },

  // ── Dividers ─────────────────────────────────────────────────────
  hr:     { borderBottomWidth: 1, borderBottomColor: LIGHT_BLUE, marginVertical: 6 },

  // ── Highlight box ────────────────────────────────────────────────
  blueBox:     { backgroundColor: LIGHT_BLUE, borderLeftWidth: 3, borderLeftColor: BLUE, padding: 6, marginVertical: 4, borderRadius: 2 },
  blueBoxText: { fontSize: 10, color: BLUE },

  // ── Signature blocks ─────────────────────────────────────────────
  sigRow:       { flexDirection: 'row', marginTop: 16, gap: 20 },
  sigBox:       { flex: 1, borderWidth: 1, borderColor: BLUE, borderRadius: 4, padding: 10 },
  sigTitle:     { fontSize: 10, fontFamily: 'NotoSansBold', color: BLUE, marginBottom: 6 },
  sigRole:      { fontSize: 9,  color: GREY, marginBottom: 8 },
  sigLine:      { borderBottomWidth: 1, borderBottomColor: '#d1d5db', marginBottom: 10, paddingTop: 16 },
  sigFieldLabel:{ fontSize: 8,  color: GREY },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function numberToWords(n: number): string {
  if (n === 0) return 'Zero'
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function below100(num: number): string {
    if (num < 20) return ones[num]
    return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '')
  }
  function below1000(num: number): string {
    if (num < 100) return below100(num)
    return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' ' + below100(num % 100) : '')
  }
  let result = ''
  let m = n
  const crore   = Math.floor(m / 10000000); m %= 10000000
  const lakh    = Math.floor(m / 100000);   m %= 100000
  const thousand= Math.floor(m / 1000);     m %= 1000
  if (crore)   result += below1000(crore)   + ' Crore '
  if (lakh)    result += below100(lakh)     + ' Lakh '
  if (thousand)result += below1000(thousand)+ ' Thousand '
  if (m)       result += below1000(m)
  return result.trim()
}

function formatDDMonYYYY(dateStr: string): string {
  const d = new Date(dateStr)
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  return `${d.getDate()} day of ${months[d.getMonth()]} ${d.getFullYear()}`
}

function computeDurationText(startDate: string, endDate: string): string {
  const months = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  const years  = Math.round(months / 12)
  const numWords: Record<number, string> = { 1:'one', 2:'two', 3:'three', 4:'four', 5:'five', 6:'six', 7:'seven', 8:'eight', 9:'nine', 10:'ten' }
  if (months % 12 === 0 && years >= 1 && years <= 10) {
    const yW = numWords[years] ?? String(years)
    return `${yW} Academic Year${years > 1 ? 's' : ''} (${months} Months)`
  }
  return `${numWords[months] ?? String(months)} Month${months !== 1 ? 's' : ''}`
}

// ─── Shared repeated components ───────────────────────────────────────────────

function Header() {
  return (
    <View fixed>
      <View style={s.headerStripe}>
        <View style={s.headerStripeNav} />
        <View style={s.headerStripeSalmon} />
      </View>
      <View style={s.headerBody}>
        <Image src={trivartaLogo} style={s.headerLogo} />
        <View style={s.headerAddr}>
          <Text style={s.headerAddrTxt}>D.R.M. Hospital Building</Text>
          <Text style={s.headerAddrTxt}>K.S.R.T.C. Depot Road Chitradurga-577501</Text>
          <Text style={s.headerAddrTxt}>9743136128, 8660234312</Text>
          <Text style={s.headerAddrTxt}>contactus@trivarta.in</Text>
          <Text style={s.headerAddrTxt}>trivarta.in</Text>
        </View>
      </View>
      <View style={s.headerDivider} />
      <View style={s.headerAccent} />
    </View>
  )
}

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>CIN: U62013KA2024PTC188843 | TRIVARTA TECH PRIVATE LIMITED</Text>
      <Text style={s.footerText}>D.R.M. Hospital Building K.S.R.T.C. Depot Road Chitradurga, Karnataka 577501.</Text>
      <Text style={s.footerText}>Ph No: 9743136128, 8660234312 | Email: contactus@trivarta.in</Text>
      <Text style={s.footerWebsite}>www.trivarta.in</Text>
    </View>
  )
}

function Watermark() {
  return (
    <View style={s.watermark} fixed>
      <Image src={trivartaLogo} style={s.watermarkImg} />
    </View>
  )
}

function BulletItem({ text }: { text: string }) {
  return (
    <View style={s.bulletRow}>
      <Text style={s.bullet}>•</Text>
      <Text style={s.bulletText}>{text}</Text>
    </View>
  )
}

// ─── Main Document ─────────────────────────────────────────────────────────────
// Single <Page> — react-pdf auto-paginates. Every logical section is wrapped in
// wrap={false} so it never gets split across a page break.

function AgreementDocument({ agreement }: { agreement: Agreement }) {
  const value            = Number(agreement.value) || 0
  const declaredStudents = agreement.school?.totalStudents
  // Treat 1 / missing student count as "not declared" — only the per-student rate is filled,
  // every other monetary field renders as a red ______ placeholder.
  const studentsDeclared = declaredStudents != null && declaredStudents > 1
  const effectiveStudents = studentsDeclared ? declaredStudents! : 1
  const rate             = Math.round(value / effectiveStudents)
  const advance          = Number(agreement.advancePayment) || 0
  const totalInstalments = agreement.totalInstalments || 0
  const remaining        = Math.max(0, value - advance)
  const instalmentAmt    = totalInstalments > 0 ? Math.round(remaining / totalInstalments) : 0
  const instRows         = totalInstalments > 0
    ? Array.from({ length: totalInstalments }, (_, i) => i + 1)
    : [1, 2, 3]
  const schoolName     = agreement.school?.name ?? `School #${agreement.schoolId}`
  const schoolLocation = agreement.school?.location ?? '________'
  const addons         = agreement.school?.schoolAddons ?? []

  return (
    <Document
      title={`Agreement – ${schoolName}`}
      author="Trivarta Tech Private Limited"
      subject="School ERP Service Agreement"
    >
      <Page size="A4" style={s.page}>
        {/* Watermark — absolutely positioned, repeats on all pages */}
        <Watermark />

        {/* Header — flows at top, repeats on all pages */}
        <Header />

        {/* Footer — absolutely positioned at bottom, repeats on all pages */}
        <Footer />

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* TITLE BLOCK                                                        */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <View wrap={false}>
          <Text style={s.docTitle}>SCHOOL ERP SERVICE AGREEMENT</Text>
          <Text style={s.docSubtitle}>(Academic Year Technology Partnership Agreement)</Text>

          <View style={s.blueBox}>
            <Text style={s.blueBoxText}>
              This Agreement is executed on this {formatDDMonYYYY(agreement.startDate)}
            </Text>
          </View>

          <View style={s.hr} />
        </View>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* PARTIES                                                            */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <View wrap={false}>
          <Text style={s.between}>BETWEEN</Text>

          <Text style={s.partyName}>TRIVARTA TECH PRIVATE LIMITED</Text>
          <Text style={s.body}>{PROVIDER_ADDRESS}</Text>
          <Text style={s.body}>{PROVIDER_GSTIN}</Text>
          <Text style={s.body}>{PROVIDER_STATE}</Text>
          <Text style={s.body}>{PROVIDER_CONTACT}</Text>
          <Text style={[s.body, { fontFamily: 'NotoSansBold', color: GREY, marginTop: 2 }]}>
            Hereinafter referred to as the "Service Provider"
          </Text>

          <Text style={s.between}>AND</Text>

          <Text style={s.partyName}>{schoolName.toUpperCase()}</Text>
          <Text style={s.body}>Address: {schoolLocation}</Text>
          <Text style={[s.body, { fontFamily: 'NotoSansBold', color: GREY, marginTop: 2 }]}>
            Hereinafter referred to as the "Institution".
          </Text>

          <View style={s.hr} />

          <Text style={s.body}>
            Both parties, in a spirit of mutual collaboration and shared commitment to improving
            educational administration, hereby agree to the following terms and conditions governing
            the provision of School ERP (Enterprise Resource Planning) software and related services.
          </Text>
        </View>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* SECTION 1 — SCOPE OF SERVICES                                     */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <View wrap={false}>
          <Text style={s.sectionTitle}>1. Scope of Services</Text>
          <Text style={s.body}>
            The Service Provider agrees to provide the Institution with access to the Trivarta School
            ERP platform, which includes the following core modules:
          </Text>
          <BulletItem text="Web & Mobile ERP Access — Full-featured web portal and mobile application" />
          <BulletItem text="Student Admission & Academic Records — Complete admission workflow and records management" />
          <BulletItem text="Attendance Management — Daily attendance tracking for students and staff" />
          <BulletItem text="Fees Management & Reports — Fee collection, receipts, and financial reporting" />
          <BulletItem text="Examination & Report Card Management — Exam scheduling, marks entry, and report cards" />
          <BulletItem text="Parent & Teacher Portals — Dedicated portals for communication and updates" />
          <Text style={[s.body, { marginTop: 6 }]}>
            The system shall be hosted on secure cloud infrastructure with regular backups, uptime
            assurance, and technical support. All services are delivered on a Software-as-a-Service
            (SaaS) model.
          </Text>
        </View>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* SELECTED SERVICES (add-ons) — only if the school has any          */}
        {/* ────────────────────────────────────────────────────────────────── */}
        {addons.length > 0 && (
          <View wrap={false}>
            <Text style={s.sectionTitle}>Selected Services</Text>
            <Text style={s.body}>
              The following additional services are included as part of this agreement:
            </Text>
            {addons.map((sa, i) => (
              <BulletItem
                key={i}
                text={sa.addon.description
                  ? `${sa.addon.name} — ${sa.addon.description}`
                  : sa.addon.name}
              />
            ))}
          </View>
        )}

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* SECTION 2 — COMMERCIAL STRUCTURE (header + 2.1–2.3)              */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <View wrap={false}>
          <Text style={s.sectionTitle}>2. Student-Based Commercial Structure</Text>
          <Text style={s.body}>
            The pricing model is determined by the total student strength declared by the Institution.
            All amounts are calculated on a per-student, per-year basis.
          </Text>

          {/* 2.1 */}
          <Text style={s.subSectionTitle}>2.1 Declared Student Strength</Text>
          <View style={s.blueBox}>
            <Text style={[s.blueBoxText, !studentsDeclared && { color: RED }]}>
              Total Students: {studentsDeclared ? String(effectiveStudents) : '______'}
            </Text>
          </View>

          {/* 2.2 */}
          <Text style={s.subSectionTitle}>2.2 Agreed Rate Per Student Per Year</Text>
          <View style={s.tableRow}>
            <Text style={s.tableLabel}>Rate per student per annum</Text>
            <Text style={s.tableValue}>₹{rate.toLocaleString('en-IN')} per student</Text>
          </View>

          {/* 2.3 */}
          <Text style={s.subSectionTitle}>2.3 Total Contract Value</Text>
          <View style={s.tableRow}>
            <Text style={s.tableLabel}>Total Agreement Value</Text>
            <Text style={[s.tableValue, !studentsDeclared && { color: RED }]}>
              {studentsDeclared ? `₹${value.toLocaleString('en-IN')}` : '______'}
            </Text>
          </View>
          <View style={s.blueBox}>
            <Text style={[s.blueBoxText, !studentsDeclared && { color: RED }]}>
              (Rupees {studentsDeclared ? numberToWords(value) : '______'} only)
            </Text>
          </View>
        </View>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* SECTION 2.4 — PAYMENT TERMS                                       */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <View wrap={false}>
          <Text style={s.subSectionTitle}>2.4 Payment Terms</Text>
          <Text style={s.body}>
            The total contract value shall be paid in structured instalments as mutually agreed.
            The payment schedule is as follows:
          </Text>

          <View style={s.tableRow}>
            <Text style={s.tableLabel}>Advance Payment (received)</Text>
            <Text style={[s.tableValue, !studentsDeclared && { color: RED }]}>
              {studentsDeclared
                ? (advance > 0 ? `₹${advance.toLocaleString('en-IN')}` : '₹ —')
                : '______'}
            </Text>
          </View>
          <View style={s.tableRow}>
            <Text style={s.tableLabel}>Remaining Balance</Text>
            <Text style={[s.tableValue, !studentsDeclared && { color: RED }]}>
              {studentsDeclared ? `₹${remaining.toLocaleString('en-IN')}` : '______'}
            </Text>
          </View>
          <View style={s.tableRow}>
            <Text style={s.tableLabel}>Number of Instalments</Text>
            <Text style={[s.tableValue, !studentsDeclared && { color: RED }]}>
              {studentsDeclared ? (totalInstalments > 0 ? String(totalInstalments) : '—') : '______'}
            </Text>
          </View>
          {studentsDeclared && totalInstalments > 0 && (
            <View style={s.tableRow}>
              <Text style={s.tableLabel}>Amount per Instalment</Text>
              <Text style={s.tableValue}>₹{instalmentAmt.toLocaleString('en-IN')}</Text>
            </View>
          )}
          {!studentsDeclared && (
            <View style={s.tableRow}>
              <Text style={s.tableLabel}>Amount per Instalment</Text>
              <Text style={[s.tableValue, { color: RED }]}>______</Text>
            </View>
          )}
          <View style={[s.blueBox, { marginTop: 6 }]}>
            <Text style={[s.blueBoxText, !studentsDeclared && { color: RED }]}>
              {studentsDeclared
                ? (advance > 0
                    ? `Advance of ₹${advance.toLocaleString('en-IN')} received. Remaining ₹${remaining.toLocaleString('en-IN')} payable in ${totalInstalments > 0 ? `${totalInstalments} instalment${totalInstalments > 1 ? 's' : ''} of ₹${instalmentAmt.toLocaleString('en-IN')} each` : 'agreed instalments'}.`
                    : `Full amount of ₹${value.toLocaleString('en-IN')} payable in ${totalInstalments > 0 ? `${totalInstalments} instalment${totalInstalments > 1 ? 's' : ''} of ₹${instalmentAmt.toLocaleString('en-IN')} each` : 'agreed instalments'}.`)
                : 'Payment schedule to be finalised once student strength is declared.'
              }
            </Text>
          </View>
        </View>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* INSTALMENT SCHEDULE                                                */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <View wrap={false}>
          <Text style={s.subSectionTitle}>Balance Payment — Instalment Schedule</Text>
          <Text style={s.body}>
            The remaining balance of {studentsDeclared ? `₹${remaining.toLocaleString('en-IN')}` : '______'} shall be collected in{' '}
            {studentsDeclared
              ? (totalInstalments > 0
                  ? `${totalInstalments} equal instalment${totalInstalments > 1 ? 's' : ''}`
                  : 'instalments')
              : '______ instalments'} as mutually agreed:
          </Text>
          {instRows.map((i) => (
            <View key={i} style={s.tableRow}>
              <Text style={s.tableLabel}>Instalment {i}</Text>
              {studentsDeclared ? (
                <Text style={s.tableValue}>
                  {instalmentAmt > 0 ? `₹${instalmentAmt.toLocaleString('en-IN')}` : '₹________'}
                  {'  '}on ________
                </Text>
              ) : (
                <Text style={[s.tableValue, { color: RED }]}>
                  ______  on ______
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* 2.5 — ADJUSTMENT FOR STUDENT STRENGTH                             */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <View wrap={false}>
          <Text style={s.subSectionTitle}>2.5 Adjustment for Change in Student Strength</Text>
          <Text style={s.body}>
            In the event of a significant change (more than 10%) in the declared student strength
            during the agreement period, the total contract value shall be recalculated
            proportionately based on the actual verified student count. Any additional amount arising
            from an increase in student strength shall be billed in the subsequent payment cycle.
            Similarly, a reduction in student strength shall be considered for adjustment only at the
            time of renewal, not mid-term.
          </Text>
        </View>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* SECTION 3 — AGREEMENT DURATION                                    */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <View wrap={false}>
          <Text style={s.sectionTitle}>3. Agreement Duration</Text>
          <View style={s.blueBox}>
            <Text style={s.blueBoxText}>
              This Agreement shall remain valid for{' '}
              {computeDurationText(agreement.startDate, agreement.endDate)}{' '}
              from the date of execution.
            </Text>
          </View>
          <Text style={s.body}>
            Post the initial term, the agreement shall be eligible for renewal on mutually agreed
            terms. A renewal notice shall be issued at least 30 days prior to expiry.
          </Text>
        </View>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* SECTION 4 — DATA PRIVACY                                          */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <View wrap={false}>
          <Text style={s.sectionTitle}>4. Data Privacy &amp; Responsibility</Text>
          <BulletItem text="All student and institutional data entered into the system remains the exclusive property of the Institution." />
          <BulletItem text="The Service Provider shall not share, sell, or use institutional data for any purpose other than service delivery." />
          <BulletItem text="Data will be stored on secure, encrypted cloud servers with access restricted to authorized personnel only." />
          <BulletItem text="The Institution is responsible for ensuring accuracy of data entered and for maintaining confidentiality of login credentials." />
          <BulletItem text="In the event of service termination, all institutional data will be made available for export within 30 days." />
        </View>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* SECTION 5 — IMPLEMENTATION & SUPPORT                              */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <View wrap={false}>
          <Text style={s.sectionTitle}>5. Implementation &amp; Support Framework</Text>
          <BulletItem text="The Service Provider shall deploy the ERP system within 7–14 working days of agreement execution and advance payment receipt." />
          <BulletItem text="Initial training sessions (online or on-site) shall be provided to administrative staff and teachers at no additional cost." />
          <BulletItem text="Ongoing technical support shall be available via phone, email, and the in-app help desk during business hours (Mon–Sat, 9 AM–6 PM)." />
          <BulletItem text="Bug fixes, security patches, and core platform updates shall be included within the service scope at no extra charge." />
          <BulletItem text="Requests for new custom features beyond the agreed scope shall be evaluated separately and quoted accordingly." />
        </View>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* SECTION 6 — PARTNERSHIP & GOOD FAITH                              */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <View wrap={false}>
          <Text style={s.sectionTitle}>6. Partnership &amp; Good Faith</Text>
          <Text style={s.body}>
            Both parties agree to work in good faith towards the common goal of improving the
            operational efficiency and academic management of the Institution. The Service Provider
            commits to continuous improvement of the platform and responsive support, while the
            Institution commits to timely payment and cooperative engagement during the
            implementation and support phases.
          </Text>
          <Text style={s.body}>
            Any disputes arising out of or in connection with this Agreement shall first be
            attempted to be resolved through mutual dialogue. If unresolved within 30 days, the
            matter shall be referred to arbitration as per the Arbitration and Conciliation Act,
            1996, with the venue of arbitration being Chitradurga, Karnataka.
          </Text>
          <Text style={s.body}>
            This Agreement shall be governed by the laws of India, and the courts at Chitradurga,
            Karnataka shall have exclusive jurisdiction over any legal proceedings.
          </Text>
          <Text style={s.body}>
            This Agreement constitutes the entire understanding between the parties and supersedes
            all prior communications, representations, or agreements, whether oral or written,
            relating to the subject matter hereof.
          </Text>
        </View>

        {/* ────────────────────────────────────────────────────────────────── */}
        {/* SECTION 7 — AUTHORIZATION & SIGNATURES                            */}
        {/* Kept together; react-pdf pushes to a fresh page if needed.        */}
        {/* ────────────────────────────────────────────────────────────────── */}
        <View wrap={false}>
          <View style={s.hr} />
          <Text style={s.sectionTitle}>7. Authorization &amp; Signatures</Text>
          <Text style={s.body}>
            In witness whereof, the parties hereto have executed this Agreement on the date first
            written above.
          </Text>

          <View style={s.sigRow}>
            {/* Provider */}
            <View style={s.sigBox}>
              <Text style={s.sigTitle}>For TRIVARTA TECH PRIVATE LIMITED</Text>
              <Text style={s.sigRole}>Authorized Signatory</Text>
              <View style={s.sigLine} /><Text style={s.sigFieldLabel}>Name</Text>
              <View style={s.sigLine} /><Text style={s.sigFieldLabel}>Signature</Text>
              <View style={s.sigLine} /><Text style={s.sigFieldLabel}>Date</Text>
            </View>

            {/* Institution */}
            <View style={s.sigBox}>
              <Text style={s.sigTitle}>For {schoolName.toUpperCase()}</Text>
              <Text style={s.sigRole}>Authorized Representative</Text>
              <View style={s.sigLine} /><Text style={s.sigFieldLabel}>Name</Text>
              <View style={s.sigLine} /><Text style={s.sigFieldLabel}>Designation</Text>
              <View style={s.sigLine} /><Text style={s.sigFieldLabel}>Signature</Text>
              <View style={s.sigLine} /><Text style={s.sigFieldLabel}>Date</Text>
            </View>
          </View>
        </View>

      </Page>
    </Document>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export async function downloadAgreementPDF(agreement: Agreement): Promise<void> {
  console.log('[AgreementPDF] BUILD-MARKER-2026-04-19-V5 starting…')
  // Clear any stale Font singleton state (survives HMR), then re-register fresh.
  try { Font.clear?.(); console.log('[AgreementPDF] Font.clear() ok') }
  catch (e) { console.warn('[AgreementPDF] Font.clear failed:', e) }
  registerPdfFonts()
  console.log('[AgreementPDF] registered families:', (Font as any).getRegisteredFontFamilies?.())

  // Pre-fetch the font files as bytes to verify they're served as binary
  try {
    const [r1, r2] = await Promise.all([
      fetch('/fonts/NotoSans.ttf').then((r) => r.arrayBuffer()),
      fetch('/fonts/NotoSans-Bold.ttf').then((r) => r.arrayBuffer()),
    ])
    const toHex = (b: ArrayBuffer) =>
      Array.from(new Uint8Array(b).slice(0, 8))
        .map((x) => x.toString(16).padStart(2, '0'))
        .join(' ')
    console.log('[AgreementPDF] NotoSans bytes:', r1.byteLength, 'magic:', toHex(r1))
    console.log('[AgreementPDF] NotoSansBold bytes:', r2.byteLength, 'magic:', toHex(r2))
  } catch (e) {
    console.error('[AgreementPDF] font GET failed:', e)
  }

  const blob = await pdf(<AgreementDocument agreement={agreement} />).toBlob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `agreement-${agreement.school?.name ?? agreement.id}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
