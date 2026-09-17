#!/usr/bin/env python3
"""
TB Intelligence Hub — Database Cleanup Script
Wipes all portfolio data for a fresh testing slate.

KEEPS:
  ✓ Admin user (admin@examplepe.com)
  ✓ Business functions (9 seeded functions)

DELETES:
  ✗ All companies
  ✗ All tools + tool_functions
  ✗ All adoption snapshots
  ✗ All governance contacts
  ✗ All tool goals
  ✗ All time_to_value records
  ✗ All kpi_targets
  ✗ All upload jobs + uploaded files
  ✗ All audit log entries
  ✗ All user_companies assignments
  ✗ All non-admin users (optional, controlled by flag)

Usage:
  cd backend
  python cleanup_db.py                    # Clean portfolio data, keep all users
  python cleanup_db.py --delete-users     # Also delete non-admin users
  python cleanup_db.py --dry-run          # Preview what would be deleted
"""

import argparse
import os
import sys
import glob
from datetime import datetime

# ─── Parse args ───
parser = argparse.ArgumentParser(description="Clean up TB Intelligence Hub database for testing")
parser.add_argument("--delete-users", action="store_true", help="Also delete non-admin users")
parser.add_argument("--dry-run", action="store_true", help="Preview only, don't delete anything")
parser.add_argument("--yes", "-y", action="store_true", help="Skip confirmation prompt")
args = parser.parse_args()

# ─── Load DB URL from .env or environment ───
DB_URL = os.environ.get("DATABASE_URL")

if not DB_URL:
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("DATABASE_URL=") and not line.startswith("#"):
                    DB_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break

if not DB_URL:
    print("✗ DATABASE_URL not found. Set it in .env or environment.")
    sys.exit(1)

# Convert async URL to sync for this script
SYNC_URL = DB_URL.replace("postgresql+asyncpg://", "postgresql://")
print(f"  Database: {SYNC_URL.split('@')[1] if '@' in SYNC_URL else SYNC_URL}")

# ─── Connect ───
try:
    import psycopg2
except ImportError:
    print("Installing psycopg2-binary...")
    os.system(f"{sys.executable} -m pip install psycopg2-binary --break-system-packages -q")
    import psycopg2

conn = psycopg2.connect(SYNC_URL)
conn.autocommit = False
cur = conn.cursor()

# ─── Count what exists ───
TABLES_TO_CLEAN = [
    ("adoption_snapshots", "Adoption Snapshots"),
    ("kpi_targets", "KPI Targets"),
    ("tool_goals", "Tool Goals"),
    ("tool_functions", "Tool Functions"),
    ("time_to_value", "Time to Value"),
    ("governance_contacts", "Governance Contacts"),
    ("upload_jobs", "Upload Jobs"),
    ("tools", "Tools"),
    ("user_companies", "User-Company Assignments"),
    ("companies", "Companies"),
    ("audit_log", "Audit Log"),
    ("refresh_tokens", "Refresh Tokens"),
]

print(f"\n{'='*50}")
print(f"  TB Intelligence Hub — Database Cleanup")
print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"{'='*50}\n")

total = 0
for table, label in TABLES_TO_CLEAN:
    try:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        count = cur.fetchone()[0]
    except Exception:
        conn.rollback()
        count = 0
    if count > 0:
        print(f"  {label:30s} {count:>6,} records")
    total += count

# Count users
cur.execute("SELECT COUNT(*) FROM users WHERE role != 'tb_admin'")
non_admin_users = cur.fetchone()[0]
cur.execute("SELECT COUNT(*) FROM users WHERE role = 'tb_admin'")
admin_count = cur.fetchone()[0]

if args.delete_users and non_admin_users > 0:
    print(f"  {'Non-admin Users':30s} {non_admin_users:>6,} records  ← WILL DELETE")
    total += non_admin_users

print(f"\n  {'TOTAL TO DELETE':30s} {total:>6,} records")
print(f"  {'Admin users (preserved)':30s} {admin_count:>6,}")

cur.execute("SELECT COUNT(*) FROM business_functions")
bf_count = cur.fetchone()[0]
print(f"  {'Business functions (preserved)':30s} {bf_count:>6,}")

# Check for uploaded files
upload_dir = os.path.join(os.path.dirname(__file__), "uploads")
upload_files = glob.glob(os.path.join(upload_dir, "*")) if os.path.exists(upload_dir) else []
if upload_files:
    print(f"  {'Upload files on disk':30s} {len(upload_files):>6,} files")

if total == 0:
    print("\n✓ Database is already clean. Nothing to delete.")
    conn.close()
    sys.exit(0)

if args.dry_run:
    print("\n  [DRY RUN] No changes made.")
    conn.close()
    sys.exit(0)

# ─── Confirm ───
if not args.yes:
    print(f"\n⚠  This will permanently delete {total:,} records.")
    response = input("   Continue? (yes/no): ").strip().lower()
    if response not in ("yes", "y"):
        print("   Cancelled.")
        conn.close()
        sys.exit(0)

# ─── Delete in dependency order ───
print("\n  Cleaning...")
try:
    for table, label in TABLES_TO_CLEAN:
        try:
            cur.execute(f"DELETE FROM {table}")
            deleted = cur.rowcount
            if deleted > 0:
                print(f"    ✓ {label}: {deleted:,} deleted")
        except Exception as e:
            conn.rollback()
            print(f"    ✗ {label}: {e}")

    if args.delete_users:
        cur.execute("DELETE FROM users WHERE role != 'tb_admin'")
        deleted = cur.rowcount
        if deleted > 0:
            print(f"    ✓ Non-admin users: {deleted:,} deleted")

    conn.commit()
    print(f"\n✅ Database cleaned successfully.")

    # Clean upload files
    if upload_files:
        for f in upload_files:
            try:
                os.remove(f)
            except Exception:
                pass
        print(f"   Removed {len(upload_files)} upload files from disk.")

except Exception as e:
    conn.rollback()
    print(f"\n✗ Error: {e}")
    sys.exit(1)
finally:
    cur.close()
    conn.close()

print(f"\n  Admin login preserved: admin@examplepe.com / TBAdmin2026!")
print(f"  Business functions preserved: {bf_count} functions")
print(f"  Ready for fresh data upload.\n")