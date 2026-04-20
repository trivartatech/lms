import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system'
import { Alert } from 'react-native'
import type { Agreement } from '@lms/shared'

/**
 * Mobile Agreement PDF generator.
 *
 * Uses expo-print to render HTML → PDF. The HTML mirrors the layout, sections
 * and wording of packages/web/src/components/agreements/AgreementPDF.tsx so both
 * platforms produce visually equivalent documents.
 */

const PROVIDER_ADDRESS = '1st Floor, D.R.M. Hospital Building, K.S.R.T.C. Depot Road, Chitradurga – 577501'
const PROVIDER_GSTIN   = 'GSTIN: 29AALCT0157H1Z4'
const PROVIDER_STATE   = 'State: Karnataka (Code: 29)'
const PROVIDER_CONTACT = 'Contact: 8660234313 / 9743136128'

function numberToWords(n: number): string {
  if (n === 0) return 'Zero'
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const below100 = (num: number): string => {
    if (num < 20) return ones[num]
    return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + ones[num % 10] : '')
  }
  const below1000 = (num: number): string => {
    if (num < 100) return below100(num)
    return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' ' + below100(num % 100) : '')
  }
  let result = ''
  let m = n
  const crore    = Math.floor(m / 10000000); m %= 10000000
  const lakh     = Math.floor(m / 100000);   m %= 100000
  const thousand = Math.floor(m / 1000);     m %= 1000
  if (crore)    result += below1000(crore)    + ' Crore '
  if (lakh)     result += below100(lakh)      + ' Lakh '
  if (thousand) result += below1000(thousand) + ' Thousand '
  if (m)        result += below1000(m)
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

function inr(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c),
  )
}

function buildHtml(agreement: Agreement): string {
  const value            = Number(agreement.value) || 0
  const declaredStudents = agreement.school?.totalStudents
  // Treat 1 / missing student count as "not declared" — only the per-student rate is filled,
  // every other monetary field renders as a red ______ placeholder.
  const studentsDeclared = declaredStudents != null && declaredStudents > 1
  const effectiveStudents = studentsDeclared ? declaredStudents! : 1
  const rate             = Math.round(value / effectiveStudents)
  const blank            = '<span class="blank">______</span>'
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

  const addonList = addons.length > 0
    ? `<section class="keep">
         <h3>Selected Services</h3>
         <p>The following additional services are included as part of this agreement:</p>
         <ul>${addons.map((sa) => `<li>${esc(sa.addon.description ? `${sa.addon.name} — ${sa.addon.description}` : sa.addon.name)}</li>`).join('')}</ul>
       </section>`
    : ''

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Agreement – ${esc(schoolName)}</title>
<style>
  @page { size: A4; margin: 40px 40px 76px 40px; }
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 10pt; color: #111827; margin: 0; }
  .stripe { display: flex; height: 10px; margin: -4px -4px 0 -4px; }
  .stripe .nav { width: 35%; background: #1c3557; }
  .stripe .sal { flex: 1; background: #d9826a; }
  .hdr { display: flex; justify-content: space-between; align-items: center; padding: 8px 0 6px 0; }
  .hdr .logo { font-size: 20pt; font-weight: 800; color: #1e40af; letter-spacing: 1px; }
  .hdr .addr { text-align: right; font-size: 7.5pt; color: #333; line-height: 1.55; }
  .accent { border-bottom: 2px solid #1e40af; margin-bottom: 8px; }
  h1 { font-size: 14pt; color: #1e40af; text-align: center; margin: 4px 0 2px; }
  h2 { font-size: 11pt; color: #1e40af; margin: 10px 0 4px; }
  h3 { font-size: 10pt; margin: 6px 0 3px; }
  .sub { font-size: 9pt; color: #6b7280; text-align: center; margin-bottom: 6px; }
  .between { font-size: 11pt; font-weight: 700; text-align: center; margin: 6px 0; }
  .party { font-size: 11pt; font-weight: 700; color: #1e40af; margin-bottom: 2px; }
  p { font-size: 10pt; line-height: 1.5; margin: 0 0 4px; }
  ul { margin: 0; padding-left: 18px; }
  li { font-size: 10pt; line-height: 1.4; margin-bottom: 3px; }
  .bluebox { background: #dbeafe; border-left: 3px solid #1e40af; padding: 6px; margin: 4px 0; border-radius: 2px; font-size: 10pt; color: #1e40af; }
  .bluebox.red, .bluebox.red * { color: #dc2626; }
  .blank { color: #dc2626; font-weight: 700; }
  .hr { border-bottom: 1px solid #dbeafe; margin: 6px 0; }
  table.kv { width: 100%; border-collapse: collapse; margin-top: 2px; }
  table.kv td { padding: 4px 0; border-bottom: 1px solid #e5e7eb; font-size: 10pt; }
  table.kv td:first-child { color: #6b7280; width: 55%; }
  table.kv td:last-child { font-weight: 700; }
  .sig { display: flex; gap: 20px; margin-top: 16px; }
  .sig .box { flex: 1; border: 1px solid #1e40af; border-radius: 4px; padding: 10px; }
  .sig .title { font-weight: 700; color: #1e40af; font-size: 10pt; margin-bottom: 6px; }
  .sig .role { color: #6b7280; font-size: 9pt; margin-bottom: 8px; }
  .sig .line { border-bottom: 1px solid #d1d5db; padding-top: 16px; margin-bottom: 2px; }
  .sig .lab { font-size: 8pt; color: #6b7280; margin-bottom: 8px; }
  .keep { page-break-inside: avoid; }
  footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; border-top: 0.75px solid #111; padding: 5px 40px; font-size: 7pt; color: #444; line-height: 1.55; }
</style>
</head>
<body>
  <div class="stripe"><div class="nav"></div><div class="sal"></div></div>
  <div class="hdr">
    <div class="logo">TRIVARTA</div>
    <div class="addr">
      D.R.M. Hospital Building<br/>
      K.S.R.T.C. Depot Road Chitradurga-577501<br/>
      9743136128, 8660234312<br/>
      contactus@trivarta.in<br/>
      trivarta.in
    </div>
  </div>
  <div class="accent"></div>

  <section class="keep">
    <h1>SCHOOL ERP SERVICE AGREEMENT</h1>
    <p class="sub">(Academic Year Technology Partnership Agreement)</p>
    <div class="bluebox">This Agreement is executed on this ${esc(formatDDMonYYYY(agreement.startDate))}</div>
    <div class="hr"></div>
  </section>

  <section class="keep">
    <p class="between">BETWEEN</p>
    <p class="party">TRIVARTA TECH PRIVATE LIMITED</p>
    <p>${esc(PROVIDER_ADDRESS)}</p>
    <p>${esc(PROVIDER_GSTIN)}</p>
    <p>${esc(PROVIDER_STATE)}</p>
    <p>${esc(PROVIDER_CONTACT)}</p>
    <p style="font-weight:700;color:#6b7280;">Hereinafter referred to as the "Service Provider"</p>
    <p class="between">AND</p>
    <p class="party">${esc(schoolName.toUpperCase())}</p>
    <p>Address: ${esc(schoolLocation)}</p>
    <p style="font-weight:700;color:#6b7280;">Hereinafter referred to as the "Institution".</p>
    <div class="hr"></div>
    <p>Both parties, in a spirit of mutual collaboration and shared commitment to improving educational administration, hereby agree to the following terms and conditions governing the provision of School ERP (Enterprise Resource Planning) software and related services.</p>
  </section>

  <section class="keep">
    <h2>1. Scope of Services</h2>
    <p>The Service Provider agrees to provide the Institution with access to the Trivarta School ERP platform, which includes the following core modules:</p>
    <ul>
      <li>Web &amp; Mobile ERP Access — Full-featured web portal and mobile application</li>
      <li>Student Admission &amp; Academic Records — Complete admission workflow and records management</li>
      <li>Attendance Management — Daily attendance tracking for students and staff</li>
      <li>Fees Management &amp; Reports — Fee collection, receipts, and financial reporting</li>
      <li>Examination &amp; Report Card Management — Exam scheduling, marks entry, and report cards</li>
      <li>Parent &amp; Teacher Portals — Dedicated portals for communication and updates</li>
    </ul>
    <p style="margin-top:6px;">The system shall be hosted on secure cloud infrastructure with regular backups, uptime assurance, and technical support. All services are delivered on a Software-as-a-Service (SaaS) model.</p>
  </section>

  ${addonList}

  <section class="keep">
    <h2>2. Student-Based Commercial Structure</h2>
    <p>The pricing model is determined by the total student strength declared by the Institution. All amounts are calculated on a per-student, per-year basis.</p>
    <h3>2.1 Declared Student Strength</h3>
    <div class="bluebox${studentsDeclared ? '' : ' red'}">Total Students: ${studentsDeclared ? String(effectiveStudents) : '______'}</div>
    <h3>2.2 Agreed Rate Per Student Per Year</h3>
    <table class="kv">
      <tr><td>Rate per student per annum</td><td>${inr(rate)} per student</td></tr>
    </table>
    <h3>2.3 Total Contract Value</h3>
    <table class="kv">
      <tr><td>Total Agreement Value</td><td>${studentsDeclared ? inr(value) : blank}</td></tr>
    </table>
    <div class="bluebox${studentsDeclared ? '' : ' red'}">(Rupees ${studentsDeclared ? esc(numberToWords(value)) : '______'} only)</div>
  </section>

  <section class="keep">
    <h3>2.4 Payment Terms</h3>
    <p>The total contract value shall be paid in structured instalments as mutually agreed. The payment schedule is as follows:</p>
    <table class="kv">
      <tr><td>Advance Payment (received)</td><td>${studentsDeclared ? (advance > 0 ? inr(advance) : '₹ —') : blank}</td></tr>
      <tr><td>Remaining Balance</td><td>${studentsDeclared ? inr(remaining) : blank}</td></tr>
      <tr><td>Number of Instalments</td><td>${studentsDeclared ? (totalInstalments > 0 ? String(totalInstalments) : '—') : blank}</td></tr>
      ${studentsDeclared
        ? (totalInstalments > 0 ? `<tr><td>Amount per Instalment</td><td>${inr(instalmentAmt)}</td></tr>` : '')
        : `<tr><td>Amount per Instalment</td><td>${blank}</td></tr>`}
    </table>
    <div class="bluebox${studentsDeclared ? '' : ' red'}" style="margin-top:6px;">
      ${studentsDeclared
        ? (advance > 0
            ? `Advance of ${inr(advance)} received. Remaining ${inr(remaining)} payable in ${totalInstalments > 0 ? `${totalInstalments} instalment${totalInstalments > 1 ? 's' : ''} of ${inr(instalmentAmt)} each` : 'agreed instalments'}.`
            : `Full amount of ${inr(value)} payable in ${totalInstalments > 0 ? `${totalInstalments} instalment${totalInstalments > 1 ? 's' : ''} of ${inr(instalmentAmt)} each` : 'agreed instalments'}.`)
        : 'Payment schedule to be finalised once student strength is declared.'}
    </div>
  </section>

  <section class="keep">
    <h3>Balance Payment — Instalment Schedule</h3>
    <p>The remaining balance of ${studentsDeclared ? inr(remaining) : '______'} shall be collected in ${studentsDeclared ? (totalInstalments > 0 ? `${totalInstalments} equal instalment${totalInstalments > 1 ? 's' : ''}` : 'instalments') : '______ instalments'} as mutually agreed:</p>
    <table class="kv">
      ${instRows.map((i) => `<tr><td>Instalment ${i}</td><td>${studentsDeclared ? `${instalmentAmt > 0 ? inr(instalmentAmt) : '₹________'}  on ________` : `${blank}  on ${blank}`}</td></tr>`).join('')}
    </table>
  </section>

  <section class="keep">
    <h3>2.5 Adjustment for Change in Student Strength</h3>
    <p>In the event of a significant change (more than 10%) in the declared student strength during the agreement period, the total contract value shall be recalculated proportionately based on the actual verified student count. Any additional amount arising from an increase in student strength shall be billed in the subsequent payment cycle. Similarly, a reduction in student strength shall be considered for adjustment only at the time of renewal, not mid-term.</p>
  </section>

  <section class="keep">
    <h2>3. Agreement Duration</h2>
    <div class="bluebox">This Agreement shall remain valid for ${esc(computeDurationText(agreement.startDate, agreement.endDate))} from the date of execution.</div>
    <p>Post the initial term, the agreement shall be eligible for renewal on mutually agreed terms. A renewal notice shall be issued at least 30 days prior to expiry.</p>
  </section>

  <section class="keep">
    <h2>4. Data Privacy &amp; Responsibility</h2>
    <ul>
      <li>All student and institutional data entered into the system remains the exclusive property of the Institution.</li>
      <li>The Service Provider shall not share, sell, or use institutional data for any purpose other than service delivery.</li>
      <li>Data will be stored on secure, encrypted cloud servers with access restricted to authorized personnel only.</li>
      <li>The Institution is responsible for ensuring accuracy of data entered and for maintaining confidentiality of login credentials.</li>
      <li>In the event of service termination, all institutional data will be made available for export within 30 days.</li>
    </ul>
  </section>

  <section class="keep">
    <h2>5. Implementation &amp; Support Framework</h2>
    <ul>
      <li>The Service Provider shall deploy the ERP system within 7–14 working days of agreement execution and advance payment receipt.</li>
      <li>Initial training sessions (online or on-site) shall be provided to administrative staff and teachers at no additional cost.</li>
      <li>Ongoing technical support shall be available via phone, email, and the in-app help desk during business hours (Mon–Sat, 9 AM–6 PM).</li>
      <li>Bug fixes, security patches, and core platform updates shall be included within the service scope at no extra charge.</li>
      <li>Requests for new custom features beyond the agreed scope shall be evaluated separately and quoted accordingly.</li>
    </ul>
  </section>

  <section class="keep">
    <h2>6. Partnership &amp; Good Faith</h2>
    <p>Both parties agree to work in good faith towards the common goal of improving the operational efficiency and academic management of the Institution. The Service Provider commits to continuous improvement of the platform and responsive support, while the Institution commits to timely payment and cooperative engagement during the implementation and support phases.</p>
    <p>Any disputes arising out of or in connection with this Agreement shall first be attempted to be resolved through mutual dialogue. If unresolved within 30 days, the matter shall be referred to arbitration as per the Arbitration and Conciliation Act, 1996, with the venue of arbitration being Chitradurga, Karnataka.</p>
    <p>This Agreement shall be governed by the laws of India, and the courts at Chitradurga, Karnataka shall have exclusive jurisdiction over any legal proceedings.</p>
    <p>This Agreement constitutes the entire understanding between the parties and supersedes all prior communications, representations, or agreements, whether oral or written, relating to the subject matter hereof.</p>
  </section>

  <section class="keep">
    <div class="hr"></div>
    <h2>7. Authorization &amp; Signatures</h2>
    <p>In witness whereof, the parties hereto have executed this Agreement on the date first written above.</p>
    <div class="sig">
      <div class="box">
        <div class="title">For TRIVARTA TECH PRIVATE LIMITED</div>
        <div class="role">Authorized Signatory</div>
        <div class="line"></div><div class="lab">Name</div>
        <div class="line"></div><div class="lab">Signature</div>
        <div class="line"></div><div class="lab">Date</div>
      </div>
      <div class="box">
        <div class="title">For ${esc(schoolName.toUpperCase())}</div>
        <div class="role">Authorized Representative</div>
        <div class="line"></div><div class="lab">Name</div>
        <div class="line"></div><div class="lab">Designation</div>
        <div class="line"></div><div class="lab">Signature</div>
        <div class="line"></div><div class="lab">Date</div>
      </div>
    </div>
  </section>

  <footer>
    CIN: U62013KA2024PTC188843 | TRIVARTA TECH PRIVATE LIMITED<br/>
    D.R.M. Hospital Building K.S.R.T.C. Depot Road Chitradurga, Karnataka 577501.<br/>
    Ph No: 9743136128, 8660234312 | Email: contactus@trivarta.in<br/>
    www.trivarta.in
  </footer>
</body>
</html>`
}

/** Slugify a school name into a safe filename fragment. */
function safeFilename(name: string): string {
  return name
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'agreement'
}

/**
 * Render the agreement HTML to a PDF via expo-print, then share it through the
 * OS share sheet. The generated file is renamed to a human-readable filename
 * (e.g. "Agreement-ABC-School.pdf") so downstream apps show a friendly name.
 * Errors are surfaced to the user with an Alert.
 */
export async function downloadAgreementPDF(agreement: Agreement): Promise<void> {
  try {
    const html = buildHtml(agreement)
    const { uri: tempUri } = await Print.printToFileAsync({ html, base64: false })

    // Rename the temp file so the share-sheet preview and downstream apps see
    // "Agreement-<school>.pdf" instead of the random print-XXXX.pdf name.
    const schoolName  = agreement.school?.name ?? `agreement-${agreement.id}`
    const friendlyName = `Agreement-${safeFilename(schoolName)}.pdf`
    const dir          = tempUri.substring(0, tempUri.lastIndexOf('/') + 1)
    const renamedUri   = `${dir}${friendlyName}`
    try {
      await FileSystem.moveAsync({ from: tempUri, to: renamedUri })
    } catch {
      // If rename fails (rare — file already exists, etc.) fall back to the
      // original temp uri so sharing still works.
    }
    const shareUri = (await FileSystem.getInfoAsync(renamedUri)).exists ? renamedUri : tempUri

    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing unavailable', `PDF saved to ${shareUri}`)
      return
    }
    await Sharing.shareAsync(shareUri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: `Share Agreement – ${schoolName}`,
    })
  } catch (err) {
    console.warn('[agreementPdf] generation failed:', err)
    Alert.alert('PDF failed', 'Could not generate the agreement PDF. Please try again.')
  }
}
