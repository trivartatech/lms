import { Document, Page, Text, View, StyleSheet, pdf, Image, Font } from '@react-pdf/renderer'
import type { Quotation } from '@lms/shared'
import { registerPdfFonts } from '@/lib/pdfFonts'
// @ts-ignore – no type declaration for .png assets
import companyLogo from '@/assets/company-logo.png?url'

// ── Company Details ───────────────────────────────────────────────────────────
const CO = {
  name:          'TRIVARTA TECH PRIVATE LIMITED',
  address1:      '1st Floor D.R.M. Hospital Building No.33/2/9/36',
  address2:      'K.S.R.T.C. Depot Road',
  city:          'Chitradurga 577 501',
  phone:         '9743136128, 8660234312',
  email:         'contactus@trivarta.in',
  gstin:         '29AALCT0157H1Z4',
  state:         '29-Karnataka',
  bankName:      'Kotak Mahindra Bank Limited, Chitradurga',
  bankAccount:   '3550472785',
  ifsc:          'KKBK0008242',
  accountHolder: 'TRIVARTA TECH PRIVATE LIMITED',
}
const HSN_SAC  = '998313'
const GST_RATE = 18   // 9% CGST + 9% SGST

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt2 = (v: number) =>
  Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtCur = (v: number) => '₹ ' + fmt2(v)

const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
  'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
const tensW = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
function sub1k(n: number): string {
  if (n < 20) return ones[n]
  if (n < 100) return tensW[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '')
  return ones[Math.floor(n/100)]+' Hundred'+(n%100 ? ' '+sub1k(n%100) : '')
}
function toWords(n: number): string {
  if (!n) return 'Zero'
  const cr=Math.floor(n/1e7), lk=Math.floor((n%1e7)/1e5), th=Math.floor((n%1e5)/1e3), rem=n%1e3
  return [(cr?sub1k(cr)+' Crore':''),(lk?sub1k(lk)+' Lakh':''),(th?sub1k(th)+' Thousand':''),(rem?sub1k(rem):'')]
    .filter(Boolean).join(' ')
}
function amountWords(total: number): string {
  const r = Math.floor(total), p = Math.round((total-r)*100)
  return toWords(r)+' Rupees'+(p?' and '+toWords(p)+' Paise':'')+' Only'
}
function estNo(id: number) {
  return `TTPL/QUT/${new Date().getFullYear().toString().slice(2)}/${String(id).padStart(2,'0')}/${id}`
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page:      { fontFamily:'NotoSans', fontSize:9, color:'#111', padding:'16 20', backgroundColor:'#fff' },
  outer:     { border:'1 solid #666', flex:1 },

  // title
  titleRow:  { borderBottom:'1 solid #666', paddingVertical:4, alignItems:'center', backgroundColor:'#fff' },
  titleText: { fontSize:11, fontFamily:'NotoSansBold', letterSpacing:2 },

  // header
  headerRow: { flexDirection:'row', borderBottom:'1 solid #666', minHeight:72 },
  logoWrap:  { width:100, borderRight:'1 solid #666', alignItems:'center', justifyContent:'center', padding:6 },
  logo:      { width:88, height:44, objectFit:'contain' },
  coInfo:    { flex:1, padding:'6 10' },
  coName:    { fontSize:10, fontFamily:'NotoSansBold', marginBottom:2 },
  coLine:    { fontSize:7.5, color:'#222', lineHeight:1.55 },
  metaBox:   { width:155, borderLeft:'1 solid #666', padding:'6 8' },
  metaRow:   { flexDirection:'row', marginBottom:3 },
  metaLabel: { fontSize:7.5, color:'#555', width:64 },
  metaVal:   { fontSize:7.5, fontFamily:'NotoSansBold', flex:1 },

  // for
  forRow:    { borderBottom:'1 solid #666', padding:'5 10' },
  forLabel:  { fontSize:7.5, fontFamily:'NotoSansBold', color:'#555', textTransform:'uppercase', marginBottom:3 },
  forName:   { fontSize:9.5, fontFamily:'NotoSansBold' },
  forLine:   { fontSize:8, color:'#333', lineHeight:1.5 },

  // table
  tHead:     { flexDirection:'row', backgroundColor:'#f0f0f0', borderBottom:'1 solid #666', paddingVertical:5, paddingHorizontal:6 },
  tRow:      { flexDirection:'row', borderBottom:'0.5 solid #ccc', paddingVertical:5, paddingHorizontal:6, minHeight:30 },
  tTotRow:   { flexDirection:'row', borderTop:'1 solid #666', borderBottom:'1 solid #666', paddingVertical:5, paddingHorizontal:6, backgroundColor:'#f0f0f0' },
  th:        { fontSize:7.5, fontFamily:'NotoSansBold', color:'#333' },
  td:        { fontSize:8.5, color:'#111' },
  tdSm:      { fontSize:7.5, color:'#555', marginTop:2 },
  tdB:       { fontSize:8.5, fontFamily:'NotoSansBold' },

  cNo:    { width:16 },
  cName:  { flex:1 },
  cHsn:   { width:48, textAlign:'center' },
  cQty:   { width:36, textAlign:'center' },
  cUnit:  { width:24, textAlign:'center' },
  cPrice: { width:56, textAlign:'right' },
  cGst:   { width:62, textAlign:'right' },
  cAmt:   { width:56, textAlign:'right' },

  // gst breakdown
  bottomRow: { flexDirection:'row', borderBottom:'1 solid #666' },
  gstWrap:   { flex:1, borderRight:'1 solid #666' },
  gHead:     { flexDirection:'row', backgroundColor:'#f0f0f0', borderBottom:'0.5 solid #666', padding:'4 6' },
  gRow:      { flexDirection:'row', borderBottom:'0.5 solid #ccc', padding:'4 6' },
  gTotRow:   { flexDirection:'row', backgroundColor:'#f0f0f0', borderTop:'1 solid #666', padding:'4 6' },
  gth:       { fontSize:7, fontFamily:'NotoSansBold', color:'#333', textAlign:'center' },
  gtd:       { fontSize:7.5, textAlign:'center' },
  gtdB:      { fontSize:7.5, fontFamily:'NotoSansBold', textAlign:'center' },
  gHsn:      { width:46 },
  gTax:      { width:54, textAlign:'right' },
  gRate:     { width:28, textAlign:'center' },
  gAmt:      { width:38, textAlign:'right' },
  gTotal:    { width:42, textAlign:'right' },

  // words inside gst box
  wordsBox:  { padding:'4 8', borderTop:'0.5 solid #ccc' },
  wordsLbl:  { fontSize:7, fontFamily:'NotoSansBold', color:'#555' },
  wordsTxt:  { fontSize:7.5, fontFamily:'NotoSansBold', marginTop:1 },

  // totals right
  totBox:    { width:175, padding:'5 8' },
  totRow:    { flexDirection:'row', borderBottom:'0.5 solid #ddd', paddingVertical:3 },
  totLbl:    { flex:1, fontSize:8, color:'#555' },
  totColon:  { fontSize:8, color:'#555', marginHorizontal:4 },
  totVal:    { fontSize:8, textAlign:'right', minWidth:64 },
  grandRow:  { flexDirection:'row', paddingVertical:4, borderTop:'1.5 solid #111', marginTop:2 },
  grandLbl:  { flex:1, fontSize:9, fontFamily:'NotoSansBold' },
  grandVal:  { fontSize:9, fontFamily:'NotoSansBold', textAlign:'right', minWidth:64 },

  // terms
  termsRow:  { borderBottom:'1 solid #666', padding:'4 10' },
  termsLbl:  { fontSize:7.5, fontFamily:'NotoSansBold', color:'#555', marginBottom:2 },
  termsTxt:  { fontSize:7.5 },

  // footer
  footRow:   { flexDirection:'row' },
  bankBox:   { flex:1, borderRight:'1 solid #666', padding:'5 10' },
  bankLbl:   { fontSize:7.5, fontFamily:'NotoSansBold', color:'#555', marginBottom:3 },
  bankLine:  { fontSize:7.5, lineHeight:1.6 },
  sigBox:    { width:165, padding:'5 10', alignItems:'flex-end' },
  sigFor:    { fontSize:7.5, fontFamily:'NotoSansBold', marginBottom:36 },
  sigLine:   { borderTop:'1 solid #666', width:110 },
  sigLbl:    { fontSize:7.5, textAlign:'center', marginTop:2 },
})

// ── Document ──────────────────────────────────────────────────────────────────
function QuotationDocument({ quotation }: { quotation: Quotation }) {
  const date = new Date(quotation.createdAt).toLocaleDateString('en-IN', {
    day:'2-digit', month:'2-digit', year:'numeric',
  })

  const entity        = quotation.school ?? quotation.lead ?? null
  const entityName    = quotation.school?.name ?? quotation.lead?.schoolName ?? '—'
  const entityPhone   = entity?.phone ?? ''
  const entityAddress = entity?.location ?? ''

  // ── Combine ALL items into ONE bundle row ──────────────────────────────────
  const totalStudents = quotation.school?.totalStudents ?? quotation.lead?.totalStudents ?? null
  const subtotal      = Number(quotation.subtotal)
  const discount      = Number(quotation.discount)
  const taxTotal      = Number(quotation.tax)
  const taxable       = subtotal - discount

  // Combined bundle name: "ERP + ADDON1 + ADDON2"
  const shortName = (name: string) =>
    name.length > 14 ? name.split(' ').map(w => w[0]).join('').toUpperCase() : name.toUpperCase()

  const bundleName  = quotation.items.map(i => shortName(i.name)).join(' + ')
  const bundleDesc  = quotation.items.map(i => i.name).join(', ')
  // When totalStudents is known: show qty=students, unit=STU, price=taxable/students
  // Otherwise: show qty=1, unit=NOS, price=taxable (lump-sum)
  const unitForPDF   = totalStudents ? 'STU' : 'NOS'
  const qtyForPDF    = totalStudents ?? 1
  const pricePerUnit = totalStudents ? taxable / totalStudents : taxable

  // Always derive GST from taxable amount at GST_RATE — stored tax may be stale if qty changed
  const computedGst = taxable > 0 ? Math.round(taxable * GST_RATE) / 100 : 0
  const gstOnBundle = computedGst
  const amountInc   = taxable + gstOnBundle

  // GST split (9% CGST + 9% SGST)
  const cgstAmt = gstOnBundle / 2
  const sgstAmt = gstOnBundle / 2

  return (
    <Document title={`Quotation #${quotation.id}`} author="Trivarta Tech">
      <Page size="A4" style={S.page}>
        <View style={S.outer}>

          {/* ── Title ── */}
          <View style={S.titleRow}>
            <Text style={S.titleText}>Estimate</Text>
          </View>

          {/* ── Company header ── */}
          <View style={S.headerRow}>
            <View style={S.logoWrap}>
              <Image style={S.logo} src={companyLogo} />
            </View>
            <View style={S.coInfo}>
              <Text style={S.coName}>{CO.name}</Text>
              <Text style={S.coLine}>{CO.address1}</Text>
              <Text style={S.coLine}>{CO.address2}</Text>
              <Text style={S.coLine}>{CO.city}</Text>
              <Text style={S.coLine}>Phone: {CO.phone}     Email: {CO.email}</Text>
              <Text style={S.coLine}>GSTIN: {CO.gstin}     State: {CO.state}</Text>
            </View>
            <View style={S.metaBox}>
              <View style={S.metaRow}>
                <Text style={S.metaLabel}>Estimate No:</Text>
                <Text style={S.metaVal}>{estNo(quotation.id)}</Text>
              </View>
              <View style={S.metaRow}>
                <Text style={S.metaLabel}>Date:</Text>
                <Text style={S.metaVal}>{date}</Text>
              </View>
            </View>
          </View>

          {/* ── Estimate For ── */}
          <View style={S.forRow}>
            <Text style={S.forLabel}>Estimate For:</Text>
            <Text style={S.forName}>{entityName}</Text>
            {entityAddress ? <Text style={S.forLine}>{entityAddress}</Text> : null}
          </View>

          {/* ── Items table header ── */}
          <View style={S.tHead}>
            <Text style={[S.th, S.cNo]}>#</Text>
            <Text style={[S.th, S.cName]}>Item Name</Text>
            <Text style={[S.th, S.cHsn]}>HSN / SAC</Text>
            <Text style={[S.th, S.cQty]}>Quantity</Text>
            <Text style={[S.th, S.cUnit]}>Unit</Text>
            <Text style={[S.th, S.cPrice]}>Price / Unit (₹)</Text>
            <Text style={[S.th, S.cGst]}>GST (₹)</Text>
            <Text style={[S.th, S.cAmt]}>Amount (₹)</Text>
          </View>

          {/* ── ONE combined bundle row ── */}
          <View style={S.tRow}>
            <Text style={[S.td, S.cNo]}>1</Text>
            <View style={S.cName}>
              <Text style={S.td}>{bundleName}</Text>
              <Text style={S.tdSm}>({bundleDesc})</Text>
            </View>
            <Text style={[S.td, S.cHsn]}>{HSN_SAC}</Text>
            <Text style={[S.td, S.cQty]}>{qtyForPDF}</Text>
            <Text style={[S.td, S.cUnit]}>{unitForPDF}</Text>
            <Text style={[S.td, S.cPrice]}>{fmt2(pricePerUnit)}</Text>
            <Text style={[S.td, S.cGst]}>
              {fmt2(gstOnBundle)} ({GST_RATE}.0%)
            </Text>
            <Text style={[S.td, S.cAmt]}>{fmt2(amountInc)}</Text>
          </View>

          {/* ── Total row ── */}
          <View style={S.tTotRow}>
            <Text style={[S.tdB, S.cNo]}></Text>
            <Text style={[S.tdB, S.cName]}>Total</Text>
            <Text style={[S.tdB, S.cHsn]}></Text>
            <Text style={[S.tdB, S.cQty]}>{qtyForPDF}</Text>
            <Text style={[S.tdB, S.cUnit]}></Text>
            <Text style={[S.tdB, S.cPrice]}></Text>
            <Text style={[S.tdB, S.cGst]}>{fmt2(gstOnBundle)}</Text>
            <Text style={[S.tdB, S.cAmt]}>{fmt2(amountInc)}</Text>
          </View>

          {/* ── Totals + Amount in Words ── */}
          <View style={S.bottomRow}>
            {/* Left: Amount in words */}
            <View style={[S.gstWrap, { justifyContent:'flex-end' }]}>
              <View style={S.wordsBox}>
                <Text style={S.wordsLbl}>Estimate Amount In Words</Text>
                <Text style={S.wordsTxt}>{amountWords(amountInc)}</Text>
              </View>
            </View>

            {/* Right: Sub Total / CGST / SGST / Total */}
            <View style={S.totBox}>
              <View style={S.totRow}>
                <Text style={S.totLbl}>Sub Total</Text>
                <Text style={S.totColon}>:</Text>
                <Text style={S.totVal}>{fmtCur(taxable)}</Text>
              </View>
              {discount > 0 && (
                <View style={S.totRow}>
                  <Text style={S.totLbl}>Discount</Text>
                  <Text style={S.totColon}>:</Text>
                  <Text style={[S.totVal, { color:'#c00' }]}>− {fmtCur(discount)}</Text>
                </View>
              )}
              {cgstAmt > 0 && (
                <View style={S.totRow}>
                  <Text style={S.totLbl}>CGST ({GST_RATE/2}%)</Text>
                  <Text style={S.totColon}>:</Text>
                  <Text style={S.totVal}>{fmtCur(cgstAmt)}</Text>
                </View>
              )}
              {sgstAmt > 0 && (
                <View style={S.totRow}>
                  <Text style={S.totLbl}>SGST ({GST_RATE/2}%)</Text>
                  <Text style={S.totColon}>:</Text>
                  <Text style={S.totVal}>{fmtCur(sgstAmt)}</Text>
                </View>
              )}
              <View style={S.grandRow}>
                <Text style={S.grandLbl}>Total</Text>
                <Text style={S.grandVal}>{fmtCur(amountInc)}</Text>
              </View>
            </View>
          </View>

          {/* ── Terms ── */}
          <View style={S.termsRow}>
            <Text style={S.termsLbl}>Terms And Conditions:</Text>
            <Text style={S.termsTxt}>Thank you for doing business with us.</Text>
          </View>

          {/* ── Bank Details + Signature ── */}
          <View style={S.footRow}>
            <View style={S.bankBox}>
              <Text style={S.bankLbl}>Bank Details:</Text>
              <Text style={S.bankLine}>Bank Name: {CO.bankName}</Text>
              <Text style={S.bankLine}>Account No.: {CO.bankAccount}</Text>
              <Text style={S.bankLine}>Bank IFSC Code: {CO.ifsc}</Text>
              <Text style={S.bankLine}>Account Holder's Name: {CO.accountHolder}</Text>
            </View>
            <View style={S.sigBox}>
              <Text style={S.sigFor}>For {CO.name}</Text>
              <View style={S.sigLine}><Text> </Text></View>
              <Text style={S.sigLbl}>Authorized Signatory</Text>
            </View>
          </View>

        </View>
      </Page>
    </Document>
  )
}

export async function downloadQuotationPDF(quotation: Quotation): Promise<void> {
  try { Font.clear?.() } catch {}
  registerPdfFonts()

  const blob = await pdf(<QuotationDocument quotation={quotation} />).toBlob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `quotation-${quotation.id}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function printQuotationPDF(quotation: Quotation): Promise<void> {
  try { Font.clear?.() } catch {}
  registerPdfFonts()

  const blob = await pdf(<QuotationDocument quotation={quotation} />).toBlob()
  const url  = URL.createObjectURL(blob)
  const win  = window.open(url, '_blank')
  if (win) {
    win.addEventListener('load', () => { win.print() })
  }
}
