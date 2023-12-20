param vnetLinkName string
param location string
param name string
param vnetResourceId string
param tags object = {}

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2020-06-01' = {
  name: name
  location: location
  tags: tags
  properties: {}
}

resource virtualNetworkLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = {
  parent: privateDnsZone
  name: vnetLinkName
  location: location
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id:  vnetResourceId
    }
  }
}

output id string = privateDnsZone.id
output name string = privateDnsZone.name
