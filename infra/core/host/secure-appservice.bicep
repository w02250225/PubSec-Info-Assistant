param name string
param location string
param tags object = {}
param dnsZoneName string
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
    serviceName: name
    location: location
    tags: tags
    serviceResourceId: appService.id
    subnetResourceId: subnetResourceIdInbound
    groupId: 'sites'
  }
}

module self '../dns/secure-private_dns_zone-record.bicep' = {
  name: 'a-record-${appService.name}-self'
  params: {
    hostname: appService.name
    privateDnsZoneName: dnsZoneName
    ipAddress: privateEndpoint.outputs.ipAddress
  }
  dependsOn: [
    privateEndpoint
  ]
}

module scm '../dns/secure-private_dns_zone-record.bicep' = {
  name: 'a-record-${appService.name}-scm'
  params: {
    hostname: '${appService.name}.scm'
    privateDnsZoneName: dnsZoneName
    ipAddress: privateEndpoint.outputs.ipAddress
  }
  dependsOn: [
    privateEndpoint
  ]
}

resource virtualNetworkConnection 'Microsoft.Web/sites/virtualNetworkConnections@2022-09-01' = {
  parent: appService
  name: 'virtual-network-connection'
  location: location
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
