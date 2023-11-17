#!/bin/bash

# Get the directory of the current script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Read the old IP address from the file
OLD_IP_ADDR=$(< "$DIR/ip_addr.txt")

# Get the current external IP address
CURR_IP_ADDR=$(curl -s ifconfig.me)

# Compare the old and current IP address
if [ "$OLD_IP_ADDR" != "$CURR_IP_ADDR" ]; then
    # Attempt to remove the old IP address rule and continue on failure
    echo "Removing old IP address rule for IP: $OLD_IP_ADDR..."
    az cognitiveservices account network-rule remove --name CADISOPENAIAZS01 --resource-group RGDOPENAIAZS01 --ip-address $OLD_IP_ADDR || true

    # Update the ip_addr.txt file with the current IP address
    echo "Updating IP address file with new IP: $CURR_IP_ADDR..."
    echo $CURR_IP_ADDR > "$DIR/ip_addr.txt"
    
    # Add the new IP address rule
    echo "Adding new IP address rule for IP: $CURR_IP_ADDR..."
    az cognitiveservices account network-rule add --name CADISOPENAIAZS01 --resource-group RGDOPENAIAZS01 --ip-address $CURR_IP_ADDR
fi

az webapp config access-restriction remove -g rgdsibinfoasstazs01 -n infoasst-web-kr839 --rule-name Codespace
az webapp config access-restriction add -g rgdsibinfoasstazs01 -n infoasst-web-kr839 --rule-name Codespace --action Allow --ip-address $CURR_IP_ADDR --priority 250

az webapp config access-restriction remove -g rgdsibinfoasstazs01 -n infoasst-web-gpt4-kr839 --rule-name Codespace
az webapp config access-restriction add -g rgdsibinfoasstazs01 -n infoasst-web-gpt4-kr839 --rule-name Codespace --action Allow --ip-address $CURR_IP_ADDR --priority 250

az webapp config access-restriction remove -g rgdsibinfoasstazs01 -n infoasst-enrichmentweb-kr839 --rule-name Codespace
az webapp config access-restriction add -g rgdsibinfoasstazs01 -n infoasst-enrichmentweb-kr839 --rule-name Codespace --action Allow --ip-address $CURR_IP_ADDR --priority 250