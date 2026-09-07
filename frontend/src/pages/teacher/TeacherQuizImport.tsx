import { useState } from 'react'
import * as XLSX from 'xlsx'
import { importQuizResults } from '../../lib/api'

type Step = 1 | 2 | 3 | 4 | 5

type QuizRow = {
  email: string
  quiz_title: string
  topic: string
  score: number
  completed_at: string
  status: 'valid' | 'invalid'
  error?: string
}

type Props = {
  onDone: () => void
}

const COLUMN_MAP = [
  ['Student Email', 'Student (matched by email)'],
  ['Quiz Name', 'Quiz Title'],
  ['Topic', 'Topic'],
  ['Score', 'Score'],
  ['Date', 'Completed At'],
]

function excelDateToString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 19).replace('T', ' ')
  }

  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)

    if (date) {
      const y = date.y
      const m = String(date.m).padStart(2, '0')
      const d = String(date.d).padStart(2, '0')
      const h = String(date.H || 0).padStart(2, '0')
      const min = String(date.M || 0).padStart(2, '0')
      const s = String(date.S || 0).padStart(2, '0')

      return `${y}-${m}-${d} ${h}:${min}:${s}`
    }
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value)

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 19).replace('T', ' ')
    }

    return value.trim()
  }

  return ''
}

export default function TeacherQuizImport({ onDone }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<QuizRow[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [importResult, setImportResult] = useState<{
    imported: number
    skipped: number
  } | null>(null)

  const validRows = rows.filter((r) => r.status === 'valid')
  const invalidRows = rows.filter((r) => r.status === 'invalid')

  const processFile = async (file: File) => {
    setError('')

    try {
      setFileName(file.name)

      const buffer = await file.arrayBuffer()

      const workbook = XLSX.read(buffer, {
        type: 'array',
        cellDates: true,
      })

      const sheetName = workbook.SheetNames[0]

      if (!sheetName) {
        throw new Error('Excel sheet not found')
      }

      const sheet = workbook.Sheets[sheetName]

      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
      })

      if (!data.length) {
        throw new Error('Excel file is empty')
      }

      const parsedRows: QuizRow[] = data.map((row, index) => {
        const email = String(
          row['Student Email'] ?? row['Email'] ?? ''
        ).trim()

        const quizTitle = String(
          row['Quiz Name'] ?? row['Quiz Title'] ?? ''
        ).trim()

        const topic = String(
          row['Topic'] ?? ''
        ).trim()

        const rawScore = row['Score']

        const score =
          typeof rawScore === 'number'
            ? rawScore
            : Number(String(rawScore).replace(',', '.'))

        const completedAt = excelDateToString(
          row['Date'] ?? row['Completed At']
        )

        const errors: string[] = []

        if (!email) errors.push('Student Email')
        if (!quizTitle) errors.push('Quiz Name')
        if (rawScore === '' || rawScore == null || Number.isNaN(score)) {
          errors.push('Score')
        }

        return {
          email,
          quiz_title: quizTitle,
          topic,
          score,
          completed_at: completedAt,
          status: errors.length ? 'invalid' : 'valid',
          error: errors.length
            ? `Row ${index + 2}: ${errors.join(', ')} are required`
            : undefined,
        }
      })

      setRows(parsedRows)
      setStep(2)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not read Excel file'
      )
    }
  }

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]

    if (file) {
      processFile(file)
    }
  }

  const handleFileDrop = (
    e: React.DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault()

    const file = e.dataTransfer.files?.[0]

    if (file) {
      processFile(file)
    }
  }

  const handleImport = async () => {
    if (!validRows.length) return

    setImporting(true)
    setError('')

    try {
      const response = await importQuizResults({
        file_name: fileName,
        results: validRows.map((row) => ({
          email: row.email,
          quiz_title: row.quiz_title,
          topic: row.topic || undefined,
          score: row.score,
          completed_at: row.completed_at || undefined,
        })),
      })

      console.log('Quiz import response:', response)

      // The backend is the source of truth for what actually landed in the
      // database — rows can still be skipped server-side (e.g. the email
      // doesn't match a student in one of this teacher's groups) even
      // though they passed the frontend's own validation above. Previously
      // this screen just showed validRows.length regardless of what the
      // server actually did, so a fully-skipped import still looked like
      // a success.
      const imported = response?.data?.imported ?? 0
      const skipped = response?.data?.skipped ?? validRows.length - imported

      setImportResult({ imported, skipped })

      if (imported === 0) {
        setError(
          'No rows could be imported. This usually means the student email in the file doesn\'t match an existing student account, or the student isn\'t in one of your groups. Double-check the emails and try again.'
        )
        return
      }

      setDone(true)
    } catch (err) {
      console.error(err)

      setError(
        err instanceof Error
          ? err.message
          : 'Quiz import failed'
      )
    } finally {
      setImporting(false)
    }
  }

  const STEPS = [
    'Upload File',
    'Map Columns',
    'Validate',
    'Preview',
    'Confirm',
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">

      <div className="mb-6">
        <h1
          className="text-2xl font-semibold"
          style={{ fontFamily: 'Outfit, sans-serif' }}
        >
          Quiz Results Import
        </h1>

        <p
          className="text-sm mt-0.5"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Import quiz results from an external platform
          (Excel / CSV)
        </p>
      </div>

      {/* STEPPER */}

      <div className="flex items-center mb-8">
        {STEPS.map((label, i) => {
          const n = (i + 1) as Step
          const active = step === n
          const completed = step > n

          return (
            <div
              key={label}
              className="flex items-center flex-1 last:flex-none"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                  style={{
                    background: completed
                      ? '#16A34A'
                      : active
                        ? 'var(--primary)'
                        : 'var(--secondary)',
                    color:
                      completed || active
                        ? 'white'
                        : 'var(--muted-foreground)',
                  }}
                >
                  {completed ? '✓' : n}
                </div>

                <span
                  className="text-sm font-medium whitespace-nowrap hidden sm:block"
                  style={{
                    color: active
                      ? 'var(--foreground)'
                      : 'var(--muted-foreground)',
                  }}
                >
                  {label}
                </span>
              </div>

              {i < STEPS.length - 1 && (
                <div
                  className="flex-1 h-px mx-3"
                  style={{
                    background:
                      step > n
                        ? '#16A34A'
                        : 'var(--border)',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      <div
        className="rounded-xl p-6"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >

        {/* STEP 1 */}

        {step === 1 && (
          <div>
            <h2
              className="text-base font-semibold mb-4"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              Upload Excel File
            </h2>

            <div
              className="border-2 border-dashed rounded-xl p-12 text-center"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--muted)',
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
            >
              <p className="text-3xl mb-3">📊</p>

              <p className="text-sm font-medium mb-1">
                Drop your Excel file here
              </p>

              <p
                className="text-xs mb-4"
                style={{
                  color: 'var(--muted-foreground)',
                }}
              >
                Supports .xlsx, .xls, .csv files
              </p>

              <label
                className="inline-block px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer"
                style={{
                  background: 'var(--primary)',
                  color: 'white',
                }}
              >
                Browse File

                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            </div>

            <div
              className="mt-4 p-3 rounded-lg text-xs"
              style={{
                background: '#EFF6FF',
                color: '#1E40AF',
              }}
            >
              <strong>Expected columns:</strong>{' '}
              Student Email, Quiz Name, Topic, Score, Date
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-600">
                {error}
              </p>
            )}
          </div>
        )}

        {/* STEP 2 */}

        {step === 2 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-base font-semibold"
                style={{ fontFamily: 'Outfit, sans-serif' }}
              >
                Map Columns
              </h2>

              <span
                className="text-xs mono"
                style={{
                  color: 'var(--muted-foreground)',
                }}
              >
                {fileName}
              </span>
            </div>

            <div
              className="rounded-xl overflow-hidden"
              style={{
                border: '1px solid var(--border)',
              }}
            >
              <table className="w-full">
                <thead>
                  <tr
                    style={{
                      borderBottom:
                        '1px solid var(--border)',
                      background: 'var(--muted)',
                    }}
                  >
                    <th className="px-4 py-3 text-left text-xs">
                      Excel Column
                    </th>

                    <th className="px-4 py-3 text-left text-xs">
                      →
                    </th>

                    <th className="px-4 py-3 text-left text-xs">
                      Platform Field
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {COLUMN_MAP.map(([excel, platform], i) => (
                    <tr
                      key={excel}
                      style={{
                        borderBottom:
                          i < COLUMN_MAP.length - 1
                            ? '1px solid var(--border)'
                            : 'none',
                      }}
                    >
                      <td className="px-4 py-3.5 text-sm mono font-medium">
                        {excel}
                      </td>

                      <td className="px-4 py-3.5 text-sm">
                        →
                      </td>

                      <td className="px-4 py-3.5 text-sm">
                        {platform}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-lg text-sm"
              >
                Back
              </button>

              <button
                onClick={() => setStep(3)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background: 'var(--primary)',
                  color: 'white',
                }}
              >
                Validate →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 */}

        {step === 3 && (
          <div>
            <h2
              className="text-base font-semibold mb-4"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              Validation Results
            </h2>

            <div className="grid grid-cols-3 gap-3 mb-5">

              <div className="rounded-lg p-3 text-center bg-gray-50">
                <p className="text-xl font-semibold">
                  {rows.length}
                </p>
                <p className="text-xs">
                  Total Rows
                </p>
              </div>

              <div className="rounded-lg p-3 text-center bg-green-50">
                <p className="text-xl font-semibold text-green-700">
                  {validRows.length}
                </p>
                <p className="text-xs">
                  Ready
                </p>
              </div>

              <div className="rounded-lg p-3 text-center bg-red-50">
                <p className="text-xl font-semibold text-red-700">
                  {invalidRows.length}
                </p>
                <p className="text-xs">
                  Invalid
                </p>
              </div>

            </div>

            {invalidRows.map((row, i) => (
              <div
                key={i}
                className="rounded-lg px-4 py-3 mb-2 text-sm"
                style={{
                  background: '#FEE2E2',
                  color: '#B91C1C',
                }}
              >
                {row.error}
              </div>
            ))}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-lg text-sm"
              >
                Back
              </button>

              <button
                disabled={!validRows.length}
                onClick={() => setStep(4)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background: 'var(--primary)',
                  color: 'white',
                  opacity: validRows.length ? 1 : 0.5,
                }}
              >
                Preview {validRows.length} valid rows →
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 */}

        {step === 4 && (
          <div>
            <h2
              className="text-base font-semibold mb-4"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              Preview — {validRows.length} rows to import
            </h2>

            <div
              className="rounded-xl overflow-hidden mb-5"
              style={{
                border: '1px solid var(--border)',
              }}
            >
              <table className="w-full">
                <thead>
                  <tr
                    style={{
                      background: 'var(--muted)',
                    }}
                  >
                    {[
                      'Email',
                      'Quiz',
                      'Topic',
                      'Score',
                      'Date',
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {validRows.map((row, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 text-xs mono">
                        {row.email}
                      </td>

                      <td className="px-4 py-3 text-sm">
                        {row.quiz_title}
                      </td>

                      <td className="px-4 py-3 text-sm">
                        {row.topic || '-'}
                      </td>

                      <td className="px-4 py-3 text-sm mono">
                        {row.score}
                      </td>

                      <td className="px-4 py-3 text-xs mono">
                        {row.completed_at || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2.5 rounded-lg text-sm"
              >
                Back
              </button>

              <button
                onClick={() => setStep(5)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background: 'var(--primary)',
                  color: 'white',
                }}
              >
                Confirm Import →
              </button>
            </div>
          </div>
        )}

        {/* STEP 5 */}

        {step === 5 && !done && (
          <div className="text-center py-6">
            <p className="text-3xl mb-4">
              📊
            </p>

            <h2 className="text-base font-semibold mb-2">
              Ready to import
            </h2>

            <p className="text-sm mb-2">
              <strong className="text-green-700">
                {validRows.length} valid results
              </strong>{' '}
              will be imported.
            </p>

            <p className="text-sm mb-8 text-gray-500">
              {invalidRows.length} invalid rows will be skipped.
            </p>

            {error && (
              <p className="text-sm text-red-600 mb-4 max-w-md mx-auto">
                {error}
              </p>
            )}

            <div className="flex gap-3 justify-center">

              <button
                onClick={() => setStep(4)}
                className="px-6 py-2.5 rounded-lg text-sm"
              >
                Back
              </button>

              <button
                onClick={handleImport}
                disabled={importing}
                className="px-8 py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background: '#16A34A',
                  color: 'white',
                  opacity: importing ? 0.7 : 1,
                }}
              >
                {importing
                  ? 'Importing…'
                  : `Confirm Import (${validRows.length} rows)`}
              </button>

            </div>
          </div>
        )}

        {/* DONE */}

        {done && (
          <div className="text-center py-8">

            <div className="text-5xl mb-4">
              ✓
            </div>

            <h2
              className="text-xl font-semibold mb-2"
              style={{ color: '#15803D' }}
            >
              Import complete
            </h2>

            <p className="text-sm mb-6">
              {importResult?.imported ?? validRows.length} quiz results successfully
              imported into Lexicon.
              {!!importResult?.skipped && (
                <>
                  {' '}
                  <span className="text-amber-700">
                    ({importResult.skipped} row{importResult.skipped === 1 ? '' : 's'} skipped —
                    email/group mismatch.)
                  </span>
                </>
              )}
            </p>

            <button
              onClick={onDone}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold"
              style={{
                background: 'var(--primary)',
                color: 'white',
              }}
            >
              View Quiz Results →
            </button>

          </div>
        )}

      </div>
    </div>
  )
}