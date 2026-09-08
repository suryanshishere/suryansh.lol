"use client";

import { useRef, useState, type FormEvent } from "react";
import { ArrowUpRight } from "./icons";

export function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const submission = useRef<string | null>(null);
  const lastPayload = useRef("");
  const feedback = useRef<HTMLDivElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "sending") return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const fields = Object.fromEntries(data.entries());
    const fingerprint = JSON.stringify(fields);
    if (fingerprint !== lastPayload.current || !submission.current) {
      submission.current = crypto.randomUUID();
      lastPayload.current = fingerprint;
    }
    setState("sending");
    setMessage("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, submissionId: submission.current }),
        signal: AbortSignal.timeout(40000),
      });
      const result = await response.json().catch(() => ({})) as { error?: string; fields?: Record<string, string> };
      if (!response.ok) throw new Error(result.fields ? Object.values(result.fields).join(" ") : result.error || "Your message couldn’t be sent. Please try again, or email me directly.");
      setState("success");
      setMessage("Your message is in my inbox. Thanks for reaching out!");
      form.reset();
      submission.current = null;
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error && error.name !== "TimeoutError" ? error.message : "This is taking longer than expected. Try again, or email me directly.");
    }
    requestAnimationFrame(() => feedback.current?.focus());
  }

  return <form className="contact-form" onSubmit={submit}>
    <div className="form-row">
      <div className="form-field"><label htmlFor="contact-name">Your name</label><input id="contact-name" name="name" autoComplete="name" placeholder="What should I call you?" required minLength={2} maxLength={80} /></div>
      <div className="form-field"><label htmlFor="contact-email">Your email</label><input id="contact-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} /></div>
    </div>
    <div className="form-field"><label htmlFor="contact-subject">What’s on your mind?</label><select id="contact-subject" name="subject" defaultValue="A project together"><option>A project together</option><option>A job opportunity</option><option>A question about my work</option><option>Just saying hello</option></select></div>
    <div className="form-field"><label htmlFor="contact-message">A little about it</label><textarea id="contact-message" name="message" placeholder="The idea, the opportunity, or just a friendly hello…" required minLength={20} maxLength={5000} rows={4} /></div>
    <div className="form-trap" aria-hidden="true"><label htmlFor="contact-website">Leave this empty<input id="contact-website" name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <div className="form-submit"><p>Just between us. Your details stay private.</p><button className="button button-dark" disabled={state === "sending"} type="submit">{state === "sending" ? "Sending…" : "Send message"}<ArrowUpRight /></button></div>
    <div ref={feedback} className={`form-feedback ${state}`} aria-live="polite" role="status" tabIndex={-1}>{message}</div>
  </form>;
}
