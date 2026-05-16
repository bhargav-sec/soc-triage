# SOC Triage — What I Built and Why

**Live:** https://soc-triage-bhargav-secs-projects.vercel.app  
**Repo:** https://github.com/bhargav-sec/soc-triage

---

## The problem I was solving

Imagine you're a security analyst and you walk into work. Your screen shows 200 alerts. Each one is a potential attack. Each one looks slightly different. There's no clear starting point, no explanation of what's dangerous, and no guide on what to do next.

Most junior analysts freeze. They spend more time figuring out where to start than actually investigating anything.

I built this tool to fix that moment.

---

## What it does in plain English

SOC Triage is a security dashboard that watches for suspicious login activity on Linux servers — things like someone trying thousands of passwords to break into an account (brute force attacks).

When suspicious activity is detected, the tool:

1. **Groups related attacks together** — instead of showing 50 separate alerts from the same attacker, it shows one investigation
2. **Explains what's happening** — an AI reads the raw log data and writes a plain English summary of what the attacker is doing and why it's suspicious
3. **Maps it to a known attack pattern** — every investigation is tagged with a MITRE ATT&CK technique, which is the industry-standard way of categorising how attackers operate
4. **Gives the analyst a workflow** — they can add notes, change the status, and close the investigation with a verdict (real attack or false alarm)

---

## How it works behind the scenes

A Python script runs continuously and sends fake attack events into the system every few seconds — simulating what real attack traffic looks like. Each event goes through this pipeline:

**Log comes in → AI reads it → AI scores it → System groups related events → Analyst sees one clean investigation**

The AI (powered by Groq, a fast AI service) reads each log line and decides: how serious is this? What type of attack is it? What happened in plain English? All of that gets stored and shown to the analyst automatically.

---

## What I actually built (the full list)

- A live web dashboard showing a queue of security investigations
- An AI scoring engine that reads raw log data and explains it in plain English
- An automatic grouping system — events from the same attacker IP get merged into one investigation
- A full analyst workflow — open, investigate, close with a verdict and notes
- A per-host timeline showing all activity from a specific server
- A bulk log upload tool — upload a real log file and replay it through the system
- A sources page showing where all the data is coming from
- A dashboard with charts showing the breakdown of alert severity
- Keyboard shortcuts so analysts can navigate the queue without touching the mouse
- A Python forwarder agent deployed on Railway generating continuous fake attack traffic

---

## The tech (in simple terms)

| What | Tool used |
|---|---|
| The website | Next.js (a web framework) |
| The database | Supabase (stores all the events and investigations) |
| The AI | Groq — reads log lines and explains them |
| Where it's hosted | Vercel (the live website) and Railway (the attack simulator) |
| Source control | GitHub |

Everything runs on free tier. No paid services.

---

## Why I built it this way

I'm a SOC Analyst. I've sat in front of a SIEM with too many alerts and not enough context. I wanted to build something that actually helps with that — not just another tool that shows raw data and expects you to figure it out yourself.

Every design decision came from real analyst experience:

- **Investigations instead of alerts** — because grouping related events is what analysts spend half their time doing manually
- **Mandatory note when closing** — because in a real SOC you always document your reasoning, not just click dismiss
- **True positive / false positive instead of just "resolved"** — because closing an investigation means making a verdict, and that distinction matters
- **AI explains, analyst decides** — the AI is there to save time, not replace judgment. The analyst can always override it

---

## What I learned

- How to build a complete end-to-end security pipeline from scratch
- How to get AI to reliably output structured data (not just freeform text)
- How real log pipelines store raw vs. parsed data separately
- How event correlation works under the hood in a SIEM
- How to deploy a full-stack application with a live database and a background agent
- How to scope a project and ship it in phases without it falling apart

---

*Built by Bhargav Chowdary — SOC Analyst, Dublin, Ireland*  
*MSc Cybersecurity, National College of Ireland | BTL1 Certified*  
*GitHub: github.com/bhargav-sec | LinkedIn: linkedin.com/in/bhargav-chowdary-cybersecurity*