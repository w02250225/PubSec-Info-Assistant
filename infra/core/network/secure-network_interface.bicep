param name string

var ipAddress = networkInterface.properties.ipConfigurations[0].properties.privateIPAddress
var ipAddress2 = empty(networkInterface.properties.ipConfigurations[1]) ? 'none' : networkInterface.properties.ipConfigurations[1].properties.privateIPAddress

resource networkInterface 'Microsoft.Network/networkInterfaces@2021-08-01' existing = {
  name: name
}

output ipAddress string = ipAddress
output ipAddress2 string = ipAddress2
