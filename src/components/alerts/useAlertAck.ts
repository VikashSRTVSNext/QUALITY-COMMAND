import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "../../core/api/config";

/**
 * The alert-acknowledgement link an engineer opens from their email.
 *
 * Two calls against one signed token: read the alert, then write the reply. The
 * token is the only credential — there is no login — so the rules around it are
 * stricter than they look:
 *
 *   * THE GET MUST NEVER WRITE. Mail clients and security scanners open these
 *     links before a human does, so a write on load would record acknowledgements
 *     nobody made. `loadDetail` is safe to call on mount and safe to retry;
 *     `submit` only ever runs from a button.
 *   * The token is never logged, never put in the page title, and never sent
 *     anywhere but these two endpoints. Anyone holding it can write the reply.
 *   * The recipient is inside the signature. We never send an email field — a
 *     link forwarded to a colleague still records against the person it was
 *     issued to, which is deliberate.
 */

export type AckState =
  | "pending"
  | "notified"
  | "acknowledged"
  | "actioned"
  | "auto_closed";

export type AlertAckDetail = {
  alert_key: string;
  episode: number;
  recipient: string;
  /** critical | risk | info — already lower-cased by the API. */
  severity: string;
  /** Never null; the API falls back to "Attention Center alert". */
  title: string;
  rule_code: string;
  entity_ref: string | null;
  item_code: string | null;
  product_name: string | null;
  /** "open" = still happening. Anything else = it cleared on its own. null =
   *  no longer determinable. Shown either way; it never hides the form. */
  condition: string | null;
  current_value: number | null;
  target_value: number | null;
  /** AI-written hint. Null means hide the block entirely. */
  recommendation: string | null;
  ack_state: AckState;
  /** Human wording for the finished states. Rendered verbatim rather than
   *  reinvented locally. */
  ack_state_label: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolution_comment: string | null;
  closed_at: string | null;
  notified_at: string | null;
  /** When the alert auto-closes, two hours after notified_at. */
  deadline_at: string | null;
  /** THE ONLY THING that decides whether the form renders. Deliberately not
   *  recomputed from ack_state — the two disagree on purpose for an alert that
   *  auto-closed but can still be answered. */
  can_reply: boolean;
  comment_max_length: number;
};

export type AlertAckReply = {
  ok: boolean;
  /** Read THIS, not the action that was sent: a reply to an already auto-closed
   *  alert is stored but leaves the state at `auto_closed`, so the "nobody
   *  answered" count stays honest. */
  ack_state: AckState;
  title: string;
  detail: string;
};

/** Every refusal on both endpoints has this shape. `title` and `detail` are
 *  always safe to show a user. */
export type AlertAckError = {
  code: string;
  title: string;
  detail: string;
};

const GENERIC_ERROR: AlertAckError = {
  code: "unreachable",
  title: "We could not reach the server",
  detail:
    "Check your connection and try again. Nothing has been recorded, so it is safe to retry.",
};

const MISSING_TOKEN: AlertAckError = {
  code: "invalid_token",
  title: "This link is not valid any more",
  detail:
    "It may have expired, or been altered in transit. Open the alert from the dashboard instead.",
};

/**
 * The token exactly as the link carried it.
 *
 * Read off `location.search` by hand rather than through URLSearchParams,
 * because that class treats "+" as an encoded space. The token is base64 with
 * "." separators, and standard base64 uses "+" — so a token containing one would
 * arrive with a space in the middle of it and fail its signature check for
 * reasons that would be very hard to see.
 *
 * decodeURIComponent has no such rule, so decoding once here gives the true
 * value: send it verbatim in the POST body, and re-encode it properly for the
 * GET query string.
 */
const readToken = (search: string): string | null => {
  const raw = search.replace(/^\?/, "");
  for (const pair of raw.split("&")) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    if (pair.slice(0, eq) !== "t") continue;
    const value = pair.slice(eq + 1);
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      // Malformed percent-encoding. Not our problem to repair — hand back the
      // bytes as they arrived and let the signature check refuse it.
      return value;
    }
  }
  return null;
};

/** Pull the API's error envelope out of a response, whatever went wrong. */
const readError = async (res: Response): Promise<AlertAckError> => {
  try {
    const body = await res.json();
    const err = body?.error;
    if (err?.title && err?.detail) {
      return {
        code: String(err.code ?? "unknown"),
        title: String(err.title),
        detail: String(err.detail),
      };
    }
  } catch {
    // Not JSON, or no body at all — fall through.
  }
  return GENERIC_ERROR;
};

export const useAlertAck = (search: string) => {
  const token = readToken(search);

  const [detail, setDetail] = useState<AlertAckDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<AlertAckError | null>(null);

  const [reply, setReply] = useState<AlertAckReply | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Shown under the textarea, keeping what the user typed. Only
   *  `comment_required` lands here; everything else is a full-page refusal. */
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      if (!token) {
        setError(MISSING_TOKEN);
        setState("error");
        return;
      }
      try {
        // cache: no-store — two people may hold the same link, and a cached
        // reply state would show one of them a stale form.
        const res = await fetch(
          apiUrl(`/alerts/ack/detail?t=${encodeURIComponent(token)}`),
          { cache: "no-store" },
        );
        if (!res.ok) {
          const err = await readError(res);
          if (cancelled) return;
          setError(err);
          setState("error");
          return;
        }
        const json: AlertAckDetail = await res.json();
        if (cancelled) return;
        setDetail(json);
        setError(null);
        setState("ready");
      } catch {
        if (cancelled) return;
        // Deliberately no console logging anywhere in this hook: the token is in
        // the URL and a logged request line would leak it.
        setError(GENERIC_ERROR);
        setState("error");
      }
    };

    setState("loading");
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = useCallback(
    async (action: "ack" | "resolve", comment: string) => {
      if (!token || submitting) return;
      setSubmitting(true);
      setCommentError(null);
      try {
        const res = await fetch(apiUrl("/alerts/ack/reply"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // The token goes in the body verbatim — JSON is not URL-encoded.
          body: JSON.stringify({ t: token, action, comment }),
        });
        if (!res.ok) {
          const err = await readError(res);
          // The one refusal that is a field problem rather than a dead end. The
          // page keeps the form, and the text, so nothing is retyped.
          if (err.code === "comment_required") {
            setCommentError(err.detail || err.title);
            return;
          }
          setError(err);
          setState("error");
          return;
        }
        const json: AlertAckReply = await res.json();
        setReply(json);
      } catch {
        setError(GENERIC_ERROR);
        setState("error");
      } finally {
        setSubmitting(false);
      }
    },
    [token, submitting],
  );

  return {
    detail,
    state,
    error,
    reply,
    submitting,
    commentError,
    clearCommentError: () => setCommentError(null),
    submit,
  };
};

export default useAlertAck;
