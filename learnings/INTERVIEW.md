# SOC Triage — Interview Q&A

**Project:** SOC Triage Platform  
**Live:** https://soc-triage-bhargav-secs-projects.vercel.app  
**Repo:** https://github.com/bhargav-sec/soc-triage

---

## The Opener

**Q: Tell me about a project you're proud of.**

> I built a SIEM-style triage platform from scratch called SOC Triage — basically the tool I wish I had when I was starting out as an analyst. It ingests Linux auth log events, scores them with an AI model, maps them to MITRE ATT&CK techniques, automatically correlates events from the same attacker IP into investigations, and gives the analyst a structured workflow to work and close each one. It's live on Vercel right now with a Python agent on Railway continuously generating realistic SSH attack events into it.

---

## The Technical Basics

**Q: What's the tech stack and why did you choose it?**

> Next.js for the frontend and API routes — that meant one repo, one deployment, no separate backend. Supabase for the database because I needed real SQL for the correlation logic and it has a generous free tier. Groq with llama-3.3-70b for AI scoring — sub-second inference, free tier, reliable JSON output. Vercel for deployment because it's zero-config with Next.js. And a Python forwarder agent on Railway to simulate live SSH attack traffic. The whole thing runs on free tier — deliberate choice, I wanted to prove the concept without spending money.

---

**Q: Walk me through what happens when an event comes in.**

> The Python forwarder POSTs a JSON log event to my /api/ingest endpoint. First the raw payload is stored exactly as received — never modified. Then I extract structured fields into a JSONB column. Then the event goes to Groq for AI scoring — it comes back with a severity level, a MITRE technique, a one-line summary of what happened, and a reasoning explanation. All four fields are validated against an allowlist before I trust them. Then a Postgres function runs a correlation check — if there are 3 or more events from the same source IP in the last 15 minutes, they all get grouped into a shared investigation. Finally the event appears in the analyst queue with severity badge, MITRE badge, and the AI summary visible immediately.

---

**Q: What does the analyst actually do with it?**

> They open their queue and see investigations, not individual alerts. Each investigation has a one-liner of what happened, why it's suspicious, and the MITRE technique. They click in, read the AI reasoning, look at the correlated events underneath, add their own notes, and then make a verdict — either true positive or false positive — with a mandatory note explaining their reasoning before they can close it. The close-requires-note rule is enforced server-side, not just in the UI, so it can't be bypassed.

---

## The AI Scoring

**Q: How does the AI scoring work exactly?**

> I send the raw log event to Groq with a prompt that instructs it to return only a JSON object with four fields — severity, mitre_technique, summary, and reasoning. I give it explicit allowlists in the prompt: severity must be one of critical, high, medium, low, or unknown; MITRE technique must be one of six specific techniques relevant to Linux auth logs. If the response doesn't parse as valid JSON, or if any field value isn't in the allowlist, I treat it as a scoring failure and the event gets severity unknown. That way a hallucinated or malformed response never silently slips through.

---

**Q: Why AI scoring instead of rule-based detection?**

> Rule-based detection already exists in every production SIEM — I didn't need to rebuild that. What I wanted to explore was where AI adds value in the analyst workflow. And the answer is summarization and triage prioritization, not detection itself. The AI doesn't decide whether an attack happened — the log line already tells you that. What it does is explain what the log line means, why it's suspicious in context, and what technique it maps to. That's where a junior analyst loses 20 minutes Googling. The AI gives them that context immediately.

---

**Q: How do you know the AI verdict is correct?**

> I don't assume it is — and the tool is designed around that. There's a false positive status so analysts can explicitly disagree with the AI verdict. There's a rescore button if you want to re-run scoring. And the original AI verdict is preserved in separate columns — ai_severity_original and ai_mitre_original — so if an analyst overrides it, you can see both what the AI said and what the human decided. The tool is built to be questioned, not trusted blindly.

---

**Q: What happens if Groq goes down?**

> The event still gets ingested — it just lands with severity unknown and ai_provider set to failed. That's visible in the UI via the unknown counter in the header, which doubles as an AI health indicator. If that counter is climbing fast, scoring is broken. The analyst can still work the queue manually and rescore events once the provider recovers.

---

## The Correlation Logic

**Q: How does your event correlation work?**

> There's a Postgres function called correlate_event that runs on every ingest. It looks for other events where the source IP matches, within a 15-minute sliding window. If it finds 3 or more events including the new one, it groups them all under a shared investigation. If an investigation for that IP already exists, the new event joins it. If not, a new investigation is created. Running it as a Postgres function instead of application logic means the check and the update happen atomically — no race conditions if two events from the same IP arrive at the same time.

---

**Q: How does that compare to correlation in a real SIEM?**

> Mine is intentionally simple — same source IP, fixed 15-minute window, fixed threshold of 3. Real SIEMs correlate across multiple dimensions: user, host, IP, process, event type combinations. They have configurable thresholds and rule editors. The architecture is equivalent in principle — event arrives, correlation logic runs, related events get grouped. The sophistication of the rules is what differs, and that's the part I'd build out next given more time.

---

## The Database

**Q: Why did you store source IP inside a JSONB column instead of as its own column?**

> Because that's how real log pipelines work — you preserve the raw event exactly as received, then extract structured fields separately. Putting source IP in its own column would mean my schema decides what's important at ingest time, before I know how I'll query it. The JSONB approach means the raw log is immutable and I can extract any field I need later. In practice I query it as parsed->>'source_ip' using Postgres JSONB operators, which is the same pattern you'd see in production log pipelines.

---

**Q: What's your status model and why those four values?**

> Open, investigating, true positive, false positive. I deliberately chose true positive instead of resolved because in real SOC workflow, closing an alert means making a verdict — you're saying this was a real attack, or it wasn't. Just saying resolved doesn't capture that. And false positive is the mechanism for disagreeing with the AI — it's not just a dismissal, it's an explicit analyst judgment that gets recorded with a mandatory note.

---

## The Design Decisions

**Q: Why build this yourself instead of using an open-source SIEM?**

> Because building it from scratch forced me to understand every layer — what a triage queue actually needs, how correlation logic works under the hood, what the analyst workflow looks like from first principles. Using an existing SIEM would have taught me how to configure it. Building one taught me why it's designed the way it is.

---

**Q: This won't scale to real SOC volumes. Is that a problem?**

> It's a deliberate constraint, not an oversight — and it's documented in the project vision. At real SOC volumes you'd replace the serverless ingest endpoint with a message queue, move AI scoring to async workers, and replace the Postgres correlation function with a streaming window processor. But the triage workflow, the AI scoring logic, and the MITRE classification are all portable. The architecture is appropriate for what this is — a workflow prototype. I'd rather build something honest about its constraints than fake scalability I haven't tested.

---

**Q: What would you add if you had more time?**

> Three things in priority order. First, proper authentication — right now it's single-user, which limits its usefulness as a real tool. Second, async AI scoring so ingest latency isn't blocked waiting for Groq to respond. Third, a detection rule editor so analysts can define their own correlation conditions instead of being stuck with my hardcoded threshold. The current correlation logic is a good default but real analysts need to tune it for their environment.

---

## The Analyst Workflow

**Q: What does true positive and false positive mean in your workflow?**

> True positive means the analyst confirmed this was a real attack or suspicious activity — the AI was right, the investigation was worth opening. False positive means the analyst looked at it and determined it was benign — maybe a known automated scan, a health check from a monitoring tool, whatever. The key thing is both require a written note before you can close. That's a real SOC practice — you document your reasoning so the next analyst understands why something was dismissed.

---

**Q: How does a junior analyst know what to do next after opening an investigation?**

> The event detail page has an AI walkthrough panel that gives them the MITRE technique, the AI's reasoning for why it's suspicious, and recommended remediation actions. The MITRE badge links directly to the relevant attack.mitre.org technique page. So even if they've never seen that specific attack pattern before, they have a starting point — what technique it maps to, why the AI flagged it, and what to check next. That's the gap I was trying to close.

---

## The Forwarder Agent

**Q: Tell me about the Python forwarder agent.**

> It runs on Railway in simulate mode — generates realistic SSH failed-auth events every 5 seconds and POSTs them to the Vercel ingest endpoint. It can also run in replay mode, where you give it a real auth.log file and it replays the events through the pipeline. I used it to replay the loghub Linux_2k dataset — real honeypot logs — and compare how the AI classified those events versus my own manual triage. That exercise is actually useful for building your own analyst instincts because it forces you to articulate why you agree or disagree with the AI verdict.

---

## The Mistakes and Lessons

**Q: What was the hardest technical problem you hit?**

> Transferring JSX files in Google Cloud Shell. Bash heredocs and the Cloud Shell editor both silently strip certain characters from JSX — specifically the angle bracket in tag expressions and the dot in JSONB operator expressions. I kept getting runtime errors that looked like bugs in my logic when they were actually corruption introduced at file transfer. The fix was base64 encoding every JSX file before transfer — encode, paste the base64 blob, decode in Cloud Shell. Once I figured that out I made it a hard rule for the whole project.

---

**Q: What would you do differently if you started over?**

> I'd write the session handoff documents from day one instead of retrofitting them. I ended up with multiple AI agents working on this across different sessions, each with a slightly different understanding of the current state. The VISION.md discipline helped but the session files got stale. If the handoff docs were a first-class commit at the end of every session, the drift between what's documented and what's actually built wouldn't happen.

---

*Last updated: May 2026. All answers based on what's actually shipped — not planned features.*
