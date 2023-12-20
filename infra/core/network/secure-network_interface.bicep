param name string

var ipAddress = networkInterface.properties.ipConfigurations[0].properties.privateIPAddress
var ipAddress2 = (length(networkInterface.properties.ipConfigurations) > 1) ? networkInterface.properties.ipConfigurations[1].properties.privateIPAddress: 'none'

resource networkInterface 'Microsoft.Network/networkInterfaces@2021-08-01' existing = {
  name: name
}

output ipAddress string = ipAddress
output ipAddress2 string = ipAddress2
