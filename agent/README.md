# SOC Triage Forwarder Agent

Tails a log file and POSTs each new line to the SOC Triage ingest API.

---

## Quick Reference — Copy-Paste Commands

### Start everything (run these in Cloud Shell)

```bash
# 1. Start fake log generator
bash -c '
while true; do
  IP="$(shuf -i 1-254 -n1).$(shuf -i 1-254 -n1).$(shuf -i 1-254 -n1).$(shuf -i 1-254 -n1)"
  USER=$(shuf -e root admin ubuntu deploy git oracle test -n1)
  echo "$(date +"%b %e %T") honeypot-01 sshd[$$]: Failed password for $USER from $IP port 22 ssh2" >> /tmp/fake-auth.log
  sleep 4
done
' &

# 2. Start forwarder
nohup python3 ~/soc-triage/agent/forwarder.py > /tmp/forwarder.log 2>&1 &

# 3. Watch events being sent
tail -f /tmp/forwarder.log
```

### Stop everything

```bash
pkill -f forwarder.py
pkill -f fake-auth.log
```

### Check if running

```bash
ps aux | grep -E "forwarder|fake-auth" | grep -v grep
```

### Watch logs live

```bash
tail -f /tmp/forwarder.log
```

### Clear the fake log (start fresh)

```bash
> /tmp/fake-auth.log
```

### Replay an existing log file (send all lines at once)

```bash
python3 ~/soc-triage/agent/forwarder.py --replay /tmp/fake-auth.log
```

### Dry run (parse but do not POST)

```bash
python3 ~/soc-triage/agent/forwarder.py --dry-run
```

---

## Config (agent/config.json)

| Field | Description |
|---|---|
| `target_url` | Your Vercel app ingest URL |
| `source_host` | Name shown in SOC app e.g. `honeypot-01` |
| `source_type` | Event type tag e.g. `linux_auth` |
| `log_file` | Path to tail — use `/tmp/fake-auth.log` for testing |
| `poll_interval_seconds` | How often to check for new lines (default 5) |
| `api_key` | Vercel protection bypass secret |
| `dry_run` | `true` = parse only, no POSTs |

---

## Run as systemd service (on a real Linux VM)

```bash
sudo nano /etc/systemd/system/soc-forwarder.service
```

```ini
[Unit]
Description=SOC Triage Forwarder
After=network.target

[Service]
ExecStart=/usr/bin/python3 /home/youruser/soc-triage-agent/forwarder.py
WorkingDirectory=/home/youruser/soc-triage-agent
Restart=always
RestartSec=10
User=youruser

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable soc-forwarder
sudo systemctl start soc-forwarder
sudo journalctl -u soc-forwarder -f
```

---

## Notes

- Cloud Shell sleeps after ~1hr inactivity — processes stop. Re-run start commands when you return.
- Events already in Supabase are permanent — only new events stop when forwarder is off.
- Each forwarder session auto-tags events with `session-YYYY-MM-DD` so you can tell sessions apart on the `/hosts/honeypot-01` timeline.
- To delete test events: go to your Supabase dashboard → Table Editor → events → delete rows.
