param name string
param location string
param tags object = {}
param subnetResourceIdOutbound string
param subnetResourceIdInbound string
param appServicePlanId string

resource appService 'Microsoft.Web/sites@2022-03-01' = {
  name: name
  location: location
  properties: {
    serverFarmId: appServicePlanId
    publicNetworkAccess: 'Enabled'
    virtualNetworkSubnetId: subnetResourceIdOutbound
  }
}

module privateEndpoint '../network/secure-private_endpoint.bicep' = {
  name: 'private-endpoint-${name}'
  params: {
    name: name
    location: location
    tags: tags
    serviceResourceId: appService.id
    subnetResourceId: subnetResourceIdInbound
    groupId: 'sites'
  }
}

resource virtualNetworkConnection 'Microsoft.Web/sites/virtualNetworkConnections@2022-09-01' = {
  parent: appService
  name: 'virtual-network-connection'
  properties: {
    vnetResourceId: subnetResourceIdOutbound
    isSwift: true
  }
}

output ipAddress string = privateEndpoint.outputs.ipAddress
output name string = appService.name
output id string = appService.id
output uri string = 'https://${appService.properties.defaultHostName}'
output fqdn string = appService.properties.defaultHostName
