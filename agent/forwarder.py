#!/usr/bin/env python3
"""
SOC Triage Forwarder Agent
Tails a log file and POSTs each new line to the SOC Triage ingest API.
Reads config from env vars (SOC_*) with fallback to config.json.
"""

import json, os, re, sys, time, datetime, argparse, logging, random
import urllib.request, urllib.error

# ── Config ────────────────────────────────────────────────────────────────────

def load_config(path: str) -> dict:
    cfg = {}
    # Load file first as base
    if os.path.exists(path):
        with open(path) as f:
            cfg = json.load(f)
    # Env vars override file (for Render / Docker)
    if os.environ.get("SOC_TARGET_URL"):
        cfg["target_url"] = os.environ["SOC_TARGET_URL"]
    if os.environ.get("SOC_SOURCE_HOST"):
        cfg["source_host"] = os.environ["SOC_SOURCE_HOST"]
    if os.environ.get("SOC_LOG_FILE"):
        cfg["log_file"] = os.environ["SOC_LOG_FILE"]
    if os.environ.get("SOC_API_KEY"):
        cfg["api_key"] = os.environ["SOC_API_KEY"]
    if os.environ.get("SOC_DRY_RUN"):
        cfg["dry_run"] = os.environ["SOC_DRY_RUN"].lower() == "true"
    if os.environ.get("SOC_POLL_INTERVAL"):
        cfg["poll_interval_seconds"] = int(os.environ["SOC_POLL_INTERVAL"])

    cfg.setdefault("source_type", "linux_auth")
    cfg.setdefault("poll_interval_seconds", 5)
    cfg.setdefault("batch_size", 10)
    cfg.setdefault("api_key", "")
    cfg.setdefault("dry_run", False)
    cfg.setdefault("log_file", "/var/log/auth.log")
    if not cfg.get("source_label"):
        cfg["source_label"] = "session-" + datetime.datetime.now().strftime("%Y-%m-%d")
    # Auto-tag session with start date if not explicitly set
    if not cfg.get("source_label"):
        cfg["source_label"] = "session-" + datetime.datetime.now().strftime("%Y-%m-%d")

    for k in ["target_url", "source_host"]:
        if not cfg.get(k):
            raise ValueError(f"Missing required config: {k} (set via env SOC_{k.upper()} or config.json)")
    return cfg

# ── Log parsing ───────────────────────────────────────────────────────────────

CURRENT_YEAR = datetime.datetime.utcnow().year
MONTH_MAP = {m: i+1 for i, m in enumerate(
    ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
)}

PATTERNS = [
    re.compile(
        r"(?P<month>\w+)\s+(?P<day>\d+)\s+(?P<time>\S+).*sshd.*"
        r"Failed password for (?:invalid user )?(?P<username>\S+) from (?P<source_ip>\S+) port \d+"
    ),
    re.compile(
        r"(?P<month>\w+)\s+(?P<day>\d+)\s+(?P<time>\S+).*sshd.*"
        r"Accepted (?P<auth_method>\S+) for (?P<username>\S+) from (?P<source_ip>\S+) port \d+"
    ),
    re.compile(
        r"(?P<month>\w+)\s+(?P<day>\d+)\s+(?P<time>\S+).*sudo.*"
        r"(?P<username>\S+)\s*:.*COMMAND=(?P<command>.+)"
    ),
    re.compile(
        r"(?P<month>\w+)\s+(?P<day>\d+)\s+(?P<time>\S+).*"
        r"(?P<action>useradd|groupadd|userdel|usermod).*name=(?P<username>\S+)"
    ),
    re.compile(
        r"(?P<month>\w+)\s+(?P<day>\d+)\s+(?P<time>\S+).*"
        r"pam_unix.*authentication failure.*user=(?P<username>\S+)"
    ),
    re.compile(
        r"(?P<month>\w+)\s+(?P<day>\d+)\s+(?P<time>\S+).*sshd.*"
        r"Invalid user (?P<username>\S+) from (?P<source_ip>\S+)"
    ),
]

def parse_line(line: str, source_host: str, source_type: str) -> dict | None:
    line = line.strip()
    if not line:
        return None

    parsed: dict = {}
    event_time = datetime.datetime.utcnow().isoformat() + "Z"

    for pattern in PATTERNS:
        m = pattern.search(line)
        if m:
            gd = m.groupdict()
            try:
                month = MONTH_MAP.get(gd.get("month", ""), 1)
                day = int(gd.get("day", 1))
                t = gd.get("time", "00:00:00")
                h, mi, s = map(int, t.split(":"))
                dt = datetime.datetime(CURRENT_YEAR, month, day, h, mi, s)
                event_time = dt.isoformat() + "Z"
            except Exception:
                pass

            parsed = {k: v for k, v in gd.items()
                      if k not in ("month", "day", "time") and v is not None}

            if "Failed password" in line or "Invalid user" in line:
                parsed["auth_result"] = "failed"
                parsed["service"] = "sshd"
            elif "Accepted" in line:
                parsed["auth_result"] = "success"
                parsed["service"] = "sshd"
            break

    # Still forward even if no pattern matched — AI scorer will handle it
    return {
        "source_type": source_type,
        "source_host": source_host,
        "event_time": event_time,
        "raw_payload": line,
        "parsed": parsed,
    }

# ── HTTP sender ───────────────────────────────────────────────────────────────

def post_event(event: dict, cfg: dict, logger: logging.Logger) -> bool:
    if cfg["dry_run"]:
        logger.info(f"[dry-run] {event['raw_payload'][:80]}")
        return True

    body = json.dumps(event).encode()
    headers = {"Content-Type": "application/json"}
    if cfg["api_key"]:
        headers["x-vercel-protection-bypass"] = cfg["api_key"]

    try:
        req = urllib.request.Request(cfg["target_url"], data=body,
                                     headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status == 201:
                data = json.loads(resp.read())
                logger.info(
                    f"✓ {data.get('id','?')[:8]}  "
                    f"sev={data.get('severity','?'):8}  "
                    f"mitre={data.get('mitre_technique','?')}"
                )
                return True
            logger.warning(f"Unexpected HTTP {resp.status}")
            return False
    except urllib.error.HTTPError as e:
        logger.error(f"HTTP {e.code}: {e.read().decode(errors='replace')[:200]}")
        return False
    except Exception as e:
        logger.error(f"POST failed: {e}")
        return False

# ── Tail ──────────────────────────────────────────────────────────────────────

def tail_file(cfg: dict, logger: logging.Logger):
    log_path = cfg["log_file"]
    poll = cfg["poll_interval_seconds"]

    # Wait for log file to appear (useful on fresh VMs)
    waited = 0
    while not os.path.exists(log_path):
        if waited == 0:
            logger.warning(f"Waiting for {log_path} to appear...")
        time.sleep(5)
        waited += 5
        if waited > 60:
            logger.error(f"Log file {log_path} not found after 60s — exiting")
            sys.exit(1)

    logger.info(f"▶ Tailing {log_path}")
    logger.info(f"  target : {cfg['target_url']}")
    logger.info(f"  host   : {cfg['source_host']}")
    logger.info(f"  poll   : {poll}s")
    logger.info(f"  dry_run: {cfg['dry_run']}")

    with open(log_path, "r") as f:
        f.seek(0, 2)  # seek to end — only forward new lines
        while True:
            lines = f.readlines()
            for line in lines:
                event = parse_line(line, cfg["source_host"], cfg["source_type"])
                if event:
                    event["source_label"] = cfg.get("source_label", "")
                    post_event(event, cfg, logger)
            time.sleep(poll)

# ── Replay ────────────────────────────────────────────────────────────────────

def replay_file(path: str, cfg: dict, logger: logging.Logger):
    logger.info(f"Replaying {path} from start...")
    sent = 0
    with open(path) as f:
        for line in f:
            event = parse_line(line, cfg["source_host"], cfg["source_type"])
            if event:
                event["source_label"] = cfg.get("source_label", "")
                post_event(event, cfg, logger)
                sent += 1
                time.sleep(3.0)  # stay under Groq free tier limit (30 req/min)
    logger.info(f"Replay complete — {sent} events sent.")

# ── Entry point ───────────────────────────────────────────────────────────────
SIMULATE_USERS = ["root", "admin", "bhargav", "ubuntu", "ec2-user", "git"]
SIMULATE_IPS = ["185.220.101.42", "198.51.100.99", "203.0.113.45", "192.0.2.1", "198.18.0.55", "45.33.32.156"]
SIMULATE_PORTS = [22, 2222, 22222]
SIMULATE_TEMPLATES = [
    "Failed password for {user} from {ip} port {port} ssh2",
    "Failed password for invalid user {user} from {ip} port {port} ssh2",
    "Accepted publickey for {user} from {ip} port {port} ssh2",
    "Invalid user {user} from {ip} port {port}",
    "{user} : 3 incorrect password attempts ; TTY=pts/0 ; PWD=/home/{user} ; USER=root ; COMMAND=/bin/bash",
    "session opened for user {user} by (uid=0)",
    "session closed for user {user}",
]


def make_fake_line() -> str:
    now = datetime.datetime.utcnow()
    month = now.strftime("%b")
    day = str(now.day).rjust(2)
    ts = now.strftime("%H:%M:%S")
    host = "honeypot-sim"
    template = random.choice(SIMULATE_TEMPLATES)
    user = random.choice(SIMULATE_USERS)
    ip = random.choice(SIMULATE_IPS)
    port = random.choice(SIMULATE_PORTS)
    msg = template.format(user=user, ip=ip, port=port)
    if "password attempt" in template or "incorrect" in template:
        service = "sudo"
    else:
        service = "sshd[" + str(random.randint(10000, 99999)) + "]"
    return f"{month} {day} {ts} {host} {service}: {msg}"

def simulate(cfg: dict, logger: logging.Logger):
    interval = float(cfg.get("poll_interval_seconds", 5))
    logger.info("Simulate mode started. Generating fake auth events every %.1fs", interval)
    while True:
        line = make_fake_line()
        logger.info("SIM: %s", line)
        event = parse_line(line, cfg.get("source_host", "honeypot-sim"), "linux_auth")
        if event:
            event["source_label"] = cfg.get("source_label", "simulate")
            post_event(event, cfg, logger)
        time.sleep(interval)
def main():
    parser = argparse.ArgumentParser(description="SOC Triage forwarder agent")
    parser.add_argument("--config", default=os.path.join(os.path.dirname(__file__), "config.json"))
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--replay", metavar="FILE", help="Replay a log file from start then exit")
    parser.add_argument("--simulate", action="store_true", help="Generate fake auth events instead of tailing a file")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    logger = logging.getLogger("forwarder")

    cfg = load_config(args.config)
    if args.dry_run:
        cfg["dry_run"] = True

    if args.simulate:
        simulate(cfg, logger)
    elif args.replay:
        replay_file(args.replay, cfg, logger)
    else:
        tail_file(cfg, logger)

if __name__ == "__main__":
    main()


# ── Simulate mode ─────────────────────────────────────────────────────────────



