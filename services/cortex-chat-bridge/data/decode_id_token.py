import os
import json
import base64

id_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczpcL1wvbmhrZmNmLXBmLm15c2hvcGlmeS5jb21cL2FkbWluIiwiZGVzdCI6Imh0dHBzOlwvXC9uaGtmY2YtcGYubXlzaG9waWZ5LmNvbSIsImF1ZCI6Ijk3YjljYzdmZDU4YzYzNjVkZjk0YWY5NWU1MDYxYjhlIiwic3ViIjoiOTA4Njc5MjUwNDAiLCJleHAiOjE3Nzk2MzkyNjYsIm5iZiI6MTc3OTYzOTIwNiwiaWF0IjoxNzc5NjM5MjA2LCJqdGkiOiJmOGJlY2RmNC05NzExLTQ4MzItOTU4Ny05NDE4MjFjYjk5NmQiLCJzaWQiOiJjMGU1NTk2OC1kMjE5LTQyODEtODY3Ny0wOThhNWMxMzA0YmMiLCJzaWciOiJkZWU1Njk1NDNhZTMxMjliN2ZmZTIwMzQ5NDc1OWRlNDM4YzVhYzk2NjA4ZTlkMTQyYTc3ZTNmOWJlYWFiZWUxIn0.tuxkcF5IOYWXyqlqhHzJ6EAT3SJqGdSa4GIquCR2aVI"

payload = id_token.split(".")[1]
# Fix padding
payload += "=" * ((4 - len(payload) % 4) % 4)
decoded = base64.b64decode(payload).decode("utf-8")
print("Decoded ID Token:")
print(json.dumps(json.loads(decoded), indent=4))
