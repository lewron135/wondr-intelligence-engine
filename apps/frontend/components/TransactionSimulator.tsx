"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  UploadCloud,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Download,
  Zap,
  Trash2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StagedTx {
  date: string;        // "YYYY-MM-DD"
  description: string;
  amount: number;
  type: "DB" | "CR";
  category: string;
}

type Step = "idle" | "parsing" | "staging" | "committing" | "analyzing" | "error";

interface Props {
  userId: string;
  onTransactionPosted: () => void;
  onStagingChange?: (isStaging: boolean) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const CAT_STYLES: Record<string, string> = {
  food_and_beverage:   "bg-orange-50 text-orange-700 border-orange-200",
  groceries:           "bg-green-50 text-green-700 border-green-200",
  shopping:            "bg-purple-50 text-purple-700 border-purple-200",
  transfer_investment: "bg-blue-50 text-blue-700 border-blue-200",
  transport:           "bg-amber-50 text-amber-700 border-amber-200",
  utilities:           "bg-cyan-50 text-cyan-700 border-cyan-200",
  lifestyle:           "bg-pink-50 text-pink-700 border-pink-200",
  healthcare:          "bg-red-50 text-red-700 border-red-200",
  travel:              "bg-indigo-50 text-indigo-700 border-indigo-200",
  uncategorized:       "bg-gray-100 text-gray-500 border-gray-200",
};

const CATEGORIES = [
  "food_and_beverage",
  "groceries",
  "shopping",
  "transfer_investment",
  "transport",
  "utilities",
  "lifestyle",
  "healthcare",
  "travel",
  "uncategorized",
] as const;

// ── CSV export (pure browser — no external dependencies) ──────────────────────

function exportCsv(rows: StagedTx[], filename: string) {
  const header = ["Date", "Description", "Amount", "Type", "Category"];
  const lines = rows.map((r) =>
    [
      r.date,
      `"${r.description.replace(/"/g, '""')}"`,
      r.amount.toFixed(2),
      r.type,
      r.category,
    ].join(",")
  );
  // BOM ensures Excel opens the file with correct UTF-8 encoding
  const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TransactionSimulator({ userId, onTransactionPosted, onStagingChange }: Props) {
  const [step, setStep]                       = useState<Step>("idle");
  const [isDragging, setIsDrag]               = useState(false);
  const [staged, setStaged]                   = useState<StagedTx[]>([]);
  const [errorMsg, setErrorMsg]               = useState("");
  const [importCount, setCount]               = useState(0);
  const [pipelineTriggered, setPipelineFired] = useState(false);
  const fileRef                               = useRef<HTMLInputElement>(null);

  // Notify the parent grid whenever staging mode enters or leaves so the layout can reflow.
  useEffect(() => {
    onStagingChange?.(staged.length > 0);
  }, [staged.length, onStagingChange]);

  // ── Hard Reset — wipes the DB then clears frontend state ─────────────────

  const handleReset = useCallback(async () => {
    try {
      const res = await fetch(`${API}/transactions/reset`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? "Reset failed");
      }
    } catch (err) {
      // Still clear the UI even if the network call fails, but surface the error.
      setErrorMsg(err instanceof Error ? err.message : "Reset failed.");
    }
    setStep("idle");
    setStaged([]);
    setErrorMsg("");
    setPipelineFired(false);
    setCount(0);
    onTransactionPosted(); // refresh dashboard so all metric cards drop to zero
  }, [onTransactionPosted]);

  // ── Step 1 — parse-only (no DB write) ────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(pdf|txt)$/i)) {
      setStep("error");
      setErrorMsg("Please upload a .pdf or .txt BCA mutation file.");
      return;
    }

    setStep("parsing");
    setPipelineFired(false);
    const fd = new FormData();
    fd.append("file", file);
    // No Content-Type header — browser sets multipart/form-data boundary

    try {
      const res  = await fetch(`${API}/transactions/parse-only`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Parse failed");
      if (!data.transactions?.length) {
        setStep("error");
        setErrorMsg(
          "No transactions detected. Check the backend terminal for [WONDR DEBUG] RAW TEXT."
        );
        return;
      }
      setStaged(data.transactions as StagedTx[]);
      setStep("staging");
    } catch (err) {
      setStep("error");
      setErrorMsg(err instanceof Error ? err.message : "Parse failed. Is the backend running?");
    }
  }, []);

  // ── Step 2 — bulk-insert (commit to DB + fire ML) ────────────────────────
  // After success the table stays visible so the user can review what was
  // imported.  The Reset button is how they return to the drop-zone.

  const handleConfirm = useCallback(async () => {
    setStep("committing");
    try {
      const res = await fetch(`${API}/transactions/bulk-insert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, transactions: staged }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Commit failed");
      setCount(data.transactions_imported ?? staged.length);

      // Give the background ML pipeline time to finish before refreshing the
      // dashboard — otherwise insights and recommendations are still empty.
      setStep("analyzing");
      await new Promise<void>((resolve) => setTimeout(resolve, 4000));

      setPipelineFired(true);
      setStep("staging");    // table stays visible for review / CSV export
      onTransactionPosted(); // dashboard now fetches fully-populated ML results
    } catch (err) {
      setStep("error");
      setErrorMsg(err instanceof Error ? err.message : "Commit failed.");
    }
  }, [userId, staged, onTransactionPosted]);

  const updateCategory = useCallback((index: number, category: string) => {
    setStaged((prev) =>
      prev.map((tx, i) => (i === index ? { ...tx, category } : tx))
    );
  }, []);

  // ── Drag & drop ──────────────────────────────────────────────────────────

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDrag(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  // ── Subtitle ─────────────────────────────────────────────────────────────

  const subtitle =
    step === "analyzing"
      ? "ML Engine running · insights generating…"
      : step === "staging" && pipelineTriggered
      ? `${importCount} row${importCount !== 1 ? "s" : ""} committed · ML pipeline complete`
      : step === "staging"
      ? `${staged.length} row${staged.length !== 1 ? "s" : ""} parsed · review before committing`
      : "BCA MutasiBCA · auto-categorized · 2-step validation";

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
          <FileText className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">Import Bank Statement</h2>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>

      {/* ── Drop zone (idle / error) ── */}
      {(step === "idle" || step === "error") && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDrag(true); }}
            onDragLeave={() => setIsDrag(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={[
              "flex flex-col items-center justify-center gap-3",
              "border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all duration-200",
              isDragging
                ? "border-blue-400 bg-blue-50 scale-[1.01]"
                : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/40",
            ].join(" ")}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isDragging ? "bg-blue-100" : "bg-gray-100"
              }`}
            >
              <UploadCloud
                className={`w-6 h-6 transition-colors ${isDragging ? "text-blue-600" : "text-gray-400"}`}
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">
                {isDragging ? "Drop the file here" : "Drag & drop your mutation file"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                or <span className="text-blue-600 font-medium">click to browse</span>
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-500">.pdf</span>
              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-500">.txt</span>
              <span className="text-xs text-gray-400">· MutasiBCA format</span>
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt"
            className="hidden"
            onChange={onFileChange}
          />

          {step === "error" && (
            <div className="mt-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 leading-relaxed">{errorMsg}</p>
            </div>
          )}
        </>
      )}

      {/* ── Spinner (parsing / committing / analyzing) ── */}
      {(step === "parsing" || step === "committing" || step === "analyzing") && (
        <div className="flex flex-col items-center justify-center gap-3 py-10">
          <Loader2
            className={`w-10 h-10 animate-spin ${
              step === "analyzing" ? "text-violet-500" : "text-blue-500"
            }`}
          />
          <p
            className={`text-sm font-medium text-center ${
              step === "analyzing" ? "text-violet-700" : "text-blue-700"
            }`}
          >
            {step === "parsing"
              ? "Parsing bank statement…"
              : step === "committing"
              ? "Saving transactions…"
              : "ML Engine Analyzing…"}
          </p>
          <p className="text-xs text-gray-400 text-center">
            {step === "parsing"
              ? "OCR → TGL normalizer → regex parser"
              : step === "committing"
              ? "Writing to database…"
              : "Isolation Forest → Prophet → Rule Engine"}
          </p>
          {step === "analyzing" && (
            <p className="text-xs text-violet-400 text-center">
              Generating insights and recommendations…
            </p>
          )}
        </div>
      )}

      {/* ── Staging table ── */}
      {step === "staging" && (
        <div>
          {/* Success banner — shown after pipeline is triggered */}
          {pipelineTriggered && (
            <div className="mb-3 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-800 font-medium">
                {importCount} transaction{importCount !== 1 ? "s" : ""} committed · ML pipeline running in background
              </p>
            </div>
          )}

          {/* Scrollable table */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
              <table className="w-full min-w-[620px] text-xs">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500 whitespace-nowrap">Date</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Description</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-500 whitespace-nowrap">Amount</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-500">Type</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {staged.map((tx, i) => (
                    <tr key={i} className="hover:bg-gray-50/60">
                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap font-mono">
                        {tx.date.slice(5).replace("-", "/")}
                      </td>
                      <td className="px-3 py-2 text-gray-700 min-w-[200px] max-w-xs">
                        <span className="block truncate" title={tx.description}>
                          {tx.description}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900 whitespace-nowrap tabular-nums">
                        {tx.amount.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-semibold text-[10px] ${
                            tx.type === "CR"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {tx.type === "CR"
                            ? <TrendingUp className="w-2.5 h-2.5" />
                            : <TrendingDown className="w-2.5 h-2.5" />}
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={tx.category}
                          onChange={(e) => updateCategory(i, e.target.value)}
                          className={`text-[10px] font-medium rounded-full px-2 py-0.5 border cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-300 ${
                            CAT_STYLES[tx.category] ?? CAT_STYLES.uncategorized
                          }`}
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat.replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action bar */}
          <div className="mt-4 flex items-center gap-2">
            {/* Reset — clears table and returns to drop-zone */}
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset
            </button>

            <button
              onClick={() =>
                exportCsv(
                  staged,
                  `wondr_statement_${new Date().toISOString().slice(0, 10)}.csv`
                )
              }
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>

            {/* Confirm — becomes a success indicator after pipeline is fired */}
            {pipelineTriggered ? (
              <button
                disabled
                className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold opacity-90 cursor-default shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Pipeline Triggered!
              </button>
            ) : (
              <button
                onClick={handleConfirm}
                className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-sm"
              >
                <Zap className="w-3.5 h-3.5" />
                Confirm &amp; Run Pipeline
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
