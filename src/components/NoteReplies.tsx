import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/dates";
import { replyToNote } from "@/app/actions/partner";
import ActionForm from "@/components/admin/ActionForm";

export default async function NoteReplies({ noteId, timezone }: { noteId: string; timezone: string }) {
  const { supabase, user, profile } = await requireUser();
  const { data: replies, error } = await supabase.from("note_replies")
    .select("id,body,author_id,created_at").eq("note_id", noteId).eq("status", "visible").order("created_at");
  return <section className="card stack" aria-label="Replies to this letter">
    <h2 className="h2">Replies</h2>
    {error ? <p className="err" role="alert">Couldn't load replies. Please refresh to try again.</p> : replies?.length ? <ul className="stack">
      {replies.map((reply) => <li key={reply.id} className="stack" style={{ gap: 6 }}>
        <p className="caption">{reply.author_id === user.id ? "You" : "Her reply"} · {fmtDateTime(reply.created_at, timezone)}</p>
        <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{reply.body}</p>
      </li>)}
    </ul> : <p className="caption">No replies yet.</p>}
    {profile?.role === "partner" && <ActionForm action={replyToNote} submitLabel="Send reply" className="stack">
      <input type="hidden" name="note_id" value={noteId} />
      <div className="field">
        <label htmlFor="reply-body">Your reply</label>
        <textarea id="reply-body" name="body" required maxLength={4000} rows={4} />
      </div>
    </ActionForm>}
  </section>;
}
