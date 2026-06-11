import os
import requests
import json
from dotenv import load_dotenv
 
# Load credentials from your .env file
load_dotenv(dotenv_path=".env")
 
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
ACCESS_TOKEN = os.getenv("ACCESS_TOKEN")
CLIENT_AUTH_URL = os.getenv("CLIENT_AUTH_URL")
CLIENT_AUTH_EMAIL = os.getenv("CLIENT_AUTH_EMAIL")
CLIENT_AUTH_PASSWORD = os.getenv("CLIENT_AUTH_PASSWORD")
 
print("DEBUG: cwd=", os.getcwd())
print("DEBUG: .env exists:", os.path.exists(".env"))
with open('.env', 'r', encoding='utf-8') as f:
    raw_env = f.read()
print("DEBUG: .env contents:\n" + raw_env)

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Missing Supabase credentials in .env file or env not loaded.")
    print(f"SUPABASE_URL present: {bool(SUPABASE_URL)}")
    print(f"SUPABASE_ANON_KEY present: {bool(SUPABASE_KEY)}")
    exit(1)

if not ACCESS_TOKEN and not CLIENT_AUTH_URL:
    print("ERROR: Set either ACCESS_TOKEN or CLIENT_AUTH_URL in .env.")
    exit(1)
 
# ==========================================
# 1. SET THE EDGE FUNCTION NAME HERE
# ==========================================
FUNCTION_NAME = "top-performer-badging" # e.g. "parse-candidate-resume"
 
# ==========================================
# 2. ADD ANY JSON PAYLOAD DATA HERE
# ==========================================
PAYLOAD = {
    #"worker_id": "935871bb-680e-4b7e-b5d7-50d1b2ccb62f",
     "worker_id": "d32167fe-c854-422b-b4ce-b0785c2b524d",
    "event": "manual_test"
}
 
def get_access_token() -> str:
    if ACCESS_TOKEN:
        print("Using ACCESS_TOKEN from .env")
        return ACCESS_TOKEN.strip()

    if not CLIENT_AUTH_EMAIL or not CLIENT_AUTH_PASSWORD:
        print("ERROR: Set CLIENT_AUTH_EMAIL and CLIENT_AUTH_PASSWORD in .env.")
        exit(1)

    print(f"Calling client auth endpoint: {CLIENT_AUTH_URL}")
    auth_headers = {
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    auth_payload = {
        "email": CLIENT_AUTH_EMAIL,
        "password": CLIENT_AUTH_PASSWORD,
    }

    auth_response = requests.post(CLIENT_AUTH_URL, headers=auth_headers, json=auth_payload, timeout=15)
    print(f"Client auth status: {auth_response.status_code}")
    print("Client auth raw response:")
    print(auth_response.text)
    auth_response.raise_for_status()

    try:
        auth_data = auth_response.json()
    except json.JSONDecodeError:
        print("ERROR: client-auth did not return JSON.")
        print(auth_response.text)
        exit(1)

    token = (
        auth_data.get("access_token")
        or auth_data.get("data", {}).get("access_token")
        or auth_data.get("session", {}).get("access_token")
    )

    if not token:
        print("ERROR: Could not find access_token in client-auth response.")
        print(json.dumps(auth_data, indent=2))
        exit(1)

    return token

 
print(f"Attempting to test Edge Function: {FUNCTION_NAME}...")

endpoint = f"{SUPABASE_URL}/functions/v1/{FUNCTION_NAME}"

access_token = get_access_token()
 
headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}
 
try:
    print(f"POST {endpoint}")
    response = requests.post(endpoint, headers=headers, json=PAYLOAD, timeout=15)
   
    print("\n--- SERVER RESPONSE ---")
    print(f"Status Code: {response.status_code}")
   
    try:
        # Try to parse the response as JSON
        data = response.json()
        print("Response JSON:")
        print(json.dumps(data, indent=2))
    except json.JSONDecodeError:
        # If it's not JSON, print the raw text
        print("Raw Response Text:")
        print(response.text)
 
except Exception as e:
    print("\nCRITICAL ERROR: Could not reach the Edge Function.")
    print(str(e))
