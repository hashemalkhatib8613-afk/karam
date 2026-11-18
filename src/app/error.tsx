"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="center-page">
      <div className="card auth-card" role="alert" style={{ textAlign: "center" }}>
        <h1 className="h2">We couldn’t load this page</h1>
        <p className="caption">There may be a temporary connection problem. Please try again.</p>
        <button className="os-btn os-btn--primary os-btn--md" onClick={() => reset()}>Try again</button>
        <a className="caption" href="">Reload page</a>
      </div>
    </div>
  );
}
