import os
import json

def find_profile():
    user_data_dir = os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data")
    if not os.path.exists(user_data_dir):
        print(f"Chrome User Data folder not found at {user_data_dir}")
        return
        
    print(f"Scanning profiles in {user_data_dir}...")
    
    # List all subdirectories
    subdirs = [d for d in os.listdir(user_data_dir) if os.path.isdir(os.path.join(user_data_dir, d))]
    
    candidate_profiles = ["Default"] + [d for d in subdirs if d.startswith("Profile ")]
    
    for prof in candidate_profiles:
        pref_path = os.path.join(user_data_dir, prof, "Preferences")
        if os.path.exists(pref_path):
            try:
                with open(pref_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                emails = []
                for domain in ["@gmail.com", "@cleengine.systems"]:
                    idx = 0
                    while True:
                        idx = content.find(domain, idx)
                        if idx == -1:
                            break
                        # Find start of email
                        start = idx
                        while start > 0 and content[start-1].isalnum() or content[start-1] in "._-":
                            start -= 1
                        email = content[start:idx+len(domain)]
                        if email not in emails and len(email) < 50:
                            emails.append(email)
                        idx += len(domain)
                
                if emails:
                    print(f"Profile: {prof} -> Emails: {', '.join(emails)}")
                else:
                    print(f"Profile: {prof} -> (No Google emails found)")
            except Exception as e:
                print(f"Profile: {prof} -> Error: {e}")

if __name__ == "__main__":
    find_profile()
