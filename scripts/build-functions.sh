# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.

#!/bin/bash
set -e

figlet Build

# Get the directory that this script is in
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
source "${DIR}"/../scripts/load-env.sh
BINARIES_OUTPUT_PATH="${DIR}/../artifacts/build/"
FUNCTIONS_ROOT_PATH="${DIR}/../functions"

# reset the current directory on exit using a trap so that the directory is reset even on error
#function finish {
#  popd > /dev/null
#}
#trap finish EXIT

# Clean previous runs on a dev machine
rm -f ${BINARIES_OUTPUT_PATH}/functions.zip && mkdir -p ${BINARIES_OUTPUT_PATH}

# Build the Azure Functions
cd ${FUNCTIONS_ROOT_PATH}
zip -r ${BINARIES_OUTPUT_PATH}/functions.zip . -x ".venv/*" 2>&1 | pv > /dev/null
