import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Info,
  XCircle,
} from "lucide-react";
import { useAlertAck, type AlertAckDetail } from "./useAlertAck";

/**
 * The page an engineer lands on from an Attention Center alert email.
 *
 * Three screens and nothing else: the alert with a form, the confirmation, and
 * an error. It is opened on a phone, on a shop floor, in a hurry — so it is one
 * column at every width, the form sits above the fold, and the tap targets are
 * full-width.
 *
 * There is no login: the token in the query string is the whole credential. The
 * page therefore never logs it, never puts it in the title, and never writes
 * anything on load — mail clients and security scanners open these links before
 * a human does. See useAlertAck for the rest of that reasoning.
 */

/** severity -> the token set for its badge. `risk` is the API's word for what
 *  the rest of the dashboard calls a warning. */
const SEVERITY = {
  critical: {
    label: "Critical",
    cls: "border-critical/40 bg-critical/[0.10] text-critical",
    Icon: AlertTriangle,
  },
  risk: {
    label: "Risk",
    cls: "border-warning/40 bg-warning/[0.10] text-warning",
    Icon: AlertTriangle,
  },
  // No status token for amber; the mail uses amber for Moderate, so match it.
  moderate: {
    label: "Moderate",
    cls: "border-amber-400/40 bg-amber-400/[0.10] text-amber-400",
    Icon: AlertTriangle,
  },
  info: {
    label: "Info",
    cls: "border-info/40 bg-info/[0.10] text-info",
    Icon: Info,
  },
} as const;

const severityOf = (s: string) =>
  SEVERITY[s as keyof typeof SEVERITY] ?? SEVERITY.info;

/** "2026-09-23T06:15:00+05:30" -> "23 Sep 2026, 06:15". Null-safe; returns null
 *  rather than a dash so callers can drop the whole line. */
const fmtWhen = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** "2026-10-08" -> "08 Oct 2026". Parsed as a plain calendar date so the
 *  viewer's timezone cannot shift it by a day. */
const fmtDate = (ymd: string | null): string | null => {
  if (!ymd) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/**
 * "about 43 minutes" until the next reminder mail, or null once it has passed.
 *
 * Computed ONCE on render rather than ticking. A countdown that moves while
 * someone is typing their note adds pressure without adding information.
 */
const timeUntil = (iso: string | null): string | null => {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const mins = Math.round((then - Date.now()) / 60000);
  if (mins <= 0) return null;
  if (mins < 60) return `about ${mins} minute${mins === 1 ? "" : "s"}`;
  const hrs = Math.round(mins / 60);
  return `about ${hrs} hour${hrs === 1 ? "" : "s"}`;
};

const CARD =
  "rounded-xl border border-line bg-panel/70 p-4 sm:p-5";

const LABEL =
  "text-[9.5px] font-black uppercase tracking-wider text-ink-dim";

/** Said on both the form and the read-only screen, so it is written once. */
const WATCH_NOTE =
  "After a reply, the system watches this alert for 2 hours and closes it if no new defect occurs in that time.";

/** The page frame. Every screen sits in this, so the shell is written once. */
const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="w-full min-h-screen bg-page text-ink flex justify-center px-4 py-6 sm:py-10">
    {/* Single column at every width. Capped so it stays readable on a desktop
        without ever needing a second column on a phone. */}
    <div className="w-full max-w-[560px] flex flex-col gap-4">
      <header className="flex items-center gap-3">
        <svg
          viewBox="0 0 238 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-[68px] h-auto flex-shrink-0"
          aria-label="Nokia"
        >
          <path
            d="M164.52 1.70304V54.2969H172.407V1.70304H164.52ZM80.2509 0.804622C64.8848 0.804553 52.9624 11.9886 52.9624 28C52.9624 44.7324 64.8848 55.1957 80.2509 55.1954C95.6171 55.1951 107.564 44.7324 107.539 28C107.517 12.8299 95.6171 0.804691 80.2509 0.804622ZM99.6661 28C99.6661 39.8532 90.9737 47.7084 80.2509 47.7084C69.5282 47.7084 60.8357 39.8532 60.8357 28C60.8357 16.3618 69.5282 8.29171 80.2509 8.29171C90.9737 8.29171 99.6661 16.3618 99.6661 28ZM0 4.74601e-06V54.2969H8.04989V18.4143L49.8817 56V44.7427L0 4.74601e-06ZM113.472 28L142.745 54.297H154.483L125.165 28L154.483 1.70302H142.745L113.472 28ZM238 54.2969H229.323L222.978 42.6502H194.239L187.893 54.2969H179.215L189.724 34.8846H218.851L204.327 7.90705L208.608 0L238 54.2969Z"
            fill="currentColor"
          />
        </svg>
        <span className="h-6 w-px bg-line-strong" />
        <span className="text-[11px] font-black uppercase tracking-widest text-ink-dim">
          Attention Center
        </span>
      </header>
      {children}
    </div>
  </div>
);

/** A refusal. Deliberately dead-ended: every code that reaches here is one that
 *  retrying cannot fix, so there is no retry button to invite it. */
const ErrorScreen = ({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) => (
  <Frame>
    <div className={CARD}>
      <div className="flex items-start gap-3">
        <XCircle size={20} className="text-critical flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h1 className="text-[16px] font-black text-white leading-snug">
            {title}
          </h1>
          <p className="text-[13px] text-ink-muted leading-relaxed mt-2">
            {detail}
          </p>
        </div>
      </div>
    </div>
  </Frame>
);

/** What the alert says. Shared by the form screen and the read-only screen, so
 *  an answered alert reads identically to an open one above the fold. */
const AlertBody = ({ d }: { d: AlertAckDetail }) => {
  const sev = severityOf(d.severity);
  const notified = fmtWhen(d.notified_at);
  const snoozed = fmtDate(d.snooze_until);

  return (
    <div className={CARD}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${sev.cls}`}
        >
          <sev.Icon size={12} />
          {sev.label}
        </span>
        {/* "open" means the problem is still happening. Anything else cleared on
            its own, which is worth saying but never hides the form. */}
        {d.condition && d.condition !== "open" && (
          <span className="rounded-lg border border-line px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-dim">
            No longer active
          </span>
        )}
      </div>

      {/* d.title is a raw "|"-separated row, so it is never the heading. The
          product is the most recognisable thing on a shop floor. */}
      <h1 className="text-[18px] sm:text-[20px] font-black text-white leading-snug mt-3">
        {d.product_name ?? "Attention Center alert"}
        {d.item_code && (
          <span className="ml-2 font-mono text-[13px] font-bold text-ink-muted">
            {d.item_code}
          </span>
        )}
      </h1>

      {/* The same label / value table the mail shows. Stacks under 420px so a
          long value never squeezes its label off a narrow phone. */}
      {d.detail_lines.length > 0 && (
        <dl className="mt-3 divide-y divide-line/60 border-y border-line/60">
          {d.detail_lines.map((line, i) => (
            <div
              key={`${line.label}-${i}`}
              className="grid grid-cols-1 min-[420px]:grid-cols-[150px_1fr] gap-x-3 gap-y-0.5 py-2"
            >
              <dt className="text-[11px] font-bold text-ink-dim">
                {line.label}
              </dt>
              <dd className="text-[13px] text-ink-secondary break-words whitespace-pre-wrap">
                {line.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* AI-written, and only sometimes present. */}
      {d.recommendation && (
        <div className="mt-4 rounded-lg border border-info/25 bg-info/[0.06] p-3">
          <div className="text-[9.5px] font-black uppercase tracking-wider text-info mb-1">
            Recommendation
          </div>
          <p className="text-[13px] text-ink-secondary leading-relaxed">
            {d.recommendation}
          </p>
        </div>
      )}

      {notified && (
        <p className="text-[11px] text-ink-dim mt-4">Raised {notified}</p>
      )}
      {snoozed && (
        <p className="text-[11px] text-ink-dim mt-1">
          Hidden until the end of {snoozed}
        </p>
      )}
    </div>
  );
};

/** A labelled textarea with its inline error, used for both comment and cause. */
const TextField = ({
  id,
  label,
  value,
  onChange,
  error,
  maxLength,
  rows,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  maxLength: number;
  rows: number;
  placeholder: string;
}) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={id} className={LABEL}>
      {label}
    </label>
    <textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={maxLength}
      rows={rows}
      required
      aria-invalid={!!error}
      placeholder={placeholder}
      className={`w-full rounded-lg bg-page border px-3 py-2.5 text-[14px] text-white leading-relaxed outline-none resize-y placeholder:text-ink-dim/50 ${
        error
          ? "border-critical focus:border-critical"
          : "border-line focus:border-info/60"
      }`}
    />
    {error ? (
      <p className="text-[12px] font-bold text-critical">{error}</p>
    ) : (
      <p className="text-[11px] text-ink-dim">
        {value.length}/{maxLength}
      </p>
    )}
  </div>
);

export const AlertAckPage = () => {
  // window.location.search, not useSearchParams: the token must not go through
  // URLSearchParams, which would turn a "+" inside it into a space. See
  // useAlertAck.readToken.
  const search =
    typeof window === "undefined" ? "" : window.location.search;

  const {
    detail,
    state,
    error,
    reply,
    submitting,
    fieldErrors,
    clearFieldError,
    submit,
  } = useAlertAck(search);

  const [comment, setComment] = useState("");
  const [cause, setCause] = useState("");
  const [snoozeUntil, setSnoozeUntil] = useState("");
  // Both fields are required for both buttons; the server refuses a blank one
  // anyway, and finding that out costs a round trip on a phone.
  const canSubmit = !!comment.trim() && !!cause.trim() && !submitting;

  const send = (action: "ack" | "resolve") => {
    if (!canSubmit) return;
    submit({ action, comment, cause, snoozeUntil: snoozeUntil || undefined });
  };

  const nextReminderIn = useMemo(
    () => (detail ? timeUntil(detail.deadline_at) : null),
    [detail],
  );

  if (state === "loading") {
    return (
      <Frame>
        <div className={`${CARD} text-center text-[13px] font-bold text-ink-dim`}>
          Loading the alert…
        </div>
      </Frame>
    );
  }

  if (state === "error" || !detail) {
    const e = error ?? {
      title: "Something went wrong",
      detail: "Please open the alert from the dashboard instead.",
    };
    return <ErrorScreen title={e.title} detail={e.detail} />;
  }

  // ---- the confirmation ------------------------------------------------
  if (reply) {
    return (
      <Frame>
        <div className={CARD}>
          <div className="flex items-start gap-3">
            <CheckCircle2
              size={20}
              className="text-healthy flex-shrink-0 mt-0.5"
            />
            <div className="min-w-0">
              {/* The API's own wording for the four outcomes (resolved,
                  acknowledged, snoozed, noted). Not reworded here — inventing
                  our own would lose the distinction. */}
              <h1 className="text-[16px] font-black text-white leading-snug">
                {reply.title}
              </h1>
              <p className="text-[13px] text-ink-muted leading-relaxed mt-2">
                {reply.detail}
              </p>
            </div>
          </div>
        </div>
        <Link
          to="/quality"
          className="flex items-center justify-center gap-2 rounded-xl border border-line bg-panel/70 px-4 py-3 text-[13px] font-bold text-ink-muted hover:text-white hover:border-line-strong transition-colors"
        >
          Open the Attention Center
          <ArrowRight size={14} />
        </Link>
      </Frame>
    );
  }

  // ---- the alert, with or without the form -----------------------------
  const answered = !detail.can_reply;

  return (
    <Frame>
      <AlertBody d={detail} />

      {answered ? (
        // Already replied to. Read-only, naming who answered and what they said.
        <div className={CARD}>
          <div className="text-[9.5px] font-black uppercase tracking-wider text-ink-dim mb-2">
            {detail.ack_state_label ?? "Answered"}
          </div>
          {detail.acknowledged_by && (
            <p className="text-[13px] text-white font-bold">
              {detail.acknowledged_by}
            </p>
          )}
          {fmtWhen(detail.acknowledged_at ?? detail.closed_at) && (
            <p className="text-[11px] text-ink-dim mt-0.5">
              {fmtWhen(detail.acknowledged_at ?? detail.closed_at)}
            </p>
          )}
          {detail.resolution_comment && (
            <p className="text-[13px] text-ink-secondary leading-relaxed mt-3 whitespace-pre-wrap">
              {detail.resolution_comment}
            </p>
          )}
          {detail.cause && (
            <div className="mt-3">
              <div className={LABEL}>Cause</div>
              <p className="text-[13px] text-ink-secondary leading-relaxed mt-1 whitespace-pre-wrap">
                {detail.cause}
              </p>
            </div>
          )}
          {/* Still being watched until it closes; once closed_at is set the
              note would describe something that has already happened. */}
          {!detail.closed_at && (
            <p className="flex items-start gap-1.5 text-[11px] text-ink-dim mt-4 leading-relaxed">
              <Clock size={12} className="flex-shrink-0 mt-0.5" />
              {WATCH_NOTE}
            </p>
          )}
        </div>
      ) : (
        <>
          {/* can_reply true AND auto_closed is deliberate, not a bug: only on
              alerts raised before 2026-10-07, when unanswered alerts closed
              after two hours. We still want to know what happened. */}
          {detail.ack_state === "auto_closed" && (
            <div className="rounded-xl border border-warning/30 bg-warning/[0.07] p-3 text-[12px] text-ink-secondary leading-relaxed">
              Nobody replied within the two-hour window, so this closed on its
              own. You can still record what happened.
            </div>
          )}

          <form
            className={`${CARD} flex flex-col gap-3`}
            onSubmit={(e) => {
              e.preventDefault();
              send("resolve");
            }}
          >
            <TextField
              id="ack-comment"
              label="What did you find, and what did you do?"
              value={comment}
              onChange={(v) => {
                setComment(v);
                clearFieldError("comment");
              }}
              error={fieldErrors.comment}
              maxLength={detail.comment_max_length}
              rows={5}
              placeholder="Fixture on tester 7 re-seated and re-calibrated; re-ran 20 boards, all passed."
            />
            <TextField
              id="ack-cause"
              label="Cause"
              value={cause}
              onChange={(v) => {
                setCause(v);
                clearFieldError("cause");
              }}
              error={fieldErrors.cause}
              maxLength={detail.comment_max_length}
              rows={2}
              placeholder="Loose RF cable on the fixture"
            />

            {/* Optional. Hides this alert — and the same product + stage +
                category + failure ID / part number on later days — until the
                end of the chosen date. */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ack-snooze" className={LABEL}>
                Hide until (optional)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <CalendarDays
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim pointer-events-none"
                  />
                  <input
                    id="ack-snooze"
                    type="date"
                    value={snoozeUntil}
                    min={detail.snooze_min}
                    max={detail.snooze_max}
                    onChange={(e) => {
                      setSnoozeUntil(e.target.value);
                      clearFieldError("snooze");
                    }}
                    // Native pickers only open from their own small icon; on a
                    // phone the whole field should open the calendar. showPicker
                    // is missing on older browsers and throws in some frames, so
                    // the plain input is the fallback either way.
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker?.();
                      } catch {
                        // Fall back to the browser's own behaviour.
                      }
                    }}
                    aria-invalid={!!fieldErrors.snooze}
                    className={`w-full cursor-pointer rounded-lg bg-page border pl-10 pr-3 py-2.5 text-[14px] text-white outline-none [color-scheme:dark] ${
                      fieldErrors.snooze
                        ? "border-critical focus:border-critical"
                        : "border-line focus:border-info/60"
                    }`}
                  />
                </div>
                {snoozeUntil && (
                  <button
                    type="button"
                    onClick={() => {
                      setSnoozeUntil("");
                      clearFieldError("snooze");
                    }}
                    className="rounded-lg border border-line px-3 text-[12px] font-bold text-ink-muted hover:text-white transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              {fieldErrors.snooze ? (
                <p className="text-[12px] font-bold text-critical">
                  {fieldErrors.snooze}
                </p>
              ) : (
                <p className="text-[11px] text-ink-dim leading-relaxed">
                  Not shown, mailed or reminded until the end of that date,
                  including the same problem on later days.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-lg bg-info px-4 py-3.5 text-[14px] font-black text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Recording…" : "Acknowledge & resolve"}
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => send("ack")}
              className="w-full rounded-lg border border-line-strong bg-panel px-4 py-3 text-[13px] font-bold text-ink-muted hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Acknowledge only
            </button>

            <p className="text-[11px] text-ink-dim text-center leading-relaxed">
              {WATCH_NOTE}
            </p>
            {/* deadline_at is the next REMINDER, not a closing time. */}
            {nextReminderIn && (
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-ink-dim">
                <Clock size={12} />
                Next reminder in {nextReminderIn} if unanswered
              </p>
            )}
          </form>
        </>
      )}
    </Frame>
  );
};

export default AlertAckPage;
