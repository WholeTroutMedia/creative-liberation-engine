#!/usr/bin/env python3
"""
Sovereign AutoMesh — QuickBooks Online Sync Service
Handles OAuth 2.0, automated journal entry formatting, and .iif export files.
"""

import time
import json
import os
import urllib.parse
import logging
import requests
from typing import Dict, Any, Optional
import aiosqlite

DB_PATH = os.environ.get("DB_PATH", "/app/creative-liberation-engine/runtime/db/ledger.db")

class QuickBooksSyncService:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self.auth_url = "https://appcenter.intuit.com/connect/oauth2"
        self.token_url = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"

    async def get_config(self) -> Dict[str, Any]:
        """Retrieve current OAuth config and defaults from ledger.db."""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM quickbooks_config WHERE id = 1")
            row = await cursor.fetchone()
            return dict(row) if row else {}

    async def save_tokens(self, access_token: str, refresh_token: str, expires_in: int):
        """Save active OAuth tokens securely to the database."""
        expires_at = int(time.time()) + expires_in
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                UPDATE quickbooks_config
                SET access_token = ?, refresh_token = ?, token_expires_at = ?
                WHERE id = 1
            """, (access_token, refresh_token, expires_at))
            await db.commit()

    def get_authorization_url(self, client_id: str, redirect_uri: str, state: str = "secure_state") -> str:
        """Generate direct QuickBooks OAuth 2.0 authorization URL."""
        params = {
            "client_id": client_id,
            "response_type": "code",
            "scope": "com.intuit.quickbooks.accounting",
            "redirect_uri": redirect_uri,
            "state": state
        }
        return f"{self.auth_url}?{urllib.parse.urlencode(params)}"

    async def refresh_access_token(self, config: Dict[str, Any]) -> str:
        """Refresh the QuickBooks access token if expired, and save to DB."""
        now = int(time.time())
        # Buffer of 60 seconds
        if config.get("token_expires_at") and config["token_expires_at"] > now + 60:
            return config["access_token"]
            
        logging.info("QuickBooks: Token is expired or expiring soon. Refreshing...")
        token_url = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        payload = {
            "grant_type": "refresh_token",
            "refresh_token": config["refresh_token"]
        }
        
        resp = requests.post(token_url, data=payload, auth=(config["client_id"], config["client_secret"]), headers=headers)
        if resp.status_code != 200:
            raise Exception(f"Failed to refresh QuickBooks token: {resp.text}")
            
        token_data = resp.json()
        new_access = token_data["access_token"]
        new_refresh = token_data.get("refresh_token", config["refresh_token"])
        expires_in = token_data.get("expires_in", 3600)
        
        await self.save_tokens(new_access, new_refresh, expires_in)
        return new_access

    async def get_api_base_url(self, access_token: str, realm_id: str) -> str:
        """Probe the QuickBooks endpoints to determine if this is a Production or Sandbox connection."""
        env_override = os.environ.get("QUICKBOOKS_ENV")
        if env_override:
            if env_override.lower() in ["sandbox", "development", "dev"]:
                return "https://sandbox-quickbooks.api.intuit.com"
            return "https://quickbooks.api.intuit.com"

        # Probe Production first
        prod_url = f"https://quickbooks.api.intuit.com/v3/company/{realm_id}/query?minorversion=65"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "Content-Type": "text/plain"
        }
        try:
            resp = requests.post(prod_url, data="select Id from Account limit 1", headers=headers, timeout=5)
            if resp.status_code == 200:
                return "https://quickbooks.api.intuit.com"
        except Exception:
            pass
            
        return "https://sandbox-quickbooks.api.intuit.com"

    async def get_account_id_by_name(self, account_name: str, access_token: str, realm_id: str, base_url: Optional[str] = None) -> str:
        """Query QBO API to find the Account ID for a given account name."""
        if not base_url:
            base_url = await self.get_api_base_url(access_token, realm_id)
        url = f"{base_url}/v3/company/{realm_id}/query?minorversion=65"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "Content-Type": "text/plain"
        }
        escaped_name = account_name.replace("'", "\\'")
        query = f"select Id from Account where Name = '{escaped_name}'"
        
        resp = requests.post(url, data=query, headers=headers)
        if resp.status_code == 200:
            results = resp.json().get("QueryResponse", {}).get("Account", [])
            if results:
                return results[0]["Id"]
        
        # Also try to match by account number if the name has a prefix like "60000 "
        if " " in account_name:
            parts = account_name.split(" ", 1)
            acct_num = parts[0]
            if acct_num.isdigit():
                query = f"select Id from Account where AcctNum = '{acct_num}'"
                resp = requests.post(url, data=query, headers=headers)
                if resp.status_code == 200:
                    results = resp.json().get("QueryResponse", {}).get("Account", [])
                    if results:
                        return results[0]["Id"]
                        
        raise Exception(f"Account '{account_name}' not found in QuickBooks Online. Please verify your Chart of Accounts.")

    async def format_journal_entry_with_ids(self, trip: Dict[str, Any], mileage_id: str, bank_id: str) -> Dict[str, Any]:
        """Format a mileage deduction as a QBO Journal Entry using resolved account IDs."""
        deduction = round(trip["distance_miles"] * 0.70 * (trip.get("business_percentage", 100.0) / 100.0), 2)
        memo = f"AutoMesh Mileage Sync: {trip['start_time'][:10]} | {trip['distance_miles']} mi | {trip['notes'] or 'No description'}"
        
        return {
            "Line": [
                {
                    "Description": memo,
                    "Amount": deduction,
                    "DetailType": "JournalEntryLineDetail",
                    "JournalEntryLineDetail": {
                        "PostingType": "Debit",
                        "AccountRef": {
                            "value": mileage_id
                        }
                    }
                },
                {
                    "Description": memo,
                    "Amount": deduction,
                    "DetailType": "JournalEntryLineDetail",
                    "JournalEntryLineDetail": {
                        "PostingType": "Credit",
                        "AccountRef": {
                            "value": bank_id
                        }
                    }
                }
            ],
            "PrivateNote": memo
        }

    async def sync_trip(self, trip_id: int) -> tuple:
        """Sync a trip to QBO Online as a Journal Entry, refreshing tokens and updating DB."""
        # 1. Fetch trip details
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute("SELECT * FROM trips WHERE trip_id = ?", (trip_id,))
            trip_row = await cursor.fetchone()
            if not trip_row:
                raise Exception(f"Trip ID {trip_id} not found.")
            trip = dict(trip_row)

        # 2. Get QBO config
        config = await self.get_config()
        if not config or not config.get("access_token") or not config.get("realm_id"):
            raise Exception("QuickBooks is not authorized. Please run setup_quickbooks_oauth.py first.")

        # 3. Refresh token if needed
        access_token = await self.refresh_access_token(config)

        # 4. Resolve Account IDs dynamically
        realm_id = config["realm_id"]
        mileage_name = config.get("default_mileage_account", "60000 Travel & Entertainment")
        bank_name = config.get("default_bank_account", "10000 Checking")

        base_url = await self.get_api_base_url(access_token, realm_id)
        mileage_id = await self.get_account_id_by_name(mileage_name, access_token, realm_id, base_url)
        bank_id = await self.get_account_id_by_name(bank_name, access_token, realm_id, base_url)

        # 5. Format payload
        payload = await self.format_journal_entry_with_ids(trip, mileage_id, bank_id)

        # 6. Post to QBO API
        url = f"{base_url}/v3/company/{realm_id}/journalentry?minorversion=65"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "Content-Type": "application/json"
        }
        
        resp = requests.post(url, json=payload, headers=headers, timeout=15)
        if resp.status_code != 200:
            raise Exception(f"QuickBooks API Error: {resp.text}")

        # 7. Extract QBO transaction ID
        res_data = resp.json()
        qbo_id = res_data.get("JournalEntry", {}).get("Id")
        if not qbo_id:
            raise Exception("Failed to extract Journal Entry ID from QBO response.")

        # 8. Update database
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "UPDATE trips SET exported_qb = 1, qb_transaction_id = ? WHERE trip_id = ?",
                (qbo_id, trip_id)
            )
            await db.commit()

        return "Synced", qbo_id

    async def format_journal_entry(self, trip: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format a mileage deduction as a standard QuickBooks Journal Entry API payload.
        Debits Travel/Mileage Expense, Credits Owner Equity or bank account.
        """
        deduction = round(trip["distance_miles"] * 0.70 * (trip.get("business_percentage", 100.0) / 100.0), 2)
        memo = f"AutoMesh Mileage Sync: {trip['start_time'][:10]} | {trip['distance_miles']} mi | {trip['notes'] or 'No description'}"
        
        return {
            "Line": [
                {
                    "Description": memo,
                    "Amount": deduction,
                    "DetailType": "JournalEntryLineDetail",
                    "JournalEntryLineDetail": {
                        "PostingType": "Debit",
                        "AccountRef": {
                            "name": config.get("default_mileage_account", "60000 Travel & Entertainment")
                        }
                    }
                },
                {
                    "Description": memo,
                    "Amount": deduction,
                    "DetailType": "JournalEntryLineDetail",
                    "JournalEntryLineDetail": {
                        "PostingType": "Credit",
                        "AccountRef": {
                            "name": config.get("default_bank_account", "10000 Checking")
                        }
                    }
                }
            ],
            "PrivateNote": memo
        }

    async def format_expense(self, record: Dict[str, Any], config: Dict[str, Any]) -> Dict[str, Any]:
        """Format a vehicle maintenance entry into an QBO Expense (Purchase) API payload."""
        memo = f"AutoMesh Maintenance Sync: {record['service_type']} | {record['provider']} | Odo: {record['mileage_at_service']} mi"
        return {
            "PaymentType": "Cash",
            "AccountRef": {
                "name": config.get("default_bank_account", "10000 Checking")
            },
            "Line": [
                {
                    "Description": memo,
                    "Amount": record["cost"],
                    "DetailType": "AccountBasedExpenseLineDetail",
                    "AccountBasedExpenseLineDetail": {
                        "AccountRef": {
                            "name": "61000 Repairs & Maintenance"
                        }
                    }
                }
            ],
            "PrivateNote": memo,
            "TxnDate": record["service_date"]
        }

    def generate_iif_export(self, trips: list, config: Dict[str, Any]) -> str:
        """
        Generate Intuit Interchange Format (.iif) for direct manual QuickBooks Desktop
        or QuickBooks Online manual journal entry upload.
        """
        lines = []
        # IIF Headers
        lines.append("!TRNS\tTRNSTYPE\tDATE\tACCNT\tAMOUNT\tDOCNUM\tMEMO\tCLEAR")
        lines.append("!SPL\tTRNSTYPE\tDATE\tACCNT\tAMOUNT\tDOCNUM\tMEMO\tCLEAR")
        lines.append("!ENDTRNS")
        
        mileage_account = config.get("default_mileage_account", "60000 Travel & Entertainment")
        bank_account = config.get("default_bank_account", "10000 Checking")
        
        for idx, trip in enumerate(trips):
            dist = trip.get("distance_miles") or 0.0
            biz_pct = trip.get("business_percentage", 100.0) / 100.0
            deduction = round(dist * 0.70 * biz_pct, 2)
            
            if deduction <= 0:
                continue
                
            date_str = trip.get("end_time")[:10].replace("-", "/")
            doc_num = f"MV-{trip['trip_id']}"
            memo = f"AutoMesh Mileage: {dist} mi @ $0.70/mi | {trip.get('notes') or ''}"
            
            # Debit line (Transaction)
            lines.append(f"TRNS\tJOURNAL\t{date_str}\t{mileage_account}\t{deduction}\t{doc_num}\t{memo}\tN")
            # Credit line (Split)
            lines.append(f"SPL\tJOURNAL\t{date_str}\t{bank_account}\t-{deduction}\t{doc_num}\t{memo}\tN")
            lines.append("ENDTRNS")
            
        return "\n".join(lines)
