param location string
param nsgName string
param tags object = {}

resource nsg 'Microsoft.Network/networkSecurityGroups@2020-05-01' = {
  name: nsgName
  location: location
  tags: tags
  properties: {
    securityRules: []
  }
}

output id string = nsg.id
output name string = nsg.name
