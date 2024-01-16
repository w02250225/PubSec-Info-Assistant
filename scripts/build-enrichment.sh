# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

#!/bin/bash
set -e

figlet Build Enrichment WebApp

# Get the directory that this script is in
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
source "${DIR}"/../scripts/load-env.sh
BINARIES_OUTPUT_PATH="${DIR}/../artifacts/build/"
ENRICHMENT_ROOT_PATH="${DIR}/..//app/enrichment"

# Clean previous runs on a dev machine
rm -f ${BINARIES_OUTPUT_PATH}/enrichment.zip
mkdir -p ${BINARIES_OUTPUT_PATH}

# zip the enrichment app content from app/enrichments to the .artifacts folders
cd ${ENRICHMENT_ROOT_PATH}
cp  ../../functions/shared_code/status_log.py ./shared_code
cp  ../../functions/shared_code/utilities_helper.py ./shared_code
zip -r ${BINARIES_OUTPUT_PATH}/enrichment.zip . -x "models/*" @ 2>&1 | pv > /dev/null
echo "Successfully zipped enrichment app"
echo -e "\n"
