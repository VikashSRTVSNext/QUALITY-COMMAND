// Handlers for the /alerts/* surface: acknowledgement and the shift report.
//
// Two things here differ from every other handler.
//
//  1. The error envelope. These endpoints answer with
//     { error: { code, title, detail } }, NOT FastAPI's { detail }. The hooks
//     parse that shape specifically, so getting it wrong turns a readable
//     refusal into a generic "something went wrong".
//
//  2. State. /alerts/ack/reply is the app's only POST and the only mutation in
//     the demo. It writes to a module-level map, so an acknowledgement sticks
//     for the session and resets on reload. There is no fixture to write back
//     to and inventing persistence would be a lie about what the demo is.

import { alertAckFixture, latestDay } from "../fixtureStore";
import { single } from "../aggregations";
import type { DemoResponse } from "../types";

const envelope = (
  status: number,
  code: string,
  title: string,
  detail: string,
): DemoResponse => ({ status, body: { error: { code, title, detail } } });

/**
 * Acknowledgements made this session, keyed by token.
 *
 * Deliberately in memory. The GET below must stay side-effect free — mail
 * scanners open these links before a human does, and a GET that acknowledged
 * on read would mark every alert the moment it was mailed.
 */
const replied = new Map<string, { ack_state: string; snooze_until: string | null }>();

// ── GET /alerts/ack/detail ──────────────────────────────────────────────────

export const ackDetailHandler = async (url: URL): Promise<DemoResponse> => {
  // Read off the raw query string rather than searchParams.get: URLSearchParams
  // decodes "+" to a space, which would corrupt a signed token. The app does
  // the same thing for the same reason.
  const raw = url.search.replace(/^\?/, "");
  const token =
    raw
      .split("&")
      .map((pair) => pair.split("="))
      .find(([k]) => k === "t")?.[1] ?? "";

  if (!token) {
    return envelope(
      400,
      "missing_token",
      "Link incomplete",
      "This link is missing its token. Open the link from the alert email again.",
    );
  }

  const fixture = await alertAckFixture();
  const entry = fixture?.[decodeURIComponent(token)];
  if (!entry) {
    return envelope(
      404,
      "unknown_token",
      "Link not recognised",
      "This acknowledgement link is not known to the demo. Use ?t=demo-token-open.",
    );
  }

  const session = replied.get(token);
  return {
    status: 200,
    body: {
      ...entry,
      business_date: latestDay(),
      // Once replied this session, the form closes — `can_reply` is the ONLY
      // thing that decides whether it renders.
      ack_state: session?.ack_state ?? entry.ack_state,
      can_reply: session ? false : entry.can_reply,
      snooze_until: session?.snooze_until ?? null,
    },
  };
};

// ── POST /alerts/ack/reply ──────────────────────────────────────────────────

/** Field-level codes the UI maps to an inline message, keeping typed text. */
const FIELD_CODES = {
  comment_required: "A comment is required.",
  cause_required: "A cause is required.",
  invalid_snooze: "Choose a snooze date inside the allowed window.",
};

export const ackReplyHandler = async (
  _url: URL,
  request?: Request,
): Promise<DemoResponse> => {
  let payload: any = {};
  try {
    payload = request ? await request.json() : {};
  } catch {
    return envelope(400, "bad_request", "Request not understood", "The request body was not valid JSON.");
  }

  const { t: token, action, comment, cause, snooze_until: snooze } = payload;
  if (!token) {
    return envelope(400, "missing_token", "Link incomplete", "This link is missing its token.");
  }

  const fixture = await alertAckFixture();
  const entry = fixture?.[String(token)];
  if (!entry) {
    return envelope(404, "unknown_token", "Link not recognised", "This acknowledgement link is not known to the demo.");
  }
  if (!entry.can_reply || replied.has(String(token))) {
    return envelope(
      409,
      "already_answered",
      "Already answered",
      "This alert has already been answered.",
    );
  }

  // Field errors, so the inline-vs-page distinction in the UI is exercised.
  if (!comment || !String(comment).trim()) {
    return envelope(422, "comment_required", "Comment required", FIELD_CODES.comment_required);
  }
  if (action === "resolve" && (!cause || !String(cause).trim())) {
    return envelope(422, "cause_required", "Cause required", FIELD_CODES.cause_required);
  }
  if (snooze && !/^\d{4}-\d{2}-\d{2}$/.test(String(snooze))) {
    return envelope(422, "invalid_snooze", "Snooze date invalid", FIELD_CODES.invalid_snooze);
  }

  // Read the state back from `ack_state`, never from the action that was sent.
  const ackState = action === "resolve" ? "resolved" : "acknowledged";
  replied.set(String(token), { ack_state: ackState, snooze_until: snooze ?? null });

  return {
    status: 200,
    body: {
      ok: true,
      ack_state: ackState,
      title: ackState === "resolved" ? "Alert resolved" : "Alert acknowledged",
      detail: "Recorded for this demo session. Reload to reset.",
      snooze_until: snooze ?? null,
    },
  };
};

// ── GET /alerts/shift-report ────────────────────────────────────────────────

/**
 * The Attention Center export.
 *
 * LIMITATION, stated plainly: the real endpoint returns an .xlsx workbook.
 * Building a valid workbook needs a spreadsheet library, and the brief rules
 * out adding dependencies, so the demo serves CSV and names the download .csv
 * rather than handing over a CSV wearing an .xlsx extension — which would fail
 * to open and look like a corrupt file.
 *
 * Everything else about the flow is real: the same 400s, the same error
 * envelope, a genuine blob, and a Content-Disposition the caller parses for the
 * filename.
 */
export const shiftReportHandler = async (url: URL): Promise<DemoResponse> => {
  const from = single(url, "from_date");
  const to = single(url, "to_date");
  const shift = single(url, "shift");

  if (!from || !to) {
    return envelope(400, "missing_range", "Range required", "Choose both a start and an end day.");
  }
  if (to < from) {
    return envelope(400, "bad_range", "Range invalid", "The end day is before the start day.");
  }
  const days =
    Math.floor(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
    ) + 1;
  // The report's own ceiling is 31 days — deliberately NOT the dashboard's 30,
  // and not a rolling window either.
  if (days > 31) {
    return envelope(
      400,
      "range_too_long",
      "Range too long",
      `One download covers at most 31 days (this is ${days}).`,
    );
  }

  const { attentionForRange } = await import("./dashboard-report");
  const rows = await attentionForRange(from, to, shift);

  const header = [
    "business_date", "shift", "alert_id", "title", "severity",
    "impact", "current_value", "target_value", "unit", "deviation", "age_minutes",
  ];
  const csv = [
    header.join(","),
    ...rows.map((r) =>
      header
        .map((k) => {
          const v = (r as any)[k];
          const s = v == null ? "" : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    ),
  ].join("\r\n");

  const name = `attention_alerts_${from}${from === to ? "" : `_to_${to}`}${shift ? `_${shift}` : ""}.csv`;

  return {
    status: 200,
    blob: new Blob([csv], { type: "text/csv;charset=utf-8" }),
    headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  };
};
