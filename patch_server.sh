#!/bin/bash
# Remove the while loop and retry logic from server.ts

sed -i 's/let attempts = 0;//g' server.ts
sed -i 's/const maxAttempts = 2; \/\/ Prevent absolute infinite loops, but allow up to 5 retries//g' server.ts
sed -i 's/let lastResult = "";//g' server.ts
sed -i 's/while (attempts < maxAttempts) {//g' server.ts
sed -i 's/attempts++;//g' server.ts
sed -i 's/lastResult = text;//g' server.ts

# We need to use awk or a more robust replacement for the if block
