# Copyright (c) Microsoft Corporation.
# Licensed under the MIT license.


#!/bin/bash
set -e

if [ -n "${IN_AUTOMATION}" ]
then
    az login --service-principal -u "$ARM_CLIENT_ID" -p "$ARM_CLIENT_SECRET" --tenant "$ARM_TENANT_ID"
    az account set -s "$ARM_SUBSCRIPTION_ID"
fi

# Get the directory that this script is in
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
source "${DIR}/load-env.sh"
source "${DIR}/environments/infrastructure.env"

search_url="https://${AZURE_SEARCH_SERVICE}.search.windows.net"

# Get the Search Admin Key
search_key=$(az search admin-key show --resource-group $RESOURCE_GROUP_NAME --service-name $AZURE_SEARCH_SERVICE --query primaryKey -o tsv)
export AZURE_SEARCH_ADMIN_KEY=$search_key

indexer_all_json=$(cat ${DIR}/../azure_search/create_all_indexer.json | envsubst)
indexer_all_name=$(echo $indexer_all_json | jq -r .name )

# Run the all files indexer...
echo "Running indexer $indexer_all_name..."
curl -s -X POST --header "Content-Type: application/json" --header "api-key: $AZURE_SEARCH_ADMIN_KEY" --data "" $search_url/indexers/$indexer_all_name/run?api-version=2021-04-30-Preview