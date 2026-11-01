import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useToast } from "./ToastSystem.jsx";

const REPORT_REASONS = [
  { id: "inappropriate", label: "Inappropriate or offensive content", desc: "Violates safety standards, offensive, or discriminatory output" },
  { id: "unsafe", label: "Unsafe commands or code", desc: "Hazardous terminal instructions, security risks, or destructive actions" },
  { id: "incorrect", label: "Factually incorrect or misleading", desc: "False facts, hallucinated commands, or invalid code guidance" },
  { id: "other", label: "Other quality or safety issue", desc: "General quality, unexpected behavior, or policy concerns" }
];

export function FlagIcon({ size = 12, className = "" }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
    <line x1="4" y1="22" x2="4" y2="15"/>
  </svg>;
}

export default function ReportAiDialog({ open, onOpenChange, message = null, onReported }) {
  const [reason, setReason] = React.useState("inappropriate");
  const [details, setDetails] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const toastApi = useToast();

  const handleClose = () => {
    if (submitting) return;
    onOpenChange?.(false);
    setDetails("");
    setReason("inappropriate");
  };

  const handleSubmit = async (event) => {
    event?.preventDefault();
    setSubmitting(true);

    const messageText = typeof message?.text === "string" ? message.text : "";
    const modelName = message?.model?.label || message?.model?.family || "Assistant";
    const selectedReason = REPORT_REASONS.find(item => item.id === reason)?.label || reason;
    const timestamp = new Date().toISOString();

    const subject = `[AI Report] ${selectedReason} (${modelName})`;
    const bodyText = `Reason: ${selectedReason}\n` +
      `Model: ${modelName}\n` +
      `Message ID: ${message?.id || "N/A"}\n\n` +
      `Details:\n${details || "None provided"}\n\n` +
      `--- Reported Content ---\n${messageText.slice(0, 1000)}`;

    const payload = {
      _subject: subject,
      reason: selectedReason,
      model: modelName,
      messageId: message?.id || "N/A",
      userContext: details || "No additional comments",
      reportedContentPreview: messageText.slice(0, 1500),
      app: "OUTARCH Windows",
      timestamp
    };

    // 1. Open in default browser via Gmail Web Compose
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=outarch54@gmail.com&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

    const openUrl = async (url) => {
      if (typeof window !== "undefined") {
        if (window.missionControl?.openExternal) {
          try { await window.missionControl.openExternal(url); return true; } catch {}
        }
        if (window.groundstation?.openExternal) {
          try { await window.groundstation.openExternal(url); return true; } catch {}
        }
        try { window.open(url, "_blank"); return true; } catch {}
      }
      return false;
    };

    await openUrl(gmailUrl);

    // 2. Background automated dispatch as additional assurance
    try {
      void fetch("https://formsubmit.co/ajax/outarch54@gmail.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      });
    } catch {
      // Ignored
    }

    // 3. Persist in local storage for auditing
    try {
      const existing = JSON.parse(localStorage.getItem("outarch_ai_reports") || "[]");
      existing.unshift({ id: message?.id || timestamp, ...payload });
      localStorage.setItem("outarch_ai_reports", JSON.stringify(existing.slice(0, 50)));
    } catch {
      // Ignored
    }

    if (toastApi?.toast?.success) {
      toastApi.toast.success("Opening browser email compose. Thank you for reporting.", { title: "AI Content Reported" });
    }

    onReported?.(message?.id);
    setSubmitting(false);
    handleClose();
  };

  return <Dialog.Root open={open} onOpenChange={value => { if (!value) handleClose(); else onOpenChange?.(true); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="palette-backdrop ai-report-backdrop"/>
      <Dialog.Content className="ai-report-dialog" aria-describedby={undefined}>
        <header className="ai-report-dialog__head">
          <div className="ai-report-dialog__title-wrap">
            <span className="ai-report-dialog__icon" aria-hidden="true"><FlagIcon size={14}/></span>
            <div>
              <Dialog.Title className="ai-report-dialog__title">Report AI Content</Dialog.Title>
              <span className="ai-report-dialog__subtitle">Opens your web browser email pre-filled to send directly to the safety team.</span>
            </div>
          </div>
          <Dialog.Close asChild>
            <button type="button" className="ai-report-dialog__close" aria-label="Close dialog" disabled={submitting}>×</button>
          </Dialog.Close>
        </header>

        <form className="ai-report-dialog__body" onSubmit={handleSubmit}>
          {message?.text && <div className="ai-report-dialog__preview">
            <span className="ai-report-dialog__preview-label">Reported output preview:</span>
            <p className="ai-report-dialog__preview-text">{message.text.length > 180 ? `${message.text.slice(0, 180)}…` : message.text}</p>
          </div>}

          <fieldset className="ai-report-dialog__fieldset" disabled={submitting}>
            <legend className="ai-report-dialog__legend">Reason for reporting</legend>
            <div className="ai-report-dialog__reasons">
              {REPORT_REASONS.map(item => <label key={item.id} className={`ai-report-dialog__option ${reason === item.id ? "is-selected" : ""}`}>
                <input
                  type="radio"
                  name="reportReason"
                  value={item.id}
                  checked={reason === item.id}
                  onChange={() => setReason(item.id)}
                />
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.desc}</span>
                </div>
              </label>)}
            </div>
          </fieldset>

          <div className="ai-report-dialog__field">
            <label htmlFor="ai-report-details" className="ai-report-dialog__field-label">
              Additional context <small>(optional)</small>
            </label>
            <textarea
              id="ai-report-details"
              className="ai-report-dialog__textarea"
              rows={3}
              value={details}
              disabled={submitting}
              onChange={e => setDetails(e.target.value)}
              placeholder="What specifically makes this output problematic or incorrect?"
              maxLength={1500}
            />
          </div>

          <footer className="ai-report-dialog__footer">
            <button type="button" className="ai-report-dialog__btn-secondary" onClick={handleClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="ai-report-dialog__btn-primary" disabled={submitting}>
              {submitting ? "Opening..." : "Submit Report in Browser"}
            </button>
          </footer>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
