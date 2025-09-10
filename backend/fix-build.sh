#!/bin/bash

# Fix unused parameters by prefixing with underscore
sed -i '' 's/app\.get.*\/api.*, (req,/app.get('\''\/api'\'', (_req,/' src/index.ts
sed -i '' 's/export const errorHandler.*req,/export const errorHandler = (_req,/' src/middleware/errorHandler.ts
sed -i '' 's/, next:/, _next:/' src/middleware/errorHandler.ts
sed -i '' 's/router\.get.*\/health.*, async (req,/router.get('\''\/health'\'', async (_req,/' src/routes/health.ts
sed -i '' 's/, next)/, _next)/' src/routes/ptbExecute.ts

# Remove unused imports
sed -i '' '/^import.*getPlaygroundWallet.*from/d' src/routes/deployV2.ts
sed -i '' '/^import.*getPlaygroundPrivateKey.*from/d' src/services/deployService.ts
sed -i '' 's/, PLAYGROUND_WALLET_CONFIG//' src/services/iotaDeployService.ts
sed -i '' 's/import { rm,.*stat }/import { mkdir, writeFile, readFile }/' src/services/compileService.ts

# Remove unused variables
sed -i '' '/const.*PLAYGROUND_WALLET_CONFIG/d' src/services/iotaDeployService.ts
sed -i '' 's/let inFunction = false;/\/\/ let inFunction = false;/' src/services/compileService.ts
sed -i '' 's/inFunction = true;/\/\/ inFunction = true;/' src/services/compileService.ts
sed -i '' 's/inFunction = false;/\/\/ inFunction = false;/' src/services/compileService.ts

# Fix return statements in ptbExecute routes
# This needs manual fixing in the actual files

echo "Basic fixes applied. Some manual fixes still needed for:"
echo "- Return statements in ptbExecute.ts"
echo "- Type issues in iotaDeployService.ts"
echo "- Array type issues in compileService.ts"
