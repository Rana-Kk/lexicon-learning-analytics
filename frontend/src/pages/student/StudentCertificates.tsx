import { useEffect, useState } from 'react'
import jsPDF from 'jspdf'
import { getCertificates } from '../../lib/api'
import type { Certificate } from '../../types'

export default function StudentCertificates() {
  const [certificates, setCertificates] =
    useState<Certificate[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getCertificates()

        setCertificates(
          Array.isArray(res?.data)
            ? res.data
            : []
        )
      } catch (err: any) {
        setError(
          err?.message ||
            'Failed to load certificates'
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const loadLogo = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()

      img.onload = () => {
        const canvas =
          document.createElement('canvas')

        canvas.width = img.width
        canvas.height = img.height

        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(
            new Error('Could not create canvas')
          )
          return
        }

        ctx.drawImage(
          img,
          0,
          0,
          img.width,
          img.height
        )

        resolve(
          canvas.toDataURL('image/png')
        )
      }

      img.onerror = () => {
        reject(
          new Error('Could not load Lexicon logo')
        )
      }

      img.src = '/lexicon-logo.png'
    })
  }

  const createCertificatePdf = async (
    cert: Certificate
  ) => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    })

    const width = 297
    const height = 210

    const studentName =
      cert.studentName || 'Student'

    const courseName =
      cert.name || 'Course'

    const issueDate = cert.issueDate
      ? new Date(
          cert.issueDate
        ).toLocaleDateString('en-GB')
      : new Date().toLocaleDateString('en-GB')

    /*
     * Background
     */
    doc.setFillColor(250, 250, 250)
    doc.rect(
      0,
      0,
      width,
      height,
      'F'
    )

    /*
     * Outer frame
     */
    doc.setDrawColor(40, 40, 40)
    doc.setLineWidth(1.2)

    doc.rect(
      12,
      12,
      width - 24,
      height - 24
    )

    doc.setLineWidth(0.35)

    doc.rect(
      18,
      18,
      width - 36,
      height - 36
    )

    /*
     * Logo
     */
    try {
      const logo = await loadLogo()

      doc.addImage(
        logo,
        'PNG',
        width / 2 - 22,
        27,
        44,
        20
      )
    } catch {
      /*
       * Fallback if logo cannot be loaded.
       */
      doc.setFont(
        'helvetica',
        'bold'
      )

      doc.setFontSize(24)

      doc.text(
        'LEXICON',
        width / 2,
        42,
        { align: 'center' }
      )
    }

    /*
     * Certificate title
     */
    doc.setFont(
      'helvetica',
      'bold'
    )

    doc.setFontSize(12)

    doc.text(
      'CERTIFICATE OF ACHIEVEMENT',
      width / 2,
      60,
      { align: 'center' }
    )

    /*
     * Intro
     */
    doc.setFont(
      'helvetica',
      'normal'
    )

    doc.setFontSize(13)

    doc.text(
      'This certificate is proudly presented to',
      width / 2,
      82,
      { align: 'center' }
    )

    /*
     * Student
     */
    doc.setFont(
      'helvetica',
      'bold'
    )

    doc.setFontSize(26)

    doc.text(
      studentName,
      width / 2,
      101,
      { align: 'center' }
    )

    /*
     * Completion text
     */
    doc.setFont(
      'helvetica',
      'normal'
    )

    doc.setFontSize(13)

    doc.text(
      'for successfully completing',
      width / 2,
      119,
      { align: 'center' }
    )

    /*
     * Course
     */
    doc.setFont(
      'helvetica',
      'bold'
    )

    doc.setFontSize(20)

    doc.text(
      courseName,
      width / 2,
      136,
      { align: 'center' }
    )

    /*
     * Issuer
     */
    doc.setFont(
      'helvetica',
      'normal'
    )

    doc.setFontSize(11)

    doc.text(
      'Lexicon',
      width / 2,
      148,
      { align: 'center' }
    )

    /*
     * Bottom information
     */
    doc.setFontSize(10)

    doc.text(
      `Issue Date: ${issueDate}`,
      45,
      175
    )

    if (cert.certificateCode) {
      doc.text(
        `Certificate ID: ${cert.certificateCode}`,
        45,
        185
      )
    }

    /*
     * Signature area
     */
    doc.line(
      207,
      176,
      258,
      176
    )

    doc.text(
      'Lexicon',
      232.5,
      185,
      { align: 'center' }
    )

    /*
     * Save
     */
    const safeStudent =
      studentName.replace(
        /[^a-z0-9-_ ]/gi,
        ''
      )

    const safeCourse =
      courseName.replace(
        /[^a-z0-9-_ ]/gi,
        ''
      )

    doc.save(
      `${safeStudent}-${safeCourse}-Certificate.pdf`
    )
  }

  const viewCertificate = async (
    cert: Certificate
  ) => {
    /*
     * Create PDF in a new blob window.
     * This lets the student VIEW the certificate
     * instead of immediately downloading it.
     */
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    })

    const width = 297
    const height = 210

    const studentName =
      cert.studentName || 'Student'

    const courseName =
      cert.name || 'Course'

    const issueDate = cert.issueDate
      ? new Date(
          cert.issueDate
        ).toLocaleDateString('en-GB')
      : new Date().toLocaleDateString('en-GB')

    doc.setFillColor(250, 250, 250)
    doc.rect(
      0,
      0,
      width,
      height,
      'F'
    )

    doc.setDrawColor(40, 40, 40)
    doc.setLineWidth(1.2)
    doc.rect(
      12,
      12,
      width - 24,
      height - 24
    )

    doc.setLineWidth(0.35)
    doc.rect(
      18,
      18,
      width - 36,
      height - 36
    )

    try {
      const logo = await loadLogo()

      doc.addImage(
        logo,
        'PNG',
        width / 2 - 22,
        27,
        44,
        20
      )
    } catch {
      doc.setFont(
        'helvetica',
        'bold'
      )

      doc.setFontSize(24)

      doc.text(
        'LEXICON',
        width / 2,
        42,
        { align: 'center' }
      )
    }

    doc.setFont(
      'helvetica',
      'bold'
    )

    doc.setFontSize(12)

    doc.text(
      'CERTIFICATE OF ACHIEVEMENT',
      width / 2,
      60,
      { align: 'center' }
    )

    doc.setFont(
      'helvetica',
      'normal'
    )

    doc.setFontSize(13)

    doc.text(
      'This certificate is proudly presented to',
      width / 2,
      82,
      { align: 'center' }
    )

    doc.setFont(
      'helvetica',
      'bold'
    )

    doc.setFontSize(26)

    doc.text(
      studentName,
      width / 2,
      101,
      { align: 'center' }
    )

    doc.setFont(
      'helvetica',
      'normal'
    )

    doc.setFontSize(13)

    doc.text(
      'for successfully completing',
      width / 2,
      119,
      { align: 'center' }
    )

    doc.setFont(
      'helvetica',
      'bold'
    )

    doc.setFontSize(20)

    doc.text(
      courseName,
      width / 2,
      136,
      { align: 'center' }
    )

    doc.setFont(
      'helvetica',
      'normal'
    )

    doc.setFontSize(11)

    doc.text(
      'Lexicon',
      width / 2,
      148,
      { align: 'center' }
    )

    doc.setFontSize(10)

    doc.text(
      `Issue Date: ${issueDate}`,
      45,
      175
    )

    if (cert.certificateCode) {
      doc.text(
        `Certificate ID: ${cert.certificateCode}`,
        45,
        185
      )
    }

    doc.line(
      207,
      176,
      258,
      176
    )

    doc.text(
      'Lexicon',
      232.5,
      185,
      { align: 'center' }
    )

    const blob =
      doc.output('blob')

    const url =
      URL.createObjectURL(blob)

    window.open(
      url,
      '_blank',
      'noopener,noreferrer'
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        Loading certificates...
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1
          className="text-2xl font-semibold"
          style={{
            fontFamily:
              'Outfit, sans-serif',
          }}
        >
          My Certificates
        </h1>

        <p
          className="text-sm mt-1"
          style={{
            color:
              'var(--muted-foreground)',
          }}
        >
          Certificates issued to you by
          your instructors.
        </p>
      </div>

      {error && (
        <div
          className="mb-5 p-3 rounded-lg text-sm"
          style={{
            background: '#FEE2E2',
            color: '#B91C1C',
          }}
        >
          {error}
        </div>
      )}

      {certificates.length === 0 ? (
        <div
          className="rounded-xl p-10 text-center"
          style={{
            background: 'var(--card)',
            border:
              '1px solid var(--border)',
          }}
        >
          <p className="font-medium">
            No certificates available.
          </p>

          <p
            className="text-sm mt-1"
            style={{
              color:
                'var(--muted-foreground)',
            }}
          >
            Certificates issued by your
            teacher will appear here.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="rounded-xl p-5"
              style={{
                background:
                  'var(--card)',
                border:
                  '1px solid var(--border)',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p
                    className="text-xs uppercase tracking-wider font-semibold"
                    style={{
                      color:
                        'var(--muted-foreground)',
                    }}
                  >
                    Lexicon Certificate
                  </p>

                  <h2 className="text-lg font-semibold mt-1">
                    {cert.name}
                  </h2>

                  <p
                    className="text-sm mt-1"
                    style={{
                      color:
                        'var(--muted-foreground)',
                    }}
                  >
                    {cert.issuingOrganization ||
                      'Lexicon'}
                  </p>
                </div>

                <div className="text-2xl">
                  🏆
                </div>
              </div>

              <div
                className="mt-4 pt-4 text-sm"
                style={{
                  borderTop:
                    '1px solid var(--border)',
                }}
              >
                <div className="flex justify-between">
                  <span
                    style={{
                      color:
                        'var(--muted-foreground)',
                    }}
                  >
                    Issue Date
                  </span>

                  <span>
                    {cert.issueDate || '—'}
                  </span>
                </div>

                {cert.certificateCode && (
                  <div className="flex justify-between mt-2">
                    <span
                      style={{
                        color:
                          'var(--muted-foreground)',
                      }}
                    >
                      Certificate ID
                    </span>

                    <span className="mono text-xs">
                      {cert.certificateCode}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={() =>
                    viewCertificate(cert)
                  }
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold"
                  style={{
                    background:
                      'var(--primary)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  View Certificate
                </button>

                <button
                  onClick={() =>
                    createCertificatePdf(cert)
                  }
                  className="px-4 py-2 rounded-lg text-sm font-semibold"
                  style={{
                    border:
                      '1px solid var(--border)',
                    background:
                      'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Download PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}