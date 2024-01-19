# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

#!/bin/bash
set -e

figlet Build WebApp

# Get the directory that this script is in
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
source "${DIR}"/../scripts/load-env.sh
BINARIES_OUTPUT_PATH="${DIR}/../artifacts/build/"

# Clean previous runs on a dev machine
rm -f ${BINARIES_OUTPUT_PATH}/webapp.zip
mkdir -p ${BINARIES_OUTPUT_PATH}

# build frontend
cd app/frontend
npm install
npm run build

# zip the webapp content from app/backend to the ./artifacts folders
cd ../backend
zip -r ${BINARIES_OUTPUT_PATH}/webapp.zip . 2>&1 | pv > /dev/null
cd $DIR
echo "Successfully zipped webapp"
echo -e "\n"