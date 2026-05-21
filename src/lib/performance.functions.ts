import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

let _supabase: ReturnType<typeof createClient<Database>> | undefined;

function supabaseServer() {
  if (_supabase) return _supabase;

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_KEY ? ["SUPABASE_SERVICE_ROLE_KEY or SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(", ")}`);
  }

  _supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _supabase;
}

export type SubData = {
  sub_id: string;
  name: string;
  monthly_report: {
    highlights?: string;
    shortcomings?: string;
    next_plan?: string;
    period?: string;
  } | null;
  last_supervisor_feedback: {
    score?: number;
    highlights?: string;
    shortcomings?: string;
    next_focus?: string;
    period?: string;
  } | null;
  work_emails: { subject: string; from: string; date: string; summary: string }[];
  chat_messages: { channel: string; date: string; summary: string }[];
};

export const getSubordinateData = createServerFn({ method: "GET" })
  .inputValidator((d: { subId: string }) => z.object({ subId: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseServer()
      .from("subordinate_data")
      .select("*")
      .eq("sub_id", data.subId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as SubData | null;
  });

const FeedbackInput = z.object({
  subId: z.string().min(1).max(64),
  subName: z.string().min(1).max(64),
  score: z.number().int().min(0).max(100),
  highlights: z.string().min(1).max(2000),
  shortcomings: z.string().min(1).max(2000),
  nextFocus: z.string().min(1).max(2000),
  scoresDetail: z.record(z.string(), z.number()),
  emailSent: z.boolean(),
});

export const saveFeedbackRecord = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => FeedbackInput.parse(d))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseServer()
      .from("feedback_records")
      .insert({
        sub_id: data.subId,
        sub_name: data.subName,
        score: data.score,
        highlights: data.highlights,
        shortcomings: data.shortcomings,
        next_focus: data.nextFocus,
        scores_detail: data.scoresDetail,
        email_sent: data.emailSent,
        sent_at: data.emailSent ? new Date().toISOString() : null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listFeedbackRecords = createServerFn({ method: "GET" })
  .inputValidator((d: { subId?: string }) =>
    z.object({ subId: z.string().max(64).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    let q = supabaseServer()
      .from("feedback_records")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (data.subId) q = q.eq("sub_id", data.subId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows;
  });
