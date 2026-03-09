"""
Oil Depletion Tracker — Daily Telegram Notification Script
Runs via GitHub Actions every day at 7:00 AM (Lagos time).
Sends a full briefing to your Telegram chat.
"""

import json
import os
import requests
from datetime import datetime, timezone, timedelta

# ── Config ────────────────────────────────────────────────
TOKEN   = os.environ["TELEGRAM_TOKEN"]
CHAT_ID = os.environ["TELEGRAM_CHAT_ID"]
API_URL = f"https://api.telegram.org/bot{TOKEN}/sendMessage"

# Lagos time = UTC+1
LAGOS_TZ = timezone(timedelta(hours=1))
TODAY    = datetime.now(LAGOS_TZ).strftime("%A, %d %B %Y")

# ── Load data ─────────────────────────────────────────────
with open("alerts/countries.json") as f:
    countries = json.load(f)

# ── Categorise ────────────────────────────────────────────
critical   = [c for c in countries if c["status"] == "CRITICAL"]
watch      = [c for c in countries if c["status"] == "WATCH"]
targets    = [c for c in countries if c["dangoteOpportunity"]]
targets_sorted = sorted(targets, key=lambda c: c["opportunityScore"], reverse=True)

# ── Helper: send a Telegram message ──────────────────────
def send(text: str):
    print(f"Sending to chat_id={CHAT_ID}...")
    resp = requests.post(API_URL, json={
        "chat_id":    CHAT_ID,
        "text":       text,
        "parse_mode": "HTML",
    })
    print(f"Response {resp.status_code}: {resp.text}")
    if not resp.ok:
        raise Exception(f"Telegram error: {resp.status_code} — {resp.text}")
    print("✅ Message sent.")

# ── Message 1: Daily Header ───────────────────────────────
header = (
    f"⛽ <b>OIL DEPLETION DAILY BRIEFING</b>\n"
    f"📅 {TODAY}\n"
    f"━━━━━━━━━━━━━━━━━━━━━\n\n"
    f"Good morning! Here is your daily oil intelligence report.\n\n"
    f"🚨 <b>CRITICAL countries:</b> {len(critical)}\n"
    f"⚠️  <b>WATCH countries:</b>    {len(watch)}\n"
    f"🎯 <b>Dangote targets:</b>     {len(targets)}\n"
)
send(header)

# ── Message 2: CRITICAL Countries ─────────────────────────
if critical:
    lines = ["🚨 <b>CRITICAL — Below 45-Day Reserve Threshold</b>\n"]
    for c in sorted(critical, key=lambda x: x["reserveDays"]):
        lines.append(
            f"{c['flag']} <b>{c['name']}</b>\n"
            f"   ⏳ <b>{c['reserveDays']} days</b> of supply remaining\n"
            f"   📦 Import dependency: {c['importDependency']}%\n"
            f"   ⚠️ {c['alert']}\n"
        )
    send("\n".join(lines))

# ── Message 3: Top Dangote Deal Opportunities ─────────────
opp_lines = ["🎯 <b>TOP DANGOTE DEAL OPPORTUNITIES TODAY</b>\n"]
for i, c in enumerate(targets_sorted[:6], 1):
    bar_filled = round(c["opportunityScore"] / 10)
    bar = "🟧" * bar_filled + "⬜" * (10 - bar_filled)
    opp_lines.append(
        f"<b>#{i} {c['flag']} {c['name']}</b>\n"
        f"   Score: {bar} {c['opportunityScore']}/100\n"
        f"   ⏳ {c['reserveDays']} days left  |  📦 {c['importDependency']}% imported\n"
        f"   💡 {c['notes']}\n"
    )
send("\n".join(opp_lines))

# ── Message 4: Watch List ─────────────────────────────────
if watch:
    watch_lines = ["⚠️ <b>WATCH LIST — 45 to 89 Days Remaining</b>\n"]
    for c in sorted(watch, key=lambda x: x["reserveDays"]):
        dangote_tag = "🎯 Dangote target" if c["dangoteOpportunity"] else ""
        watch_lines.append(
            f"{c['flag']} <b>{c['name']}</b> — {c['reserveDays']} days  {dangote_tag}"
        )
    send("\n".join(watch_lines))

# ── Message 5: Brokerage Action Tip ──────────────────────
tip_country = targets_sorted[0] if targets_sorted else None
if tip_country:
    tip = (
        f"💼 <b>TODAY'S BROKERAGE ACTION TIP</b>\n\n"
        f"Focus on <b>{tip_country['flag']} {tip_country['name']}</b> today.\n\n"
        f"With only <b>{tip_country['reserveDays']} days</b> of supply left and "
        f"<b>{tip_country['importDependency']}%</b> import dependency, "
        f"they urgently need a reliable supplier.\n\n"
        f"📌 <b>Your move:</b>\n"
        f"1. Contact {tip_country['name']}'s national energy ministry or state oil company\n"
        f"2. Present the supply gap data\n"
        f"3. Propose a Dangote Refinery supply connection\n"
        f"4. Structure your brokerage commission on the deal\n\n"
        f"🏭 <b>Dangote Refinery</b> — 650,000 BPD capacity, ready to export.\n\n"
        f"🌐 Track your dashboard: https://dinnudaniel.github.io/Oil-delepletion-tracker-/"
    )
    send(tip)

print("All messages sent successfully.")
