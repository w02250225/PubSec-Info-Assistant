#!/bin/bash

#IP_ADDR=$(curl -s ifconfig.me)/32

#az webapp config access-restriction remove -g rgdsibinfoasstazs01 -n infoasst-web-kr839 --rule-name Codespace
#az webapp config access-restriction add -g rgdsibinfoasstazs01 -n infoasst-web-kr839 --rule-name Codespace --action Allow --ip-address $IP_ADDR --priority 250

IP_ADDR=$(curl -s ifconfig.me)

az cognitiveservices account network-rule add --name CADISOPENAIAZS01 --resource-group RGDOPENAIAZS01 --ip-address $IP_ADDR