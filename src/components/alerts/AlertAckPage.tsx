import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
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
  info: {
    label: "Info",
    cls: "border-info/40 bg-info/[0.10] text-info",
    Icon: Info,
  },
} as const;

const severityOf = (s: string) =>
  SEVERITY[s as keyof typeof SEVERITY] ?? SEVERITY.info;

const fmtNum = (v: number | null) =>
  v === null || !Number.isFinite(v) ? null : String(v);

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

/**
 * "about 43 minutes" until the deadline, or null once it has passed.
 *
 * Computed ONCE on render rather than ticking. A countdown that moves while
 * someone is typing their note adds pressure without adding information, and the
 * two-hour window is not precise enough to warrant a running clock.
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
  const measured = fmtNum(d.current_value);
  const expected = fmtNum(d.target_value);
  const notified = fmtWhen(d.notified_at);

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

      <h1 className="text-[18px] sm:text-[20px] font-black text-white leading-snug mt-3">
        {d.title}
      </h1>

      {(d.product_name || d.item_code) && (
        <p className="text-[12px] text-ink-muted mt-1.5">
          {d.product_name}
          {d.product_name && d.item_code ? " · " : ""}
          {d.item_code && <span className="font-mono">{d.item_code}</span>}
        </p>
      )}

      {measured && (
        <p className="text-[13px] text-ink-secondary mt-3">
          Measured <span className="font-bold text-white">{measured}</span>
          {expected && (
            <>
              {" "}
              <span className="text-ink-dim">(expected {expected})</span>
            </>
          )}
        </p>
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
    </div>
  );
};

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
    commentError,
    clearCommentError,
    submit,
  } = useAlertAck(search);

  const [comment, setComment] = useState("");
  const trimmed = comment.trim();

  const closesIn = useMemo(
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
              {/* The API's own wording, matched to the three real outcomes.
                  Not reworded here — a reply to an already auto-closed alert
                  gets different copy, and inventing our own would lose that. */}
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
        </div>
      ) : (
        <>
          {/* can_reply true AND auto_closed is deliberate, not a bug: nobody
              answered inside the window, the alert closed itself and left the
              dashboard, but we still want to know what happened. */}
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
              if (trimmed) submit("resolve", comment);
            }}
          >
            <label
              htmlFor="ack-comment"
              className="text-[9.5px] font-black uppercase tracking-wider text-ink-dim"
            >
              What did you do about it?
            </label>
            <textarea
              id="ack-comment"
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                if (commentError) clearCommentError();
              }}
              maxLength={detail.comment_max_length}
              rows={5}
              placeholder="Fixture on tester 7 re-seated and re-calibrated; re-ran 20 boards, all passed."
              className={`w-full rounded-lg bg-page border px-3 py-2.5 text-[14px] text-white leading-relaxed outline-none resize-y placeholder:text-ink-dim/50 ${
                commentError
                  ? "border-critical focus:border-critical"
                  : "border-line focus:border-info/60"
              }`}
            />
            {commentError ? (
              <p className="text-[12px] font-bold text-critical">
                {commentError}
              </p>
            ) : (
              <p className="text-[11px] text-ink-dim">
                {comment.length}/{detail.comment_max_length}
              </p>
            )}

            {/* Primary. Disabled on a blank comment: the server refuses one
                anyway, and finding that out costs a round trip on a phone. */}
            <button
              type="submit"
              disabled={!trimmed || submitting}
              className="w-full rounded-lg bg-info px-4 py-3.5 text-[14px] font-black text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Recording…" : "Acknowledge & resolve"}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => submit("ack", comment)}
              className="w-full rounded-lg border border-line-strong bg-panel px-4 py-3 text-[13px] font-bold text-ink-muted hover:text-white transition-colors disabled:opacity-40"
            >
              Acknowledge only
            </button>

            {closesIn && (
              <p className="flex items-center justify-center gap-1.5 text-[11px] text-ink-dim">
                <Clock size={12} />
                Closes automatically in {closesIn}
              </p>
            )}
          </form>
        </>
      )}
    </Frame>
  );
};

export default AlertAckPage;
