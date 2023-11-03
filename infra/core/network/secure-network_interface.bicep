param name string

resource networkInterface 'Microsoft.Network/networkInterfaces@2021-08-01' existing = {
  name: name
}

output ipAddress string = networkInterface.properties.ipConfigurations[0].properties.privateIPAddress
