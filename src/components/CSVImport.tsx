import { useState, useRef } from 'react'
import { parseCSV, type ImportDiagnostics } from '../utils/csvParser'
import type { Contact, ImportMode } from '../types'

interface Props {
  onImport: (contacts: Contact[], mode: ImportMode) => void
  onClose: () => void
}

export default function CSVImport({ onImport, onClose }: Props) {
  const [preview, setPreview] = useState<Contact[] | null>(null)
  const [diagnostics, setDiagnostics] = useState<ImportDiagnostics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<ImportMode>('append')
  const [showDiag, setShowDiag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setPreview(null)
    setDiagnostics(null)
    setShowDiag(false)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const { contacts, diagnostics: diag } = parseCSV(ev.target?.result as string)
        setDiagnostics(diag)

        if (diag.papaParseErrors?.length > 0 && contacts.length === 0) {
          setError(`CSV could not be parsed. PapaParse reported ${diag.papaParseErrors.length} error(s). See details below.`)
          setShowDiag(true)
          return
        }

        if (contacts.length === 0) {
          setError('No valid contacts found. Every row was missing both Full Name and Relationship.')
          setShowDiag(true)
          return
        }

        setPreview(contacts)
        if (diag.missingHeaders.length > 0 || diag.rowErrors.length > 0) {
          setShowDiag(true)
        }
      } catch (err) {
        setError(`Unexpected error: ${(err as Error).message}`)
      }
    }
    reader.onerror = () => setError('Could not read the file. Make sure it is a valid CSV.')
    reader.readAsText(file)
  }

  function handleImport() {
    if (!preview) return
    onImport(preview, mode)
    onClose()
  }

  const hasWarnings = diagnostics && (
    diagnostics.missingHeaders.length > 0 ||
    diagnostics.rowErrors.length > 0 ||
    diagnostics.papaParseErrors?.length > 0
  )

  return (
    <div className="fixed inset-0 bg-stone-dark/40 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200">
          <h2 className="text-lg font-semibold text-stone-dark">Import CSV</h2>
          <button onClick={onClose} className="btn-ghost text-stone-warm text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-stone-warm">
            Upload a CSV exported from your Google Sheet. Column headers must match exactly.
          </p>

          <div
            className="border-2 border-dashed border-cream-300 rounded-xl p-8 text-center cursor-pointer hover:border-sage-300 hover:bg-sage-50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <div className="text-3xl mb-2">📄</div>
            <p className="text-sm font-medium text-stone-dark">Click to select a CSV file</p>
            <p className="text-xs text-stone-warm mt-1">or drag and drop</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 space-y-1">
              <p className="font-medium">Import failed</p>
              <p>{error}</p>
            </div>
          )}

          {preview && (
            <div className="space-y-3">
              <div className={`border rounded-lg px-4 py-3 ${hasWarnings ? 'bg-amber-50 border-amber-200' : 'bg-sage-50 border-sage-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${hasWarnings ? 'text-amber-700' : 'text-sage-600'}`}>
                      {preview.length} contacts ready to import
                      {diagnostics && diagnostics.skipped > 0 && ` (${diagnostics.skipped} rows skipped)`}
                    </p>
                    <p className="text-xs text-stone-warm mt-0.5">
                      {preview.slice(0, 3).map(c => c.fullName).filter(Boolean).join(', ')}
                      {preview.length > 3 ? ` and ${preview.length - 3} more…` : ''}
                    </p>
                  </div>
                  {hasWarnings && (
                    <button
                      className="text-xs text-amber-600 underline underline-offset-2 ml-3 shrink-0"
                      onClick={() => setShowDiag(d => !d)}
                    >
                      {showDiag ? 'Hide' : 'Show'} warnings
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="label">Import Mode</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="mode" value="append" checked={mode === 'append'} onChange={() => setMode('append')} className="accent-sage-500" />
                    <span className="text-sm text-stone-dark">Append — add new contacts, keep existing</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="mode" value="replace" checked={mode === 'replace'} onChange={() => setMode('replace')} className="accent-sage-500" />
                    <span className="text-sm text-stone-dark">Replace all — overwrite everything with this file</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {diagnostics && showDiag && (
            <DiagnosticsPanel diagnostics={diagnostics} />
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-cream-200">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!preview}
            onClick={handleImport}
          >
            Import {preview ? `${preview.length} Contacts` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

function DiagnosticsPanel({ diagnostics: d }: { diagnostics: ImportDiagnostics }) {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 space-y-3 text-xs font-mono">
      <p className="font-sans font-semibold text-stone-dark text-sm">Import Diagnostics</p>

      <div className="space-y-0.5 text-stone-warm">
        <p>Total CSV rows: {d.totalRows}</p>
        <p>Imported: {d.imported}</p>
        <p>Skipped (blank name+relationship): {d.skipped}</p>
        {d.skippedRows.length > 0 && (
          <p className="text-stone-light">Skipped row numbers: {d.skippedRows.join(', ')}</p>
        )}
      </div>

      {d.missingHeaders.length > 0 && (
        <div>
          <p className="text-amber-700 font-sans font-medium">Missing expected columns ({d.missingHeaders.length}):</p>
          <ul className="mt-1 space-y-0.5 text-amber-600">
            {d.missingHeaders.map(h => <li key={h}>• {h}</li>)}
          </ul>
          <p className="text-stone-warm font-sans mt-1">These fields will be blank for all imported contacts.</p>
        </div>
      )}

      {d.unmappedHeaders.length > 0 && (
        <div>
          <p className="text-stone-warm font-sans font-medium">Unrecognized columns (ignored):</p>
          <ul className="mt-1 space-y-0.5 text-stone-light">
            {d.unmappedHeaders.map(h => <li key={h}>• {h}</li>)}
          </ul>
        </div>
      )}

      {d.rowErrors.length > 0 && (
        <div>
          <p className="text-red-600 font-sans font-medium">Row-level errors ({d.rowErrors.length}):</p>
          <ul className="mt-1 space-y-1">
            {d.rowErrors.map((e, i) => (
              <li key={i} className="text-red-500">
                Row {e.row}, col "{e.col}": {e.error} (value: "{e.val}")
              </li>
            ))}
          </ul>
        </div>
      )}

      {d.papaParseErrors?.length > 0 && (
        <div>
          <p className="text-red-600 font-sans font-medium">CSV parse errors ({d.papaParseErrors.length}):</p>
          <ul className="mt-1 space-y-1">
            {d.papaParseErrors.map((e, i) => (
              <li key={i} className="text-red-500">
                Row {e.row}: {e.code} — {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {d.papaParseMeta && (
        <div className="text-stone-light border-t border-stone-200 pt-2">
          <p>Delimiter detected: "{d.papaParseMeta.delimiter}"</p>
          <p>Line ending: {d.papaParseMeta.linebreak === '\r\n' ? 'CRLF' : d.papaParseMeta.linebreak === '\n' ? 'LF' : 'CR'}</p>
          <p>Columns detected: {d.papaParseMeta.fields?.length ?? '?'}</p>
        </div>
      )}
    </div>
  )
}
