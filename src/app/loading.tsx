export default function Loading() {
  return (
    <main id="main" className="center-page" aria-busy="true">
      <div className="card auth-card" role="status" style={{ textAlign: "center" }}>
        <p className="hero">Just Us.</p>
        <p className="caption">Loading your memories…</p>
      </div>
    </main>
  );
}
